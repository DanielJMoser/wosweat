import { Handler } from '@netlify/functions';
import { scrapeEvents, storeEvents } from './utils/scraper-utils';

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
        // Get the target URL from query parameters or use a default
        const targetUrl = event.queryStringParameters?.url || 'https://www.treibhaus.at/programm';

        // Determine if we need JavaScript rendering
        const useJsRendering = event.queryStringParameters?.js === 'true';

        // Scrape events
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