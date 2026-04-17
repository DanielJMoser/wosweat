import { readEvents } from './utils/blobs';
import { todayInVienna } from './utils/timezone';

const BASE_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
};

const HEADERS_HIT = { ...BASE_HEADERS, 'Cache-Control': 'public, max-age=3600' };
const HEADERS_MISS = { ...BASE_HEADERS, 'Cache-Control': 'no-store' };

export default async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: BASE_HEADERS });
    }

    const cache = await readEvents();
    if (!cache) {
        return new Response(
            JSON.stringify({ events: [], lastUpdated: null, count: 0 }),
            { status: 200, headers: HEADERS_MISS }
        );
    }

    const today = todayInVienna();
    const events = (cache.events ?? []).filter((e) => e.date >= today);

    return new Response(
        JSON.stringify({ events, lastUpdated: cache.lastUpdated, count: events.length }),
        { status: 200, headers: HEADERS_HIT }
    );
};
