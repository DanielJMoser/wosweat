import { scrapeAllVenues } from './utils/scraper';
import { writeEvents } from './utils/blobs';

const HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
};

export default async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: HEADERS });
    }

    if (req.method !== 'POST') {
        return new Response(null, { status: 405, headers: HEADERS });
    }

    if (!process.env.TRIGGER_SECRET) {
        return new Response(null, { status: 503, headers: HEADERS });
    }
    if (req.headers.get('authorization') !== `Bearer ${process.env.TRIGGER_SECRET}`) {
        return new Response(null, { status: 401, headers: HEADERS });
    }

    const events = await scrapeAllVenues();
    await writeEvents(events);
    return new Response(
        JSON.stringify({ count: events.length }),
        { status: 200, headers: HEADERS }
    );
};