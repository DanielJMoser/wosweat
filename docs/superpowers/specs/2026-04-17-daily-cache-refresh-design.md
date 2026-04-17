# Daily Cache Refresh — Design Spec

> Revision history: 2026-04-17 initial. 2026-04-17 incorporated senior-dev review feedback (per-venue timeout, fail-closed auth, Vienna-tz string filter, helper extraction, anti-slop fixes).

## Context

wosweat scrapes 8 Innsbruck venue websites and serves the aggregated events to a frontend. Today, `get-events.ts` checks a 5-minute cache in `/tmp` and falls back to live scraping on a miss. A `scheduled-scrape.ts` function runs daily at midnight UTC and writes the same `/tmp` file.

This design exists. It does not work as intended.

**Why it fails:** Netlify Functions run in ephemeral, per-invocation containers. `/tmp` is per-container. The cron runs in container A and writes `/tmp/cached_events.json`. A user request hits container B with an empty `/tmp` and triggers a live scrape (8 sites, including a Puppeteer site, ~30–90 s). The "cache" almost never hits.

## Problem

Users wait up to 90 s for first paint after a cold container. Worse, the scraper hammers venue websites on every cold start because every container scrapes from scratch.

## Goal

Scrape every venue **exactly once per day**, at **00:01 Europe/Vienna**, and serve all subsequent user requests from a shared persistent cache. Read latency < 200 ms.

## Non-Goals

- Live scraping on user request. Removed entirely from the public path.
- Backfill of historical events. Future events only, as today.
- Per-venue independent refresh schedules. One daily batch.
- Mobile offline support. Orthogonal — handled later by Capacitor-side caching, no impact on this design.

## Architecture

```
        00:01 Vienna (cron)
              │
              ▼
   ┌─────────────────────────┐
   │ scheduled-scrape-       │
   │ background.ts           │  ── scrapeAllVenues() ──▶  scraper.ts
   │ (15-min limit)          │     (per-venue 60s        (8 venues, parallel,
   └────────────┬────────────┘      timeout, settled)     timeout-wrapped)
                │ writeEvents()
                ▼
        ┌──────────────┐
        │ Netlify      │   store: "events-cache"
        │ Blobs        │   key:   "latest"
        │              │   value: { events, lastUpdated }
        └──────┬───────┘
               │ readEvents() — strong consistency
               ▼
   ┌─────────────────────────┐
   │ get-events.ts           │   GET /.netlify/functions/get-events
   │ (no fallback scrape)    │   ─▶ { events, lastUpdated, count }
   └─────────────────────────┘
```

A single key, a single primary writer (the cron), many readers (every user request). No coordination needed. No `/tmp`. No live-scrape fallback.

## Storage Layer

**File:** `backend/functions/utils/blobs.ts` (new, ~20 LOC)

Two functions, no exported interface (only used inside this file):

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

**Why strong consistency on read:** Netlify Blobs is eventually consistent (≤60 s propagation). Without `consistency: 'strong'`, users in the minute after the cron may see yesterday's data. Strong adds latency (single-digit ms) but avoids the surprise.

**Why no etag / conditional write:** The cron is the primary writer. `trigger-scrape.ts` is the only other writer and is auth-protected ops use. Last-write-wins is acceptable; an accidental simultaneous run clobbers a partial scrape over a complete one once and recovers next cycle.

**Why no exported `CacheEntry` type:** It would have a single producer and a single consumer in the same file. Inline it (anti-slop rule: no type aliases without external consumers).

**Delete:** `backend/functions/utils/storage.ts` (the `/tmp` cache). Replaced by this.

## Timezone Helpers

**File:** `backend/functions/utils/timezone.ts` (new, ~15 LOC)

Two pure functions, both used in two places (the scheduled function and the read endpoint). Worth extracting both for DRY and for explicit verification at DST boundaries.

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

**Why a separate file:** Two consumers (`scheduled-scrape-background.ts` uses `viennaHour`, `get-events.ts` uses `todayInVienna`). Extraction is justified, not speculative. The project has a documented history of UTC bugs (commit `ba13cf7`); centralizing timezone logic in one verifiable file is the right move.

**Why `formatToParts`:** locale-string formats vary across runtimes — `en-CA`/`sv-SE` happen to produce ISO-like dates today, but relying on locale formatting is brittle. `formatToParts` is bulletproof.

**Verification:** Plan includes a Node one-liner that exercises both helpers at known DST-boundary instants (spring-forward 2026-03-29, fall-back 2026-10-25). No test infrastructure needed.

## Scrape Orchestration

**File:** `backend/functions/utils/scraper.ts` (modify — add one exported function and one private helper)

Add to the bottom of the existing file:

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

**Why per-venue timeout:** `axios.get(url)` in `scrapeWithCheerio` has no timeout. A hung venue stalls the whole batch indefinitely, eventually blowing the 15-minute background-function limit silently — write nothing, no log, no recovery until next cycle. 60 s per venue is generous (typical scrape <10 s) and bounds worst-case batch time at ~8 minutes.

**Why no extra error log:** `scrapeEvents()` already logs `Failed to scrape ${url}` and re-throws (line 21 of `scraper.ts`). A second log here is duplicate noise without added context.

**Why this lives in `scraper.ts`, not a new file:** This is the orchestrator's job — running scrapes. Splitting "scrape one site" and "scrape all sites" across files for two dependent functions is over-decomposition.

## Scheduled Background Function

**File:** `backend/functions/scheduled-scrape-background.ts` (new — replaces deleted `scheduled-scrape.ts`)

Why background, not regular scheduled: standard scheduled functions cap at **30 s**. Eight venues including one Puppeteer-rendered site can exceed that. Background functions allow **15 min** (suffix `-background` in filename).

Why Functions v2 pattern: the legacy `schedule()` helper still ships but all current Netlify docs use the v2 inline-config pattern. New code uses v2.

Why DST guard: Netlify cron is UTC-only. 00:01 Europe/Vienna is 23:01 UTC in winter (CET, UTC+1) and 22:01 UTC in summer (CEST, UTC+2). Scheduling at both `1 22,23 * * *` and bailing at runtime when Vienna hour ≠ 0 yields exactly one daily run year-round. Single-cron alternatives shift by an hour at DST.

**DST correctness analysis:** Vienna's DST transitions happen at 03:00 wall-clock (= 01:00 UTC), well outside our 22:01–23:01 UTC scheduling window. The repeated/skipped hour at the boundary never overlaps with midnight, so `viennaHour` always returns exactly one `0` per UTC day across the year. This is verified empirically by the Node one-liner in the verification checklist.

```typescript
import type { Config } from '@netlify/functions';
import { scrapeAllVenues } from './utils/scraper';
import { writeEvents } from './utils/blobs';
import { viennaHour } from './utils/timezone';

export default async () => {
  if (viennaHour() !== 0) return new Response(null, { status: 204 });

  const events = await scrapeAllVenues();
  await writeEvents(events);
  return new Response(`Stored ${events.length} events`, { status: 200 });
};

export const config: Config = {
  schedule: '1 22,23 * * *',
};
```

**Why no future-event filter here:** The reader filters at read time using `todayInVienna()`. Filtering at write time too would duplicate logic, complicate the writer, and produce no observable benefit (the blob is overwritten daily — past events don't accumulate across days; within a day, the reader handles the rolling window correctly).

**No `try/catch` wrapping the handler:** Function runtime catches and logs uncaught rejections. Adding a wrapping try/catch only obscures the stack trace. Per-venue errors are already absorbed by `scrapeAllVenues`'s `Promise.allSettled`.

## Public Read Endpoint

**File:** `backend/functions/get-events.ts` (rewrite)

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

**Removed from the old version:**
- `?refresh=true` query param. Public force-refresh defeats caching and is a trivial DoS vector.
- `?js=true` query param. Vestigial — `scrapeEvents` already picks rendering per-site.
- `success: true` field. Status code conveys success. Field was redundant noise.
- The whole live-scrape-on-cache-miss block (~40 LOC). Replaced by `events: []`.
- The `try/catch` wrapper. Function runtime handles uncaught errors.
- The `setHours(0,0,0,0)` UTC-midnight comparison. Replaced by Vienna-local string comparison via `todayInVienna()`. The old approach had the same UTC-vs-local mismatch class as commit `ba13cf7`.

**`Cache-Control: max-age=3600`:** The blob is updated once per day, so 1 hour of edge/browser caching is conservative. Originally `max-age=300` carried over from when the cache was 5-minute TTL. Now that the upstream refresh is 24h, an hour of downstream caching strictly reduces load without observable freshness cost.

**Defensive `cache.events ?? []`:** Even though the type says `events: EventData[]`, blob data crosses a runtime boundary. Per the project's anti-slop rule §3 ("If a value comes from a backend/API, assume any field can be null — use optional chaining regardless of what the TypeScript interface claims"), apply defensive chaining at the boundary.

## Manual Trigger (Ops Only)

**File:** `backend/functions/trigger-scrape.ts` (rewrite)

Auth-gated by `TRIGGER_SECRET`. **Fails closed** if the env var is missing — the existing code's `if (process.env.TRIGGER_SECRET && auth !== ...)` accidentally exposes a public scrape trigger when the env var is unset (forgotten on a redeploy or accidentally cleared). The rewritten version returns 503 in that case.

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
  return new Response(JSON.stringify({ count: events.length }), { status: 200, headers: HEADERS });
};
```

**Removed from the old version:**
- `?url=` query param. Unused — kept for "flexibility" with no consumer.
- `?js=true` query param. Vestigial.
- The `success: true` wrapper.
- Body content on auth failures (`{ error: 'Unauthorized' }`). HTTP status code is sufficient; no body reduces information leakage.

## Shared Types

**File:** `shared/types/events.ts` (modify)

Replace `ScraperResponse` with:

```typescript
export interface ScraperResponse {
  events: EventData[];
  lastUpdated: string | null;
  count: number;
}
```

The previous `success`, `error`, `count?`, `timestamp?` shape is fully replaced. `EventData` is unchanged.

## Frontend Changes

**`frontend/src/hooks/useEvents.ts`** — return `lastUpdated` alongside events. Pass-through field, no logic.

**Staleness hint** — small UI affordance when `lastUpdated` is older than 30 hours (cron should run every ~24 h; 30 h means at least one missed run).

Render in `App.tsx`, immediately above `<DateHeading>` inside the `<main>` block. Not inside `DateHeading` — the heading is concerned with the selected date, not cache state.

```tsx
{lastUpdated && Date.now() - new Date(lastUpdated).getTime() > 30 * 60 * 60 * 1000 && (
  <div className="stale-hint">
    Daten vom {new Intl.DateTimeFormat('de-AT', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(lastUpdated))}
  </div>
)}
```

CSS for `.stale-hint` (one rule, ~5 lines) added to `frontend/src/theme/variables.css` next to existing utility styles (`.refresh-progress-bar`, `.error-banner`).

## Backend Package

**File:** `backend/package.json` (modify)

Add `@netlify/blobs` to dependencies. Existing `@netlify/functions` already covers the v2 types via `import type { Config }`.

## Files Removed

- `backend/functions/utils/storage.ts` — replaced by `blobs.ts`
- `backend/functions/scheduled-scrape.ts` — replaced by `scheduled-scrape-background.ts`

## Failure Modes

| Failure | Behavior | Mitigation |
|---|---|---|
| Cron silently stops (documented Netlify pain point) | `lastUpdated` ages past 30 h, frontend shows staleness hint | Manual ops: `trigger-scrape`. Future: external uptime monitor pings `get-events` and alerts if `lastUpdated` > 30 h |
| One venue's scraper breaks | That venue's events drop for the day; others still served | `Promise.allSettled` + error logged inside `scrapeEvents`. Manual `trigger-scrape` once fixed |
| One venue's scraper hangs | Per-venue 60s timeout fires; that venue drops; batch continues | `withTimeout` wrapper |
| All scrapers break (shared utility regression) | `writeEvents([])` → blob is empty array with fresh `lastUpdated`; frontend shows no events but no staleness hint | Operator must catch in logs. Acceptable trade-off; alerting is out of scope |
| Blobs propagation race (60 s window) | Eliminated by `consistency: 'strong'` on read | — |
| Concurrent `trigger-scrape` + cron | Last-write-wins clobber. Both runs scrape successfully; one's data is lost | Acceptable. Ops should avoid manual triggers around 22:00–23:00 UTC |
| `TRIGGER_SECRET` unset in production | `trigger-scrape` returns 503; cannot trigger manual scrapes until env var restored | Fails closed, not open |
| Function cold start | One-time ~200 ms, then warm | Acceptable for an event-aggregator UX |

## Local Development

Netlify cron does **not** trigger during `netlify dev`. Manual invocation:

```bash
netlify functions:invoke scheduled-scrape-background --no-identity
```

Local Blobs is sandboxed (separate from production), persisted on disk between `netlify dev` restarts. No mocking needed.

The `get-events` function reads from the local sandbox the same way it reads from production. First local run: invoke `scheduled-scrape-background` once to populate (with the DST guard temporarily commented out, since local Vienna time is unlikely to be 00:00 when developing).

## Verification Checklist

- [ ] `npm install` succeeds with `@netlify/blobs` added
- [ ] `npx tsc --noEmit -p backend/tsconfig.json` passes
- [ ] `npx tsc --noEmit -p frontend/tsconfig.json` passes
- [ ] DST helper verification (Node one-liner from plan Task 11) prints expected hours and dates at DST boundaries
- [ ] `netlify functions:invoke scheduled-scrape-background` populates the local blob (with DST guard disabled for local testing)
- [ ] `curl http://localhost:8888/.netlify/functions/get-events` returns events with `lastUpdated` set
- [ ] Removing the local blob → `get-events` returns `{ events: [], lastUpdated: null, count: 0 }`
- [ ] Frontend renders events; stale hint hidden when `lastUpdated` is fresh
- [ ] Frontend stale hint appears when `lastUpdated` is manually set to >30 h ago
- [ ] DST guard: invoke `scheduled-scrape-background` without disabling the guard outside the 00:00 Vienna hour → returns 204 without scraping
- [ ] `trigger-scrape` returns 503 when `TRIGGER_SECRET` env var is unset
- [ ] `trigger-scrape` returns 401 with wrong bearer token when `TRIGGER_SECRET` is set
- [ ] `trigger-scrape` writes to the blob and returns `{ count: N }` with the correct token
- [ ] Production cron schedule visible in Netlify UI under Functions → scheduled-scrape-background
- [ ] No reference to `/tmp/cached_events.json` anywhere in the repo
- [ ] No reference to legacy `schedule(` helper in source files

## Out of Scope

- External uptime / heartbeat monitoring of the cron (manual log check for now)
- Per-venue cache versioning (future, if scraping budget becomes constrained)
- Capacitor-side offline cache (separate feature)
- Migration of historical `/tmp` data (none exists across containers)
- Backend test infrastructure (vitest etc.). DST helpers are verified empirically via the Node one-liner in the verification checklist; if future logic warrants real tests, add vitest then.
