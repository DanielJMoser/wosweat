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
    | { type: 'TRIGGER_UPDATE_SUCCESS' }
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
            console.log('FETCH_EVENTS_SUCCESS with payload:', action.payload);
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
                // Keep existing events on error
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
        console.log(`[EventsContext] fetchEvents called with forceRefresh=${forceRefresh}`);
        dispatch({ type: 'FETCH_EVENTS_START' });
        try {
            const events = await EventService.getEvents(forceRefresh);
            console.log(`[EventsContext] fetchEvents got ${events.length} events`);
            dispatch({ type: 'FETCH_EVENTS_SUCCESS', payload: events });
        } catch (error) {
            console.error('[EventsContext] Error in fetchEvents:', error);
            dispatch({
                type: 'FETCH_EVENTS_ERROR',
                payload: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    // Trigger manual update function
    const triggerUpdate = async (url?: string) => {
        console.log('[EventsContext] triggerUpdate called');
        dispatch({ type: 'TRIGGER_UPDATE_START' });
        try {
            const success = await EventService.triggerUpdate(url);
            if (success) {
                dispatch({ type: 'TRIGGER_UPDATE_SUCCESS' });
                // Always fetch fresh events after a successful trigger
                await fetchEvents(true);
            } else {
                throw new Error('Trigger update failed');
            }
        } catch (error) {
            console.error('[EventsContext] Error in triggerUpdate:', error);
            dispatch({
                type: 'TRIGGER_UPDATE_ERROR',
                payload: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    // Fetch events on component mount
    useEffect(() => {
        console.log('[EventsContext] Initial fetch on mount');
        fetchEvents();

        // Set up auto-refresh every 5 minutes
        const refreshInterval = setInterval(() => {
            console.log('[EventsContext] Auto-refresh interval triggered');
            fetchEvents();
        }, 5 * 60 * 1000);

        // Clean up interval on unmount
        return () => clearInterval(refreshInterval);
    }, []);

    return (
        <EventsContext.Provider value={{ state, dispatch, fetchEvents, triggerUpdate }}>
            {children}
        </EventsContext.Provider>
    );
};

// Custom hook for using the events context
export const useEvents = () => useContext(EventsContext);