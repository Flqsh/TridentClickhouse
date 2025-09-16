import { Schema, model, Document } from 'mongoose';

const leaveSchema = new Schema<LOA>({
    _id: {
        type: String,
        required: true,
    },
    guildId: { type: String, required: true },
    staffId: { type: String, required: true },

    active: Boolean,
    ended: Boolean,
    respondedTo: Boolean,
    approved: Boolean,
    loaReason: String, // Initial reason
    denialReason: String, // Reason for denial
    logMessageID: String, // Approve / Deny message ID
    decidedByID: String, // ID of management who approved / denied

    startTimestamp: Number,
    endTimestamp: Number, // Expected end
    endedByAdmin: Boolean,
    endedEarly: Boolean,
    actualEndTimestamp: Number, // Actual end

    // Extensions
    extended: Boolean,
    lastExtensionDenialReason: String,
    lastExtensionApproveDenyMessageID: String,
    lastExtensionDecidedByID: String,
    pendingExtensionNewEndTimestamp: Number,
    pendingExtension: Boolean,

    createdAt: {
        type: Number,
        default: Date.now(),
    },
    // Archived
    // extendedByAdmin: Boolean,
    // documentVersion: {
    //     type: Number,
    //     default: 1,
    // },
    // forceEnded: Boolean,
});

export default model<LOA>('loas', leaveSchema);

export interface LOA extends Document {
    _id: string;
    guildId: string;
    staffId: string;
    active?: boolean;
    ended?: boolean;
    respondedTo: boolean;
    approved?: boolean;
    startTimestamp?: number;
    endTimestamp?: number;
    actualEndTimestamp?: number;
    loaReason: string | null;
    denialReason?: string;
    logMessageID?: string; // this is actually the original approve deny message ID
    decidedByID?: string;
    documentVersion: number;
    forceEnded?: boolean;
    extended?: boolean;
    lastExtensionDenialReason?: string;
    lastExtensionApproveDenyMessageID?: string;
    lastExtensionDecidedByID?: string;
    pendingExtensionNewEndTimestamp?: number;
    pendingExtension: boolean;
    extendedByAdmin?: boolean;
    endedByAdmin?: boolean;
    endedEarly?: boolean;
    createdAt: number;
}
