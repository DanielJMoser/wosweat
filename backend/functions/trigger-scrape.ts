import { Handler } from '@netlify/functions';
import { EventData } from '@wosweat/shared/types/events';
import { TARGET_SITES } from '@wosweat/shared/constants';
import { scrapeEvents } from './utils/scraper';
import { storeEvents } from './utils/storage';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const handler: Handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    const authToken = event.headers.authorization;
    if (process.env.TRIGGER_SECRET && (!authToken || authToken !== `Bearer ${process.env.TRIGGER_SECRET}`)) {
        return {
            statusCode: 401,
            headers: CORS_HEADERS,
            body: JSON.stringify({ success: false, error: 'Unauthorized' })
        };
    }

    try {
        const sites: string[] = [...TARGET_SITES];
        if (event.queryStringParameters?.url) {
            sites.push(event.queryStringParameters.url);
        }

        const useJsRendering = event.queryStringParameters?.js === 'true';
        let allEvents: EventData[] = [];

        for (const site of sites) {
            try {
                const siteEvents = await scrapeEvents(site, useJsRendering);
                allEvents = [...allEvents, ...siteEvents];
            } catch (siteError) {
                console.error(`Error scraping ${site}:`, siteError);
            }
        }

        if (allEvents.length > 0) {
            await storeEvents(allEvents);
        }

        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: true,
                message: `Scraped and stored ${allEvents.length} events from ${sites.length} sites`,
                count: allEvents.length
            })
        };
    } catch (error) {
        console.error('Error in manual scraper trigger:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};
