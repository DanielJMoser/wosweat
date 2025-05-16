import { schedule } from '@netlify/functions';
import { EventData } from '../../shared/types/events';
import { scrapeEvents, storeEvents } from './utils/scraper-utils';

// Run every day at midnight UTC
export const handler = schedule('0 0 * * *', async () => {
    console.log('Running scheduled event scraper');

    try {
        // Define the websites to scrape
        const targetSites = [
            'https://www.treibhaus.at/programm',
            'https://pmk.or.at/termine',
            'https://artilleryproductions.bigcartel.com/',
            'https://www.music-hall.at/veranstaltungen/',
            'https://diebaeckerei.at/programm/'
        ];

        // Scrape each site
        let allEvents: EventData[] = [];

        // Track any errors that occur during scraping
        const errors: Error[] = [];

        // Process sites in parallel for better performance
        const scrapePromises = targetSites.map(async (site) => {
            try {
                // Determine if the site needs JavaScript rendering from the scrapeEvents function
                // The function will handle this internally now based on the site URL
                const events = await scrapeEvents(site);
                console.log(`Scraped ${events.length} events from ${site}`);
                return events;
            } catch (error) {
                console.error(`Error scraping ${site}:`, error);
                errors.push(error instanceof Error ? error : new Error(`Unknown error scraping ${site}`));
                return [] as EventData[];
            }
        });

        // Wait for all scraping to complete
        const results = await Promise.all(scrapePromises);

        // Combine all events
        allEvents = results.flat();

        // Store the combined events
        await storeEvents(allEvents);

        console.log(`Successfully scraped and stored ${allEvents.length} events`);

        // Log any errors that occurred
        if (errors.length > 0) {
            console.warn(`Completed with ${errors.length} errors`);
        }

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