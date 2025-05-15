import { Handler } from '@netlify/functions';
import { scrapeEvents, storeEvents } from './utils/scraper-utils';
import { EventData } from '../../shared/types/events';

export const handler: Handler = async (event) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    // Handle OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Optional: Add authentication for the trigger
    const authToken = event.headers.authorization;
    if (process.env.TRIGGER_SECRET && (!authToken || authToken !== `Bearer ${process.env.TRIGGER_SECRET}`)) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Unauthorized' })
        };
    }

    try {
        console.log('Manual trigger received with params:', event.queryStringParameters);

        // If a specific URL was provided, scrape only that URL
        if (event.queryStringParameters?.url) {
            const targetUrl = event.queryStringParameters.url;
            const useJsRendering = event.queryStringParameters?.js === 'true';

            console.log(`Scraping single URL: ${targetUrl}`);
            const events = await scrapeEvents(targetUrl, useJsRendering);

            // Store events
            await storeEvents(events);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: `Scraped and stored ${events.length} events from ${targetUrl}`,
                    count: events.length
                })
            };
        }

        // If no URL provided, scrape all configured sites
        console.log('Scraping all configured sites');
        const targetSites = [
            'https://www.treibhaus.at/programm',
            'https://pmk.or.at/termine'
            // Add more sites as needed
        ];

        const useJsRendering = event.queryStringParameters?.js === 'true';
        let allEvents: EventData[] = [];

        // Scrape each site
        for (const site of targetSites) {
            try {
                console.log(`Attempting to scrape ${site}`);
                const siteEvents = await scrapeEvents(site, useJsRendering);
                console.log(`Successfully scraped ${siteEvents.length} events from ${site}`);
                allEvents = [...allEvents, ...siteEvents];
            } catch (siteError) {
                console.error(`Error scraping ${site}:`, siteError);
                // Continue with next site
            }
        }

        console.log(`Total events scraped: ${allEvents.length}`);

        // Store all events
        if (allEvents.length > 0) {
            await storeEvents(allEvents);
            console.log(`Successfully stored ${allEvents.length} events`);
        } else {
            console.log('No events found to store');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Scraped and stored ${allEvents.length} events from ${targetSites.length} sites`,
                count: allEvents.length
            })
        };
    } catch (error) {
        console.error('Error in manual scraper trigger:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};