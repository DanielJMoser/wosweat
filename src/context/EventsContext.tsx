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
            const events = await EventService.getEvents(forceRefresh);
            dispatch({ type: 'FETCH_EVENTS_SUCCESS', payload: events });
        } catch (error) {
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
            await EventService.triggerUpdate(url);
            dispatch({ type: 'TRIGGER_UPDATE_SUCCESS' });
            // Fetch the updated events
            await fetchEvents(true);
        } catch (error) {
            dispatch({
                type: 'TRIGGER_UPDATE_ERROR',
                payload: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    // Fetch events on component mount
    useEffect(() => {
        fetchEvents();

        // Set up auto-refresh every 5 minutes
        const refreshInterval = setInterval(() => fetchEvents(), 5 * 60 * 1000);

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