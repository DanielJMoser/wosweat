import { Handler } from '@netlify/functions';
import { getStoredEvents, scrapeEvents } from './utils/scraper-utils';
import { EventData } from '../../shared/types/events';

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
        // Check if we're in test mode
        if (event.queryStringParameters?.test === 'true') {
            console.log('Running in test mode with sample events');
            const sampleEvents = generateSampleEvents();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    events: sampleEvents,
                    count: sampleEvents.length,
                    fromCache: false,
                    timestamp: new Date().toISOString()
                })
            };
        }

        // Retrieve stored events
        let events = await getStoredEvents();
        let fromCache = true;

        console.log(`Retrieved ${events.length} events from storage`);

        // If no events are in the cache or a force refresh is requested, fetch fresh data
        if (events.length === 0 || event.queryStringParameters?.refresh === 'true') {
            console.log('No cached events found or refresh requested. Fetching fresh data.');

            // Attempt to scrape events from the target sites
            const targetSites = [
                'https://www.treibhaus.at/programm',
                'https://pmk.or.at/termine'
            ];

            const useJsRendering = event.queryStringParameters?.js === 'true';

            let allEvents: EventData[] = [];

            // Try each site in sequence
            for (const site of targetSites) {
                try {
                    console.log(`Attempting to scrape ${site}`);
                    const siteEvents = await scrapeEvents(site, useJsRendering);
                    console.log(`Successfully scraped ${siteEvents.length} events from ${site}`);
                    allEvents = [...allEvents, ...siteEvents];
                } catch (siteError) {
                    console.error(`Error scraping ${site}:`, siteError);
                    // Continue with the next site
                }
            }

            events = allEvents;
            fromCache = false;

            console.log(`Retrieved ${events.length} fresh events in total`);

            // If we still have no events, use fallback sample events
            if (events.length === 0) {
                console.log('No events found from any source. Using fallback sample events.');
                events = generateSampleEvents();
            }
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

        // Return sample events in case of any error
        const sampleEvents = generateSampleEvents();

        return {
            statusCode: 200, // Return 200 to avoid breaking the frontend
            headers,
            body: JSON.stringify({
                success: true,
                events: sampleEvents,
                count: sampleEvents.length,
                fromCache: false,
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error retrieving events'
            })
        };
    }
};

// Generate sample events for testing or as fallback
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
            url: 'https://pmk.or.at/termine',
            venue: 'PMK Innsbruck',
            imageUrl: 'https://via.placeholder.com/300?text=Art+Exhibition'
        }
    ];
}