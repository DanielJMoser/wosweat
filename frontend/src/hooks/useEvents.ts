import { useState, useEffect, useCallback, useMemo } from 'react';
import type { EventData } from '../../../shared/types/events';

interface UseEventsOptions {
  venueFilter?: string[];
}

interface UseEventsReturn {
  events: EventData[];
  eventsByDate: Map<string, EventData[]>;
  loading: boolean;
  error: string | null;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  refresh: () => Promise<void>;
  refreshing: boolean;
  lastUpdated: string | null;
}

export function useEvents(options?: UseEventsOptions): UseEventsReturn {
  const [events, setEvents] = useState<EventData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const url = import.meta.env.DEV ? '/api/get-events' : '/.netlify/functions/get-events';
      const res = await fetch(url, isRefresh ? { cache: 'no-store' } : undefined);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setEvents(data?.events ?? []);
      setLastUpdated(data?.lastUpdated ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const refresh = useCallback(() => {
    return fetchEvents(true);
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    if (!options?.venueFilter?.length) return events;
    return events.filter(
      (e) => e.venue && options.venueFilter!.some((f) => e.venue!.includes(f))
    );
  }, [events, options?.venueFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventData[]>();
    for (const event of filteredEvents) {
      const key = event.date ?? 'unknown';
      const group = map.get(key);
      if (group) group.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [filteredEvents]);

  return {
    events: filteredEvents,
    eventsByDate,
    loading,
    error,
    selectedDate,
    setSelectedDate,
    refresh,
    refreshing,
    lastUpdated,
  };
}
