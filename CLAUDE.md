# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

wosweat is an event tracking Progressive Web App built with Ionic React that aggregates events from multiple Innsbruck venues. It features a serverless backend using Netlify Functions for web scraping and data aggregation.

## Tech Stack

- **Frontend**: Ionic React v8.5.0, React 19.0.0, TypeScript
- **Build Tool**: Vite v5.2.0
- **Backend**: Netlify Functions (serverless)
- **Mobile**: Capacitor for iOS/Android builds
- **Web Scraping**: Puppeteer with Chromium, Cheerio
- **Testing**: Vitest (unit), Cypress (E2E)
- **State Management**: React Context API with useReducer

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run unit tests
npm run test.unit

# Run E2E tests
npm run test.e2e

# Lint code
npm run lint

# Preview production build
npm run preview

# Mobile development
ionic capacitor build ios
ionic capacitor build android
ionic capacitor run ios
ionic capacitor run android
```

## Architecture Overview

### Frontend Architecture

- **Entry Point**: `src/main.tsx` → `src/App.tsx`
- **Routing**: Tab-based navigation with `/events` and `/direct` routes
- **State Management**: `EventsContext` provides global state using Context API
  - Manages events, loading states, errors, and auto-refresh
  - 5-minute auto-refresh interval
  - Local caching for offline support
- **Service Layer**: `EventService` handles API calls and caching
- **UI Style**: Vaporwave aesthetic with animated backgrounds

### Backend Architecture

- **Netlify Functions** in `netlify/functions/`:
  - `get-events.ts`: Main endpoint for retrieving events (supports caching)
  - `trigger-scrape.ts`: Manual trigger for scraping all venues
  - `scraper-utils.ts`: Core scraping logic with site-specific selectors
- **Scraping Strategy**:
  - Cheerio for static HTML sites
  - Puppeteer for JavaScript-rendered sites
  - Fallback to cached or sample data on failure
- **Caching**: File-based caching in `/tmp` directory (5-minute TTL)

### Data Flow

1. Frontend requests events from `EventService`
2. Service checks localStorage cache (5 min TTL)
3. If cache miss, calls Netlify Function
4. Function checks server cache or scrapes venues
5. Data normalized and returned as `EventData[]`
6. Frontend groups events by day and displays

## Key Files and Directories

```
src/
├── context/EventsContext.tsx    # Global state management
├── services/events-service.ts   # API and caching layer
├── pages/
│   ├── EventsPage.tsx          # Main events view with grouping
│   └── DirectEventsPage.tsx    # Debug view bypassing context
├── components/                  # Reusable UI components
└── types/                      # TypeScript interfaces

netlify/functions/
├── get-events.ts               # Main API endpoint
├── trigger-scrape.ts           # Manual scrape trigger
└── scraper-utils.ts            # Scraping implementation

shared/types/
└── event.ts                    # Shared EventData interface
```

## Important Implementation Details

### Event Data Model
```typescript
interface EventData {
  id: string;
  title: string;
  date: string;      // ISO format
  description: string;
  url: string;
  venue?: string;
  imageUrl?: string;
}
```

### Supported Venues
- Treibhaus Innsbruck
- PMK Innsbruck
- Artillery Productions (BigCartel)
- Music Hall Innsbruck
- Die Bäckerei

### Date Parsing
- Supports multiple German/English date formats
- Handles recurring events (e.g., "jeden Donnerstag")
- Special handling for cancelled events

### Performance Optimizations
- Request interception blocks unnecessary resources during scraping
- LocalStorage caching reduces API calls
- Serverless-optimized Puppeteer configuration
- Auto-scroll implementation for lazy-loaded content

## TypeScript Configuration

Note: The project uses TypeScript with `strict: false` but `noImplicitAny: true`. When writing code:
- Always provide explicit types for function parameters
- Use type inference for local variables where appropriate
- Leverage existing types from `shared/types/`

## Testing Strategy

- **Unit Tests**: Test individual components and utilities
- **E2E Tests**: Test full user flows including event viewing and searching
- Run tests before committing any changes

## Deployment

The app is deployed on Netlify with:
- Automatic builds on push
- Serverless functions for backend
- Environment variables for sensitive data (if needed)

Configuration in `netlify.toml` handles:
- Build commands
- Function directory
- External module bundling for Puppeteer

## Clean Code Principles (Robert C. Martin Guidelines)

### Core Principles
- **Self-Documenting Code**: Write code so clear that comments become unnecessary
- **Single Responsibility**: Each function/component should have one reason to change
- **DRY (Don't Repeat Yourself)**: Eliminate code duplication through abstraction
- **Small Functions**: Functions should be small and do one thing well
- **Meaningful Names**: Use intention-revealing names for variables, functions, and classes

### Function Guidelines
- **Function Size**: Keep functions under 20 lines when possthese ible
- **Function Arguments**: Prefer 0-3 arguments; use objects for multiple parameters
- **Pure Functions**: Avoid side effects; return predictable outputs for given inputs
- **Error Handling**: Use proper error boundaries; don't ignore caught exceptions

## Code Style Guidelines

### TypeScript Best Practices
- **Strict Typing**: Use strict typing with interfaces/types for all components
- **Discriminated Unions**: Use for type-safe state management (see `grantTypes.ts`)
- **Interface Naming**: Use descriptive names (`FormFieldProps`, not `IProps`)
- **Type Guards**: Implement type guards for runtime type checking
- **Generic Types**: Use generics for reusable components (`useMultiStepForm<T>`)

### Component Architecture
- **Functional Components**: Use functional components with hooks exclusively
- **Custom Hooks**: Extract complex logic into custom hooks (`useErrorHandler`, `useLoadingManager`)
- **Component Composition**: Prefer composition over inheritance
- **Props Interface**: Always define explicit props interfaces
- **Component Size**: Keep components under 200 lines; extract sub-components if larger

## Development Documentation Tracking

### Guidelines for Development Work
- Always update your tracking documents (if they exist)
- Always apply your clean code guidelines, found in CLAUDE.md