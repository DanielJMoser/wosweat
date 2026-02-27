import { Handler } from '@netlify/functions';
import { getStoredEvents, scrapeEvents, storeEvents } from './utils/scraper-utils';
import { EventData } from '../../shared/types/events';

export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const forceRefresh = event.queryStringParameters?.refresh === 'true';

        if (!forceRefresh) {
            if (event.queryStringParameters?.test === 'true') {
                const sampleEvents = generateSampleEvents();
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        events: sampleEvents,
                        count: sampleEvents.length,
                        fromCache: false,
                        mode: 'test',
                        timestamp: new Date().toISOString()
                    })
                };
            }

            const cachedEvents = await getStoredEvents();
            if (cachedEvents.length > 0) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        events: cachedEvents,
                        count: cachedEvents.length,
                        fromCache: true,
                        mode: 'cached',
                        timestamp: new Date().toISOString()
                    })
                };
            }
        }

        const targetSites = [
            'https://www.treibhaus.at/programm',
            'https://pmk.or.at/de/events/',
            'https://artilleryproductions.bigcartel.com/',
            'https://diebaeckerei.at/programm/'
        ];

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

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    events: currentEvents,
                    count: currentEvents.length,
                    fromCache: false,
                    mode: 'scraped',
                    timestamp: new Date().toISOString()
                })
            };
        }

        const sampleEvents = generateSampleEvents();
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                events: sampleEvents,
                count: sampleEvents.length,
                fromCache: false,
                mode: 'fallback',
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Error retrieving events:', error);

        const sampleEvents = generateSampleEvents();
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                events: sampleEvents,
                count: sampleEvents.length,
                fromCache: false,
                mode: 'error',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error retrieving events'
            })
        };
    }
};

function generateSampleEvents() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return [
        {
            id: 'sample-1',
            title: 'Live Music Night',
            date: today.toISOString().split('T')[0],
            description: 'Join us for a night of live music featuring local bands and performers.',
            url: 'https://www.treibhaus.at/programm',
            venue: 'Treibhaus Innsbruck',
            imageUrl: 'https://via.placeholder.com/300?text=Live+Music'
        },
        {
            id: 'sample-2',
            title: 'Poetry Slam',
            date: tomorrow.toISOString().split('T')[0],
            description: 'Experience the best poets in the region competing in our monthly poetry slam.',
            url: 'https://www.treibhaus.at/programm',
            venue: 'Treibhaus Innsbruck',
            imageUrl: 'https://via.placeholder.com/300?text=Poetry+Slam'
        },
        {
            id: 'sample-3',
            title: 'Art Exhibition Opening',
            date: nextWeek.toISOString().split('T')[0],
            description: 'Opening night for our new contemporary art exhibition featuring works from local artists.',
            url: 'https://pmk.or.at/de/events/',
            venue: 'PMK Innsbruck',
            imageUrl: 'https://via.placeholder.com/300?text=Art+Exhibition'
        }
    ];
}
