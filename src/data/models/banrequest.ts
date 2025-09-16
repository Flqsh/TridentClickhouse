import { Schema, model, Document } from 'mongoose';

const banRequestSchema = new Schema<BanRequest>({
    _id: String,
    guildId: {
        type: String,
        required: true,
    },
    robloxId: {
        type: String,
        required: true,
    },
    reasons: {
        // 600 limit
        type: [String],
        default: ['No reason provided'],
    },
    createdBy: {
        // Staff Discord ID
        type: [String],
        required: true,
    },
    createdAt: {
        type: Number,
        default: Date.now(),
    },
    logMessageId: {
        type: String,
        default: null,
    },
});

export default model<BanRequest>('banrequests', banRequestSchema);

export interface BanRequest extends Document {
    _id: string;
    guildId: string;
    robloxId: string;
    reasons: string[];
    createdBy: string[];
    createdAt: number;
    logMessageId: string | null;
}
