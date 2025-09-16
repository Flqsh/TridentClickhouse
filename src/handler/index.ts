// ErlcPoller.ts
import crypto from 'crypto';
import type { ClickHouseClient } from '@clickhouse/client';
import type { Model, Document } from 'mongoose';
import type { RestManager } from '@discordeno/rest';
import { ERLC } from '../data/models/erlc.js';
import { PRCClient } from 'erlc.ts';
import { getPRCClient } from '../utils/PRCClients.js';

// If you have types from erlc.ts, import them here.
// For now we'll keep them loose enough to work without the package types.
// type PRCClient = {
//     getServerStatus: () => Promise<any>;
//     getCommandLogs: () => Promise<any>;
//     getJoinLogs: () => Promise<any>;
//     getKillLogs: () => Promise<any>;
//     getModCalls: () => Promise<any>;
//     getPlayers: () => Promise<any>;
//     getQueue: () => Promise<any>;
//     getStaff: () => Promise<any>;
//     getVehicles: () => Promise<any>;
//     getBans: () => Promise<any>;
// };

export interface ErlcDoc extends Document {
    guildId: string;
    accessToken: string; // we hash this for storage auditing; not sent to the PRC client
}

type RouteResult = {
    route: string;
    payload: unknown;
    ok: boolean;
};

export interface ErlcPollerOptions {
    tickMs?: number;
    globalMaxConcurrency?: number;
    perTokenMaxConcurrency?: number;
    maxRetries?: number;
    backoffBaseMs?: number;
    // If your rest.getPRCClient signature differs, override this.
    getClient?: (guildId: string, accessToken: string) => Promise<PRCClient> | PRCClient;
}

const DEFAULTS: Required<ErlcPollerOptions> = {
    tickMs: 15_000,
    globalMaxConcurrency: 10,
    perTokenMaxConcurrency: 3,
    maxRetries: 3,
    backoffBaseMs: 400,
    getClient: getPRCClient,
};

// ---------------------------
// Tiny semaphore
// ---------------------------
class Semaphore {
    private queue: (() => void)[] = [];
    private counter: number;
    constructor(private readonly max: number) {
        this.counter = max;
    }
    async acquire(): Promise<() => void> {
        if (this.counter > 0) {
            this.counter -= 1;
            return () => this.release();
        }
        return new Promise((resolve) => {
            this.queue.push(() => {
                this.counter -= 1;
                resolve(() => this.release());
            });
        });
    }
    private release() {
        this.counter += 1;
        const next = this.queue.shift();
        if (next) next();
    }
}

// ---------------------------
// Main class
// ---------------------------
export class ErlcPoller {
    private clickhouse: ClickHouseClient;
    private rest: RestManager;
    private ErlcModel: Model<ERLC>;
    private opts: Required<ErlcPollerOptions>;
    private timer: NodeJS.Timeout | null = null;
    private globalSem: Semaphore;

    constructor(params: {
        clickhouseClient: ClickHouseClient;
        discordRestManager: RestManager; // from @discordeno/rest (already created)
        erlcModel: Model<ERLC>; // mongoose model bound to collection 'erlcs'
        options?: ErlcPollerOptions;
    }) {
        this.clickhouse = params.clickhouseClient;
        this.rest = params.discordRestManager;
        this.ErlcModel = params.erlcModel;
        this.opts = { ...DEFAULTS, ...(params.options ?? {}) };
        this.globalSem = new Semaphore(this.opts.globalMaxConcurrency);
    }

    // Lifecycle
    async start() {
        await this.tickOnce();
        this.timer = setInterval(() => {
            this.tickOnce().catch((err) => console.error('[ErlcPoller] tick error', err));
        }, this.opts.tickMs);
    }

    async stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    // One pass over all guilds
    private async tickOnce() {
        const docs = await this.ErlcModel.find({ active: true }).lean().exec();
        await Promise.allSettled(docs.map((d) => this.processGuild(d._id, d.token!)));
    }

    // Per-guild flow
    private async processGuild(guildId: string, accessToken: string) {
        const release = await this.globalSem.acquire();
        try {
            const client = await this.getClient(guildId, accessToken);

            // Gate
            const gateRes = await this.callWithRetry(() => client.getServerStatus());
            const currentPlayers = Number(gateRes?.data.CurrentPlayers ?? 0);

            // Always store the gate result
            await this.insertSnapshots(guildId, accessToken, [
                { route: 'getServerStatus', payload: gateRes, ok: true },
            ]);

            if (!Number.isFinite(currentPlayers) || currentPlayers === 0) {
                // Do not proceed to the others per your rule
                return;
            }

            // Others (9 calls)
            const perTokenSem = new Semaphore(this.opts.perTokenMaxConcurrency);
            const runners: Array<Promise<RouteResult>> = [
                this.wrap(perTokenSem, 'getCommandLogs', () => client.getCommandLogs()),
                this.wrap(perTokenSem, 'getJoinLogs', () => client.getJoinLogs()),
                this.wrap(perTokenSem, 'getKillLogs', () => client.getKillLogs()),
                this.wrap(perTokenSem, 'getModCalls', () => client.getModCalls()),
                this.wrap(perTokenSem, 'getPlayers', () => client.getPlayers()),
                this.wrap(perTokenSem, 'getQueue', () => client.getQueue()),
                this.wrap(perTokenSem, 'getStaff', () => client.getStaff()),
                this.wrap(perTokenSem, 'getVehicles', () => client.getVehicles()),
                this.wrap(perTokenSem, 'getBans', () => client.getBans()),
            ];

            const results = await Promise.allSettled(runners);
            const rows: RouteResult[] = results.map((r) => {
                if (r.status === 'fulfilled') return r.value;
                return {
                    route: 'error',
                    payload: String((r as PromiseRejectedResult).reason ?? 'unknown'),
                    ok: false,
                };
            });

            await this.insertSnapshots(guildId, accessToken, rows);
        } catch (err) {
            console.error(`[ErlcPoller][${guildId}]`, err);
            // write an error row to ClickHouse for visibility
            await this.insertSnapshots(guildId, accessToken, [
                { route: 'internalError', payload: { error: String(err) }, ok: false },
            ]).catch(() => {});
        } finally {
            release();
        }
    }

    private async getClient(guildId: string, accessToken: string): Promise<PRCClient> {
        const maybe = await this.opts.getClient(guildId, accessToken);
        return maybe as PRCClient;
    }

    // Concurrency wrapper for a single client call
    private async wrap<T>(
        sem: Semaphore,
        route: string,
        fn: () => Promise<T>
    ): Promise<RouteResult> {
        const release = await sem.acquire();
        try {
            const payload = await this.callWithRetry(fn);
            return { route, payload, ok: true };
        } catch (err) {
            return { route, payload: String(err), ok: false };
        } finally {
            release();
        }
    }

    // Generic retry/backoff around a PRC client method
    private async callWithRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
        try {
            return await fn();
        } catch (err: any) {
            const shouldRetry = attempt < this.opts.maxRetries;
            if (!shouldRetry) throw err;

            // respect Retry-After if present on known shapes
            const retryAfterMs =
                Number(err?.retryAfter ?? err?.response?.headers?.['retry-after']) * 1000;
            const backoff = Number.isFinite(retryAfterMs)
                ? retryAfterMs
                : this.opts.backoffBaseMs * Math.pow(2, attempt);

            await new Promise((r) => setTimeout(r, backoff));
            return this.callWithRetry(fn, attempt + 1);
        }
    }

    // Storage
    private tokenHash(token: string) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    private chNow() {
        // ClickHouse DateTime: 'YYYY-MM-DD HH:MM:SS'
        return new Date().toISOString().slice(0, 19).replace('T', ' ');
    }

    private toJsonObject(value: unknown): Record<string, unknown> {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value as Record<string, unknown>;
        }
        // Wrap arrays/primitives/errors so ClickHouse sees an object
        return { value };
    }

    private async insertSnapshots(
        guildId: string,
        token: string,
        results: RouteResult[]
    ) {
        if (!results.length) return;

        // Map to ClickHouse ingest rows
        const rows = results.map((r) => ({
            event_time: this.chNow(),
            guild_id: guildId,
            token_hash: this.tokenHash(token), // store hashed only
            route: r.route,
            status: r.ok ? 200 : 500,
            payload: this.toJsonObject(r.payload),
        }));

        await this.clickhouse.insert({
            table: 'api_snapshots',
            values: rows,
            format: 'JSONEachRow',
        });
        console.log(
            `[ErlcPoller][${guildId}] Inserted ${rows.length} snapshot(s) to ${guildId}`
        );
    }
}
