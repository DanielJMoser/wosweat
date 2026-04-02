# wosweat Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the wosweat single-page event aggregator UI with Catppuccin theming, image grid cards, date navigation, and accessibility panel.

**Architecture:** Single-page Ionic React app. No routing — `IonApp` renders all sections in one scrollable page. Data fetched from Netlify Functions API, grouped by date client-side. CSS Grid for event cards, GSAP for animations, custom accessibility drawer.

**Tech Stack:** Ionic React 8.5, React 19, TypeScript, Vite, GSAP + Lenis, Catppuccin CSS variables, Google Fonts (Syne + Bricolage Grotesque)

**Spec:** `docs/superpowers/specs/2026-03-27-frontend-ui-design.md`

---

## File Structure

```
frontend/src/
├── App.tsx                          # Shell: IonApp → IonContent, no routing
├── main.tsx                         # Entry point (unchanged)
├── theme/
│   └── variables.css                # Catppuccin Mocha/Latte tokens, fonts, globals
├── config/
│   └── venues.ts                    # Venue color map, gradient definitions, accent assignments
├── hooks/
│   └── useEvents.ts                 # Fetch events from API, group by date, manage state
├── components/
│   ├── Header.tsx                   # Wordmark + venue list icon
│   ├── Header.css                   # Header styles
│   ├── DateStrip.tsx                # Horizontal scrollable date pills
│   ├── DateStrip.css                # Date strip styles
│   ├── MonthGrid.tsx                # Expandable month calendar + venue filter chips
│   ├── MonthGrid.css                # Month grid styles
│   ├── DateHeading.tsx              # Bold typographic date heading
│   ├── DateHeading.css              # Date heading styles
│   ├── EventGrid.tsx                # CSS Grid container + featured card logic
│   ├── EventGrid.css                # Grid layout styles
│   ├── EventCard.tsx                # Individual event card with image/fallback
│   ├── EventCard.css                # Card styles, venue gradients, hover overlay
│   ├── QuickPeek.tsx                # Hover/long-press overlay with description + link
│   ├── VenueList.tsx                # Collapsible venue section
│   ├── VenueList.css                # Venue list styles
│   ├── AccessibilityFab.tsx         # FAB button + drawer panel
│   └── AccessibilityFab.css         # FAB + drawer styles
├── (delete) pages/Home.tsx
├── (delete) pages/Home.css
├── (delete) components/ExploreContainer.tsx
└── (delete) components/ExploreContainer.css

shared/types/
└── events.ts                        # Add time?: string, tags?: string[]

frontend/
├── index.html                       # Update title, add font preconnects
└── capacitor.config.ts              # Update appId and appName
```

---

## Task 0: Backend Data Model Extension

**Files:**
- Modify: `shared/types/events.ts`

- [ ] **Step 1: Extend EventData interface**

Add `time` and `tags` fields to the shared interface:

```typescript
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
}
```

- [ ] **Step 2: Verify backend still compiles**

Run: `npx tsc --noEmit -p backend/tsconfig.json`
Expected: No errors (new fields are optional, existing code unaffected)

- [ ] **Step 3: Commit**

```bash
git add shared/types/events.ts
git commit -m "feat(shared): add time and tags fields to EventData"
```

---

## Task 1: Install Dependencies & Project Setup

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/index.html`
- Modify: `frontend/capacitor.config.ts`

- [ ] **Step 1: Install GSAP and Lenis**

Run from project root:
```bash
npm install gsap lenis --workspace=frontend
```

- [ ] **Step 2: Update index.html**

Replace the `<head>` content with font preconnects, proper title, and meta:

```html
<meta charset="utf-8" />
<title>wosweat — Innsbruck Events</title>
<base href="/" />
<meta name="color-scheme" content="light dark" />
<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<meta name="description" content="Alle Events in Innsbruck auf einen Blick" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600&display=swap" rel="stylesheet">
<link rel="manifest" href="/manifest.json" />
<link rel="shortcut icon" type="image/png" href="/favicon.png" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="wosweat" />
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

- [ ] **Step 3: Update capacitor.config.ts**

Change `appId` to `at.wosweat.app` and `appName` to `wosweat`.

- [ ] **Step 4: Verify frontend compiles**

Run: `npx tsc --noEmit -p frontend/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json package-lock.json frontend/index.html frontend/capacitor.config.ts
git commit -m "feat(frontend): install gsap/lenis, update meta and capacitor config"
```

---

## Task 2: Design System — Theme & Global Styles

**Files:**
- Modify: `frontend/src/theme/variables.css`
- Create: `frontend/src/config/venues.ts`

- [ ] **Step 1: Write Catppuccin theme tokens in variables.css**

Full Mocha + Latte palettes as CSS custom properties on `:root` and `[data-theme="light"]`. Include font declarations, atmospheric body background with radial gradients, and accessibility CSS variables (`--a11y-font-scale`, `--a11y-font-family`).

Key tokens:
- `--ctp-base`, `--ctp-mantle`, `--ctp-crust` (backgrounds)
- `--ctp-surface0`, `--ctp-surface1`, `--ctp-surface2` (elevated surfaces)
- `--ctp-text`, `--ctp-subtext0`, `--ctp-subtext1` (text)
- `--ctp-teal`, `--ctp-lavender` (accents)
- `--font-display: 'Syne', sans-serif`
- `--font-body: 'Bricolage Grotesque', sans-serif`

Override Ionic's default CSS variables (`--ion-background-color`, `--ion-text-color`, etc.) to use Catppuccin tokens.

- [ ] **Step 2: Create venue config map**

`frontend/src/config/venues.ts` — exports `VENUE_CONFIG`: a `Record<string, VenueConfig>` mapping venue name substrings to their gradient, accent color (teal or lavender), and display name. Include the fallback entry. This is the single source of truth for venue visual identity.

```typescript
export interface VenueConfig {
  gradient: string;
  accent: 'teal' | 'lavender';
  displayName: string;
}

export const VENUE_CONFIG: Record<string, VenueConfig> = {
  'PMK': { gradient: 'linear-gradient(160deg, #2d3a4a, #1a2332, #0f1720)', accent: 'teal', displayName: 'PMK Innsbruck' },
  'Treibhaus': { gradient: 'linear-gradient(160deg, #3a2d2d, #2a1f22, #1a1215)', accent: 'lavender', displayName: 'Treibhaus Innsbruck' },
  // ... all 8 venues + fallback
};

export function getVenueConfig(venue?: string): VenueConfig { ... }
```

- [ ] **Step 3: Verify app loads with new theme**

Run: `npm run dev --workspace=frontend`
Expected: App loads with Catppuccin dark background and Syne/Bricolage Grotesque fonts visible.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/theme/variables.css frontend/src/config/venues.ts
git commit -m "feat(frontend): add Catppuccin design system and venue config"
```

---

## Task 3: App Shell — Strip Routing, Set Up Layout

**Files:**
- Modify: `frontend/src/App.tsx`
- Delete: `frontend/src/pages/Home.tsx`, `frontend/src/pages/Home.css`
- Delete: `frontend/src/components/ExploreContainer.tsx`, `frontend/src/components/ExploreContainer.css`

- [ ] **Step 1: Rewrite App.tsx**

Remove `IonReactRouter`, `IonRouterOutlet`, and all route imports. Replace with:

```tsx
import { IonApp, IonContent } from '@ionic/react';
import { setupIonicReact } from '@ionic/react';
// ... ionic CSS imports (keep existing)
import './theme/variables.css';

setupIonicReact({ mode: 'md' });

const App: React.FC = () => (
  <IonApp>
    <IonContent>
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '0 1rem' }}>
        <p>wosweat shell</p>
      </main>
    </IonContent>
  </IonApp>
);

export default App;
```

- [ ] **Step 2: Delete scaffold files and remove unused router dependencies**

```bash
rm frontend/src/pages/Home.tsx frontend/src/pages/Home.css
rm frontend/src/components/ExploreContainer.tsx frontend/src/components/ExploreContainer.css
npm uninstall react-router react-router-dom @ionic/react-router @types/react-router @types/react-router-dom --workspace=frontend
```

Also remove `@vitejs/plugin-legacy` and `terser` (modern audience, unnecessary):
```bash
npm uninstall @vitejs/plugin-legacy terser --workspace=frontend
```
Update `vite.config.ts` to remove the `legacy()` plugin import and usage.

- [ ] **Step 3: Update App.test.tsx**

Update the test to match the new shell (no router needed):

```tsx
import { render } from '@testing-library/react';
import App from './App';

test('renders app shell', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
```

- [ ] **Step 4: Verify app runs**

Run: `npm run dev --workspace=frontend`
Expected: "wosweat shell" visible on Catppuccin dark background.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/
git commit -m "feat(frontend): strip routing, set up single-page shell"
```

---

## Task 4: Data Layer — useEvents Hook

**Files:**
- Create: `frontend/src/hooks/useEvents.ts`

- [ ] **Step 1: Create useEvents hook**

Custom hook that:
- Fetches from `/.netlify/functions/get-events` (or relative `/api/get-events` via Vite proxy)
- Returns `{ events, eventsByDate, loading, error, selectedDate, setSelectedDate, refresh }`
- Groups events by `date` field into a `Map<string, EventData[]>`
- `selectedDate` defaults to today (ISO string)
- `refresh()` calls API with `?refresh=true`
- Accepts optional `venueFilter: string[]` to filter events client-side

- [ ] **Step 2: Add Vite proxy for Netlify functions**

In `frontend/vite.config.ts`, add proxy so dev requests to `/api/` forward to the Netlify functions dev server (default port 8888, or 9999 if `--filter` changes it — check which port `npm run dev:functions` reports):

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8888/.netlify/functions',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

- [ ] **Step 3: Wire into App.tsx temporarily**

Add `useEvents` to App.tsx and render event count to verify data flows:

```tsx
const { events, loading, error } = useEvents();
// render: loading ? "Loading..." : `${events.length} events`
```

- [ ] **Step 4: Verify data loads**

Start backend: `npm run dev:functions` (in separate terminal)
Start frontend: `npm run dev --workspace=frontend`
Expected: Event count visible in browser (2 from test-events, or more from live scraper)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useEvents.ts frontend/vite.config.ts frontend/src/App.tsx
git commit -m "feat(frontend): add useEvents hook with API fetch and date grouping"
```

---

## Task 5: Header Component

**Files:**
- Create: `frontend/src/components/Header.tsx`
- Create: `frontend/src/components/Header.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Build Header component**

Minimal top bar with "wosweat" wordmark (Syne 700) on left, venue-list icon on right. Sticky position. Catppuccin Mantle background.

- [ ] **Step 2: Add to App.tsx**

Replace placeholder with `<Header onVenueListClick={scrollToVenueSection} />`.

- [ ] **Step 3: Verify**

Run frontend. Expected: Sticky header with wordmark visible.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Header.tsx frontend/src/components/Header.css frontend/src/App.tsx
git commit -m "feat(frontend): add header with wordmark"
```

---

## Task 6: DateStrip Component

**Files:**
- Create: `frontend/src/components/DateStrip.tsx`
- Create: `frontend/src/components/DateStrip.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Build DateStrip**

Generates 15 date pills (today + 14 days forward, matching spec). Each pill shows German day abbreviation + day number. Today highlighted with Teal. Past dates dimmed. Horizontal scroll with `overflow-x: auto`, snap scrolling. Centers on today on mount via `scrollIntoView`. Small chevron at end to toggle month grid.

Props: `selectedDate`, `onDateSelect`, `onToggleMonthGrid`.

- [ ] **Step 2: Add to App.tsx**

Wire `selectedDate` state from `useEvents` to `DateStrip`.

- [ ] **Step 3: Verify**

Run frontend. Expected: Scrollable date strip with today highlighted. Tapping a different date updates the selected state.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/DateStrip.tsx frontend/src/components/DateStrip.css frontend/src/App.tsx
git commit -m "feat(frontend): add horizontal date strip with selection"
```

---

## Task 7: DateHeading Component

**Files:**
- Create: `frontend/src/components/DateHeading.tsx`
- Create: `frontend/src/components/DateHeading.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Build DateHeading**

Renders the bold typographic date heading. Small uppercase weekday label in Teal + large date in Syne 800 with month name in Teal. Uses `clamp(2.4rem, 6vw, 4rem)` for responsive sizing. German weekday/month names derived from `selectedDate`.

- [ ] **Step 2: Add to App.tsx below DateStrip**

- [ ] **Step 3: Verify and commit**

```bash
git add frontend/src/components/DateHeading.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add bold date heading"
```

---

## Task 8: EventCard Component

**Files:**
- Create: `frontend/src/components/EventCard.tsx`
- Create: `frontend/src/components/EventCard.css`

- [ ] **Step 1: Build EventCard**

Props: `event: EventData`, `featured?: boolean`.

Card anatomy:
- Card container with `border-radius: 10px`, `overflow: hidden`, hover scale transform
- Regular cards: `aspect-ratio: 3/4`. Featured card: `aspect-ratio: 16/7` on mobile, auto-height spanning 2×2 on desktop.
- Image area: if `imageUrl` present, `<img>` with `object-fit: cover`. If absent, show venue gradient (from `getVenueConfig`) + typographic initial
- Gradient overlay div (transparent → Crust)
- Teal-tinted hover overlay (Leo Kino-style, opacity transition)
- Content at bottom: venue label (uppercase, letter-spaced), title (Syne 700), time badge + tags
- Featured variant: larger title, different aspect ratio
- `onClick` → `window.open(event.url, '_blank')`

- [ ] **Step 2: Verify card renders with mock data**

Temporarily render a single `<EventCard event={mockEvent} />` in App.tsx.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/EventCard.tsx frontend/src/components/EventCard.css
git commit -m "feat(frontend): add EventCard with venue gradients and image fallback"
```

---

## Task 9: EventGrid Component

**Files:**
- Create: `frontend/src/components/EventGrid.tsx`
- Create: `frontend/src/components/EventGrid.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Build EventGrid**

Props: `events: EventData[]`.

- Determines featured event (first with `imageUrl`, or first in array)
- CSS Grid: 2 columns mobile, 3 columns ≥700px
- Featured card spans grid-column 1/3 + grid-row 1/3 on desktop, full-width on mobile
- Renders `<EventCard>` for each event
- Empty state: "Keine Events gefunden" centered message
- Stagger animation: CSS `@keyframes cardIn` with incremental `animation-delay`

- [ ] **Step 2: Wire into App.tsx**

Replace temporary card rendering with `<EventGrid events={eventsForSelectedDate} />`.

- [ ] **Step 3: Add skeleton loading state**

When `loading` is true, render 6 pulsing placeholder cards (Surface0 rectangles matching card aspect ratio).

- [ ] **Step 4: Verify grid renders with live data**

Run both backend and frontend. Expected: Event cards in grid layout, featured card prominent, stagger animation on load.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/EventGrid.tsx frontend/src/components/EventGrid.css frontend/src/App.tsx
git commit -m "feat(frontend): add event grid with featured card and skeleton loading"
```

---

## Task 10: QuickPeek Overlay

**Files:**
- Create: `frontend/src/components/QuickPeek.tsx`
- Modify: `frontend/src/components/EventCard.tsx`
- Modify: `frontend/src/components/EventCard.css`

- [ ] **Step 1: Build QuickPeek component**

Overlay that slides up from bottom of card. Shows description (3 lines, truncated), venue name, "Zur Website →" link button. Semi-transparent Crust background with `backdrop-filter: blur(8px)`.

- [ ] **Step 2: Integrate into EventCard**

- Desktop: show on `mouseenter`, hide on `mouseleave`
- Mobile: show on long-press (500ms `setTimeout` on `touchstart`, clear on `touchend`/`touchmove`)
- Prevent `onClick` (external link) from firing when QuickPeek is shown via long-press
- Dismissal: tap outside the card (document-level click listener), or Ionic hardware back button handler (`document.addEventListener('ionBackButton', ...)`) — both close the overlay

- [ ] **Step 3: Verify on desktop and mobile viewport**

Test hover in desktop browser. Test long-press via Chrome DevTools mobile emulation.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/QuickPeek.tsx frontend/src/components/EventCard.tsx frontend/src/components/EventCard.css
git commit -m "feat(frontend): add quick-peek overlay with hover and long-press"
```

---

## Task 11: MonthGrid Component

**Files:**
- Create: `frontend/src/components/MonthGrid.tsx`
- Create: `frontend/src/components/MonthGrid.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Build MonthGrid**

7-column calendar grid. Props: `selectedDate`, `onDateSelect`, `isOpen`, `venueFilter`, `onVenueFilterChange`.

- Month name + ←/→ arrows to navigate months
- Today highlighted with Teal filled circle
- Selected date (if different from today) highlighted with Teal outline circle
- Venue filter chips row at bottom: one pill per venue from `VENUE_CONFIG`, tap to toggle

- [ ] **Step 2: Add GSAP expand/collapse animation + mobile swipe gesture**

In App.tsx, manage `monthGridOpen` state. Triggered by:
- Desktop: chevron click in DateStrip OR click on month name
- Mobile: swipe-down gesture on the DateStrip area. Detect via `touchstart`/`touchmove`/`touchend` with a vertical threshold (>50px downward). Add rubber-band overscroll feel via GSAP elastic easing.

Animation:
- GSAP `gsap.to()` animates height from 0 to auto (use `gsap.from` with `height: 0, overflow: hidden`)
- Date strip stays in place, month grid pushes content down
- Reverse animation on close (swipe up on mobile, chevron/click on desktop)

- [ ] **Step 3: Wire venue filter to useEvents**

Pass `venueFilter` state to `useEvents` hook to filter events client-side.

- [ ] **Step 4: Verify expand/collapse and filtering**

Click chevron → month grid slides down. Select venues → event grid updates. Click chevron again → slides up.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MonthGrid.tsx frontend/src/components/MonthGrid.css frontend/src/App.tsx
git commit -m "feat(frontend): add month grid with venue filters and GSAP animation"
```

---

## Task 12: VenueList Section

**Files:**
- Create: `frontend/src/components/VenueList.tsx`
- Create: `frontend/src/components/VenueList.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Build VenueList**

Collapsible section at bottom of page. Lists all 8 venues with display name + external link. Compact cards with venue gradient as accent. Toggled by header venue icon via `scrollIntoView` + expand.

- [ ] **Step 2: Connect to Header's venue icon click**

- [ ] **Step 3: Verify and commit**

```bash
git add frontend/src/components/VenueList.tsx frontend/src/components/VenueList.css frontend/src/App.tsx
git commit -m "feat(frontend): add venue list section"
```

---

## Task 13: Accessibility FAB + Drawer

**Files:**
- Create: `frontend/src/components/AccessibilityFab.tsx`
- Create: `frontend/src/components/AccessibilityFab.css`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/theme/variables.css`

- [ ] **Step 1: Build FAB button**

Fixed bottom-right position with `env(safe-area-inset-bottom)`. Teal circle, accessibility icon (inline SVG). 48px mobile, 56px desktop. z-index 10000. Toggles drawer open/closed.

- [ ] **Step 2: Build drawer panel**

Slides in from right (360px desktop, 100% mobile). Contains:
- Font size scaling (3 buttons: S/M/L) → sets `--a11y-font-scale` on `<html>`
- High contrast toggle → adds `[data-high-contrast]` attribute to `<html>`
- Dyslexia font toggle → loads OpenDyslexic via `FontFace` API, sets `--a11y-font-family`
- Reading line toggle → activates cursor-following horizontal bar
- Dark/light mode toggle → sets `data-theme` attribute on `<html>`
- Close button at top

- [ ] **Step 3: Persist settings in localStorage**

Load from `localStorage.getItem('wosweat-a11y')` on mount, save on every change.

- [ ] **Step 4: Add high-contrast CSS rules to variables.css**

```css
[data-high-contrast] {
  --ctp-text: #ffffff;
  --ctp-base: #000000;
  --ctp-mantle: #000000;
  /* ... forced high contrast overrides */
}
```

- [ ] **Step 5: Verify all toggles work and persist across reload**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/AccessibilityFab.tsx frontend/src/components/AccessibilityFab.css frontend/src/theme/variables.css frontend/src/App.tsx
git commit -m "feat(frontend): add accessibility FAB with settings drawer"
```

---

## Task 14: Animations — GSAP Stagger & Lenis Scroll

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/EventGrid.tsx`

- [ ] **Step 1: Initialize Lenis smooth scroll**

In App.tsx, set up Lenis in a `useEffect`:

```typescript
useEffect(() => {
  const lenis = new Lenis();
  function raf(time: number) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
  return () => lenis.destroy();
}, []);
```

- [ ] **Step 2: Add GSAP ScrollTrigger for card reveals**

In EventGrid, register ScrollTrigger and animate cards as they enter viewport:

```typescript
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

// In useEffect:
gsap.from('.event-card', {
  scrollTrigger: { trigger: '.event-grid', start: 'top 80%' },
  y: 20, opacity: 0, stagger: 0.05, duration: 0.5,
  ease: 'power2.out'
});
```

- [ ] **Step 3: Verify smooth scroll and card animations**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/EventGrid.tsx
git commit -m "feat(frontend): add Lenis smooth scroll and GSAP card animations"
```

---

## Task 15: Pull-to-Refresh & Error Handling

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add IonRefresher with Teal progress bar**

Add `<IonRefresher>` inside `IonContent` that calls `refresh()` from `useEvents`. During refresh, keep existing events visible (don't clear state before re-fetch). Add a thin Teal progress bar (`height: 2px`, animated `width` from 0 to 100%) at the top of the page while loading, instead of replacing content with a spinner.

- [ ] **Step 2: Add error banner with retry**

When `error` is truthy, show a dismissible banner at top with a retry button: "Fehler beim Laden" + tappable "Erneut versuchen" button that calls `refresh()`. Style: Surface0 background, Red accent border-left, Teal retry button.

- [ ] **Step 3: Verify pull-to-refresh works**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): add pull-to-refresh and error handling"
```

---

## Task 16: Final Cleanup & Polish

**Files:**
- Modify: `frontend/src/App.tsx`
- Delete: `frontend/src/App.test.tsx` (or update)
- Delete: `frontend/src/setupTests.ts` (if unused)

- [ ] **Step 1: Remove any remaining scaffold code**

Delete `pages/` directory if not already gone. Remove unused test setup files. Clean up any temporary debug rendering in App.tsx.

- [ ] **Step 2: Update App.test.tsx**

Ensure the app renders without crashing.

- [ ] **Step 3: Verify full flow end-to-end**

1. Start backend: `npm run dev:functions`
2. Start frontend: `npm run dev --workspace=frontend`
3. Verify: date strip → date heading → event grid → cards with images/fallbacks → quick-peek on hover → month grid expands → venue filters work → accessibility FAB → light/dark toggle → pull-to-refresh
4. Test at 375px, 768px, 1280px widths

- [ ] **Step 4: Final commit**

```bash
git add -A frontend/
git commit -m "feat(frontend): final cleanup and polish"
```
