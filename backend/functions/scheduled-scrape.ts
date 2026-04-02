import { schedule } from '@netlify/functions';
import { EventData } from '@wosweat/shared/types/events';
import { TARGET_SITES } from '@wosweat/shared/constants';
import { scrapeEvents } from './utils/scraper';
import { storeEvents } from './utils/storage';

export const handler = schedule('0 0 * * *', async () => {
    try {
        const errors: Error[] = [];

        const results = await Promise.all(
            TARGET_SITES.map(async (site: string) => {
                try {
                    return await scrapeEvents(site);
                } catch (error) {
                    console.error(`Error scraping ${site}:`, error);
                    errors.push(error instanceof Error ? error : new Error(`Unknown error scraping ${site}`));
                    return [] as EventData[];
                }
            })
        );

        const allEvents = results.flat();
        await storeEvents(allEvents);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Scraped ${allEvents.length} events from ${TARGET_SITES.length} sites`,
                errors: errors.length > 0 ? errors.map(e => e.message) : undefined
            })
        };
    } catch (error) {
        console.error('Error in scheduled scraper:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
});
