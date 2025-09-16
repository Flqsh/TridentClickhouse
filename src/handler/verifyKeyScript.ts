import { rest } from '../index.js';
import { getPRCClient } from '../utils/PRCClients.js';

export async function verifyKeys() {
    const allERLCs = await rest.db.erlc.find({ active: true }).lean();
    for (const erlc of allERLCs) {
        const { _id: guildId, token } = erlc;
        if (!token || typeof token !== 'string') continue;

        // Verify the token with the PRC
        const client = await getPRCClient(guildId, token);
        const isValid = await client.getServerStatus().catch(() => {});
        if (isValid?.rateLimit) {
            console.warn(
                `[verifyKeys] Rate limited while verifying token for guild ${guildId}, stopping.`,
                isValid.rateLimit
            );
            process.exit(1);
        }
        if (!isValid?.data?.Name) {
            console.warn(`[verifyKeys] Invalid token for guild ${guildId}`);
            await rest.db.erlc.updateOne({ _id: guildId }, { $set: { active: false } });
        } else console.log(`[verifyKeys] Valid token for guild ${guildId}`);
    }
}
