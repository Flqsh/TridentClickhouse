import { rest } from '../index.js';

export async function getMemberCount() {
    const keys = await rest.redis.keys('discord:guild:*');
    console.log('start');
    let memberCount = 0;
    const values = await Promise.all(keys.map((k) => rest.redis.get(k)));

    for (const guild of values) {
        memberCount += JSON.parse(guild!)?.memberCount || 0;
    }
    // for (const key of keys) {
    //     const guild = await rest.redis.get(key);
    //     if (guild) {
    //         const parsedGuild = JSON.parse(guild);
    //         memberCount += parsedGuild.memberCount || 0;
    //         console.log(memberCount);
    //     }
    // }
    console.log(memberCount);
}
