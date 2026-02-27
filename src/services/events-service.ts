import { EventData } from '../../shared/types/events';

interface CachedData<T> {
    data: T;
    timestamp: number;
}

export class EventService {
    private static CACHE_KEY = 'cached_events';
    private static CACHE_DURATION = 5 * 60 * 1000;

    static async getEvents(forceRefresh = false): Promise<EventData[]> {
        if (!forceRefresh) {
            const cachedEvents = this.getFromCache();
            if (cachedEvents) return cachedEvents;
        }

        try {
            const url = forceRefresh
                ? '/.netlify/functions/get-events?refresh=true'
                : '/.netlify/functions/get-events';

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch events');
            }

            if (!data.events || !Array.isArray(data.events)) {
                throw new Error('Events data is invalid or missing');
            }

            const events: EventData[] = data.events;
            this.saveToCache(events);
            return events;
        } catch (error) {
            console.error('Error fetching events:', error);

            const expiredCache = this.getFromCache(true);
            if (expiredCache) return expiredCache;

            throw error;
        }
    }

    static async triggerUpdate(url?: string): Promise<boolean> {
        try {
            const endpoint = url
                ? `/.netlify/functions/trigger-scrape?url=${encodeURIComponent(url)}`
                : '/.netlify/functions/trigger-scrape';

            const response = await fetch(endpoint);

            if (!response.ok) {
                throw new Error(`Failed to trigger update: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to trigger update');
            }

            return true;
        } catch (error) {
            console.error('Error triggering update:', error);
            return false;
        }
    }

    private static getFromCache(ignoreExpiration = false): EventData[] | null {
        const cached = localStorage.getItem(this.CACHE_KEY);
        if (!cached) return null;

        try {
            const parsedCache: CachedData<EventData[]> = JSON.parse(cached);
            const age = Date.now() - parsedCache.timestamp;

            if (ignoreExpiration || age < this.CACHE_DURATION) {
                return parsedCache.data;
            }
        } catch (e) {
            console.error('Error parsing cache:', e);
            localStorage.removeItem(this.CACHE_KEY);
        }

        return null;
    }

    private static saveToCache(data: EventData[]): void {
        const cacheData: CachedData<EventData[]> = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    }

    static async debugFetchEvents(): Promise<void> {
        try {
            console.log('DIRECT DEBUG FETCH:');

            const endpoints = [
                '/.netlify/functions/get-events',
                '/.netlify/functions/get-events?refresh=true',
                '/.netlify/functions/test-events'
            ];

            for (const endpoint of endpoints) {
                console.log(`Fetching ${endpoint}...`);
                const startTime = Date.now();

                try {
                    const response = await fetch(endpoint);
                    console.log(`${endpoint} response in ${Date.now() - startTime}ms:`, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: Object.fromEntries([...response.headers.entries()])
                    });

                    if (response.ok) {
                        const data = await response.json();
                        console.log(`${endpoint} data:`, {
                            success: data.success,
                            mode: data.mode,
                            count: data.events?.length,
                            fromCache: data.fromCache
                        });

                        if (data.events && data.events.length > 0) {
                            console.log('Attempting to directly use events from this endpoint...');
                            this.saveToCache(data.events);
                            window.location.reload();
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching ${endpoint}:`, error);
                }
            }
        } catch (e) {
            console.error('Debug fetch error:', e);
        }
    }
}
