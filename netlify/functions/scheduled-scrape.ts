import { schedule } from '@netlify/functions';
import { EventData } from '../../shared/types/events';
import { scrapeEvents, storeEvents } from './utils/scraper-utils';

export const handler = schedule('0 0 * * *', async () => {
    try {
        const targetSites = [
            'https://www.treibhaus.at/programm',
            'https://pmk.or.at/de/events/',
            'https://artilleryproductions.bigcartel.com/',
            'https://www.music-hall.at/veranstaltungen/',
            'https://diebaeckerei.at/programm/'
        ];

        const errors: Error[] = [];

        const results = await Promise.all(
            targetSites.map(async (site) => {
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
                message: `Scraped ${allEvents.length} events from ${targetSites.length} sites`,
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
