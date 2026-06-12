# Sanity editorial layer — design

**Date:** 2026-06-12
**Status:** approved by user (all sections)

## Goal

Add an editorial layer on top of the scraper pipeline:

1. **Custom events** — events created by hand in a Sanity studio (venues we don't scrape, one-offs, festivals), shown alongside scraped events in every view.
2. **Recommendation flag ("heißer Tipp")** — deliberately mark any event (scraped or custom) as recommended, restoring the featured-row styling in the list view that was removed in `9c34260` (styling recoverable from `8d1ffed`).

Decisions already made with the user:

- Tipps can mark **any** event, not just custom ones.
- Editorial changes must appear on the live site **within minutes** → merge happens at request time, not at scrape time.
- **New Sanity project** in the user's existing account (free plan). Project creation is interactive (`sanity init`) and is done by the user during implementation.
- Architecture: **backend merge** in `get-events` (chosen over frontend dual-fetch and webhook→blob sync).

## Architecture

```
nightly scrape ----> Blob (events-cache)
                          |
browser --> get-events ---+--> merge + Tipp flags --> EventData[]
                          |
Studio ---> Sanity CDN ---+   (one GROQ query, read-only, no token)

fail-open: Sanity unreachable -> scraped-only response
frontend: unchanged data flow, still exactly one endpoint
```

The frontend keeps a single data source. List, cards, console (WQL), telly band, and ICS export consume custom events and the `recommended` flag with no pipeline changes.

## Studio workspace

- New npm workspace `studio/` (`@wosweat/studio`), following the pdt convention: Sanity v4, `sanity.config.ts`, `sanity.cli.ts`, `schemaTypes/` with an `index.ts` barrel.
- **Not** part of the Netlify build. Deployed separately by the user via `npx sanity deploy` (hosted at `<name>.sanity.studio`).
- New root script: `npm run studio` → starts the studio dev server (localhost:3333).
- Studio imports venue names from `@wosweat/shared` so the venue list has a single source of truth.
- Risk to verify at implementation time: npm workspace hoisting of studio dependencies (React, styled-components) must not break the frontend build. Gate: `npm install` + both builds green before anything else proceeds.

## Content model

Two document types, German-labeled in the studio UI.

### `customEvent`

| Field | Type | Rules |
|---|---|---|
| `title` | string | required |
| `date` | date | required (ISO `YYYY-MM-DD`) |
| `time` | string | optional, `HH:MM` regex validation |
| `venue` | string | required; free text, known venue names offered as suggestions |
| `description` | text | optional → `''` when mapped |
| `url` | url | optional → `''` when mapped |
| `image` | image | optional → Sanity CDN URL (`image.asset->url` + `?w=1200&auto=format`) |
| `tags` | array of strings | optional |
| `recommended` | boolean | "heißer Tipp", initial `false` |

Mapping to `EventData`: `id = "sanity-" + _id` — stable across edits (a hash of title/date would change on every correction), unique by construction, and marks provenance. All mapping is defensive (`?.`, fallbacks): never trust that a Sanity payload matches the schema.

### `recommendation` (Empfehlung — marks a scraped event)

| Field | Type | Rules |
|---|---|---|
| `venue` | string | required, dropdown of known venue names from `@wosweat/shared` |
| `date` | date | required |
| `titleContains` | string | required, min 3 chars |

Match rule, applied to the **merged** list (so it can also re-flag a custom event, harmlessly):

```
event.venue === r.venue
&& event.date === r.date
&& event.title.toLowerCase().includes(r.titleContains.toLowerCase())
→ event.recommended = true
```

Why match fields instead of our stable event IDs: IDs are djb2 hashes of `venue|date|title|url` — invisible in the UI and they dangle the moment a venue edits a title. Venue+date+fragment is human-enterable in the studio and survives title edits while the fragment still matches. If the venue changes the **date**, the match lapses silently: the Tipp disappears rather than flagging a wrong event — the safe failure direction. Multiple matches all get flagged (the editor controls specificity via the fragment).

Recommendations expire naturally: `get-events` already filters past dates.

### Shared type change

`EventData` gains one optional field: `recommended?: boolean`.

## Backend changes

### `backend/functions/utils/sanity.ts` (new)

- Plain `fetch` against the Sanity HTTP query API (`https://<projectId>.apicdn.sanity.io/v<apiVersion>/data/query/<dataset>?query=…`). **No `@sanity/client` dependency** — the query API is a simple GET, and the dataset is public/read-only so there is no token to manage or leak.
- One GROQ query returns both types, already date-filtered:
  ```groq
  {
    "custom": *[_type == "customEvent" && date >= $today]{ ..., "imageUrl": image.asset->url },
    "recs":   *[_type == "recommendation" && date >= $today]{ venue, date, titleContains }
  }
  ```
- `AbortSignal.timeout(3000)`; any error (timeout, non-200, malformed JSON) is logged and returns `null`.
- If `SANITY_PROJECT_ID` is unset, short-circuits to `null` silently — fresh local dev needs zero Sanity setup.

### `backend/functions/get-events.ts`

After the existing blob read + date filter:

1. fetch editorial content (fail-open as above),
2. map `custom` → `EventData[]` and concatenate,
3. apply recommendation matchers across the combined list.

Merge/mapping/matching live as pure functions so they are unit-testable without any network.

Cache header change: `max-age=3600` → `max-age=300` on the hit path, otherwise the browser cache defeats "fresh within minutes". Invocation volume stays trivially inside the Netlify free tier.

### Environment

- `SANITY_PROJECT_ID`, `SANITY_DATASET` (default `production`) — set in Netlify env and locally (picked up by `netlify dev`). No secrets: both values are public by nature.

## Frontend changes (minimal)

- **EventList**: restore `event-list__row--feat` styling + "heißer tipp!" marker from `8d1ffed`, driven by `event.recommended` instead of "first row". Recommended rows can appear anywhere in the list, any number of them (including zero — the common case).
- **Empty-url guard**: rows/cards for a custom event without a link must not act as links (no `role="link"`, no navigation, no empty `href`).
- **Venue chips**: a custom venue outside `VENUE_CONFIG` gets no chip and appears under "Alle" only — accepted for now. Its hand-entered name must still display on rows/cards (fallback styling); `getVenueConfig` may not collapse it to "Unbekannt". (Added after plan review.)
- Explicitly **out of scope** (noted as future ideas): Tipp badge in the cards view, `recommended` as a WQL-queryable field, Tipp styling in the telly band. Per user (2026-06-12): the cards-view badge and the WQL field are wanted in a **future iteration** — not this one.

## Accessibility

The restored Tipp marker must not be color-only (WCAG 1.4.1): the `8d1ffed` styling already includes the "heißer tipp!" text marker — that text stays, and gets an appropriate treatment for screen readers if it is decorative-positioned. Recommended rows keep the same keyboard/focus behavior as normal rows.

## Failure modes

| Failure | Behavior |
|---|---|
| Sanity unreachable / timeout / 5xx | log, serve scraped-only (site never degrades below status quo) |
| Malformed document (missing title/date) | defensive mapping skips the event, logs |
| Recommendation matches nothing | no flag set, no error — Tipp silently absent |
| Venue changes a recommended event's date | match lapses → Tipp disappears (safe direction) |
| `SANITY_PROJECT_ID` unset (local dev) | editorial layer off, everything else works |

## Testing

- **Backend (vitest)**: pure-function coverage for mapping (incl. malformed payloads), recommendation matching (case-insensitivity, multi-match, no-match), merge order; `sanity.ts` fetch behavior with mocked fetch (timeout, non-200, bad JSON → `null`).
- **Frontend (vitest/RTL)**: EventList renders the Tipp row for `recommended: true`, none for the common all-false case; empty-url row is not a link.
- **Cypress e2e**: list view shows the Tipp row via an intercepted fixture — no live Sanity in CI.
- **Pre-commit gate**: build, lint, full unit suite, e2e, Firefox screenshot check (both themes for the restored Tipp styling).

## Setup steps owned by the user

1. `! npx -y sanity@latest init --bare` once — creates the project in the existing account and prints the projectId (handed to Claude to wire in).
2. Set `SANITY_PROJECT_ID` / `SANITY_DATASET` in Netlify env (CLI command will be provided).
3. `npx sanity deploy` when the studio is ready (and re-run after schema changes).

## Out of scope

- Editorial overrides/corrections of scraped event fields (future idea — would need the dangling-ID problem solved properly).
- Webhook-based cache invalidation.
- Auth'd/private datasets, tokens, draft previews.
- Tipp surfaces beyond the list view.
