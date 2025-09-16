import { Schema, model, Document } from 'mongoose';

const configSchema = new Schema<Config>({
    _id: String,
    inServer: { type: Boolean, default: true },
    accentColor: { type: String, default: '2b2d31' },
    permissionRoles: {
        type: [
            {
                roleID: String,
                roleName: String,
                useShifts: { type: Boolean, default: false },
                manageShifts: { type: Boolean, default: false },
                manageShiftTypes: { type: Boolean, default: false },
                useActivityTracking: { type: Boolean, default: false },
                useModeration: { type: Boolean, default: false },
                manageModeration: { type: Boolean, default: false },
                useBanRequests: { type: Boolean, default: false },
                manageBanRequests: { type: Boolean, default: false },
                useReminders: { type: Boolean, default: false },
                manageReminders: { type: Boolean, default: false },
                useLeave: { type: Boolean, default: false },
                manageLeave: { type: Boolean, default: false },
                usePoints: { type: Boolean, default: false },
                managePoints: { type: Boolean, default: false },
                modERLC: { type: Boolean, default: false },
                adminERLC: { type: Boolean, default: false },
                coOwnerERLC: { type: Boolean, default: false },
                manageConfig: { type: Boolean, default: false },
                administrator: { type: Boolean, default: false },
            },
        ],
        _id: false,
    },
    shiftModule: {
        enabled: { type: Boolean, default: false },
        shiftTypes: {
            type: [
                {
                    id: String,
                    name: String,
                    roles: { type: [String], default: [] },
                    enabled: { type: Boolean, default: false },
                    onShiftRoleID: { type: String, default: null },
                    onBreakRoleID: { type: String, default: null },
                    logChannelID: { type: String, default: null },
                },
            ],
            default: [
                {
                    name: 'default',
                    id: 'default',
                    roles: [],
                    enabled: true,
                    onShiftRoleID: null,
                    onBreakRoleID: null,
                    logChannelID: null,
                },
            ],
            _id: false,
        },
    },
    moderationModule: {
        enabled: { type: Boolean, default: false },
        modLogChannelID: { type: String, default: null },
        moderationConfirmation: { type: Boolean, default: false },
        punishmentTypes: { type: [String], default: [] },
        banReqLogChannelID: { type: String, default: null },
        ingameLoggingChannelID: { type: String, default: null },
    },
    leaveModule: {
        enabled: { type: Boolean, default: false },
        leaveApproveDenyChannelID: { type: String, default: null },
        leaveLogChannelID: { type: String, default: null },
        onLeaveRoleID: { type: String, default: null },
    },
    activityTrackingModule: {
        enabled: { type: Boolean, default: false },
        frequency: { type: Number, default: 6.048e8 },
        duration: { type: Number, default: 6.048e8 },
        requirement: { type: Number, default: 7.2e6 },
        channelId: { type: String, default: null },
        includeManagement: { type: Boolean, default: true },
        nextSendTimestamp: { type: Number, default: null },
    },
    points: {
        enabled: { type: Boolean, default: false },
        logChannel: { type: String, default: null },
        prefix: { type: String, default: 'c!' },
        discordStaffRoleIDs: { type: [String], default: [] },
        maxValue: { type: Number, default: 16 },
        warnValue: { type: Number, default: 1 },
        muteValue: { type: Number, default: 2 },
        kickValue: { type: Number, default: 3 },
        softBanValue: { type: Number, default: 3 },
        banValue: { type: Number, default: 4 },
        autoBanAtMax: { type: Boolean, default: false },
        autoDeleteActionReply: { type: Boolean, default: false },
    },
    reminderModule: {
        enabled: { type: Boolean, default: false },
        reminders: {
            type: [
                {
                    uniqueId: String,
                    name: String,
                    active: { type: Boolean, default: true },
                    channelId: { type: String, default: null },
                    intervalMs: { type: Number, default: 300000 },
                    roleIds: { type: [String], default: [] },
                    text: { type: String, default: null },
                    createdBy: { type: String, default: null },
                    activeShiftOnly: { type: Boolean, default: false },
                    nextSendTimestamp: {
                        type: Number,
                        default: Date.now() - 300,
                    },
                    createdAt: { type: Number, default: Date.now() },
                },
            ],
            default: [],
            _id: false,
        },
    },
    erlc: {
        vsmEnabled: { type: Boolean, default: false },
        vsmAllowAllOther: { type: Boolean, default: false },
        vsmLogChannelId: { type: String, default: null },
        autoBanRequest: { type: Boolean, default: false },
        kickBanChannelId: { type: String, default: null },
        commandsChannelId: { type: String, default: null },
    },
    createdAt: { type: String, default: Date.now().toString() },
    lastBotRemoval: { type: String, default: null },
});

export default model<Config>('configs', configSchema);

export interface Config extends Document {
    _id: string;
    inServer: boolean;
    accentColor: string;
    permissionRoles: Array<{
        roleID: string;
        roleName: string;
        useShifts: boolean;
        manageShifts: boolean;
        manageShiftTypes: boolean;
        useActivityTracking: boolean;
        useModeration: boolean;
        manageModeration: boolean;
        useBanRequests: boolean;
        manageBanRequests: boolean;
        useReminders: boolean;
        manageReminders: boolean;
        useLeave: boolean;
        manageLeave: boolean;
        usePoints: boolean;
        managePoints: boolean;
        modERLC: boolean;
        adminERLC: boolean;
        coOwnerERLC: boolean;
        manageConfig: boolean;
        administrator: boolean;
    }>;
    shiftModule: {
        enabled: boolean;
        shiftTypes: Array<{
            id: string;
            name: string;
            roles: string[];
            enabled: boolean;
            onShiftRoleID: string | null;
            onBreakRoleID: string | null;
            logChannelID: string | null;
        }>;
    };
    moderationModule: {
        enabled: boolean;
        modLogChannelID: string | null;
        moderationConfirmation: boolean;
        punishmentTypes: string[];
        banReqLogChannelID: string | null;
        ingameLoggingChannelID: string | null;
    };
    leaveModule: {
        enabled: boolean;
        leaveApproveDenyChannelID: string | null;
        leaveLogChannelID: string | null;
        onLeaveRoleID: string | null;
    };
    activityTrackingModule: {
        enabled: boolean;
        frequency: number;
        duration: number;
        requirement: number;
        channelId: string | null;
        includeManagement: boolean;
        nextSendTimestamp: number | null;
    };
    points: {
        enabled: boolean;
        logChannel: string | null;
        prefix: string;
        discordStaffRoleIDs: string[];
        maxValue: number;
        warnValue: number;
        muteValue: number;
        kickValue: number;
        softBanValue: number;
        banValue: number;
        autoBanAtMax: boolean;
        autoDeleteActionReply: boolean;
    };
    reminderModule: {
        enabled: boolean;
        reminders: Array<{
            uniqueId: string;
            name: string;
            active: boolean;
            channelId: string | null;
            intervalMs: number;
            roleIds: string[];
            text: string | null;
            createdBy: string | null;
            activeShiftOnly: boolean;
            nextSendTimestamp: number;
            createdAt: number;
        }>;
    };
    erlc: {
        vsmEnabled: boolean;
        vsmAllowAllOther: boolean;
        vsmLogChannelId: string | null;
        autoBanRequest: boolean;
        kickBanChannelId: string | null;
        commandsChannelId: string | null;
    };
    createdAt: string;
    lastBotRemoval: string | null;
}
