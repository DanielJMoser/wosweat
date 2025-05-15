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
        console.log(`[EventService] getEvents called with forceRefresh=${forceRefresh}`);
        // Check cache first if not forcing a refresh
        if (!forceRefresh) {
            const cachedEvents = this.getFromCache();
            if (cachedEvents) {
                console.log('[EventService] Using cached events');
                return cachedEvents;
            }
        }

        // If not in cache or expired, fetch from API
        try {
            console.log('[EventService] Fetching events from API');
            const response = await fetch('/.netlify/functions/get-events');
            if (!response.ok) {
                throw new Error(`Failed to fetch events: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[EventService] API response:', data);

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch events');
            }

            const events: EventData[] = data.events;
            console.log(`[EventService] Retrieved ${events.length} events from API`);

            // Save to cache
            this.saveToCache(events);

            return events;
        } catch (error) {
            console.error('[EventService] Error fetching events:', error);

            // If we have expired cache, use it as fallback
            const expiredCache = this.getFromCache(true);
            if (expiredCache) {
                console.log('[EventService] Using expired cache as fallback');
                return expiredCache;
            }

            throw error;
        }
    }

    /**
     * Trigger a manual update of the events data
     */
    static async triggerUpdate(url?: string): Promise<boolean> {
        console.log('[EventService] triggerUpdate called');
        try {
            const endpoint = url
                ? `/.netlify/functions/trigger-scrape?url=${encodeURIComponent(url)}`
                : '/.netlify/functions/trigger-scrape';

            console.log(`[EventService] Calling endpoint: ${endpoint}`);
            const response = await fetch(endpoint);
            if (!response.ok) {
                throw new Error(`Failed to trigger update: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[EventService] Trigger response:', data);

            if (!data.success) {
                throw new Error(data.error || 'Failed to trigger update');
            }

            // REMOVED: Do not fetch events here to avoid double fetch
            // Let the caller handle refreshing the data

            return true;
        } catch (error) {
            console.error('[EventService] Error triggering update:', error);
            return false;
        }
    }

    /**
     * Get events from the local cache
     */
    private static getFromCache(ignoreExpiration = false): EventData[] | null {
        const cached = localStorage.getItem(this.CACHE_KEY);
        if (!cached) return null;

        try {
            const parsedCache: CachedData<EventData[]> = JSON.parse(cached);
            const now = Date.now();

            if (ignoreExpiration || now - parsedCache.timestamp < this.CACHE_DURATION) {
                return parsedCache.data;
            }
        } catch (e) {
            localStorage.removeItem(this.CACHE_KEY);
        }

        return null;
    }

    /**
     * Save events to the local cache
     */
    private static saveToCache(data: EventData[]): void {
        const cacheData: CachedData<EventData[]> = {
            data,
            timestamp: Date.now()
        };

        localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    }
}