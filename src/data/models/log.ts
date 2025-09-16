import { Schema, model, Document } from 'mongoose';

const logsSchema = new Schema<Log>({
    _id: String, // epoch snowflake - 19 characters
    guildId: { type: String, required: true }, // server ID
    staffId: { type: String, default: null }, // Discord ID
    subject: { type: String, default: null }, // Title of the log
    details: { type: String, default: null }, // Description of the log
    extended: { type: String, default: null }, // Optional more detailed description of the log
    timestamp: { type: String, default: Date.now().toString() }, // epoch timestamp
});

export default model<Log>('logs', logsSchema);

export interface Log extends Document {
    _id: string;
    guildId: string;
    staffId: string | null;
    subject: string | null;
    details: string | null;
    extended: string | null;
    timestamp: string;
}
