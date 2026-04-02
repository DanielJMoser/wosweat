import { Handler } from '@netlify/functions';
import { EventData } from '@wosweat/shared/types/events';

const sampleEvents: EventData[] = [
    {
        id: 'test-1',
        title: 'Direct Test Event 1',
        date: new Date().toISOString().split('T')[0],
        description: 'This is a test event directly from the test-events endpoint.',
        url: 'https://example.com/test1',
        venue: 'Test Venue',
        imageUrl: 'https://via.placeholder.com/300?text=Test+Event+1'
    },
    {
        id: 'test-2',
        title: 'Direct Test Event 2',
        date: (() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        })(),
        description: 'Another test event to verify the frontend display is working correctly.',
        url: 'https://example.com/test2',
        venue: 'Another Test Venue',
        imageUrl: 'https://via.placeholder.com/300?text=Test+Event+2'
    }
];

export const handler: Handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            events: sampleEvents,
            count: sampleEvents.length,
            fromCache: false,
            mode: 'test-endpoint',
            timestamp: new Date().toISOString()
        })
    };
};
