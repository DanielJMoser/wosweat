import { getStore } from '@netlify/blobs';
import { EventData } from '@wosweat/shared/types/events';

const STORE = 'events-cache';
const KEY = 'latest';

export async function readEvents(): Promise<{ events: EventData[]; lastUpdated: string } | null> {
    const store = getStore(STORE);
    return store.get(KEY, { type: 'json', consistency: 'strong' });
}

export async function writeEvents(events: EventData[]): Promise<void> {
    const store = getStore(STORE);
    await store.setJSON(KEY, { events, lastUpdated: new Date().toISOString() });
}
