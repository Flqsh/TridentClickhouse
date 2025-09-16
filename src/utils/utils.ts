import { hasProperty } from '@discordeno/bot';
import showDuration from 'humanize-duration';
import { rest } from '../index.js';
import axios from 'axios';

export function avatarUrl(id: string, avatar: string) {
    if (!id || !avatar) return undefined;
    return `https://cdn.discordapp.com/avatars/${id.toString()}/${avatar}.png`;
}
export function iconUrl(id: string, icon: string) {
    if (!id || !icon) return undefined;
    return `https://cdn.discordapp.com/icons/${id.toString()}/${icon}.png`;
}
export function emoteUrl(id: string) {
    if (!id) return undefined;
    return `https://cdn.discordapp.com/emojis/${id}.png`;
}

export interface RobloxUser {
    success: boolean;
    id: string | undefined;
    username: string | undefined;
    displayName: string | undefined;
    creation: number | undefined;
    bodyAvatar: string | undefined;
    thumbnailAvatar: string | undefined;
}
export async function fetchRoblox(input: string | number, options = { avatar: false }) {
    let response: RobloxUser = {
        success: false,
        id: undefined,
        username: undefined,
        displayName: undefined,
        creation: undefined, // ms
        bodyAvatar: undefined,
        thumbnailAvatar: undefined,
    };
    let success;
    if (!isNaN(input as any)) {
        // Roblox ID
        const rawData = await axios
            .get(`https://users.roblox.com/v1/users/${input}`)
            .catch(() => (success = false));
        if (
            !rawData ||
            typeof rawData === 'boolean' ||
            rawData?.status != 200 ||
            !rawData?.data ||
            !rawData.data?.id
        )
            return response;
        const data = rawData.data;
        response.id = data.id;
        response.username = data.name;
        response.displayName = data.displayName;
        response.creation = +new Date(data.created); // ms
    } else {
        // Roblox Username
        const rawData = await axios
            .post('https://users.roblox.com/v1/usernames/users', {
                usernames: [input],
            })
            .catch(() => (success = false));
        if (
            !rawData ||
            typeof rawData === 'boolean' ||
            rawData?.status != 200 ||
            !rawData?.data ||
            !rawData.data?.data ||
            !rawData.data.data?.length ||
            !rawData.data.data[0]?.id
        )
            return response;

        const data = rawData.data.data[0];
        response.id = data.id;
        response.username = data.name;
        response.displayName = data.displayName;

        const rawDetailData = await axios
            .get(`https://users.roblox.com/v1/users/${response.id}`)
            .catch(() => (success = false));
        if (
            !rawDetailData ||
            typeof rawDetailData === 'boolean' ||
            rawDetailData?.status != 200 ||
            !rawDetailData?.data ||
            !rawDetailData.data?.id
        )
            return response;
        const detailData = rawDetailData.data;
        response.creation = +new Date(detailData.created);
    }
    if (options.avatar) {
        const rawBodyAvatar = await axios
            .get(
                `https://thumbnails.roblox.com/v1/users/avatar?userIds=${response.id}&size=720x720&format=Png&isCircular=false`
            )
            .catch(() => (success = false));
        const rawThumbnailAvatar = await axios
            .get(
                `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${response.id}&size=720x720&format=Png&isCircular=false`
            )
            .catch(() => (success = false));
        if (
            !rawBodyAvatar ||
            typeof rawBodyAvatar === 'boolean' ||
            rawBodyAvatar?.status != 200 ||
            !rawBodyAvatar?.data ||
            !rawBodyAvatar.data?.data ||
            !rawBodyAvatar.data.data[0]?.imageUrl
        )
            return response;
        if (
            !rawThumbnailAvatar ||
            typeof rawThumbnailAvatar === 'boolean' ||
            rawThumbnailAvatar?.status != 200 ||
            !rawThumbnailAvatar?.data ||
            !rawThumbnailAvatar.data?.data ||
            !rawThumbnailAvatar.data.data[0]?.imageUrl
        )
            return response;
        response.bodyAvatar = rawBodyAvatar.data.data[0].imageUrl;
        response.thumbnailAvatar = rawThumbnailAvatar.data.data[0].imageUrl;
    }
    response.success = true;
    return response;
}

export async function log(
    guildId: string | bigint,
    staffId: string | bigint,
    subject: string,
    details: string,
    extended?: string
) {
    const newLog = new rest.db.log({
        _id: `${rest.snowflake()}`,
        guildId: guildId.toString(),
        staffId: staffId.toString(),
        subject,
        details,
        extended,
        timestamp: Date.now(),
    });
    await newLog.save();
    return newLog;
}

export function duration(ms: number, options: showDuration.Options = {}) {
    return showDuration(ms, {
        ...options,
        round: true,
        largest: 4,
    });
}

export function chunk<T>(collection: T[], size: number = 2): T[][] {
    const result: T[][] = [];

    // default size to two item
    // size = parseInt(size) || 2;

    // add each chunk to the result
    for (let x = 0; x < Math.ceil(collection.length / size); x++) {
        const start = x * size;
        const end = start + size;

        result.push(collection.slice(start, end));
    }

    return result;
}

export function formatPlayer(player: string, id?: string) {
    if (id) return `[${player}](https://www.roblox.com/users/${id}/profile)`;
    return `[${player.split(':')[0]}](https://www.roblox.com/users/${
        player.split(':')[1]
    }/profile)`;
}

export async function verifyUserPoints(
    userId: string | bigint,
    guildId: string | bigint
) {
    let data = await rest.db.points.findOne({ _id: `${userId}.${guildId}` });
    if (!data) {
        data = new rest.db.points({
            _id: `${userId}.${guildId}`,
            userId: userId.toString(),
            guildId: guildId.toString(),
            history: [],
        });
        await data.save();
    }
    return data;
}

export let existingConfigs: string[] = [];

export async function verifyServerData(guildId: string | bigint): Promise<void> {
    if (existingConfigs.includes(guildId.toString())) return;
    if (!(await rest.db.config.exists({ _id: guildId.toString() }))) {
        const newConfig = new rest.db.config({
            _id: guildId.toString(),
        });
        await newConfig.save();
    }
    existingConfigs.push(guildId.toString());
}

export let existingUsers: string[] = [];

export async function verifyUserData(
    userId: string | bigint,
    username: string
): Promise<void> {
    if (existingUsers.includes(userId.toString())) return;
    if (!(await rest.db.uniqueUser.exists({ _id: userId.toString() }))) {
        const newConfig = new rest.db.uniqueUser({
            _id: userId.toString(),
            tag: username,
        });
        await newConfig.save();
    }
    existingUsers.push(userId.toString());
}

export function bigIntsToStrings(obj: Object) {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
            key,
            typeof value === 'bigint' ? value.toString() : value,
        ])
    );
}

export async function getGuild(guildId: bigint | string) {
    const guild = await rest.redis.get(`discord:guild:${guildId.toString()}`);
    if (guild) return JSON.parse(guild);
    const fetchedGuild = await rest.getGuild(BigInt(guildId));
    console.log(fetchedGuild);
    return fetchedGuild;
}

export default {
    avatarUrl,
    iconUrl,
    emoteUrl,
    fetchRoblox,
    log,
    duration,
    chunk,
    formatPlayer,
    verifyUserPoints,
    verifyServerData,
    existingConfigs,
    verifyUserData,
    existingUsers,
    bigIntsToStrings,
    getGuild,
};
