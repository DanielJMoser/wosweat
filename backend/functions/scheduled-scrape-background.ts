import type { Config } from '@netlify/functions';
import { scrapeAllVenues } from './utils/scraper';
import { writeEvents } from './utils/blobs';
import { viennaHour } from './utils/timezone';

export default async () => {
    if (viennaHour() !== 0) {
        return new Response(null, { status: 204 });
    }

    const events = await scrapeAllVenues();
    await writeEvents(events);
    return new Response(`Stored ${events.length} events`, { status: 200 });
};

export const config: Config = {
    schedule: '1 22,23 * * *',
};
