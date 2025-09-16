import { Schema, model, Document } from 'mongoose';

const uniqueUserSchema = new Schema<UniqueUser>({
    _id: String, // user id
    tag: String,
    accountCreated: Number,
    badges: {
        type: [String],
        default: [],
    },
    roles: {
        type: Array,
        default: null,
    },
    lastRobloxUsernames: {
        type: [String],
        default: [],
    },
    createdAt: { type: Number, default: Date.now() },
    robloxId: String,
    robloxUsername: String,
    bypassEnabled: { type: Boolean, default: false },
});

export default model<UniqueUser>('unique-users', uniqueUserSchema);

export interface UniqueUser extends Document {
    _id: string;
    tag: string;
    accountCreated: number;
    badges: any[];
    roles: string[] | null;
    lastRobloxUsernames: string[];
    createdAt: number;
    robloxId: string;
    robloxUsername: string;
    bypassEnabled: boolean;
}
