import { Handler } from '@netlify/functions';
import { scrapeEvents, storeEvents } from './utils/scraper-utils';
import {EventData} from "../../shared/types/events";

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

    console.log('Trigger scrape function called with params:', event.queryStringParameters);

    // Optional: Add authentication for the trigger
    const authToken = event.headers.authorization;
    if (process.env.TRIGGER_SECRET && (!authToken || authToken !== `Bearer ${process.env.TRIGGER_SECRET}`)) {
        console.log('Unauthorized trigger attempt');
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ success: false, error: 'Unauthorized' })
        };
    }

    try {
        // Get the target sites to scrape
        const targetSites = [
            'https://www.treibhaus.at/programm',
            'https://pmk.or.at/termine'
        ];

        // Use a custom URL if provided
        if (event.queryStringParameters?.url) {
            targetSites.push(event.queryStringParameters.url);
        }

        // Determine if we need JavaScript rendering
        const useJsRendering = event.queryStringParameters?.js === 'true';

        console.log(`Starting to scrape ${targetSites.length} sites`);

        let allEvents: EventData[] = [];

        // Try each site in sequence
        for (const site of targetSites) {
            try {
                console.log(`Scraping ${site}`);
                const siteEvents = await scrapeEvents(site, useJsRendering);
                console.log(`Successfully scraped ${siteEvents.length} events from ${site}`);
                allEvents = [...allEvents, ...siteEvents];
            } catch (siteError) {
                console.error(`Error scraping ${site}:`, siteError);
                // Continue with the next site
            }
        }

        // Store all events
        if (allEvents.length > 0) {
            console.log(`Storing ${allEvents.length} total events`);
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