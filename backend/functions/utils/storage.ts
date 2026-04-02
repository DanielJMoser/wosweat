import fs from 'fs';
import path from 'path';
import { EventData } from '@wosweat/shared/types/events';
import { CACHE_DURATION_MS } from '@wosweat/shared/constants';

const CACHE_FILE = path.join('/tmp', 'cached_events.json');

export async function storeEvents(events: EventData[]): Promise<void> {
    try {
        const tmpDir = '/tmp';
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        fs.writeFileSync(CACHE_FILE, JSON.stringify({
            events,
            timestamp: new Date().toISOString()
        }), 'utf8');
    } catch (error) {
        console.error('Error storing events:', error);
        throw error;
    }
}

export async function getStoredEvents(): Promise<EventData[]> {
    try {
        if (!fs.existsSync(CACHE_FILE)) return [];

        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        const cacheAgeMs = Date.now() - new Date(data.timestamp).getTime();

        if (cacheAgeMs > CACHE_DURATION_MS) {
            fs.unlinkSync(CACHE_FILE);
            return [];
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return (data.events || []).filter((event: EventData) => {
            try {
                const eventDate = new Date(event.date);
                eventDate.setHours(0, 0, 0, 0);
                return eventDate >= today;
            } catch {
                return false;
            }
        });
    } catch (error) {
        console.error('Error reading cached events:', error);
        return [];
    }
}
