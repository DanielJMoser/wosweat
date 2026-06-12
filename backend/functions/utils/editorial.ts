import { EventData } from '@wosweat/shared/types/events';

export interface RawCustomEvent {
    _id?: string;
    title?: string;
    date?: string;
    time?: string;
    venue?: string;
    description?: string;
    url?: string;
    imageUrl?: string;
    tags?: string[];
    recommended?: boolean;
}

export interface RawRecommendation {
    venue?: string;
    date?: string;
    titleContains?: string;
}

export interface EditorialContent {
    custom: RawCustomEvent[];
    recs: RawRecommendation[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function mapCustomEvents(raw: RawCustomEvent[]): EventData[] {
    const events: EventData[] = [];
    for (const r of raw ?? []) {
        if (!str(r?._id) || !str(r.title) || !str(r.date) || !ISO_DATE.test(r.date) || !str(r.venue)) {
            console.warn('[editorial] skipping malformed customEvent', r?._id ?? '(no id)');
            continue;
        }
        events.push({
            id: `sanity-${r._id}`,
            title: r.title,
            date: r.date,
            ...(str(r.time) && TIME.test(r.time) ? { time: r.time } : {}),
            description: typeof r.description === 'string' ? r.description : '',
            url: typeof r.url === 'string' ? r.url : '',
            venue: r.venue,
            ...(str(r.imageUrl) ? { imageUrl: `${r.imageUrl}?w=1200&auto=format` } : {}),
            ...(Array.isArray(r.tags) && r.tags.length
                ? { tags: r.tags.filter((t): t is string => typeof t === 'string') }
                : {}),
            ...(r.recommended === true ? { recommended: true } : {}),
        });
    }
    return events;
}

export function applyRecommendations(events: EventData[], recs: RawRecommendation[]): EventData[] {
    const valid = (recs ?? []).flatMap((r) => {
        if (str(r?.venue) && str(r.date) && typeof r.titleContains === 'string' && r.titleContains.length >= 3) {
            return [{ venue: r.venue, date: r.date, fragment: r.titleContains.toLowerCase() }];
        }
        console.warn('[editorial] skipping malformed recommendation', r?.venue ?? '(no venue)', r?.date ?? '');
        return [];
    });
    if (valid.length === 0) return events;
    return events.map((e) => {
        const hit = valid.some(
            (r) => e.venue === r.venue && e.date === r.date
                && typeof e.title === 'string' && e.title.toLowerCase().includes(r.fragment),
        );
        return hit ? { ...e, recommended: true } : e;
    });
}

export function mergeEditorial(scraped: EventData[], editorial: EditorialContent | null): EventData[] {
    if (!editorial) return scraped;
    return applyRecommendations([...scraped, ...mapCustomEvents(editorial.custom)], editorial.recs);
}
