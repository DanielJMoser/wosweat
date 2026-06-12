import { describe, expect, test } from 'vitest';
import { EventData } from '@wosweat/shared/types/events';
import { applyRecommendations, mapCustomEvents, mergeEditorial, RawCustomEvent } from './editorial';

const rawEvent = (over: Partial<RawCustomEvent> = {}): RawCustomEvent => ({
    _id: 'abc123',
    title: 'Hofgarten Open Air',
    date: '2026-07-01',
    venue: 'Hofgarten',
    ...over,
});

const scraped = (over: Partial<EventData> = {}): EventData => ({
    id: 'e1',
    title: 'Molchat Doma',
    date: '2026-07-01',
    description: '',
    url: 'https://example.com/1',
    venue: 'PMK Innsbruck',
    ...over,
});

describe('mapCustomEvents', () => {
    test('maps a full document', () => {
        const [e] = mapCustomEvents([rawEvent({
            time: '20:30', description: 'Open Air', url: 'https://example.com/h',
            imageUrl: 'https://cdn.sanity.io/images/p/production/img.jpg',
            tags: ['gratis'], recommended: true,
        })]);
        expect(e).toEqual({
            id: 'sanity-abc123',
            title: 'Hofgarten Open Air',
            date: '2026-07-01',
            time: '20:30',
            description: 'Open Air',
            url: 'https://example.com/h',
            venue: 'Hofgarten',
            imageUrl: 'https://cdn.sanity.io/images/p/production/img.jpg?w=1200&auto=format',
            tags: ['gratis'],
            recommended: true,
        });
    });

    test('defaults description and url to empty strings', () => {
        const [e] = mapCustomEvents([rawEvent()]);
        expect(e.description).toBe('');
        expect(e.url).toBe('');
        expect(e.recommended).toBeUndefined();
    });

    test('skips documents missing required fields or with bad dates', () => {
        expect(mapCustomEvents([
            rawEvent({ _id: undefined }),
            rawEvent({ title: undefined }),
            rawEvent({ date: '01.07.2026' }),
            rawEvent({ venue: undefined }),
        ])).toEqual([]);
    });

    test('drops a malformed time but keeps the event', () => {
        const [e] = mapCustomEvents([rawEvent({ time: 'ab 20 Uhr' })]);
        expect(e.time).toBeUndefined();
        expect(e.title).toBe('Hofgarten Open Air');
    });

    test('tolerates null/garbage input', () => {
        expect(mapCustomEvents(undefined as never)).toEqual([]);
        expect(mapCustomEvents([null as never, {} as never])).toEqual([]);
    });
});

describe('applyRecommendations', () => {
    const rec = { venue: 'PMK Innsbruck', date: '2026-07-01', titleContains: 'molchat' };

    test('flags a case-insensitive venue+date+substring match', () => {
        const [e] = applyRecommendations([scraped()], [rec]);
        expect(e.recommended).toBe(true);
    });

    test('does not flag on venue, date, or title mismatch', () => {
        const out = applyRecommendations([
            scraped({ venue: 'Treibhaus Innsbruck' }),
            scraped({ id: 'e2', date: '2026-07-02' }),
            scraped({ id: 'e3', title: 'Jazz Trio' }),
        ], [rec]);
        expect(out.every(e => !e.recommended)).toBe(true);
    });

    test('flags every match and leaves the input array untouched', () => {
        const input = [scraped(), scraped({ id: 'e2', title: 'Molchat Doma (Zusatzshow)' })];
        const out = applyRecommendations(input, [rec]);
        expect(out.filter(e => e.recommended)).toHaveLength(2);
        expect(input[0].recommended).toBeUndefined();
    });

    test('ignores recommendations with missing fields or a too-short fragment', () => {
        const out = applyRecommendations([scraped()], [
            { venue: 'PMK Innsbruck', date: '2026-07-01', titleContains: 'mo' },
            { venue: undefined, date: '2026-07-01', titleContains: 'molchat' },
        ]);
        expect(out[0].recommended).toBeUndefined();
    });
});

describe('mergeEditorial', () => {
    test('returns scraped events unchanged when editorial is null', () => {
        const input = [scraped()];
        expect(mergeEditorial(input, null)).toBe(input);
    });

    test('appends custom events and applies recommendations across the merged list', () => {
        const out = mergeEditorial([scraped()], {
            custom: [rawEvent()],
            recs: [{ venue: 'PMK Innsbruck', date: '2026-07-01', titleContains: 'Molchat' }],
        });
        expect(out.map(e => e.id)).toEqual(['e1', 'sanity-abc123']);
        expect(out[0].recommended).toBe(true);
    });

    test('non-string fields from Sanity never throw and never flag', () => {
        const out = mergeEditorial([scraped()], {
            custom: [
                rawEvent({ title: 42 as never }),
                rawEvent({ _id: 'ok1', description: { de: 'x' } as never, url: 7 as never, imageUrl: {} as never }),
            ],
            recs: [{ venue: 'Hofgarten', date: '2026-07-01', titleContains: 'hofgarten' }],
        });
        expect(out.find(e => e.id === 'sanity-abc123')).toBeUndefined();
        const ok = out.find(e => e.id === 'sanity-ok1');
        expect(ok?.description).toBe('');
        expect(ok?.url).toBe('');
        expect(ok?.imageUrl).toBeUndefined();
        expect(ok?.recommended).toBe(true);
    });

    test('a recommendation matching a custom event that is already recommended stays a single flag', () => {
        const out = mergeEditorial([], {
            custom: [rawEvent({ recommended: true })],
            recs: [{ venue: 'Hofgarten', date: '2026-07-01', titleContains: 'open air' }],
        });
        expect(out).toHaveLength(1);
        expect(out[0].recommended).toBe(true);
    });
});
