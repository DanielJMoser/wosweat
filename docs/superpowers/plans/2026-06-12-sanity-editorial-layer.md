# Sanity Editorial Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Custom events and a "heißer Tipp" recommendation flag, edited in a Sanity studio and merged into `get-events` at request time (spec: `docs/superpowers/specs/2026-06-12-sanity-cms-design.md`).

**Architecture:** New `studio/` npm workspace (Sanity v4, two schemas). Backend fetches both document types in one GROQ query over plain `fetch` (no `@sanity/client`), maps custom events to `EventData`, applies recommendation matchers across the merged list, fail-open on any error. Frontend restores the `8d1ffed` Tipp-row styling driven by `event.recommended` and guards empty-url events.

**Tech Stack:** Sanity v4 (studio only), Netlify Functions, vitest (new in backend), React 19 / Ionic, Cypress.

**House rules for executors:**
- NEVER run the backend (`netlify dev`, function invocation) — the user does this manually. Backend verification = `tsc --noEmit` + vitest only.
- Each commit step requires the user's permission first. Ask at the commit step; do not batch silently.
- Editing `frontend/src/**/*.ts(x)` auto-runs related vitest via a PostToolUse hook — that output is expected, not an error.
- Never include AI attribution in commits/code/comments.
- All file paths are relative to the repo root `/home/danielm/WebstormProjects/wosweat`.

---

## Task 1: Shared venue constants + `recommended` field

Venue names currently live as string literals in `backend/functions/utils/site-selectors.ts` and two extractors. Recommendation matching uses exact venue equality, so the studio dropdown and the scrapers must share one source of truth.

**Files:**
- Modify: `shared/constants.ts`
- Modify: `shared/types/events.ts`
- Modify: `backend/functions/utils/site-selectors.ts`
- Modify: `backend/functions/utils/extractors/artillery.ts:34`
- Modify: `backend/functions/utils/extractors/kellertheater.ts:33`

- [ ] **Step 1: Add venue constants to `shared/constants.ts`**

Append after `TARGET_SITES`:

```ts
export const VENUES = {
    treibhaus: 'Treibhaus Innsbruck',
    pmk: 'PMK Innsbruck',
    artillery: 'Artillery Productions',
    musicHall: 'Music Hall Innsbruck',
    baeckerei: 'Die Bäckerei',
    brux: 'BRUX Freies Theater Innsbruck',
    kellertheater: 'Innsbrucker Kellertheater',
    livestage: 'LiveStage Tirol',
} as const;

export const VENUE_NAMES = Object.values(VENUES);
```

These strings must stay byte-identical to what the scrapers currently emit (they are copied from `site-selectors.ts` / the extractors — do not "fix" spelling).

- [ ] **Step 2: Add `recommended` to `shared/types/events.ts`**

```ts
export interface EventData {
    id: string;
    title: string;
    date: string;
    time?: string;
    description: string;
    url: string;
    venue?: string;
    imageUrl?: string;
    tags?: string[];
    recommended?: boolean;
}
```

- [ ] **Step 3: Use the constants in `site-selectors.ts`**

Add at the top:

```ts
import { VENUES } from '@wosweat/shared/constants';
```

Replace the six `venue:` literals: `'Treibhaus Innsbruck'` → `VENUES.treibhaus`, `'PMK Innsbruck'` → `VENUES.pmk`, `'Music Hall Innsbruck'` → `VENUES.musicHall`, `'Die Bäckerei'` → `VENUES.baeckerei`, `'BRUX Freies Theater Innsbruck'` → `VENUES.brux`, `'LiveStage Tirol'` → `VENUES.livestage`. The `'Unknown Venue'` fallback stays a literal.

- [ ] **Step 4: Use the constants in the two extractors**

In `artillery.ts` add `import { VENUES } from '@wosweat/shared/constants';` and replace BOTH literals: line 29's `eventId('Artillery Productions', …)` first argument becomes `VENUES.artillery` and line 34 becomes `venue: VENUES.artillery,`. In `kellertheater.ts` likewise: line 28's `eventId('Innsbrucker Kellertheater', …)` first argument and line 33's `venue:` both become `VENUES.kellertheater`. (Identical strings, so generated IDs do not change.)

- [ ] **Step 5: Type-check both consumers**

Run: `npx tsc --noEmit -p backend/tsconfig.json && npm run build`
Expected: backend clean; root build (frontend `tsc && vite build`) succeeds.

- [ ] **Step 6: Commit (ask permission first)**

```bash
git add shared/constants.ts shared/types/events.ts backend/functions/utils/site-selectors.ts backend/functions/utils/extractors/artillery.ts backend/functions/utils/extractors/kellertheater.ts
git commit -m "refactor(shared): single-source venue names; add EventData.recommended"
```

---

## Task 2: Backend vitest + editorial merge utilities (TDD)

The backend workspace has no test runner. Add vitest, then build the pure merge functions test-first.

**Files:**
- Modify: `backend/package.json`
- Modify: `package.json` (root, `test` script)
- Create: `backend/vitest.config.ts`
- Create: `backend/functions/utils/editorial.ts`
- Test: `backend/functions/utils/editorial.test.ts`

- [ ] **Step 1: Add vitest to the backend workspace**

In `backend/package.json` add:

```json
"scripts": {
    "test.unit": "vitest run"
},
"devDependencies": {
    "vitest": "^3.2.0"
}
```

(The workspace currently has neither key; add both blocks after `"type": "module",`.)

In the root `package.json` change the `test` script to run every workspace that has one:

```json
"test": "npm run test.unit --workspaces --if-present"
```

Create `backend/vitest.config.ts` (vitest does not read tsconfig `paths`, so mirror the `@wosweat/shared` alias):

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@wosweat/shared': fileURLToPath(new URL('../shared', import.meta.url)),
        },
    },
    test: { environment: 'node' },
});
```

Run: `npm install`
Expected: lockfile updates, no peer-dep errors.

- [ ] **Step 2: Write the failing tests**

Create `backend/functions/utils/editorial.test.ts`:

```ts
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
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test.unit --workspace=@wosweat/backend`
Expected: FAIL — cannot resolve `./editorial`.

- [ ] **Step 4: Implement `backend/functions/utils/editorial.ts`**

```ts
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

export function mapCustomEvents(raw: RawCustomEvent[]): EventData[] {
    const events: EventData[] = [];
    for (const r of raw ?? []) {
        if (!r?._id || !r.title || !r.date || !ISO_DATE.test(r.date) || !r.venue) {
            console.warn('[editorial] skipping malformed customEvent', r?._id ?? '(no id)');
            continue;
        }
        events.push({
            id: `sanity-${r._id}`,
            title: r.title,
            date: r.date,
            ...(r.time && TIME.test(r.time) ? { time: r.time } : {}),
            description: r.description ?? '',
            url: r.url ?? '',
            venue: r.venue,
            ...(r.imageUrl ? { imageUrl: `${r.imageUrl}?w=1200&auto=format` } : {}),
            ...(Array.isArray(r.tags) && r.tags.length
                ? { tags: r.tags.filter((t): t is string => typeof t === 'string') }
                : {}),
            ...(r.recommended === true ? { recommended: true } : {}),
        });
    }
    return events;
}

export function applyRecommendations(events: EventData[], recs: RawRecommendation[]): EventData[] {
    const valid = (recs ?? []).filter(
        (r) => r?.venue && r.date && typeof r.titleContains === 'string' && r.titleContains.length >= 3,
    );
    if (valid.length === 0) return events;
    return events.map((e) => {
        const hit = valid.some(
            (r) => e.venue === r.venue && e.date === r.date
                && e.title?.toLowerCase().includes(r.titleContains!.toLowerCase()),
        );
        return hit ? { ...e, recommended: true } : e;
    });
}

export function mergeEditorial(scraped: EventData[], editorial: EditorialContent | null): EventData[] {
    if (!editorial) return scraped;
    return applyRecommendations([...scraped, ...mapCustomEvents(editorial.custom)], editorial.recs);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test.unit --workspace=@wosweat/backend`
Expected: PASS (11 tests). Also run `npx tsc --noEmit -p backend/tsconfig.json` — clean.

- [ ] **Step 6: Commit (ask permission first)**

```bash
git add backend/package.json package.json package-lock.json backend/vitest.config.ts backend/functions/utils/editorial.ts backend/functions/utils/editorial.test.ts
git commit -m "feat(backend): editorial merge utilities with vitest setup"
```

---

## Task 3: Sanity fetch, fail-open (TDD)

**Files:**
- Create: `backend/functions/utils/sanity.ts`
- Test: `backend/functions/utils/sanity.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/functions/utils/sanity.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchEditorial } from './sanity';

const okBody = {
    result: {
        custom: [{ _id: 'a', title: 'T', date: '2026-07-01', venue: 'Hofgarten' }],
        recs: [{ venue: 'PMK Innsbruck', date: '2026-07-01', titleContains: 'molchat' }],
    },
};

const mockFetch = (impl: () => Promise<Response>) => {
    // vi.fn(impl) would type mock.calls as [] (vitest 3 uses Parameters<T>) — declare fetch's params explicitly
    const spy = vi.fn((..._args: Parameters<typeof fetch>) => impl());
    vi.stubGlobal('fetch', spy);
    return spy;
};

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('fetchEditorial', () => {
    test('returns null without fetching when SANITY_PROJECT_ID is unset', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', '');
        const spy = mockFetch(() => Promise.resolve(new Response('{}')));
        expect(await fetchEditorial('2026-06-12')).toBeNull();
        expect(spy).not.toHaveBeenCalled();
    });

    test('returns parsed content on 200 and queries the CDN host with the date param', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', 'testproj');
        const spy = mockFetch(() => Promise.resolve(new Response(JSON.stringify(okBody))));
        const content = await fetchEditorial('2026-06-12');
        expect(content).toEqual(okBody.result);
        const url = String(spy.mock.calls[0][0]);
        expect(url).toContain('https://testproj.apicdn.sanity.io/');
        expect(url).toContain(encodeURIComponent('"2026-06-12"'));
    });

    test('returns null on non-200', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', 'testproj');
        mockFetch(() => Promise.resolve(new Response('nope', { status: 500 })));
        expect(await fetchEditorial('2026-06-12')).toBeNull();
    });

    test('returns null when fetch rejects (timeout/abort)', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', 'testproj');
        mockFetch(() => Promise.reject(new DOMException('aborted', 'TimeoutError')));
        expect(await fetchEditorial('2026-06-12')).toBeNull();
    });

    test('returns null on unexpected response shape', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', 'testproj');
        mockFetch(() => Promise.resolve(new Response(JSON.stringify({ result: { custom: 'x' } }))));
        expect(await fetchEditorial('2026-06-12')).toBeNull();
    });

    test('returns null on invalid JSON', async () => {
        vi.stubEnv('SANITY_PROJECT_ID', 'testproj');
        mockFetch(() => Promise.resolve(new Response('<html>')));
        expect(await fetchEditorial('2026-06-12')).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test.unit --workspace=@wosweat/backend`
Expected: FAIL — cannot resolve `./sanity`. (Task 2 tests stay green.)

- [ ] **Step 3: Implement `backend/functions/utils/sanity.ts`**

```ts
import { EditorialContent } from './editorial';

const API_VERSION = 'v2025-02-19';
const TIMEOUT_MS = 3000;

const QUERY = `{
  "custom": *[_type == "customEvent" && defined(date) && date >= $today]{
    _id, title, date, time, venue, description, url, tags, recommended,
    "imageUrl": image.asset->url
  },
  "recs": *[_type == "recommendation" && defined(date) && date >= $today]{
    venue, date, titleContains
  }
}`;

export async function fetchEditorial(todayIso: string): Promise<EditorialContent | null> {
    const projectId = process.env.SANITY_PROJECT_ID;
    if (!projectId) return null;
    const dataset = process.env.SANITY_DATASET ?? 'production';
    const params = new URLSearchParams({ query: QUERY, $today: JSON.stringify(todayIso) });
    const url = `https://${projectId}.apicdn.sanity.io/${API_VERSION}/data/query/${dataset}?${params}`;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) {
            console.error(`[editorial] Sanity responded ${res.status}`);
            return null;
        }
        const body = await res.json();
        const result = body?.result;
        if (!result || !Array.isArray(result.custom) || !Array.isArray(result.recs)) {
            console.error('[editorial] unexpected Sanity response shape');
            return null;
        }
        return { custom: result.custom, recs: result.recs };
    } catch (err) {
        console.error('[editorial] Sanity fetch failed:', err instanceof Error ? err.message : err);
        return null;
    }
}
```

Notes for the executor: the `apicdn` host is Sanity's cached public query endpoint — no token, drafts are never returned. `$today` must be JSON-encoded (`"2026-06-12"` with quotes) per the Sanity HTTP API parameter convention.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test.unit --workspace=@wosweat/backend`
Expected: PASS (17 tests). `npx tsc --noEmit -p backend/tsconfig.json` clean.

- [ ] **Step 5: Commit (ask permission first)**

```bash
git add backend/functions/utils/sanity.ts backend/functions/utils/sanity.test.ts
git commit -m "feat(backend): fail-open Sanity editorial fetch"
```

---

## Task 4: Wire the merge into `get-events`

**Files:**
- Modify: `backend/functions/get-events.ts`

- [ ] **Step 1: Rewrite `get-events.ts`**

Full new content (changes: `max-age=300`, merge call, and editorial content now also serves when the blob is empty — custom events must not depend on a scrape having run):

```ts
import { readEvents } from './utils/blobs';
import { mergeEditorial } from './utils/editorial';
import { fetchEditorial } from './utils/sanity';
import { todayInVienna } from './utils/timezone';

const BASE_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
};

const HEADERS_HIT = { ...BASE_HEADERS, 'Cache-Control': 'public, max-age=300' };
const HEADERS_MISS = { ...BASE_HEADERS, 'Cache-Control': 'no-store' };

export default async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: BASE_HEADERS });
    }

    const today = todayInVienna();
    const [cache, editorial] = await Promise.all([readEvents(), fetchEditorial(today)]);
    const scraped = (cache?.events ?? []).filter((e) => e.date >= today);
    const events = mergeEditorial(scraped, editorial);

    return new Response(
        JSON.stringify({ events, lastUpdated: cache?.lastUpdated ?? null, count: events.length }),
        { status: 200, headers: cache ? HEADERS_HIT : HEADERS_MISS },
    );
};
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit -p backend/tsconfig.json && npm run test.unit --workspace=@wosweat/backend`
Expected: both clean. Do NOT run the function — the user verifies live behavior after Sanity setup (Task 10).

- [ ] **Step 3: Commit (ask permission first)**

```bash
git add backend/functions/get-events.ts
git commit -m "feat(backend): merge Sanity editorial content into get-events"
```

---

## Task 5: Studio workspace

**Files:**
- Create: `studio/package.json`, `studio/project.ts`, `studio/sanity.config.ts`, `studio/sanity.cli.ts`, `studio/tsconfig.json`
- Create: `studio/schemaTypes/customEvent.ts`, `studio/schemaTypes/recommendation.ts`, `studio/schemaTypes/index.ts`
- Modify: `package.json` (root: workspaces + `studio` script), `.gitignore`

- [ ] **Step 1: Create `studio/package.json`**

```json
{
    "name": "@wosweat/studio",
    "private": true,
    "version": "0.0.1",
    "type": "module",
    "scripts": {
        "dev": "sanity dev",
        "build": "sanity build",
        "deploy": "sanity deploy"
    },
    "dependencies": {
        "@wosweat/shared": "*",
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "sanity": "^4.0.0",
        "styled-components": "^6.1.0"
    }
}
```

- [ ] **Step 2: Create `studio/project.ts`** (the single place the real id lands in Task 10)

```ts
// Replaced with the real id after `npx sanity init --bare` (Task 10).
export const projectId = 'pending0';
export const dataset = 'production';
```

- [ ] **Step 3: Create config files**

`studio/sanity.config.ts`:

```ts
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { dataset, projectId } from './project';
import { schemaTypes } from './schemaTypes';

export default defineConfig({
    name: 'default',
    title: 'wosweat',
    projectId,
    dataset,
    plugins: [structureTool()],
    schema: { types: schemaTypes },
});
```

`studio/sanity.cli.ts`:

```ts
import { defineCliConfig } from 'sanity/cli';
import { dataset, projectId } from './project';

export default defineCliConfig({ api: { projectId, dataset } });
```

`studio/tsconfig.json`:

```json
{
    "extends": "../tsconfig.base.json",
    "compilerOptions": {
        "moduleResolution": "bundler",
        "noEmit": true,
        "paths": { "@wosweat/shared/*": ["../shared/*"] }
    },
    "include": ["./**/*.ts"]
}
```

- [ ] **Step 4: Create the schemas**

`studio/schemaTypes/customEvent.ts`:

```ts
import { defineField, defineType } from 'sanity';
import { VENUE_NAMES } from '@wosweat/shared/constants';

export const customEvent = defineType({
    name: 'customEvent',
    title: 'Eigenes Event',
    type: 'document',
    fields: [
        defineField({ name: 'title', title: 'Titel', type: 'string', validation: (r) => r.required() }),
        defineField({ name: 'date', title: 'Datum', type: 'date', validation: (r) => r.required() }),
        defineField({
            name: 'time',
            title: 'Uhrzeit',
            type: 'string',
            description: 'Format HH:MM, z. B. 20:30',
            validation: (r) => r.regex(/^\d{2}:\d{2}$/).error('Format HH:MM, z. B. 20:30'),
        }),
        defineField({
            name: 'venue',
            title: 'Venue',
            type: 'string',
            description: `Frei wählbar. Bekannte Venues (eigene Farbe/Filter-Chip): ${VENUE_NAMES.join(', ')}`,
            validation: (r) => r.required(),
        }),
        defineField({ name: 'description', title: 'Beschreibung', type: 'text' }),
        defineField({ name: 'url', title: 'Link', type: 'url' }),
        defineField({ name: 'image', title: 'Bild', type: 'image' }),
        defineField({ name: 'tags', title: 'Tags', type: 'array', of: [{ type: 'string' }] }),
        defineField({ name: 'recommended', title: 'heißer Tipp', type: 'boolean', initialValue: false }),
    ],
    preview: { select: { title: 'title', subtitle: 'date' } },
});
```

`studio/schemaTypes/recommendation.ts`:

```ts
import { defineField, defineType } from 'sanity';
import { VENUE_NAMES } from '@wosweat/shared/constants';

export const recommendation = defineType({
    name: 'recommendation',
    title: 'Empfehlung (heißer Tipp)',
    type: 'document',
    description: 'Markiert ein gescraptes Event als heißen Tipp.',
    fields: [
        defineField({
            name: 'venue',
            title: 'Venue',
            type: 'string',
            options: { list: [...VENUE_NAMES] },
            validation: (r) => r.required(),
        }),
        defineField({ name: 'date', title: 'Datum', type: 'date', validation: (r) => r.required() }),
        defineField({
            name: 'titleContains',
            title: 'Titel enthält',
            type: 'string',
            description: 'Mindestens 3 Zeichen; Groß-/Kleinschreibung egal.',
            validation: (r) => r.required().min(3),
        }),
    ],
    preview: { select: { title: 'titleContains', subtitle: 'venue' } },
});
```

`studio/schemaTypes/index.ts`:

```ts
import { customEvent } from './customEvent';
import { recommendation } from './recommendation';

export const schemaTypes = [customEvent, recommendation];
```

Deviation from spec, intentional: `customEvent.venue` is a plain string with the known names in the field description (Sanity's `options.list` would *restrict* to the list; a custom autocomplete component is not worth the weight). `recommendation.venue` IS restricted via `options.list` — exact equality with scraped strings is required there.

- [ ] **Step 5: Register the workspace**

Root `package.json`: add `"studio"` to `workspaces` (after `"frontend"`) and add the script:

```json
"studio": "npm run dev --workspace=@wosweat/studio"
```

`.gitignore`: add a line `.sanity` (studio runtime cache; `dist` is already covered).

Accepted cost, stated for the record: Netlify production builds install all workspaces, so the Sanity v4 dependency tree now downloads on every deploy even though the studio is never built there. Revisit (e.g. `NPM_FLAGS="--workspace=…"`) only if build minutes become a problem.

- [ ] **Step 6: Install and verify nothing else broke**

Run: `npm install`
Expected: installs Sanity deps; React dedupes to one v19 copy (verify: `npm ls react` shows a single version, `npm ls vite` may legitimately show two).

Run: `npx tsc --noEmit -p studio/tsconfig.json && npm run build && npm run test.unit --workspace=@wosweat/backend && npm test`
Expected: all green — proves studio types check and the new hoisted deps did not disturb frontend or backend. (`sanity dev`/`build` need the real projectId — runtime verification is Task 10.)

- [ ] **Step 7: Commit (ask permission first)**

```bash
git add studio package.json package-lock.json .gitignore
git commit -m "feat(studio): Sanity studio workspace with customEvent and recommendation schemas"
```

---

## Task 6: Restore the Tipp row in the list view (TDD)

**Files:**
- Modify: `frontend/src/components/EventList.tsx`
- Modify: `frontend/src/components/EventList.css`
- Test: `frontend/src/components/EventList.test.tsx` (new)

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/EventList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { EventData } from '../../../shared/types/events';
import EventList from './EventList';

const event = (over: Partial<EventData> = {}): EventData => ({
    id: 'e1',
    title: 'Molchat Doma',
    date: '2026-07-01',
    description: '',
    url: 'https://example.com/1',
    venue: 'PMK Innsbruck',
    ...over,
});

test('recommended event gets the Tipp styling and a marker readable by AT', () => {
    render(<EventList events={[event(), event({ id: 'e2', title: 'Jazz Trio', recommended: true })]} />);
    const tipp = screen.getByRole('link', { name: /Jazz Trio.*heißer Tipp/ });
    expect(tipp.className).toContain('event-list__row--feat');
    expect(screen.getByRole('heading', { name: /Jazz Trio.*heißer tipp!/i })).toBeInTheDocument();
    const normal = screen.getByRole('link', { name: /Molchat Doma/ });
    expect(normal.className).not.toContain('event-list__row--feat');
});

test('no Tipp styling when nothing is recommended', () => {
    render(<EventList events={[event()]} />);
    expect(document.querySelector('.event-list__row--feat')).toBeNull();
    expect(screen.queryByText(/heißer tipp!/i)).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/EventList.test.tsx`
Expected: FAIL — no `--feat` class, no marker.

- [ ] **Step 3: Implement in `EventList.tsx`**

Inside the `events.map` callback, derive the flag and use it (only these lines change):

```tsx
      {events.map((event) => {
        const venue = getVenueConfig(event.venue);
        const isTipp = event.recommended === true;
        return (
          <div
            key={event.id}
            className={`event-list__row${isTipp ? ' event-list__row--feat' : ''}`}
```

the `aria-label` gains the Tipp (screen-reader users navigating by link hear only the label, not the inner heading):

```tsx
            aria-label={`${event.title} — ${venue.displayName}${isTipp ? ' — heißer Tipp' : ''}`}
```

and in the title span:

```tsx
            <span className="event-list__title" role="heading" aria-level={3}>
              {event.title}
              {isTipp && <span className="event-list__mk"> heißer tipp!</span>}
            </span>
```

Note: unlike `8d1ffed`, the marker carries NO `aria-hidden` and the label names the Tipp — screen readers must hear it in both browse and link-navigation modes (WCAG 1.4.1: not color-only, and the info must be programmatically available).

- [ ] **Step 4: Restore the CSS**

Append to `frontend/src/components/EventList.css` (desktop blocks after the `:hover` rule, before `@keyframes`; the `--feat` mobile block inside the existing `@media (max-width: 699px)` after the row rule). These are byte-identical to `8d1ffed`:

```css
.event-list__row--feat {
  background: var(--ctp-teal);
  border-top: none;
  border-radius: 4px;
  padding: 26px 22px;
  margin: 0 -22px;
}

.event-list__row--feat .event-list__time,
.event-list__row--feat .event-list__title {
  color: var(--on-accent);
}

.event-list__row--feat .event-list__venue {
  border-color: var(--on-accent);
  color: var(--on-accent);
}

.event-list__mk {
  font-family: var(--font-marker);
  font-size: 0.9375rem;
  vertical-align: super;
  text-transform: none;
  letter-spacing: 0;
}
```

Mobile (inside the media query):

```css
  .event-list__row--feat {
    padding: 18px 16px;
    margin: 0 -16px;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run`
Expected: all green (new file + existing suites).

- [ ] **Step 6: Commit (ask permission first)**

```bash
git add frontend/src/components/EventList.tsx frontend/src/components/EventList.css frontend/src/components/EventList.test.tsx
git commit -m "feat(ui): recommended-event Tipp row in list view"
```

---

## Task 7: Empty-url guards (TDD)

Custom events may have no link, and may carry a venue outside `VENUE_CONFIG`. `ics.ts` already guards (`if (e.url)`) — only the three components below navigate. `getVenueConfig` currently collapses unknown venues to "Unbekannt", which would hide the hand-entered venue name (the point of a custom event) — fix it here too.

**Files:**
- Modify: `frontend/src/components/EventList.tsx`, `frontend/src/components/EventList.css`
- Modify: `frontend/src/components/EventCard.tsx`
- Modify: `frontend/src/components/QuickPeek.tsx`
- Modify: `frontend/src/config/venues.ts`
- Test: extend `frontend/src/components/EventList.test.tsx`; create `frontend/src/components/QuickPeek.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `EventList.test.tsx` (add `fireEvent` and `vi` to the existing imports):

```tsx
test('event without url is not a link and never opens a window', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<EventList events={[event({ url: '' })]} />);
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(screen.getByText('Molchat Doma'));
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
});

test('a custom venue shows its hand-entered name, not Unbekannt', () => {
    render(<EventList events={[event({ venue: 'Hofgarten' })]} />);
    expect(screen.getByText('Hofgarten')).toBeInTheDocument();
    expect(screen.queryByText('Unbekannt')).toBeNull();
});
```

Create `frontend/src/components/QuickPeek.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { EventData } from '../../../shared/types/events';
import QuickPeek from './QuickPeek';

const event: EventData = {
    id: 'e1', title: 'T', date: '2026-07-01', description: 'Beschreibung',
    url: '', venue: 'Hofgarten',
};

test('website button is absent when the event has no url', () => {
    render(<QuickPeek event={event} visible />);
    expect(screen.queryByRole('button', { name: /zur website/i })).toBeNull();
});

test('website button renders when a url exists', () => {
    render(<QuickPeek event={{ ...event, url: 'https://example.com' }} visible />);
    expect(screen.getByRole('button', { name: /zur website/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/EventList.test.tsx src/components/QuickPeek.test.tsx`
Expected: both new behaviors FAIL.

- [ ] **Step 3: Implement the guards**

`EventList.tsx` — row attributes become conditional (`isTipp` line from Task 6 stays):

```tsx
        const hasUrl = !!event.url;
        return (
          <div
            key={event.id}
            className={`event-list__row${isTipp ? ' event-list__row--feat' : ''}${hasUrl ? '' : ' event-list__row--nolink'}`}
            role={hasUrl ? 'link' : undefined}
            tabIndex={hasUrl ? 0 : undefined}
            aria-label={hasUrl ? `${event.title} — ${venue.displayName}${isTipp ? ' — heißer Tipp' : ''}` : undefined}
            onClick={hasUrl ? () => openEvent(event.url) : undefined}
            onKeyDown={hasUrl ? (e) => { if (e.key === 'Enter') openEvent(event.url); } : undefined}
          >
```

`EventList.css` — append:

```css
.event-list__row--nolink {
  cursor: default;
}
```

and remove the link affordance from non-links by changing the existing hover rule's first selector:

```css
.event-list__row:not(.event-list__row--nolink):hover .event-list__title,
.event-list__row:focus-visible .event-list__title {
```

`frontend/src/config/venues.ts` — unknown-but-present venues keep their name (fallback gradient/accent stay):

```ts
export function getVenueConfig(venue?: string): VenueConfig {
  if (!venue) return FALLBACK_CONFIG;
  const key = Object.keys(VENUE_CONFIG).find(k => venue.includes(k));
  if (key) return VENUE_CONFIG[key];
  return { ...FALLBACK_CONFIG, displayName: venue };
}
```

`EventCard.tsx` — guard the opener and demote the role (the card stays focusable: focus shows QuickPeek, its remaining function):

```tsx
  const openEvent = () => {
    if (!event.url) return;
    window.open(event.url, '_blank', 'noopener');
  };
```

and on the root div:

```tsx
      role={event.url ? 'link' : 'group'}
```

`QuickPeek.tsx` — wrap the button:

```tsx
      {event.url && (
        <button className="quick-peek__link" onClick={handleLinkClick} tabIndex={visible ? 0 : -1}>
          Zur Website →
        </button>
      )}
```

- [ ] **Step 4: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all green.

- [ ] **Step 5: Commit (ask permission first)**

```bash
git add frontend/src/components/EventList.tsx frontend/src/components/EventList.css frontend/src/components/EventCard.tsx frontend/src/components/QuickPeek.tsx frontend/src/config/venues.ts frontend/src/components/EventList.test.tsx frontend/src/components/QuickPeek.test.tsx
git commit -m "fix(ui): handle custom events without url; show hand-entered venue names"
```

---

## Task 8: Cypress e2e

**Files:**
- Create: `frontend/cypress/e2e/editorial.cy.ts`

- [ ] **Step 1: Write the spec** (conventions copied from `hybrid.cy.ts`: inline factories, `/api/get-events` intercept)

```ts
const iso = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const mkEvents = () => [
  { id: 'e1', title: 'Molchat Doma', date: iso(0), description: 'x', url: 'https://example.com/1', venue: 'PMK Innsbruck' },
  { id: 'e2', title: 'Jazz Trio', date: iso(0), description: 'x', url: 'https://example.com/2', venue: 'Treibhaus Innsbruck', recommended: true },
  { id: 'sanity-abc123', title: 'Hofgarten Open Air', date: iso(0), description: 'Eigenes Event', url: '', venue: 'Hofgarten' },
];

beforeEach(() => {
  cy.viewport(1280, 900);
  cy.intercept('GET', '/api/get-events', {
    body: { events: mkEvents(), lastUpdated: new Date().toISOString(), count: 3 },
  });
});

describe('editorial layer', () => {
  it('renders exactly the recommended row as Tipp, wherever it sits', () => {
    cy.visit('/');
    cy.get('.event-list__row').should('have.length', 3);
    cy.get('.event-list__row--feat')
      .should('have.length', 1)
      .and('contain', 'Jazz Trio')
      .and('contain', 'heißer tipp!');
    cy.get('.event-list__row').first().should('not.have.class', 'event-list__row--feat');
  });

  it('custom event without url is rendered but not clickable', () => {
    cy.visit('/');
    cy.window().then(win => cy.stub(win, 'open').as('open'));
    cy.contains('.event-list__row', 'Hofgarten Open Air')
      .should('not.have.attr', 'role')
      .click();
    cy.get('@open').should('not.have.been.called');
  });

  it('custom venue shows under Alle and drops out when a chip filters', () => {
    cy.visit('/');
    cy.contains('.event-list__row', 'Hofgarten Open Air').should('exist');
    cy.contains('.view-controls__chip', 'PMK').click();
    cy.contains('.event-list__row', 'Hofgarten Open Air').should('not.exist');
    cy.contains('button', 'Alle').click();
    cy.contains('.event-list__row', 'Hofgarten Open Air').should('exist');
  });
});
```

- [ ] **Step 2: Run the e2e suite**

Start the dev server if not running (frontend only — this does not start the backend): `cd frontend && npx vite & sleep 3`
Run: `cd frontend && npx cypress run`
Expected: all specs green (existing `hybrid.cy.ts` + new `editorial.cy.ts`). Kill the Vite process afterwards with `lsof -ti:5173 | xargs kill`.

Also run the full lint gate (spec requirement): `npm run lint`
Expected: clean across workspaces.

- [ ] **Step 3: Commit (ask permission first)**

```bash
git add frontend/cypress/e2e/editorial.cy.ts
git commit -m "test(e2e): editorial layer coverage"
```

---

## Task 9: Documentation

**Files:**
- Modify: `CLAUDE.md` (project)
- Modify: `docs/audit-2026-06-11.md`
- Modify: `docs/superpowers/specs/2026-06-12-sanity-cms-design.md`

- [ ] **Step 1: Update `CLAUDE.md`**

- Monorepo Structure: add `├── studio/           # @wosweat/studio — Sanity studio (customEvent, recommendation)` between backend and frontend.
- Development Commands: add `npm run studio          # Sanity studio dev server (localhost:3333)`.
- Architecture Overview → Backend: add a short "Editorial layer" paragraph: `get-events` merges Sanity content (`utils/sanity.ts` fetch → `utils/editorial.ts` pure merge/matching) at request time; fail-open — Sanity errors degrade to scraped-only; off when `SANITY_PROJECT_ID` is unset.
- Event Data Model: add `recommended?: boolean; // editorial "heißer Tipp" (Sanity)` to the interface listing.
- Gotchas: add `Venue names are single-sourced in shared/constants.ts (VENUES); the recommendation matcher needs exact equality between studio dropdown and scraper output — never reintroduce venue string literals in extractors.`
- Deployment: mention env vars `SANITY_PROJECT_ID` / `SANITY_DATASET`, and that the studio deploys separately via `npx sanity deploy`.

- [ ] **Step 2: Update audit doc + spec status**

- `docs/audit-2026-06-11.md` feature idea 9: mark done for the list view (`→ Done 2026-06-12 (list view; Sanity).`), leave idea 10 (cards view + WQL field) open.
- Spec header: `**Status:** approved by user (all sections)` → `**Status:** implemented 2026-06-12 (see plan + audit doc)`.

- [ ] **Step 3: Commit (ask permission first)**

```bash
git add CLAUDE.md docs/audit-2026-06-11.md docs/superpowers/specs/2026-06-12-sanity-cms-design.md
git commit -m "docs: record Sanity editorial layer"
```

---

## Task 10: User setup + live verification (main session, not a subagent)

Interactive steps owned by the user; the orchestrator hands over exact commands and finishes the wiring.

- [ ] **Step 1: User creates the Sanity project**

User runs in the chat: `! npx -y sanity@latest init --bare`
(Logs into the existing account, creates a project, prints `projectId`.)

- [ ] **Step 2: Wire the id**

Replace `pending0` in `studio/project.ts` with the real id. Run `npx tsc --noEmit -p studio/tsconfig.json`.

- [ ] **Step 3: Set Netlify env** (with user's OK — it changes the linked site)

```bash
netlify env:set SANITY_PROJECT_ID <id>
netlify env:set SANITY_DATASET production
```

`netlify dev` picks these up locally; no `.env` file needed.

- [ ] **Step 4: Studio smoke test**

User runs `npm run studio`, opens `http://localhost:3333`, logs in. If the browser console shows a CORS error: `cd studio && npx sanity cors add http://localhost:3333 --credentials`. User creates one test `customEvent` (today, no url) and one `recommendation` matching a real scraped event, publishes both.

- [ ] **Step 5: Live verification (user runs the backend)**

User runs `npm run dev` (+ `npm run dev:scrape` if the local blob is stale) and checks the editorial content arrives (`npm run dev:events` only prints `.events[0]`, so query directly):

```bash
curl -fsS http://localhost:8888/.netlify/functions/get-events | jq '[.events[] | select(.recommended or (.id|startswith("sanity-")))]'
``` Then Firefox check on `http://localhost:8888`: Tipp row teal with marker in BOTH themes (Latte via a11y drawer), custom event present and not clickable, layout sane at 390px width.

- [ ] **Step 6: Commit the id (ask permission first)**

```bash
git add studio/project.ts
git commit -m "chore(studio): wire Sanity project id"
```

- [ ] **Step 7: Deploy** (user, when ready): push to master (Netlify builds), then `cd studio && npx sanity deploy`.

---

## Review log

Independently reviewed by a pedantic-but-fair senior-dev subagent (2026-06-12): verdict REQUEST-CHANGES with 1 critical (vitest 3 `mock.calls` typing in the Task 3 fetch helper — would have failed the `tsc` gate deterministically), 6 minor/nit findings. All fixes are applied in this version: corrected test counts (11/17), lint gate in Task 8, hand-entered venue names instead of "Unbekannt" (Task 7), `eventId` literals also moved to `VENUES.*` (Task 1), `Promise.all` for blob+Sanity (Task 4), Netlify install-cost note (Task 5), Tipp in the row `aria-label` (Tasks 6/7), hover-affordance guard on non-link rows (Task 7), corrected verification `jq` (Task 10). Workspace resolution, Sanity API usage, React 19 hoisting, and e2e interplay were explicitly verified as correct.

## Self-review notes (already applied)

- Spec coverage: every spec section maps to a task (constants/type → 1, merge+fail-open → 2–4, studio/schemas → 5, Tipp row + a11y → 6, url guards → 7, e2e → 8, docs → 9, user setup → 10). `ics.ts` needed no change (existing `if (e.url)` guard) — verified during planning.
- The marker `aria-hidden` from `8d1ffed` was deliberately NOT restored (screen readers must hear the Tipp); test in Task 6 asserts it.
- `customEvent.venue` is free text (spec deviation documented in Task 5, Step 4).
- Venue strings in Task 1 were verified against `site-selectors.ts` and both extractors before writing this plan.
