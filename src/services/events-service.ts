import { EventData } from '../../shared/types/events';

interface CachedData<T> {
    data: T;
    timestamp: number;
}

export class EventService {
    private static CACHE_KEY = 'cached_events';
    private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    /**
     * Get events from the API or cache
     */
    static async getEvents(forceRefresh = false): Promise<EventData[]> {
        console.log(`EventService.getEvents(forceRefresh: ${forceRefresh})`);

        // Check cache first if not forcing a refresh
        if (!forceRefresh) {
            const cachedEvents = this.getFromCache();
            if (cachedEvents) {
                console.log(`Using ${cachedEvents.length} cached events from local storage`);
                return cachedEvents;
            }
        }

        // If not in cache or expired, fetch from API
        try {
            // Add the refresh parameter if we're forcing a refresh
            const url = forceRefresh
                ? '/.netlify/functions/get-events?refresh=true'
                : '/.netlify/functions/get-events';

            console.log(`Fetching events from ${url}`);
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch events: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`Response from get-events:`, data);

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch events');
            }

            const events: EventData[] = data.events;
            console.log(`Received ${events.length} events from API`);

            // Save to cache
            this.saveToCache(events);

            return events;
        } catch (error) {
            console.error('Error fetching events:', error);

            // If we have expired cache, use it as fallback
            const expiredCache = this.getFromCache(true);
            if (expiredCache) {
                console.log(`Using ${expiredCache.length} expired cached events as fallback`);
                return expiredCache;
            }

            throw error;
        }
    }

    /**
     * Trigger a manual update of the events data
     */
    static async triggerUpdate(url?: string): Promise<boolean> {
        try {
            const endpoint = url
                ? `/.netlify/functions/trigger-scrape?url=${encodeURIComponent(url)}`
                : '/.netlify/functions/trigger-scrape';

            console.log(`Triggering scraper update via ${endpoint}`);
            const response = await fetch(endpoint);

            if (!response.ok) {
                throw new Error(`Failed to trigger update: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Trigger response:', data);

            if (!data.success) {
                throw new Error(data.error || 'Failed to trigger update');
            }

            console.log('Scraper update triggered successfully');
            return true;
        } catch (error) {
            console.error('Error triggering update:', error);
            return false;
        }
    }

    /**
     * Get events from the local cache
     */
    private static getFromCache(ignoreExpiration = false): EventData[] | null {
        const cached = localStorage.getItem(this.CACHE_KEY);
        if (!cached) {
            console.log('No events in localStorage cache');
            return null;
        }

        try {
            const parsedCache: CachedData<EventData[]> = JSON.parse(cached);
            const now = Date.now();
            const age = now - parsedCache.timestamp;

            console.log(`Cache age: ${Math.round(age/1000)} seconds (max: ${Math.round(this.CACHE_DURATION/1000)} seconds)`);

            if (ignoreExpiration || age < this.CACHE_DURATION) {
                return parsedCache.data;
            } else {
                console.log('Cache expired');
            }
        } catch (e) {
            console.error('Error parsing cache:', e);
            localStorage.removeItem(this.CACHE_KEY);
        }

        return null;
    }

    /**
     * Save events to the local cache
     */
    private static saveToCache(data: EventData[]): void {
        console.log(`Saving ${data.length} events to localStorage cache`);
        const cacheData: CachedData<EventData[]> = {
            data,
            timestamp: Date.now()
        };

        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    }
}