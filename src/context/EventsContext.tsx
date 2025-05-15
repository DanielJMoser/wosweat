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
            return {
                ...state,
                loading: true,
                error: null,
            };
        case 'FETCH_EVENTS_SUCCESS':
            return {
                ...state,
                loading: false,
                events: action.payload,
                lastUpdated: new Date(),
                error: null,
            };
        case 'FETCH_EVENTS_ERROR':
            return {
                ...state,
                loading: false,
                error: action.payload,
            };
        case 'TRIGGER_UPDATE_START':
            return {
                ...state,
                loading: true,
                error: null,
            };
        case 'TRIGGER_UPDATE_SUCCESS':
            return {
                ...state,
                loading: false,
                events: action.payload,
                lastUpdated: new Date(),
                error: null,
            };
        case 'TRIGGER_UPDATE_ERROR':
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
            console.log(`Fetched ${events.length} events`);
            dispatch({ type: 'FETCH_EVENTS_SUCCESS', payload: events });
        } catch (error) {
            console.error('Error fetching events:', error);
            dispatch({
                type: 'FETCH_EVENTS_ERROR',
                payload: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    // Trigger manual update function
    const triggerUpdate = async (url?: string) => {
        dispatch({ type: 'TRIGGER_UPDATE_START' });
        try {
            console.log('Triggering manual update...');
            // Fixed: Don't call getEvents inside triggerUpdate to avoid double fetching
            const success = await EventService.triggerUpdate(url);

            if (success) {
                console.log('Manual update successful, fetching fresh events');
                // Get the updated events after the update is complete
                const events = await EventService.getEvents(true); // Force refresh to get latest data
                dispatch({ type: 'TRIGGER_UPDATE_SUCCESS', payload: events });
            } else {
                throw new Error('Update failed');
            }
        } catch (error) {
            console.error('Error triggering update:', error);
            dispatch({
                type: 'TRIGGER_UPDATE_ERROR',
                payload: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    // Fetch events on component mount
    useEffect(() => {
        console.log('EventsProvider mounted, fetching initial events');
        fetchEvents();

        // Set up auto-refresh every 5 minutes
        const refreshInterval = setInterval(() => {
            console.log('Auto-refresh triggered');
            fetchEvents();
        }, 5 * 60 * 1000);

        // Clean up interval on unmount
        return () => clearInterval(refreshInterval);
    }, []);

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