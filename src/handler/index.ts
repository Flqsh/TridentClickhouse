// ErlcPoller.ts
import crypto from 'crypto';
import type { ClickHouseClient } from '@clickhouse/client';
import type { Model, Document } from 'mongoose';
import type { RestManager } from '@discordeno/rest';
import { ERLC } from '../data/models/erlc.js';
import { PRCClient } from 'erlc.ts';
import { getPRCClient } from '../utils/PRCClients.js';

export interface ErlcDoc extends Document {
    guildId: string;
    accessToken: string;
}

type RouteResult = {
    route: string;
    payload: unknown;
    ok: boolean;
};

export interface ErlcPollerOptions {
    tickMs?: number;
    refreshMs?: number; // how often to refetch active guilds
    globalMaxConcurrency?: number;
    perTokenMaxConcurrency?: number;
    maxRetries?: number;
    backoffBaseMs?: number;
    getClient?: (guildId: string, accessToken: string) => Promise<PRCClient> | PRCClient;
}

const DEFAULTS: Required<ErlcPollerOptions> = {
    tickMs: 15_000,
    refreshMs: 120_000, // 2 minutes
    globalMaxConcurrency: 10,
    perTokenMaxConcurrency: 3,
    maxRetries: 3,
    backoffBaseMs: 400,
    getClient: getPRCClient,
};

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
export class ErlcPoller {
    private clickhouse: ClickHouseClient;
    private rest: RestManager;
    private ErlcModel: Model<ERLC>;
    private opts: Required<ErlcPollerOptions>;
    private tickTimer: NodeJS.Timeout | null = null;
    private refreshTimer: NodeJS.Timeout | null = null; // NEW
    private globalSem: Semaphore;

    // in-memory cache of guilds to process
    private cachedGuilds: Array<{ id: string; token: string }> = []; // NEW

    constructor(params: {
        clickhouseClient: ClickHouseClient;
        discordRestManager: RestManager;
        erlcModel: Model<ERLC>;
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
        // initial fetch of active guilds
        await this.refreshGuilds();

        // start periodic refresh
        this.refreshTimer = setInterval(() => {
            this.refreshGuilds().catch((err) =>
                console.error('[ErlcPoller] refresh error', err)
            );
        }, this.opts.refreshMs);

        // first processing tick
        await this.tickOnce();

        // periodic processing
        this.tickTimer = setInterval(() => {
            this.tickOnce().catch((err) => console.error('[ErlcPoller] tick error', err));
        }, this.opts.tickMs);
    }

    async stop() {
        if (this.tickTimer) clearInterval(this.tickTimer);
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.tickTimer = null;
        this.refreshTimer = null;
    }

    // refresh active guilds from DB every refreshMs
    private async refreshGuilds() {
        const docs = await this.ErlcModel.find({ active: true }, { _id: 1, token: 1 })
            .lean()
            .exec();
        this.cachedGuilds = docs
            .filter((d) => d._id && d.token)
            .map((d) => ({ id: String(d._id), token: String(d.token) }));
        console.log(`[ErlcPoller] refreshed ${this.cachedGuilds.length} active guild(s)`);
    }

    // One pass over the cached guilds
    private async tickOnce() {
        if (!this.cachedGuilds.length) return;
        await Promise.allSettled(
            this.cachedGuilds.map((g) => this.processGuild(g.id, g.token))
        );
    }

    // Per-guild flow
    private async processGuild(guildId: string, accessToken: string) {
        const release = await this.globalSem.acquire();
        try {
            const client = await this.getClient(guildId, accessToken);

            // Gate
            const gateRes = await this.callWithRetry(() => client.getServerStatus());
            const gateData = (gateRes as any)?.data ?? gateRes;
            const currentPlayers = Number(gateData?.CurrentPlayers ?? 0);

            // Always store the gate result
            await this.insertSnapshots(guildId, accessToken, [
                { route: 'getServerStatus', payload: gateData, ok: true },
            ]);

            if (!Number.isFinite(currentPlayers) || currentPlayers === 0) {
                return; // inactive server: stop here
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
                    payload: {
                        error: String((r as PromiseRejectedResult).reason ?? 'unknown'),
                    },
                    ok: false,
                };
            });

            await this.insertSnapshots(guildId, accessToken, rows);
        } catch (err: any) {
            // If this looks like an auth error, disable the guild and evict from cache
            if (this.isAuthError(err)) {
                console.error(
                    `[ErlcPoller][${guildId}] auth error -> deactivating guild`,
                    err?.message ?? err
                );
                await this.deactivateGuild(guildId).catch(() => {});
                this.removeFromCache(guildId);
                // Also record the error
                await this.insertSnapshots(guildId, accessToken, [
                    { route: 'authError', payload: { error: String(err) }, ok: false },
                ]).catch(() => {});
                return;
            }

            console.error(`[ErlcPoller][${guildId}]`, err);
            await this.insertSnapshots(guildId, accessToken, [
                { route: 'internalError', payload: { error: String(err) }, ok: false },
            ]).catch(() => {});
        } finally {
            release();
        }
    }

    private removeFromCache(guildId: string) {
        this.cachedGuilds = this.cachedGuilds.filter((g) => g.id !== guildId);
    }

    private async deactivateGuild(guildId: string) {
        await this.ErlcModel.updateOne(
            { _id: guildId },
            { $set: { active: false } }
        ).exec();
    }

    private isAuthError(err: any): boolean {
        const code = err?.status ?? err?.code ?? err?.response?.status;
        const msg = String(err?.message ?? err ?? '').toLowerCase();
        // common signals
        if (code === 401 || code === 403) return true;
        if (msg.includes('unauthorized') || msg.includes('forbidden')) return true;
        if (msg.includes('invalid token') || msg.includes('invalid authorization'))
            return true;
        // erlc.ts/axios-like envelopes
        const dataCode = err?.response?.data?.code ?? err?.data?.code;
        if (dataCode === 401 || dataCode === 403) return true;
        return false;
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
            const res = await this.callWithRetry(fn);
            const data = (res as any)?.data ?? res;
            return { route, payload: data, ok: true };
        } catch (err) {
            return { route, payload: { error: String(err) }, ok: false };
        } finally {
            release();
        }
    }

    // Generic retry/backoff around a PRC client method
    private async callWithRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
        try {
            return await fn();
        } catch (err: any) {
            // short-circuit: don't retry auth errors
            if (this.isAuthError(err)) throw err;

            const shouldRetry = attempt < this.opts.maxRetries;
            if (!shouldRetry) throw err;

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

    private toPlainJsonObject(value: unknown): Record<string, unknown> {
        const seen = new WeakSet();
        const normalize = (v: any): any => {
            if (v === null || v === undefined) return v;
            const t = typeof v;
            if (t === 'bigint') return v.toString();
            if (t === 'function' || t === 'symbol') return String(v);
            if (t !== 'object') return v;
            if (v instanceof Date) return v.toISOString();
            if (Array.isArray(v)) return v.map(normalize);
            if (seen.has(v)) return '[Circular]';
            seen.add(v);
            const out: Record<string, unknown> = {};
            for (const [k, val] of Object.entries(v)) {
                const nv = normalize(val);
                if (nv !== undefined) out[k] = nv;
            }
            return out;
        };
        const obj =
            value && typeof value === 'object' && !Array.isArray(value)
                ? (value as Record<string, unknown>)
                : { value };
        return normalize(obj);
    }

    private async insertSnapshots(
        guildId: string,
        token: string,
        results: RouteResult[]
    ) {
        if (!results.length) return;
        const rows = results.map((r) => ({
            event_time: this.chNow(),
            guild_id: guildId,
            token_hash: this.tokenHash(token), // store hashed only
            route: r.route,
            status: r.ok ? 200 : 500,
            payload: this.toPlainJsonObject(r.payload),
        }));
        await this.clickhouse.insert({
            table: 'api_snapshots',
            values: rows,
            format: 'JSONEachRow',
        });
        console.log(`[ErlcPoller][${guildId}] Inserted ${rows.length} snapshot(s)`);
    }
}
