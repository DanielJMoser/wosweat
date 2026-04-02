import { Handler } from '@netlify/functions';
import { EventData } from '@wosweat/shared/types/events';
import { TARGET_SITES } from '@wosweat/shared/constants';
import { getStoredEvents, storeEvents } from './utils/storage';
import { scrapeEvents } from './utils/scraper';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300'
};

export const handler: Handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    try {
        const forceRefresh = event.queryStringParameters?.refresh === 'true';

        if (!forceRefresh) {
            const cachedEvents = await getStoredEvents();
            if (cachedEvents.length > 0) {
                return {
                    statusCode: 200,
                    headers: CORS_HEADERS,
                    body: JSON.stringify({
                        success: true,
                        events: cachedEvents,
                        count: cachedEvents.length,
                        fromCache: true,
                        timestamp: new Date().toISOString()
                    })
                };
            }
        }

        const useJsRendering = event.queryStringParameters?.js === 'true';
        let allEvents: EventData[] = [];

        for (const site of TARGET_SITES) {
            try {
                const siteEvents = await scrapeEvents(site, useJsRendering);
                allEvents = [...allEvents, ...siteEvents];
            } catch (siteError) {
                console.error(`Error scraping ${site}:`, siteError);
            }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const currentEvents = allEvents.filter(event => {
            try {
                const eventDate = new Date(event.date);
                eventDate.setHours(0, 0, 0, 0);
                return eventDate >= today;
            } catch {
                return false;
            }
        });

        if (currentEvents.length > 0) {
            try {
                await storeEvents(currentEvents);
            } catch (storageError) {
                console.error('Failed to store events:', storageError);
            }
        }

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: true,
                events: currentEvents,
                count: currentEvents.length,
                fromCache: false,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Error retrieving events:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: false,
                events: [],
                count: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};
