import { Handler } from '@netlify/functions';
import { getStoredEvents, scrapeEvents, storeEvents } from './utils/scraper-utils';
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
        // Log query parameters for debugging
        console.log('Query parameters:', event.queryStringParameters);

        // Force a refresh if the force parameter is set to true
        const forceRefresh = event.queryStringParameters?.refresh === 'true';

        // Skip cache and test mode if we're forcing a refresh
        if (!forceRefresh) {
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
                        mode: 'test',
                        timestamp: new Date().toISOString()
                    })
                };
            }

            // Try to get cached events first (if not forcing a refresh)
            const cachedEvents = await getStoredEvents();
            if (cachedEvents.length > 0) {
                console.log(`Using ${cachedEvents.length} cached events`);
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

        console.log('Fetching fresh events data');

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

        console.log(`Retrieved a total of ${allEvents.length} events from all sites`);

        // Store events for future use if we found any
        if (allEvents.length > 0) {
            try {
                await storeEvents(allEvents);
                console.log(`Successfully stored ${allEvents.length} events`);
            } catch (storageError) {
                console.error('Failed to store events:', storageError);
            }

            // Return the real events we found
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    events: allEvents,
                    count: allEvents.length,
                    fromCache: false,
                    mode: 'scraped',
                    timestamp: new Date().toISOString()
                })
            };
        }

        // If we didn't find any events, use fallback sample events
        console.log('No events found from any source. Using fallback sample events.');
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
                mode: 'error',
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