import { ServerStatus } from 'erlc.ts';
import { rest } from '../index.js';
import ms from 'ms';
import { getPRCClient } from '../utils/PRCClients.js';
import axios from 'axios';

interface timezoneData {
    timezone: string | null;
    longitude?: number | null;
    latitude?: number | null;
    lastExecuted: number;
}
//https://api.open-meteo.com/v1/forecast?latitude=38.12&longitude=-121.29&timezone=auto&current=weather_code
let timezonesCache: Map<string, timezoneData> = new Map(); // guildId -> timezone

const WeatherCode = {
    // Rain Thunderstorm Fog Clear
    0: 'clear',
    1: 'clear',
    2: 'clear',
    45: 'fog',
    48: 'fog',
    51: 'rain',
    53: 'rain',
    55: 'rain',
    56: 'rain',
    57: 'rain',
    61: 'rain',
    63: 'rain',
    65: 'thunderstorm',
    66: 'rain',
    67: 'thunderstorm',
    71: 'rain',
    73: 'rain',
    75: 'thunderstorm',
    77: 'rain',
    80: 'rain',
    81: 'rain',
    82: 'thunderstorm',
    85: 'rain',
    86: 'thunderstorm',
    95: 'thunderstorm',
    96: 'thunderstorm',
    99: 'thunderstorm',
};

export async function initializeTimezoneHandler() {
    await updateTimezoneCache();
    setInterval(() => {
        updateTimezoneCache();
    }, ms('20m'));
}

async function updateTimezoneCache() {
    console.log('Updating timezone cache...');
    const timezones = await rest.db.config.find({
        'erlc.timeSyncTimezone': {
            $exists: true,
            $ne: null,
        },
    });

    timezones.forEach((config) => {
        if (config.erlc?.timeSyncTimezone)
            timezonesCache.set(config._id, {
                lastExecuted: 0,
                timezone: config.erlc.timeSyncTimezone,
                longitude: config.erlc.longitude || null,
                latitude: config.erlc.latitude || null,
            });
    });
    console.log(`Timezone cache updated with ${timezonesCache.size} entries.`);
}

export async function timeZoneHandler(
    guildId: string,
    accessToken: string,
    info: ServerStatus
) {
    const timezone = timezonesCache.get(guildId);
    if (!timezone) return;
    console.log(timezone);
    if (Date.now() - timezone.lastExecuted < ms('10m')) return; // only every 10 minutes
    timezone.lastExecuted = Date.now();

    const client = await getPRCClient(guildId, accessToken);
    if (!client) return;
    if (timezone?.timezone) {
        const offset = timezone.timezone.replace('UTC', '');
        const date = new Date().getUTCHours() + parseInt(offset);
        const finalHour = ((date % 24) + 24) % 24; // wrap around 24

        try {
            await client.executeCommand(`:time ${finalHour}`);
        } catch (e) {
            console.error(
                `Failed to update server status with timezone for guild ${guildId}:`,
                e
            );
        }
    }
    if (timezone?.longitude && timezone?.latitude) {
        try {
            const response = await axios.get(
                `https://api.open-meteo.com/v1/forecast?latitude=${timezone.latitude}&longitude=${timezone.longitude}&timezone=auto&current_weather=true`
            );
            const weatherCode = response.data.current.weather_code;
            const weatherString =
                WeatherCode[weatherCode as keyof typeof WeatherCode] || 'clear';
            await client.executeCommand(`:weather ${weatherString}`);
        } catch (e) {
            console.error(`Failed to fetch weather data for guild ${guildId}:`, e);
        }
    }
}
