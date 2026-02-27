import { EventData } from '../../shared/types/events';

export const formatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(date);
    } catch {
        return dateString;
    }
};

export const getShortDate = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
        }).format(date);
    } catch {
        return dateString;
    }
};

export const getDayName = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
    } catch {
        return '';
    }
};

export const groupEventsByDay = (events: EventData[]): { [key: string]: EventData[] } => {
    return events.reduce((groups: { [key: string]: EventData[] }, event) => {
        const dateKey = event.date.split('T')[0];
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(event);
        return groups;
    }, {});
};

export const isToday = (dateString: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
};
