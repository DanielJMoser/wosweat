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

        // Show all state for debugging
        this.logBrowserState();

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

            // Log the network request details
            const startTime = Date.now();

            const response = await fetch(url);

            console.log(`Network response received in ${Date.now() - startTime}ms, status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`Response parsed from get-events:`, data);

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch events');
            }

            // Validate events array
            if (!data.events || !Array.isArray(data.events)) {
                console.error('Invalid events data received:', data);
                throw new Error('Events data is invalid or missing');
            }

            const events: EventData[] = data.events;
            console.log(`Received ${events.length} events from API with mode: ${data.mode || 'unknown'}`);

            // Detailed logging of the first event if available
            if (events.length > 0) {
                console.log('First event example:', JSON.stringify(events[0], null, 2));
            }

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

            // Log the network request details
            const startTime = Date.now();

            const response = await fetch(endpoint);

            console.log(`Network response received in ${Date.now() - startTime}ms, status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`Failed to trigger update: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Trigger response:', data);

            if (!data.success) {
                throw new Error(data.error || 'Failed to trigger update');
            }

            console.log(`Scraper update triggered successfully, found ${data.count || 0} events`);
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
                console.log(`Found ${parsedCache.data.length} events in valid cache`);
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

    /**
     * Log browser state for debugging
     */
    private static logBrowserState(): void {
        // Log network status
        console.log(`Network status: ${navigator.onLine ? 'online' : 'offline'}`);

        // Log localStorage state
        try {
            console.log('LocalStorage state:');
            const cacheKeys = Object.keys(localStorage).filter(key =>
                key === this.CACHE_KEY || key.includes('event')
            );

            for (const key of cacheKeys) {
                const value = localStorage.getItem(key);
                console.log(`- ${key}: ${value ? `${value.substring(0, 50)}...` : 'null'}`);
            }
        } catch (e) {
            console.error('Error accessing localStorage:', e);
        }
    }

    /**
     * Direct debug method to fetch and display raw event data
     */
    static async debugFetchEvents(): Promise<void> {
        try {
            console.log('DIRECT DEBUG FETCH:');

            const endpoints = [
                '/.netlify/functions/get-events',
                '/.netlify/functions/get-events?refresh=true',
                '/.netlify/functions/test-events' // Test endpoint that always returns events
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

                        // Test if we can directly load these events
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