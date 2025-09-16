import { Schema, model, Document } from 'mongoose';

const shiftSchema = new Schema<Shift>({
    _id: String,
    userID: String,
    serverID: String,
    started: Number,
    ended: Number,
    duration: Number,
    status: Number,
    onBreak: Boolean,
    breaks: [Array],
    shiftType: {
        type: {
            id: String,
        },
        default: undefined,
        _id: false,
    },
    modified: Boolean,
    messageId: String,
    createdAt: { type: Number, default: Date.now() },
});

export default model<Shift>('shifts', shiftSchema);

export type Break = [number, number] | [number];

interface ShiftType {
    id: string;
}

interface Shift extends Document {
    _id: string;
    userID: string;
    serverID: string;
    started: number;
    ended: number;
    duration: number;
    status: 1 | 2 | 3; // 1=active, 2=break, 3=ended
    onBreak: boolean;
    breaks: Break[];
    shiftType?: ShiftType;
    modified: boolean;
    messageId: string;
    createdAt: number;
}
