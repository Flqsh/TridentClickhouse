import { Schema, model, Document } from 'mongoose';

const erlcSchema = new Schema<ERLC>({
    _id: String, // guildId
    token: { type: String, default: null },
    active: { type: Boolean, default: true },
    killedBy: { type: String, default: null }, // the command ID that invalidated this token
    empty: { type: Boolean, default: false },
    nextCheck: { type: Number, default: Date.now() },
    server: {
        name: { type: String },
        ownerId: { type: Number },
        coOwnerIds: { type: [Number] },
        currentPlayers: { type: Number },
        maxPlayers: { type: Number },
        joinKey: { type: String },
        accVerifiedReq: { type: String },
        teamBalance: { type: Boolean },
    },
    serverUpdated: { type: String },
    players: {
        type: [
            {
                name: { type: String },
                id: { type: Number },
                permission: { type: String },
                callsign: { type: String },
                team: { type: String },
            },
        ],
        default: [],
        _id: false,
    },
    playersUpdated: { type: String },
    joins: {
        type: [
            {
                join: { type: Boolean },
                timestamp: { type: Number },
                name: { type: String },
                id: { type: Number },
            },
        ],
        default: [],
        _id: false,
    },
    joinsUpdated: { type: String },
    queue: { type: [Number] },
    queueUpdated: { type: String },
    kills: {
        type: [
            {
                killedName: { type: String },
                killedId: { type: Number },
                timestamp: { type: Number },
                killerName: { type: String },
                killerId: { type: Number },
            },
        ],
        default: [],
        _id: false,
    },
    killsUpdated: { type: String },
    commandLogs: {
        type: [
            {
                playerName: { type: String },
                playerId: { type: Number },
                command: { type: String },
                timestamp: { type: Number },
            },
        ],
        default: [],
        _id: false,
    },
    commandLogsUpdated: { type: String },
    modCalls: {
        type: [
            {
                callerName: { type: String },
                callerId: { type: Number },
                timestamp: { type: Number },
                moderatorName: { type: String, default: null },
                moderatorId: { type: Number, default: null },
            },
        ],
        default: [],
        _id: false,
    },
    modCallsUpdated: { type: String },
    bans: {
        type: [
            {
                id: { type: Number },
                name: { type: String },
            },
        ],
        default: [],
        _id: false,
    },
    bansUpdated: { type: String },
    vehicles: {
        type: [
            {
                livery: { type: String },
                name: { type: String },
                owner: { type: String },
            },
        ],
    },
    vehiclesUpdated: { type: String },
    lastUpdated: { type: Number },
});

export default model<ERLC>('erlcs', erlcSchema);

export interface ERLC extends Document {
    _id: string;
    token: string | null;
    active: boolean;
    killedBy: string | null;
    empty: boolean;
    nextCheck: number;
    server: {
        name: string;
        ownerId: number;
        coOwnerIds: number[];
        currentPlayers: number;
        maxPlayers: number;
        joinKey: string;
        accVerifiedReq: string;
        teamBalance: boolean;
    };
    serverUpdated: string;
    players: {
        name: string;
        id: number;
        permission: string;
        callsign: string;
        team: string;
    }[];
    playersUpdated: string;
    joins: {
        join: boolean;
        timestamp: number;
        name: string;
        id: number;
    }[];
    joinsUpdated: string;
    queue: number[];
    queueUpdated: string;
    kills: {
        killedName: string;
        killedId: number;
        timestamp: number;
        killerName: string;
        killerId: number;
    }[];
    killsUpdated: string;
    commandLogs: {
        playerName: string;
        playerId: number;
        command: string;
        timestamp: number;
    }[];
    commandLogsUpdated: string;
    modCalls: {
        callerName: string;
        callerId: number;
        timestamp: number;
        moderatorName: string | null;
        moderatorId: number | null;
    }[];
    modCallsUpdated: string;
    bans: {
        id: number;
        name: string;
    }[];
    bansUpdated: string;
    vehicles: {
        livery: string;
        name: string;
        owner: string;
    }[];
    vehiclesUpdated: string;
    lastUpdated: number;
}
