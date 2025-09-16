import { PRCClient } from 'erlc.ts';
import { config } from 'dotenv';
import { rest } from '../index.js';
import ms from 'ms';
config();

export const clients = new Map<string, PRCClient>();

const globalKey = process.env.PRC_GLOBAL_KEY;
const defaultCacheMaxAge = ms('1m');

export async function getPRCClient(
    guildId: string | bigint,
    serverKey?: string,
    cacheMaxAge = defaultCacheMaxAge
): Promise<PRCClient> {
    guildId = guildId.toString();
    if (!serverKey) {
        const serverData = await rest.db.erlc.findOne({ _id: guildId });
        if (!serverData?.token)
            throw new Error(
                'No server key provided and no server key found in database.'
            );
        serverKey = serverData.token;
    }
    if (!clients.has(guildId))
        clients.set(
            guildId,
            new PRCClient({
                serverKey,
                globalKey,
                cache: false,
                // cacheMaxAge,
                // redisUrl: process.env.REDIS_URI,
                // redisKeyPrefix: `erlc:${guildId}`,
            })
        );

    return clients.get(guildId)!;
}
