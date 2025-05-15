import { schedule, Config } from '@netlify/functions';
import { EventData } from '../../shared/types/events';
import { scrapeEvents, storeEvents } from './utils/scraper-utils';

// Define the handler with schedule configuration
export const handler = schedule('0 0 * * *', async (event) => {
    console.log('Running scheduled event scraper');

    try {
        // Define the websites to scrape
        const targetSites = [
            'https://www.treibhaus.at/programm',
            // Add more event sites here
        ];

        // Scrape each site
        let allEvents: EventData[] = [];

        // Track any errors that occur during scraping
        const errors: Error[] = [];

        // Process sites in parallel for better performance
        const scrapePromises = targetSites.map(async (site) => {
            try {
                // Determine if the site needs JavaScript rendering
                // This could be a configuration in a database or a predefined mapping
                const needsJsRendering = site.includes('javascript-heavy-site.com');

                // Scrape the site
                const events = await scrapeEvents(site, needsJsRendering);
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

// Export config for scheduled function
export const config: Config = {
    schedule: '0 0 * * *' // Run at midnight UTC every day
};