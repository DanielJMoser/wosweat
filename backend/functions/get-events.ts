import { readEvents } from './utils/blobs';
import { todayInVienna } from './utils/timezone';

const HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
};

export default async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: HEADERS });
    }

    const cache = await readEvents();
    if (!cache) {
        return new Response(
            JSON.stringify({ events: [], lastUpdated: null, count: 0 }),
            { status: 200, headers: HEADERS }
        );
    }

    const today = todayInVienna();
    const events = (cache.events ?? []).filter((e) => e.date >= today);

    return new Response(
        JSON.stringify({ events, lastUpdated: cache.lastUpdated, count: events.length }),
        { status: 200, headers: HEADERS }
    );
};
