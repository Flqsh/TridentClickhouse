import { createRestManager, RestManager } from '@discordeno/rest';
import { createProxyCache } from 'dd-cache-proxy';
import { DiscordSnowflake } from '@sapphire/snowflake';
import dotenv from 'dotenv';
import colors from './data/colors.js';
import emotes from './data/emotes.js';
import embeds from './data/embeds.js';
import Utils from './utils/utils.js';
import Models from './data/models/index.js';
import { Redis } from 'ioredis';
import { connectToDatabase } from './database/mongodb.js';
import { createClient, ClickHouseClient } from '@clickhouse/client';
// import { runHandler } from './archive/index3.js';
import { clients, getPRCClient } from './utils/PRCClients.js';
import { ErlcPoller } from './handler/index.js';
import { verifyKeys } from './handler/verifyKeyScript.js';

dotenv.config();

setInterval(() => {
    const m = process.memoryUsage();
    console.log(
        `[mem] rss=${(m.rss / 1e6).toFixed(1)}MB heapUsed=${(m.heapUsed / 1e6).toFixed(
            1
        )}MB ext=${(m.external / 1e6).toFixed(1)}MB`
    );
}, 30_000);

// setInterval(() => {
//     const file = `C:\\Users\\User\\Desktop\\heap-${Date.now()}.heapsnapshot`;
//     // @ts-ignore
//     heapdump.writeSnapshot(file, (err: any, fname: string) => {
//         console.log('[heapdump] wrote', err || fname);
//     });
// }, ms('5m'));

const restRaw = createRestManager({
    token: process.env.TOKEN!,
});

export const rest = restRaw as CustomRedis;

export type CustomRedis = typeof restRaw & {
    colors: typeof colors;
    emotes: typeof emotes;
    embeds: typeof embeds;
    config: typeof process.env;
    utils: typeof Utils;
    db: typeof Models;
    snowflake: typeof DiscordSnowflake.generate;
    getPRCClient: typeof getPRCClient;
    redis: Redis;
    clickhouse: ClickHouseClient;
};

rest.colors = colors;
rest.emotes = emotes;
rest.embeds = embeds;
rest.config = process.env;
rest.utils = Utils;
rest.db = Models;
rest.snowflake = () => DiscordSnowflake.generate();
rest.getPRCClient = getPRCClient;
rest.redis = new Redis(process.env.REDIS_URI!);
rest.clickhouse = createClient({
    url: 'https://clickhouse.trident.bot/',
    username: 'default',
    password: 'aogeLPz&gg9eDEcg',
});
await connectToDatabase();

rest.clickhouse
    .ping()
    .then(() => console.log('ClickHouse connected'))
    .catch((err) => {
        console.error('ClickHouse connection error:', err);
        process.exit(1);
    });
// runHandler();

// verifyKeys();
const poller = new ErlcPoller({
    clickhouseClient: rest.clickhouse,
    discordRestManager: rest,
    erlcModel: Models.erlc,
});
poller.start();

// // By default, bot.logger will use an instance of the logger from @discordeno/bot, this logger supports depth and we need to change it, so we need to say to TS that we know what we are doing with as
// bot.logger as typeof discordenoLogger; //.setDepth(LogDepth.Full);

process.on('unhandledRejection', (reason, promise) => {
    rest.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    rest.logger.error('Uncaught Exception thrown:', error);
});
process.on('warning', (warning) => {
    rest.logger.warn(warning.name, warning.message, warning.stack);
});
