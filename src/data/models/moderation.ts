import { Schema, model, Document } from 'mongoose';

const moderationSchema = new Schema<Moderation>({
    _id: String, // snowflake
    guildId: String,
    staffId: String, // Discord ID
    staffRobloxId: { type: String, default: null },
    robloxId: String, // Offending Roblox ID
    robloxUsername: String, // Offending Roblox Username - 20 limit
    robloxUsernameLowercase: { type: String, lowercase: true }, // Offending Roblox Username - 20 limit
    punishment: {
        type: String,
        default: 'No punishment provided',
        maxlength: 300,
    }, // type such as kick/ban - 300 limit
    reason: { type: String, default: 'No reason provided', maxlength: 1024 }, // 1024 limit
    createdAt: { type: Number, default: Date.now() }, // started timestamp
    editedBy: {
        type: [String], // [Discord ID]
        default: [],
    },
    privateServerCode: { type: String, default: null }, // private server code
    messageId: { type: String, default: null }, // Discord message ID
});

export default model<Moderation>('v2-moderations', moderationSchema);

export interface Moderation extends Document {
    _id: string;
    guildId: string;
    staffId: string;
    staffRobloxId: string | null;
    robloxId: string;
    robloxUsername: string;
    robloxUsernameLowercase: string;
    punishment: string;
    reason: string;
    createdAt: number;
    editedBy: string[];
    privateServerCode: string | null;
    messageId: string | null;
}
