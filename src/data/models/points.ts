import { Schema, model, Document } from 'mongoose';

const pointsSchema = new Schema<Points>({
    _id: String, // UserID.GuildID
    userId: String,
    guildId: String,
    createdAt: {
        type: Number,
        default: Date.now(),
    },
    history: {
        type: [
            {
                action: String,
                pointValue: Number,
                moderator: String, // ID
                totalPoints: Number,
                timestamp: String,
            },
        ],
        default: [],
    },
});

export default model<Points>('points', pointsSchema);

export interface Points extends Document {
    _id: string;
    userId: string;
    guildId: string;
    createdAt: number;
    history: {
        action: string;
        pointValue: number;
        moderator: string; // ID
        totalPoints: number;
        timestamp: string;
    }[];
}
