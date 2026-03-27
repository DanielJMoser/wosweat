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
npm run build            # Build frontend for production
npm run lint             # Lint code
```

## Architecture Overview

### Backend (Scraper)

Netlify Functions in `backend/functions/`:
- `get-events.ts` — Main API endpoint, returns cached or freshly scraped events
- `trigger-scrape.ts` — Manual scrape trigger (POST, auth-protected)
- `scheduled-scrape.ts` — Daily cron job scraping all venues
- `test-events.ts` — Returns sample events for frontend testing

Scraper utilities in `backend/functions/utils/`:
- `scraper.ts` — Orchestrator: dispatches to Cheerio or Puppeteer
- `site-selectors.ts` — CSS selectors per venue
- `date-parser.ts` — German/English date extraction
- `storage.ts` — File-based cache in `/tmp` (5-min TTL)
- `extractors/` — Per-venue extraction logic (artillery, baeckerei, kellertheater, generic)

### Shared

- `shared/types/events.ts` — `EventData`, `ScraperResponse` interfaces
- `shared/constants.ts` — `TARGET_SITES` (all venues), `CACHE_DURATION_MS`

### Frontend

Ionic React app in `frontend/` (currently scaffold, UI being redesigned).

### Data Flow

1. Frontend calls `/.netlify/functions/get-events`
2. Function checks server cache (5-min TTL in `/tmp`)
3. On cache miss, scrapes all venues from `TARGET_SITES`
4. Cheerio for static HTML, Puppeteer for JS-rendered sites (music-hall.at)
5. Future-dated events returned as `EventData[]`

## Key Files

```
shared/
├── constants.ts                        # TARGET_SITES, CACHE_DURATION_MS
└── types/events.ts                     # EventData, ScraperResponse

backend/functions/
├── get-events.ts                       # Main API endpoint
├── trigger-scrape.ts                   # Manual scrape trigger
├── scheduled-scrape.ts                 # Cron job (daily midnight)
├── test-events.ts                      # Test endpoint
└── utils/
    ├── scraper.ts                      # Scraping orchestrator
    ├── site-selectors.ts               # Per-venue CSS selectors
    ├── date-parser.ts                  # Date extraction
    ├── storage.ts                      # /tmp cache
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
  description: string;
  url: string;
  venue?: string;
  imageUrl?: string;
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
