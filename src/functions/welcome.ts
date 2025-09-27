import { Player, ServerStatus } from 'erlc.ts';
import { rest } from '../index.js';
import ms from 'ms';
import { getPRCClient } from '../utils/PRCClients.js';
import axios from 'axios';

interface Data {
    welcomeMessage: string | null;
    playerCountStatsChannelId: string | null;
    playerCountFormat: string | null;
    queueStatsChannelId: string | null;
    queueFormat: string | null;
    disallowAllOtherUsernames: boolean | null;
    lastExecuted: number;
}

let cache: Map<string, Data> = new Map();

export async function initializeWelcomeHandler() {
    await updateCache();
    setInterval(() => {
        updateCache();
    }, ms('20m'));
}

async function updateCache() {
    console.log('Updating welcome cache...');
    const timezones = await rest.db.config.find({
        'erlc.timeSyncTimezone': {
            $exists: true,
            $ne: null,
        },
    });

    timezones.forEach((config) => {
        if (
            config.erlc?.welcomeMessage ||
            (config.erlc.playerCountStatsChannelId && config.erlc.playerCountFormat) ||
            (config.erlc.queueStatsChannelId && config.erlc.queueFormat) ||
            config.erlc.disallowAllOtherUsernames
        )
            cache.set(config._id, {
                lastExecuted: 0,
                welcomeMessage: config.erlc?.welcomeMessage || null,
                playerCountStatsChannelId: config.erlc?.playerCountStatsChannelId || null,
                playerCountFormat: config.erlc?.playerCountFormat || null,
                queueStatsChannelId: config.erlc?.queueStatsChannelId || null,
                queueFormat: config.erlc?.queueFormat || null,
                disallowAllOtherUsernames: config.erlc?.disallowAllOtherUsernames || null,
            });
    });
    console.log(`Timezone cache updated with ${cache.size} entries.`);
}

const previousPlayers: Map<string, string[]> = new Map();
const lastPlayerCountUpdate: Map<string, number> = new Map();
const lastQueueSizeUpdate: Map<string, number> = new Map();

export async function timeZoneHandler(
    guildId: string,
    accessToken: string,
    players: Player[],
    queue: number[],
    info: ServerStatus
) {
    if (!players.length) return;
    const data = cache.get(guildId);
    if (!data) return;
    if (Date.now() - data.lastExecuted < ms('1m')) return; // only every 1 minute
    data.lastExecuted = Date.now();

    const client = await getPRCClient(guildId, accessToken);
    if (!client) return;

    if (data.disallowAllOtherUsernames) {
        const allOtherPlayers = players.filter(
            (p) =>
                p.Player.toLowerCase().startsWith('all') ||
                p.Player.toLowerCase().startsWith('other')
        );
        if (allOtherPlayers.length) {
            const playerIds = allOtherPlayers.map((p) => p.Player.split(':')[1]);
            try {
                await client.executeCommand(
                    `:kick ${playerIds.join(',')} Disallowed username (All/Other)`
                );
            } catch (e) {
                console.error(
                    `Failed to kick players with disallowed usernames for guild ${guildId}:`,
                    e
                );
            }
        }
    }

    if (data.playerCountFormat && data.playerCountStatsChannelId) {
        const lastUpdate = lastPlayerCountUpdate.get(guildId);
        if (!lastUpdate || Date.now() - lastUpdate > ms('5m')) {
            lastPlayerCountUpdate.set(guildId, Date.now());
            const text = data.playerCountFormat
                .replace('{count}', players.length.toString())
                .replace('{max}', info.MaxPlayers.toString());
            try {
                rest.editChannel(data.playerCountStatsChannelId, {
                    name: text,
                });
            } catch (error) {
                console.error(
                    `Failed to update player count channel for guild ${guildId}:`,
                    error
                );
            }
        }
    }
    if (data.queueFormat && data.queueStatsChannelId) {
        const lastUpdate = lastQueueSizeUpdate.get(guildId);
        if (!lastUpdate || Date.now() - lastUpdate > ms('5m')) {
            lastQueueSizeUpdate.set(guildId, Date.now());
            const text = data.queueFormat.replace('{size}', queue.length.toString());
            try {
                rest.editChannel(data.queueStatsChannelId, {
                    name: text,
                });
            } catch (error) {
                console.error(
                    `Failed to update queue channel for guild ${guildId}:`,
                    error
                );
            }
        }
    }

    if (data.welcomeMessage) {
        const previous = previousPlayers.get(guildId);
        if (previous && previous.length) {
            const newPlayers = players.filter((p) => !previous.includes(p.Player));

            previousPlayers.set(
                guildId,
                players.map((p) => p.Player)
            );

            if (newPlayers.length) {
                const playerIds = newPlayers.map((p) => p.Player.split(':')[1]);
                try {
                    await client.executeCommand(
                        `:pm ${playerIds.join(',')} ${data.welcomeMessage}`
                    );
                } catch (e) {
                    console.error(
                        `Failed to send welcome message to new players for guild ${guildId}:`,
                        e
                    );
                }
            }
        } else
            previousPlayers.set(
                guildId,
                players.map((p) => p.Player)
            );
    }
}
