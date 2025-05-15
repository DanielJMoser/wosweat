import { Handler } from '@netlify/functions';
import { getStoredEvents, scrapeEvents } from './utils/scraper-utils';

export const handler: Handler = async (event) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
    };

    // Handle OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // Retrieve stored events
        let events = await getStoredEvents();
        let fromCache = true;

        // If no events are in the cache or a force refresh is requested, fetch fresh data
        if (events.length === 0 || event.queryStringParameters?.refresh === 'true') {
            const targetUrl = event.queryStringParameters?.url || 'https://www.treibhaus.at/programm';
            const useJsRendering = event.queryStringParameters?.js === 'true';

            events = await scrapeEvents(targetUrl, useJsRendering);
            fromCache = false;

            console.log(`Retrieved ${events.length} fresh events`);
        } else {
            console.log(`Retrieved ${events.length} cached events`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                events,
                count: events.length,
                fromCache,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Error retrieving events:', error);

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