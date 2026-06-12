# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

wosweat is an event tracking Progressive Web App built with Ionic React that aggregates events from multiple Innsbruck venues. It features a serverless backend using Netlify Functions for web scraping and data aggregation.

## Monorepo Structure

The project uses npm workspaces with three packages:

```
wosweat/
├── shared/           # @wosweat/shared — types and constants used by both frontend and backend
├── backend/          # @wosweat/backend — Netlify Functions (scraper)
└── frontend/         # @wosweat/frontend — Ionic React app
```

## Tech Stack

- **Frontend**: Ionic React, React 19, TypeScript, Vite, Capacitor
- **Backend**: Netlify Functions (serverless), Cheerio, Puppeteer
- **Testing**: Vitest (unit), Cypress (E2E)
- **Build**: npm workspaces, esbuild (Netlify)

## Development Commands

```bash
npm install              # Install all workspace dependencies
npm run dev              # Start Netlify dev server (frontend + functions)
npm run dev:scrape       # Populate the LOCAL Blobs sandbox (first run + after long gaps — it starts empty)
npm run build            # Build frontend for production
npm run lint             # Lint code
npm test                 # Frontend unit tests (vitest)
npx cypress run          # E2E (from frontend/; needs the dev server on port 5173)
```

## Gotchas

- `netlify dev` MUST run via `npm run dev` (passes `--filter @wosweat/backend`) — without the filter, the CLI's monorepo picker selects an arbitrary workspace and all functions 404.
- A stale local blob (old `dev:scrape`) leaves only 0–2 future events per day, which surfaces latent sparse-data UI bugs — refresh data before suspecting regressions.
- Verify layout changes in Firefox as well as Chromium — Cypress runs Chromium only, and grid/aspect-ratio interop differs (a Chromium-green change regressed in Firefox once already).
- Image-less event cards size via an in-flow placeholder that mimics `<img>`; don't "fix" card sizing with aspect-ratio tricks on grid items.
- `firefox --headless --screenshot` captures at the load event (skeletons, mid-animation); set `ui.prefersReducedMotion=1` in a throwaway profile to capture final states.
- Editing `frontend/src/**/*.ts(x)` auto-runs related vitest tests via a PostToolUse hook in `.claude/settings.json` — test output after edits is expected, not noise.

## Architecture Overview

### Backend (Scraper)

Netlify Functions in `backend/functions/`:
- `get-events.ts` — Main API endpoint, serves future-dated events from the Blobs cache
- `trigger-scrape.ts` — Manual scrape trigger (POST, auth-protected)
- `scheduled-scrape-background.ts` — Daily scrape at 00:01 Vienna time (cron runs 22:01 and 23:01 UTC; a Vienna-hour guard picks the right one across DST — intentional, don't simplify)

Scraper utilities in `backend/functions/utils/`:
- `scraper.ts` — Orchestrator: dispatches to Cheerio or Puppeteer
- `site-selectors.ts` — CSS selectors per venue
- `date-parser.ts` — German/English date extraction
- `blobs.ts` — Persistent events cache in Netlify Blobs
- `timezone.ts` — Vienna-local hour/date helpers
- `extractors/` — Per-venue extraction logic (artillery, baeckerei, kellertheater, generic)

### Shared

- `shared/types/events.ts` — `EventData` interface
- `shared/constants.ts` — `TARGET_SITES` (all venues)

### Frontend

Ionic React app in `frontend/`: date strip (pixel event-count badges) + month grid navigation, poster-scale date heading, three-view toggle KARTEN/LISTE/KONSOLE (list is default, persisted in localStorage), venue filter chips, telly-band marquee, venue list, accessibility drawer. Catppuccin theme plus non-flipping token sets (`--overlay-*`, `--on-accent`, `--console-*`) for surfaces that stay dark in both themes.

`frontend/src/lib/wql/` is the client-only query language behind the console (lexer → parser → evaluator → ics). Security invariants — closed grammar, fixed field table, no `eval`/`new Function`, input caps, escaped LIKE patterns, RFC 5545 escaping — must never be weakened without re-running the adversarial tests in the module's `*.test.ts`.

### Data Flow

1. Scheduled function scrapes all venues from `TARGET_SITES` daily at 00:01 Vienna time
2. Cheerio for static HTML, Puppeteer for JS-rendered sites (music-hall.at)
3. Results stored in Netlify Blobs (`events-cache` store)
4. Frontend calls `/.netlify/functions/get-events`, which reads the blob
5. Future-dated events (Vienna "today" onwards) returned as `EventData[]`

## Key Files

```
shared/
├── constants.ts                        # TARGET_SITES
└── types/events.ts                     # EventData

backend/functions/
├── get-events.ts                       # Main API endpoint
├── trigger-scrape.ts                   # Manual scrape trigger
├── scheduled-scrape-background.ts      # Daily scrape (00:01 Vienna)
└── utils/
    ├── scraper.ts                      # Scraping orchestrator
    ├── site-selectors.ts               # Per-venue CSS selectors
    ├── date-parser.ts                  # Date extraction
    ├── blobs.ts                        # Netlify Blobs cache
    ├── timezone.ts                     # Vienna time helpers
    └── extractors/
        ├── artillery.ts
        ├── baeckerei.ts
        ├── kellertheater.ts
        └── generic.ts
```

## Event Data Model

```typescript
interface EventData {
  id: string;
  title: string;
  date: string;       // ISO format (YYYY-MM-DD)
  time?: string;      // "21:00" — not yet populated by extractors
  description: string;
  url: string;
  venue?: string;
  imageUrl?: string;
  tags?: string[];    // not yet populated by extractors
}
```

## Supported Venues

- Treibhaus Innsbruck
- PMK Innsbruck
- Artillery Productions (BigCartel)
- Music Hall Innsbruck (Puppeteer, JS-rendered)
- Die Bäckerei
- BRUX Freies Theater Innsbruck
- Innsbrucker Kellertheater
- LiveStage Tirol

## TypeScript Configuration

- `tsconfig.base.json` at root with shared compiler options (ES2020, strict, noImplicitAny)
- Backend and frontend extend the base config
- Backend uses `@wosweat/shared/*` path alias for shared imports

## Deployment

Deployed on Netlify:
- `netlify.toml` points functions to `backend/functions/`, publish to `frontend/dist/`
- `@sparticuz/chromium` bundled externally for Puppeteer
- Environment: `TRIGGER_SECRET` for auth-protected scrape trigger

## Clean Code Principles

- Self-documenting code, comments only when the "why" is non-obvious
- Single responsibility per function/component
- DRY — single source of truth (e.g., `TARGET_SITES` in shared/)
- Functions under 20 lines where possible, max 3 arguments
- Components under 200 lines, extract sub-components if larger
- Functional components with hooks exclusively
- Explicit props interfaces, strict typing

## Frontend Design Philosophy

You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

**Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

**Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

**Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

**Backgrounds**: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

**Avoid generic AI-generated aesthetics:**
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. Avoid converging on common choices (Space Grotesk, for example) across generations — think outside the box.
