import { Handler } from '@netlify/functions';
import { scrapeEvents, storeEvents } from './utils/scraper-utils';
import { EventData } from "../../shared/types/events";

export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const authToken = event.headers.authorization;
    if (process.env.TRIGGER_SECRET && (!authToken || authToken !== `Bearer ${process.env.TRIGGER_SECRET}`)) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ success: false, error: 'Unauthorized' })
        };
    }

    try {
        const targetSites = [
            'https://www.treibhaus.at/programm',
            'https://pmk.or.at/de/events/',
            'https://artilleryproductions.bigcartel.com/',
            'https://www.music-hall.at/veranstaltungen/',
            'https://diebaeckerei.at/programm/'
        ];

        if (event.queryStringParameters?.url) {
            targetSites.push(event.queryStringParameters.url);
        }

        const useJsRendering = event.queryStringParameters?.js === 'true';
        let allEvents: EventData[] = [];

        for (const site of targetSites) {
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
