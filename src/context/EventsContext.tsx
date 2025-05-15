import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { EventData } from '../../shared/types/events';
import { EventService } from '../services/events-service';

// State type definition
interface EventsState {
    events: EventData[];
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
}

// Action type definitions
type EventsAction =
    | { type: 'FETCH_EVENTS_START' }
    | { type: 'FETCH_EVENTS_SUCCESS', payload: EventData[] }
    | { type: 'FETCH_EVENTS_ERROR', payload: string }
    | { type: 'TRIGGER_UPDATE_START' }
    | { type: 'TRIGGER_UPDATE_SUCCESS', payload: EventData[] }
    | { type: 'TRIGGER_UPDATE_ERROR', payload: string };

// Initial state
const initialState: EventsState = {
    events: [],
    loading: false,
    error: null,
    lastUpdated: null,
};

// Context interface
interface EventsContextType {
    state: EventsState;
    dispatch: React.Dispatch<EventsAction>;
    fetchEvents: (forceRefresh?: boolean) => Promise<void>;
    triggerUpdate: (url?: string) => Promise<void>;
}

// Create the context
const EventsContext = createContext<EventsContextType>({
    state: initialState,
    dispatch: () => null,
    fetchEvents: async () => {},
    triggerUpdate: async () => {},
});

// Reducer function
const eventsReducer = (state: EventsState, action: EventsAction): EventsState => {
    switch (action.type) {
        case 'FETCH_EVENTS_START':
            console.log('FETCH_EVENTS_START action');
            return {
                ...state,
                loading: true,
                error: null,
            };
        case 'FETCH_EVENTS_SUCCESS':
            console.log(`FETCH_EVENTS_SUCCESS action with ${action.payload.length} events`);
            return {
                ...state,
                loading: false,
                events: action.payload,
                lastUpdated: new Date(),
                error: null,
            };
        case 'FETCH_EVENTS_ERROR':
            console.log(`FETCH_EVENTS_ERROR action: ${action.payload}`);
            return {
                ...state,
                loading: false,
                error: action.payload,
            };
        case 'TRIGGER_UPDATE_START':
            console.log('TRIGGER_UPDATE_START action');
            return {
                ...state,
                loading: true,
                error: null,
            };
        case 'TRIGGER_UPDATE_SUCCESS':
            console.log(`TRIGGER_UPDATE_SUCCESS action with ${action.payload.length} events`);
            return {
                ...state,
                loading: false,
                events: action.payload,
                lastUpdated: new Date(),
                error: null,
            };
        case 'TRIGGER_UPDATE_ERROR':
            console.log(`TRIGGER_UPDATE_ERROR action: ${action.payload}`);
            return {
                ...state,
                loading: false,
                error: action.payload,
            };
        default:
            return state;
    }
};

// Provider component
export const EventsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(eventsReducer, initialState);

    // Fetch events function
    const fetchEvents = async (forceRefresh = false) => {
        dispatch({ type: 'FETCH_EVENTS_START' });
        try {
            console.log(`Fetching events (forceRefresh: ${forceRefresh})`);
            const events = await EventService.getEvents(forceRefresh);
            console.log(`Fetched ${events.length} events:`, events);
            dispatch({ type: 'FETCH_EVENTS_SUCCESS', payload: events });
        } catch (error) {
            console.error('Error fetching events:', error);
            dispatch({
                type: 'FETCH_EVENTS_ERROR',
                payload: error instanceof Error ? error.message : 'Unknown error'
            });

            // Try the test endpoint as a fallback
            try {
                console.log('Trying test endpoint as fallback...');
                const response = await fetch('/.netlify/functions/test-events');
                if (response.ok) {
                    const data = await response.json();
                    if (data.events && data.events.length > 0) {
                        console.log(`Loaded ${data.events.length} fallback events from test endpoint`);
                        dispatch({ type: 'FETCH_EVENTS_SUCCESS', payload: data.events });
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
            }
        }
    };

    // Trigger manual update function
    const triggerUpdate = async (url?: string) => {
        dispatch({ type: 'TRIGGER_UPDATE_START' });
        try {
            console.log('Triggering manual update...');

            // Try direct endpoint first for testing
            try {
                console.log('Trying test endpoint first...');
                const testResponse = await fetch('/.netlify/functions/test-events');
                if (testResponse.ok) {
                    const testData = await testResponse.json();
                    console.log('Test endpoint response:', testData);
                }
            } catch (testError) {
                console.error('Test endpoint check failed:', testError);
            }

            // Now try the real update
            const success = await EventService.triggerUpdate(url);

            if (success) {
                console.log('Manual update successful, fetching fresh events');
                // Get the updated events after the update is complete
                try {
                    const events = await EventService.getEvents(true); // Force refresh to get latest data
                    console.log(`Got ${events.length} fresh events after update`);
                    dispatch({ type: 'TRIGGER_UPDATE_SUCCESS', payload: events });
                } catch (fetchError) {
                    console.error('Error fetching events after update:', fetchError);
                    dispatch({
                        type: 'TRIGGER_UPDATE_ERROR',
                        payload: fetchError instanceof Error ? fetchError.message : 'Unknown error fetching after update'
                    });

                    // Try the test endpoint as a fallback
                    try {
                        console.log('Trying test endpoint as fallback after update...');
                        const response = await fetch('/.netlify/functions/test-events');
                        if (response.ok) {
                            const data = await response.json();
                            if (data.events && data.events.length > 0) {
                                console.log(`Loaded ${data.events.length} fallback events from test endpoint`);
                                dispatch({ type: 'TRIGGER_UPDATE_SUCCESS', payload: data.events });
                            }
                        }
                    } catch (fallbackError) {
                        console.error('Fallback also failed:', fallbackError);
                    }
                }
            } else {
                // Try direct endpoint as fallback
                try {
                    console.log('Update failed, trying direct endpoint...');
                    const response = await fetch('/.netlify/functions/get-events?refresh=true');
                    if (response.ok) {
                        const data = await response.json();
                        if (data.events && data.events.length > 0) {
                            console.log(`Got ${data.events.length} events from direct endpoint`);
                            dispatch({ type: 'TRIGGER_UPDATE_SUCCESS', payload: data.events });
                            return;
                        }
                    }

                    // If that fails, try test endpoint
                    const testResponse = await fetch('/.netlify/functions/test-events');
                    if (testResponse.ok) {
                        const testData = await testResponse.json();
                        if (testData.events && testData.events.length > 0) {
                            console.log(`Got ${testData.events.length} events from test endpoint`);
                            dispatch({ type: 'TRIGGER_UPDATE_SUCCESS', payload: testData.events });
                            return;
                        }
                    }
                } catch (directError) {
                    console.error('Direct endpoint fallback failed:', directError);
                }

                throw new Error('Update failed and all fallbacks exhausted');
            }
        } catch (error) {
            console.error('Error triggering update:', error);
            dispatch({
                type: 'TRIGGER_UPDATE_ERROR',
                payload: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    // Fetch events on component mount and set up auto-refresh
    useEffect(() => {
        console.log('EventsProvider mounted, fetching initial events');

        // Immediate first fetch
        fetchEvents();

        // Try test endpoint after a small delay if we don't get events
        const testTimeout = setTimeout(() => {
            if (state.events.length === 0 && !state.loading && !state.error) {
                console.log('No events after initial load, trying test endpoint...');
                // Try the test endpoint directly
                fetch('/.netlify/functions/test-events')
                    .then(response => response.json())
                    .then(data => {
                        if (data.events && data.events.length > 0) {
                            console.log(`Loaded ${data.events.length} events from test endpoint`);
                            dispatch({ type: 'FETCH_EVENTS_SUCCESS', payload: data.events });
                        }
                    })
                    .catch(error => console.error('Error fetching from test endpoint:', error));
            }
        }, 3000);

        // Set up auto-refresh every 5 minutes
        const refreshInterval = setInterval(() => {
            console.log('Auto-refresh triggered');
            fetchEvents();
        }, 5 * 60 * 1000);

        // Clean up intervals on unmount
        return () => {
            clearInterval(refreshInterval);
            clearTimeout(testTimeout);
        };
    }, []);

    useEffect(() => {
        // Log state changes for debugging
        console.log('Events state updated:', state);
    }, [state]);

    const contextValue = {
        state,
        dispatch,
        fetchEvents,
        triggerUpdate
    };

    return (
        <EventsContext.Provider value={contextValue}>
            {children}
        </EventsContext.Provider>
    );
};


// Custom hook for using the events context
export const useEvents = () => useContext(EventsContext);