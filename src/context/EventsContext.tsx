import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { EventData } from '../../shared/types/events';
import { EventService } from '../services/events-service';

const AUTO_REFRESH_MS = 5 * 60 * 1000;

interface EventsState {
    events: EventData[];
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
}

type EventsAction =
    | { type: 'LOADING_START' }
    | { type: 'LOADING_SUCCESS'; payload: EventData[] }
    | { type: 'LOADING_ERROR'; payload: string };

const initialState: EventsState = {
    events: [],
    loading: false,
    error: null,
    lastUpdated: null,
};

interface EventsContextType {
    state: EventsState;
    fetchEvents: (forceRefresh?: boolean) => Promise<void>;
    triggerUpdate: (url?: string) => Promise<void>;
}

const EventsContext = createContext<EventsContextType>({
    state: initialState,
    fetchEvents: async () => {},
    triggerUpdate: async () => {},
});

const eventsReducer = (state: EventsState, action: EventsAction): EventsState => {
    switch (action.type) {
        case 'LOADING_START':
            return { ...state, loading: true, error: null };
        case 'LOADING_SUCCESS':
            return { ...state, loading: false, events: action.payload, lastUpdated: new Date(), error: null };
        case 'LOADING_ERROR':
            return { ...state, loading: false, error: action.payload };
        default:
            return state;
    }
};

export const EventsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(eventsReducer, initialState);

    const fetchEvents = async (forceRefresh = false) => {
        dispatch({ type: 'LOADING_START' });
        try {
            const events = await EventService.getEvents(forceRefresh);
            dispatch({ type: 'LOADING_SUCCESS', payload: events });
        } catch (error) {
            console.error('Error fetching events:', error);
            dispatch({
                type: 'LOADING_ERROR',
                payload: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    const triggerUpdate = async (url?: string) => {
        dispatch({ type: 'LOADING_START' });
        try {
            const success = await EventService.triggerUpdate(url);

            if (success) {
                const events = await EventService.getEvents(true);
                dispatch({ type: 'LOADING_SUCCESS', payload: events });
            } else {
                throw new Error('Update failed');
            }
        } catch (error) {
            console.error('Error triggering update:', error);
            dispatch({
                type: 'LOADING_ERROR',
                payload: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    useEffect(() => {
        fetchEvents();

        const refreshInterval = setInterval(() => {
            fetchEvents();
        }, AUTO_REFRESH_MS);

        return () => clearInterval(refreshInterval);
    }, []);

    const contextValue = { state, fetchEvents, triggerUpdate };

    return (
        <EventsContext.Provider value={contextValue}>
            {children}
        </EventsContext.Provider>
    );
};

export const useEvents = () => useContext(EventsContext);
