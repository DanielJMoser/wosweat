# Daily Cache Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Revision:** 2026-04-17 incorporated senior-dev review (per-venue timeout, fail-closed auth, Vienna-tz string filter, helper extraction, anti-slop fixes). 13 tasks.

**Goal:** Move venue event scraping to a once-daily cron at 00:01 Europe/Vienna, persist results in Netlify Blobs, and serve every user request from the cache. Eliminate per-request live scraping entirely.

**Architecture:** A scheduled background function scrapes all 8 venues once daily and writes the result to a single key in a Netlify Blob store. The public read endpoint (`get-events`) reads that key with strong consistency and returns the cached payload. No live-scrape fallback. Manual `trigger-scrape` retained for ops only, fail-closed.

**Tech Stack:** Netlify Functions v2, `@netlify/blobs` v10.7.4, `@netlify/functions` v3 (already installed), TypeScript, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-04-17-daily-cache-refresh-design.md`

---

## Testing Approach

This plan deliberately does **not** add backend test infrastructure. Reasons specific to this codebase:

- The codebase has no existing backend test setup; adding vitest + config + setup file for two helpers is meaningful new infrastructure
- Most new code is thin wrappers around Netlify primitives — meaningful tests would require mocking the Netlify runtime, testing the mock more than our code
- The two pieces that do warrant verification (the timezone helpers + DST guard) are exercised by an explicit Node one-liner in Task 13 that prints actual outputs at known DST boundaries
- The spec's verification checklist serves as the integration test plan, run manually via `netlify dev`

If a future change introduces logic that *can* be unit-tested without mocking infrastructure, add tests then.

Each task gates on:
1. **Type check** — `npx tsc --noEmit -p backend/tsconfig.json` (or frontend variant) — runs cleanly
2. **Manual verification commands** are listed where applicable — the user runs them
3. **Permission gate** before committing (per user's standing instruction)

---

## Task 1: Add `@netlify/blobs` dependency

**Files:**
- Modify: `backend/package.json`
- Modify: `package-lock.json` (auto)

- [ ] **Step 1.1:** Add the dependency via npm workspace flag

```bash
npm install @netlify/blobs -w @wosweat/backend
```

Expected: `backend/package.json` gains `"@netlify/blobs": "^10.7.4"` (or current latest); `package-lock.json` updated; no errors.

- [ ] **Step 1.2:** Confirm the new dependency line in `backend/package.json`

Read the file; verify `@netlify/blobs` appears in `dependencies` with version `^10.x.x`.

- [ ] **Step 1.3:** Type-check the backend

```bash
npx tsc --noEmit -p backend/tsconfig.json
```

Expected: zero errors.

- [ ] **Step 1.4:** Ask permission, then commit

```bash
git add backend/package.json package-lock.json
git commit -m "chore(backend): add @netlify/blobs for persistent cache storage"
```

---

## Task 2: Update `ScraperResponse` shared type

**Files:**
- Modify: `shared/types/events.ts`

- [ ] **Step 2.1:** Replace the `ScraperResponse` interface (lines 13–19) entirely

Replace:
```typescript
export interface ScraperResponse {
    success: boolean;
    events?: EventData[];
    error?: string;
    count?: number;
    timestamp?: string;
}
```

With:
```typescript
export interface ScraperResponse {
    events: EventData[];
    lastUpdated: string | null;
    count: number;
}
```

- [ ] **Step 2.2:** Type-check both projects

```bash
npx tsc --noEmit -p backend/tsconfig.json
npx tsc --noEmit -p frontend/tsconfig.json
```

Expected: zero errors. (`ScraperResponse` is currently not consumed anywhere in code — only referenced in docs — so this is non-breaking.)

- [ ] **Step 2.3:** Ask permission, then commit

```bash
git add shared/types/events.ts
git commit -m "refactor(shared): replace success/error fields in ScraperResponse with lastUpdated"
```

---

## Task 3: Create the Blobs storage helper

**Files:**
- Create: `backend/functions/utils/blobs.ts`

- [ ] **Step 3.1:** Write the file

```typescript
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
```

Notes (do not include in code):
- Inlined return type, no `CacheEntry` interface — single producer, single consumer, both inside this file
- `consistency: 'strong'` on read avoids the default 60s eventual-consistency window
- `setJSON` returns `{ modified, etag }` — discarded; one writer means etag tracking adds no value
- Constants are file-local (no export)

- [ ] **Step 3.2:** Type-check

```bash
npx tsc --noEmit -p backend/tsconfig.json
```

Expected: zero errors.

- [ ] **Step 3.3:** Ask permission, then commit

```bash
git add backend/functions/utils/blobs.ts
git commit -m "feat(backend): add Netlify Blobs storage helper for event cache"
```

---

## Task 4: Create timezone helpers

**Files:**
- Create: `backend/functions/utils/timezone.ts`

The project has a documented UTC-bug history (commit `ba13cf7`). Centralize timezone-aware date math in one file, exercised explicitly by the verification step at Task 13.

- [ ] **Step 4.1:** Write the file

```typescript
export function viennaHour(now: Date = new Date()): number {
    return Number(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Vienna',
            hour: '2-digit',
            hour12: false,
        }).format(now)
    );
}

export function todayInVienna(now: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Vienna',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}
```

Notes (do not include in code):
- `formatToParts` is locale-independent — relying on `'sv-SE'` or `'en-CA'` to produce ISO format works today but is implementation-dependent
- `now` parameter defaults to `new Date()` so production code calls with no args; verification uses fixed instants
- Both functions are used in two places (cron + read endpoint), so the helpers are non-speculative

- [ ] **Step 4.2:** Type-check

```bash
npx tsc --noEmit -p backend/tsconfig.json
```

Expected: zero errors.

- [ ] **Step 4.3:** Verify the helpers at DST boundaries

Run this Node one-liner. Expected output is annotated to the right of each line.

```bash
node -e "
function vh(d) { return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Vienna',hour:'2-digit',hour12:false}).format(d)); }
function td(d) { const p = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Vienna',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d); const g = t => p.find(x=>x.type===t).value; return g('year')+'-'+g('month')+'-'+g('day'); }
console.log('Winter 22:01Z 2026-03-28 →', vh(new Date('2026-03-28T22:01:00Z')), td(new Date('2026-03-28T22:01:00Z')), '  expect: 23 2026-03-28 (bail)');
console.log('Winter 23:01Z 2026-03-28 →', vh(new Date('2026-03-28T23:01:00Z')), td(new Date('2026-03-28T23:01:00Z')), '   expect:  0 2026-03-29 (run)');
console.log('Summer 22:01Z 2026-04-01 →', vh(new Date('2026-04-01T22:01:00Z')), td(new Date('2026-04-01T22:01:00Z')), '   expect:  0 2026-04-02 (run)');
console.log('Summer 23:01Z 2026-04-01 →', vh(new Date('2026-04-01T23:01:00Z')), td(new Date('2026-04-01T23:01:00Z')), '   expect:  1 2026-04-02 (bail)');
console.log('Fall-back 22:01Z 2026-10-25 →', vh(new Date('2026-10-25T22:01:00Z')), td(new Date('2026-10-25T22:01:00Z')), 'expect: 23 2026-10-25 (bail)');
console.log('Fall-back 23:01Z 2026-10-25 →', vh(new Date('2026-10-25T23:01:00Z')), td(new Date('2026-10-25T23:01:00Z')), ' expect:  0 2026-10-26 (run)');
"
```

If any actual differs from `expect`, **stop** and investigate before proceeding.

- [ ] **Step 4.4:** Ask permission, then commit

```bash
git add backend/functions/utils/timezone.ts
git commit -m "feat(backend): add Vienna timezone helpers (viennaHour, todayInVienna)"
```

---

## Task 5: Extend `scraper.ts` with batch orchestration

**Files:**
- Modify: `backend/functions/utils/scraper.ts` (append, do not refactor existing code)

The existing `scrapeEvents(url)` function stays untouched. Add a batch wrapper with per-venue timeout — `axios.get` currently has no timeout, so a single hung venue would stall the whole 15-minute background run silently.

- [ ] **Step 5.1:** Append to the bottom of `backend/functions/utils/scraper.ts`

```typescript
import { TARGET_SITES } from '@wosweat/shared/constants';

const VENUE_TIMEOUT_MS = 60_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        p,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
        ),
    ]);
}

export async function scrapeAllVenues(): Promise<EventData[]> {
    const results = await Promise.allSettled(
        TARGET_SITES.map((site) => withTimeout(scrapeEvents(site), VENUE_TIMEOUT_MS))
    );
    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
```

Notes (do not include in code):
- `scrapeEvents` already logs `Failed to scrape ${url}` and rethrows (line 21). Logging again here would be duplicate noise.
- 60s per venue × 8 venues = ~8 min worst-case batch, well inside the 15-min background-function limit.
- `EventData` is already imported at the top of `scraper.ts` — do not re-import.

- [ ] **Step 5.2:** Type-check

```bash
npx tsc --noEmit -p backend/tsconfig.json
```

Expected: zero errors.

- [ ] **Step 5.3:** Ask permission, then commit

```bash
git add backend/functions/utils/scraper.ts
git commit -m "feat(backend): add scrapeAllVenues with per-venue 60s timeout"
```

---

## Task 6: Replace scheduled scrape with background variant

**Files:**
- Delete: `backend/functions/scheduled-scrape.ts`
- Create: `backend/functions/scheduled-scrape-background.ts`

- [ ] **Step 6.1:** Delete the old file

```bash
git rm backend/functions/scheduled-scrape.ts
```

- [ ] **Step 6.2:** Create `backend/functions/scheduled-scrape-background.ts`

```typescript
import type { Config } from '@netlify/functions';
import { scrapeAllVenues } from './utils/scraper';
import { writeEvents } from './utils/blobs';
import { viennaHour } from './utils/timezone';

export default async () => {
    if (viennaHour() !== 0) {
        return new Response(null, { status: 204 });
    }

    const events = await scrapeAllVenues();
    await writeEvents(events);
    return new Response(`Stored ${events.length} events`, { status: 200 });
};

export const config: Config = {
    schedule: '1 22,23 * * *',
};
```

Notes (do not include in code):
- The `-background` suffix in the filename is a Netlify convention — it makes this a background function (15-min limit) instead of a regular scheduled function (30s limit).
- The cron fires twice per UTC day (22:01 and 23:01). The Vienna-hour guard runs the body on exactly the firing that maps to 00:00 Vienna time, year-round. Verified at DST boundaries by Task 4.
- No future-event filter at write time — the read endpoint filters using the same Vienna-day reference, so duplicating here adds no value.
- No try/catch wrapping — runtime catches uncaught rejections; per-venue errors are absorbed by `Promise.allSettled` inside `scrapeAllVenues`.

- [ ] **Step 6.3:** Type-check

```bash
npx tsc --noEmit -p backend/tsconfig.json
```

Expected: zero errors.

- [ ] **Step 6.4:** *(User runs manually, optional)* Verify the DST guard locally

With `netlify dev` running, invoke the function. Vienna's hour is unlikely to be 00 at the moment you run this, so the guard should bail:

```bash
netlify functions:invoke scheduled-scrape-background --no-identity
```

Expected: HTTP 204 No Content. (To force a real local scrape, comment out lines 6–8 of the new file, invoke, then revert before committing.)

- [ ] **Step 6.5:** Ask permission, then commit

```bash
git add backend/functions/scheduled-scrape-background.ts
git commit -m "feat(backend): replace scheduled-scrape with background variant writing to Blobs

- Migrate to Functions v2 inline config pattern
- Use scrapeAllVenues for per-venue timeout + failure isolation
- DST-correct Vienna midnight guard via viennaHour helper
- Background function (15min limit) replaces 30s scheduled function for Puppeteer headroom"
```

---

## Task 7: Rewrite `get-events.ts` to read from Blobs

**Files:**
- Modify: `backend/functions/get-events.ts`

- [ ] **Step 7.1:** Replace `backend/functions/get-events.ts` with this content:

```typescript
import { readEvents } from './utils/blobs';
import { todayInVienna } from './utils/timezone';

const HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
};

export default async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: HEADERS });
    }

    const cache = await readEvents();
    if (!cache) {
        return new Response(
            JSON.stringify({ events: [], lastUpdated: null, count: 0 }),
            { status: 200, headers: HEADERS }
        );
    }

    const today = todayInVienna();
    const events = (cache.events ?? []).filter((e) => e.date >= today);

    return new Response(
        JSON.stringify({ events, lastUpdated: cache.lastUpdated, count: events.length }),
        { status: 200, headers: HEADERS }
    );
};
```

Notes (do not include in code):
- Vienna-tz string compare (`e.date >= today`) replaces the previous `setHours(0,0,0,0)` UTC-midnight comparison, which had the same UTC-vs-local mismatch class as commit `ba13cf7`.
- `(cache.events ?? [])` defends against a malformed blob (anti-slop §3: optional chaining at runtime boundaries regardless of TS interface).
- `Cache-Control: max-age=3600` (1h) — cache is updated once per day, so 1h CDN/browser TTL is conservative. Old code's `max-age=300` was a holdover from the 5-minute server-side cache.

- [ ] **Step 7.2:** Type-check

```bash
npx tsc --noEmit -p backend/tsconfig.json
```

Expected: zero errors.

- [ ] **Step 7.3:** *(User runs manually)* Verify the endpoint

With `netlify dev` running and the local blob populated (run Task 6's manual scrape first with the DST guard temporarily disabled):

```bash
curl -s http://localhost:8888/.netlify/functions/get-events | jq
```

Expected JSON shape:
```json
{
  "events": [ /* ... */ ],
  "lastUpdated": "2026-04-17T22:01:00.000Z",
  "count": 42
}
```

Empty-blob check: clear local Blobs storage. The exact path is whatever `netlify dev` initializes — see Netlify CLI docs for your installed version. After clearing, expect:
```json
{ "events": [], "lastUpdated": null, "count": 0 }
```

- [ ] **Step 7.4:** Ask permission, then commit

```bash
git add backend/functions/get-events.ts
git commit -m "refactor(backend): read events from Blobs only, remove live-scrape fallback

- Migrate to Functions v2 (Request/Response signature)
- Vienna-timezone string filter via todayInVienna helper
- Remove ?refresh=true and ?js=true query params (DoS vector + vestigial)
- Remove sample-event generator and try/catch wrapping
- Empty cache returns events: [], lastUpdated: null instead of triggering a scrape
- Cache-Control max-age 300 → 3600 (matches daily refresh cadence)"
```

---

## Task 8: Rewrite `trigger-scrape.ts` (fail-closed auth)

**Files:**
- Modify: `backend/functions/trigger-scrape.ts`

The current code only checks the bearer token if `TRIGGER_SECRET` is set. If the env var is forgotten or accidentally cleared, the endpoint becomes a public scrape trigger that runs Puppeteer on every call. The rewrite fails closed — 503 when the secret is unset.

- [ ] **Step 8.1:** Replace `backend/functions/trigger-scrape.ts` with:

```typescript
import { scrapeAllVenues } from './utils/scraper';
import { writeEvents } from './utils/blobs';

const HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
};

export default async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: HEADERS });
    }

    if (!process.env.TRIGGER_SECRET) {
        return new Response(null, { status: 503, headers: HEADERS });
    }
    if (req.headers.get('authorization') !== `Bearer ${process.env.TRIGGER_SECRET}`) {
        return new Response(null, { status: 401, headers: HEADERS });
    }

    const events = await scrapeAllVenues();
    await writeEvents(events);
    return new Response(
        JSON.stringify({ count: events.length }),
        { status: 200, headers: HEADERS }
    );
};
```

Notes (do not include in code):
- Auth flow now: 503 if no secret configured → 401 if wrong token → run if right token. Fails closed.
- `?url=` and `?js=true` query params removed (no consumers).
- Auth-failure responses have no body — HTTP status conveys it; less information leaked.

- [ ] **Step 8.2:** Type-check

```bash
npx tsc --noEmit -p backend/tsconfig.json
```

Expected: zero errors.

- [ ] **Step 8.3:** Ask permission, then commit

```bash
git add backend/functions/trigger-scrape.ts
git commit -m "refactor(backend): trigger-scrape fails closed when TRIGGER_SECRET is unset

- Migrate to Functions v2
- 503 when secret env var is missing (was: implicitly public)
- Drop ?url= (no consumer) and ?js= (vestigial)
- Use scrapeAllVenues for timeout + failure isolation
- Replace /tmp storage with writeEvents()"
```

---

## Task 9: Delete obsolete `/tmp` storage helper

**Files:**
- Delete: `backend/functions/utils/storage.ts`

- [ ] **Step 9.1:** Verify nothing still imports `storage`

Use the Grep tool with pattern `from ['\"]\./utils/storage['\"]` across `backend/`. Expected: zero matches. If any match remains, abort and investigate before deleting.

- [ ] **Step 9.2:** Delete the file (stages the deletion)

```bash
git rm backend/functions/utils/storage.ts
```

- [ ] **Step 9.3:** Type-check

```bash
npx tsc --noEmit -p backend/tsconfig.json
```

Expected: zero errors.

- [ ] **Step 9.4:** Confirm no `/tmp/cached_events.json` references remain

Use the Grep tool with pattern `cached_events|/tmp/cached` across the whole repo. Expected: zero matches in source files. (Matches in this plan or the spec are fine.)

- [ ] **Step 9.5:** Ask permission, then commit

```bash
git commit -m "chore(backend): remove obsolete /tmp file-cache helper, replaced by Blobs"
```

---

## Task 10: Expose `lastUpdated` from `useEvents` hook

**Files:**
- Modify: `frontend/src/hooks/useEvents.ts`

- [ ] **Step 10.1:** Apply three edits to `frontend/src/hooks/useEvents.ts`

**Edit A** — extend the `UseEventsReturn` interface (lines 8–17):

Change:
```typescript
interface UseEventsReturn {
  events: EventData[];
  eventsByDate: Map<string, EventData[]>;
  loading: boolean;
  error: string | null;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  refresh: () => Promise<void>;
  refreshing: boolean;
}
```

To:
```typescript
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
```

**Edit B** — add `lastUpdated` state. Find:

```typescript
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
```

Replace with:
```typescript
  const [events, setEvents] = useState<EventData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
```

**Edit C** — set `lastUpdated` from the response. Find (inside `fetchEvents`):

```typescript
      const data = await res.json();
      setEvents(data?.events ?? []);
```

Replace with:
```typescript
      const data = await res.json();
      setEvents(data?.events ?? []);
      setLastUpdated(data?.lastUpdated ?? null);
```

**Edit D** — return `lastUpdated`. Find the return block (around line 77):

```typescript
  return {
    events: filteredEvents,
    eventsByDate,
    loading,
    error,
    selectedDate,
    setSelectedDate,
    refresh,
    refreshing,
  };
```

Replace with:
```typescript
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
```

- [ ] **Step 10.2:** Type-check the frontend

```bash
npx tsc --noEmit -p frontend/tsconfig.json
```

Expected: zero errors.

- [ ] **Step 10.3:** Ask permission, then commit

```bash
git add frontend/src/hooks/useEvents.ts
git commit -m "feat(frontend): expose lastUpdated cache timestamp from useEvents hook"
```

---

## Task 11: Render the staleness hint in `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

Render the hint immediately above `<DateHeading>` when `lastUpdated` exceeds 30 hours.

- [ ] **Step 11.1:** Two edits to `frontend/src/App.tsx`

**Edit A** — destructure `lastUpdated` from `useEvents`. Find:

```typescript
  const { eventsByDate, loading, error, refresh, refreshing, selectedDate, setSelectedDate } = useEvents({ venueFilter });
```

Replace with:
```typescript
  const { eventsByDate, loading, error, refresh, refreshing, selectedDate, setSelectedDate, lastUpdated } = useEvents({ venueFilter });
```

**Edit B** — insert the hint above `<DateHeading>`. Find:

```tsx
          <DateHeading date={selectedDate} />
```

Replace with:
```tsx
          {lastUpdated && Date.now() - new Date(lastUpdated).getTime() > 30 * 60 * 60 * 1000 && (
            <div className="stale-hint">
              Daten vom {new Intl.DateTimeFormat('de-AT', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
              }).format(new Date(lastUpdated))}
            </div>
          )}
          <DateHeading date={selectedDate} />
```

- [ ] **Step 11.2:** Type-check

```bash
npx tsc --noEmit -p frontend/tsconfig.json
```

Expected: zero errors.

- [ ] **Step 11.3:** Ask permission, then commit

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): show staleness hint when cache is older than 30 hours"
```

---

## Task 12: Add `.stale-hint` CSS

**Files:**
- Modify: `frontend/src/theme/variables.css`

Place the rule next to the existing utility styles (`.refresh-progress-bar`, `.error-banner`).

- [ ] **Step 12.1:** Locate the existing `.error-banner` rule in `frontend/src/theme/variables.css` and add this block immediately after it (or, if the file structure has changed, append at the end):

```css
.stale-hint {
  margin: 0 0 0.75rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  color: var(--ion-color-warning, #f5a623);
  background: rgba(245, 166, 35, 0.08);
  border-left: 2px solid var(--ion-color-warning, #f5a623);
  border-radius: 0 4px 4px 0;
}
```

- [ ] **Step 12.2:** Build the frontend to confirm CSS parses

```bash
npm run build
```

Expected: build completes; no CSS errors.

- [ ] **Step 12.3:** Ask permission, then commit

```bash
git add frontend/src/theme/variables.css
git commit -m "style(frontend): add .stale-hint utility for cache age warning"
```

---

## Task 13: End-to-end verification

**Files:** none modified.

Final checklist run, mirroring the spec's Verification Checklist. The user runs all manual commands.

- [ ] **Step 13.1:** Confirm clean type-check across the monorepo

```bash
npx tsc --noEmit -p backend/tsconfig.json
npx tsc --noEmit -p frontend/tsconfig.json
```

Expected: zero errors in both.

- [ ] **Step 13.2:** Confirm no legacy references remain

Use the Grep tool with each pattern below, scoped to source files via `glob: "**/*.{ts,tsx,js}"`. Each must return zero matches; doc-file matches are fine.

| Pattern | What it catches |
|---|---|
| `cached_events` | Any leftover reference to the old `/tmp/cached_events.json` file |
| `from ['\"]\./utils/storage['\"]` | Imports from the deleted `storage.ts` |
| `\bschedule\s*\(` | Calls to the legacy `schedule()` helper (the new file uses `schedule:` as a config object key, which this pattern does not match) |

If any pattern returns a source match, fix the import/reference and re-run.

- [ ] **Step 13.3:** Re-run the DST verification (sanity check, end-to-end)

The same one-liner from Task 4.3 — confirm no regression as more code now depends on the helpers:

```bash
node -e "
function vh(d) { return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Vienna',hour:'2-digit',hour12:false}).format(d)); }
function td(d) { const p = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Vienna',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d); const g = t => p.find(x=>x.type===t).value; return g('year')+'-'+g('month')+'-'+g('day'); }
console.log('Winter 22:01Z 2026-03-28 →', vh(new Date('2026-03-28T22:01:00Z')), td(new Date('2026-03-28T22:01:00Z')), '  expect: 23 2026-03-28 (bail)');
console.log('Winter 23:01Z 2026-03-28 →', vh(new Date('2026-03-28T23:01:00Z')), td(new Date('2026-03-28T23:01:00Z')), '   expect:  0 2026-03-29 (run)');
console.log('Summer 22:01Z 2026-04-01 →', vh(new Date('2026-04-01T22:01:00Z')), td(new Date('2026-04-01T22:01:00Z')), '   expect:  0 2026-04-02 (run)');
console.log('Summer 23:01Z 2026-04-01 →', vh(new Date('2026-04-01T23:01:00Z')), td(new Date('2026-04-01T23:01:00Z')), '   expect:  1 2026-04-02 (bail)');
console.log('Fall-back 22:01Z 2026-10-25 →', vh(new Date('2026-10-25T22:01:00Z')), td(new Date('2026-10-25T22:01:00Z')), 'expect: 23 2026-10-25 (bail)');
console.log('Fall-back 23:01Z 2026-10-25 →', vh(new Date('2026-10-25T23:01:00Z')), td(new Date('2026-10-25T23:01:00Z')), ' expect:  0 2026-10-26 (run)');
"
```

- [ ] **Step 13.4:** *(User runs manually)* Local end-to-end smoke test

With `netlify dev` running:

```bash
# 1. Populate the local blob (temporarily disable the DST guard, since local Vienna time is unlikely to be 00:00)
netlify functions:invoke scheduled-scrape-background --no-identity

# 2. Read it back
curl -s http://localhost:8888/.netlify/functions/get-events | jq '{count, lastUpdated, sample: .events[0]}'

# 3. Confirm trigger-scrape fails closed without the secret
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8888/.netlify/functions/trigger-scrape
# Expect: 503

# 4. With TRIGGER_SECRET=test in the local env, wrong bearer
TRIGGER_SECRET=test netlify dev   # restart dev
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer wrong" http://localhost:8888/.netlify/functions/trigger-scrape
# Expect: 401

# 5. Right bearer
curl -s -X POST -H "Authorization: Bearer test" http://localhost:8888/.netlify/functions/trigger-scrape | jq
# Expect: { "count": N }
```

- [ ] **Step 13.5:** *(User runs manually)* Stale-hint visual check

Manually edit the local blob's `lastUpdated` to 48h ago (e.g., via a temporary script that calls `writeEvents` then patches the timestamp). Open the frontend; confirm the orange `.stale-hint` band appears above the `DateHeading`.

- [ ] **Step 13.6:** *(User runs manually after deploy)* Production verification

After deploying to Netlify:

```bash
# Schedule should appear in the function list
netlify functions:list   # expect scheduled-scrape-background with cron 1 22,23 * * *

# Force a one-off run from the Netlify UI (Functions → scheduled-scrape-background → "Run now")

# Read the production endpoint
curl -s https://<site>.netlify.app/.netlify/functions/get-events | jq '{count, lastUpdated}'
# Expect: lastUpdated within the past minute

# Confirm trigger-scrape requires auth in production
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<site>.netlify.app/.netlify/functions/trigger-scrape
# Expect: 401 (TRIGGER_SECRET should be set in production)
```

- [ ] **Step 13.7:** No commit needed; this task is verification only.

---

## Files at end of implementation

**Created:**
- `backend/functions/utils/blobs.ts`
- `backend/functions/utils/timezone.ts`
- `backend/functions/scheduled-scrape-background.ts`

**Modified:**
- `backend/package.json` (`@netlify/blobs` added)
- `package-lock.json`
- `shared/types/events.ts` (`ScraperResponse` reshaped)
- `backend/functions/utils/scraper.ts` (`scrapeAllVenues` appended)
- `backend/functions/get-events.ts` (rewritten)
- `backend/functions/trigger-scrape.ts` (rewritten)
- `frontend/src/hooks/useEvents.ts` (`lastUpdated` exposed)
- `frontend/src/App.tsx` (staleness hint JSX)
- `frontend/src/theme/variables.css` (`.stale-hint` rule)

**Deleted:**
- `backend/functions/utils/storage.ts`
- `backend/functions/scheduled-scrape.ts`

**Commit count:** 11 (one per Task 1–12 except Task 13 which is verification-only).
