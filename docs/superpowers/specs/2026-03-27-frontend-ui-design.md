# wosweat Frontend UI Design Spec

## Context

wosweat aggregates events from 8 Innsbruck venues (Treibhaus, PMK, Artillery, Music Hall, Die Bäckerei, BRUX, Kellertheater, LiveStage) into a single view. The backend scraper is complete and deployed on Netlify. The frontend needs a full redesign — the old UI is being discarded.

**Problem**: Locals check 8-10 venue websites every weekend to find what's happening. Events get missed.

**Solution**: A single-page event aggregator that answers "was geht heute?" at a glance, with the ability to plan ahead.

## Target Audience

Innsbruck locals who go out regularly. Primary use: quick Friday evening check of tonight's events. Secondary use: planning ahead for the coming week/month.

## Tech Stack

- Ionic React (existing scaffold in `frontend/`)
- React 19, TypeScript, Vite
- Capacitor for native mobile builds
- GSAP (scroll/reveal animations) + Lenis (smooth scrolling)
- Catppuccin color tokens via CSS variables

## Design System

### Color Palette

**Dark mode — Catppuccin Mocha:**
- Base: `#1e1e2e`, Mantle: `#181825`, Crust: `#11111b`
- Surface0: `#313244`, Surface1: `#45475a`, Surface2: `#585b70`
- Text: `#cdd6f4`, Subtext: `#a6adc8`
- Primary accent: Teal `#94e2d5`
- Secondary accent: Lavender `#b4befe`

**Light mode — Catppuccin Latte:**
- Base: `#eff1f5`, Mantle: `#e6e9ef`, Crust: `#dce0e8`
- Text: `#4c4f69`, Subtext: `#6c6f85`
- Primary accent: Teal `#179299`
- Secondary accent: Lavender `#7287fd`

### Typography

- **Display / Headlines**: Syne (weight 700-800) — geometric, bold, cultural energy
- **Body / UI**: Bricolage Grotesque (weight 400-600) — warm, distinctive, anti-generic
- Loaded via Google Fonts with `font-display: swap`

### Design Principles

- Bold & Expressive: dark base, high-contrast accents, large headlines
- Inspired by Nonstop Kino (editorial boldness) and Leo Kino (poster card layouts)
- No AI-slop patterns: no Inter/Roboto, no purple gradients on white, no cookie-cutter layouts
- Atmospheric backgrounds with subtle radial gradient glows, not flat solid colors
- Venue-specific gradient colors provide visual distinction even without event photos

## Page Structure

Single-page application. No tab bar, no sidebar. The event grid IS the app. The existing Ionic scaffold uses `IonReactRouter` — this will be stripped out and replaced with direct `IonApp` → `IonContent` rendering (no routes needed for a single-page layout).

```
┌──────────────────────────────────┐
│  Header (logo + venue list icon) │
├──────────────────────────────────┤
│  Date Strip (scrollable)         │
│  [chevron to expand month grid]  │
├──────────────────────────────────┤
│  (Pull-down month grid — hidden  │
│   by default, contains venue     │
│   filter chips)                  │
├──────────────────────────────────┤
│  Date Heading                    │
│  "Donnerstag"                    │
│  "27. März"                      │
├──────────────────────────────────┤
│  Event Grid                      │
│  ┌──────────┬──────┐             │
│  │ Featured │ Card │             │
│  │  (2col)  │      │             │
│  │          ├──────┤             │
│  │          │ Card │             │
│  ├──────┬───┴──────┤             │
│  │ Card │   Card   │             │
│  └──────┴──────────┘             │
├──────────────────────────────────┤
│  Venue List (collapsible section)│
└──────────────────────────────────┘
    ◉  Accessibility FAB (fixed)
```

## Components

### 1. Header

Minimal top bar:
- Left: "wosweat" wordmark in Syne 700
- Right: Venue list icon (building/map icon) — scrolls to venue section or reveals it

### 2. Date Strip

Horizontal scrollable row of date pills:
- Each pill shows day abbreviation (Mo, Di, Mi...) + day number
- Today highlighted with Teal background, dark text
- Past dates dimmed
- Scrollable left/right, centered on today by default

**Expand/collapse to month grid:**
- Mobile: swipe down gesture with rubber-band momentum
- Desktop: small chevron button OR click on month name in the strip
- Animation: GSAP slide-down, date strip stays fixed, grid pushes event list down

### 3. Month Grid (Pull-Down Panel)

Traditional 7-column calendar grid:
- Current day highlighted in Teal
- Month name + left/right arrows to navigate months
- **Venue filter chips** live here: scrollable row of venue pills (Treibhaus, PMK, etc.), tap to toggle active/inactive
- Collapses back with reverse animation

### 4. Date Heading

Bold typographic heading for the selected date:
- Small label: weekday name in uppercase, Teal, letter-spaced (e.g., "DONNERSTAG")
- Large heading: "27. März" in Syne 800, `clamp(2.4rem, 6vw, 4rem)`
- Month name in Teal accent color

### 5. Event Cards (Image Grid)

CSS Grid with uniform columns (not true masonry — browser support insufficient). The featured card spanning 2×2 creates visual asymmetry that gives the impression of a staggered layout without JS layout calculation:
- Mobile: 2 columns
- Desktop (700px+): 3 columns
- Gap: 14-16px
- All regular cards use 3:4 aspect ratio for consistency. Only the featured card differs (16:7 mobile, auto-height spanning 2×2 desktop).

**Card anatomy:**
- Poster image area (aspect-ratio 3:4 default, 2:3 for tall variant)
- Gradient overlay for text readability (transparent top → dark bottom)
- Teal-tinted hover overlay (Leo Kino-inspired)
- Content at bottom: venue label, event title (Syne 700), time badge + genre tags

**Featured card:**
- Selection logic: the event with an `imageUrl` that is earliest in the day gets featured. If no events have images, the first event in the array is featured. No editorial mechanism — purely algorithmic.
- Spans 2 columns on desktop (grid-column: 1/3, grid-row: 1/3)
- Full-width (16:7 aspect ratio) on mobile
- Larger title size (1.5-1.8rem)

**Venue color coding (gradient stops for card backgrounds when no image):**

| Venue | Gradient |
|---|---|
| PMK | `linear-gradient(160deg, #2d3a4a, #1a2332, #0f1720)` |
| Treibhaus | `linear-gradient(160deg, #3a2d2d, #2a1f22, #1a1215)` |
| Die Bäckerei | `linear-gradient(160deg, #2d3a2e, #1f2a20, #121a13)` |
| Music Hall | `linear-gradient(160deg, #35294a, #251c38, #160f24)` |
| BRUX | `linear-gradient(160deg, #3a3a2d, #2a2a1f, #1a1a12)` |
| Artillery | `linear-gradient(160deg, #2d3540, #1c252e, #0e151c)` |
| Kellertheater | `linear-gradient(160deg, #2d2d3a, #1f1f2a, #12121a)` |
| LiveStage | `linear-gradient(160deg, #3a2d35, #2a1f25, #1a1218)` |
| Fallback | `linear-gradient(160deg, #313244, #45475a, #313244)` |

Venue labels and time badges alternate between Teal and Lavender based on venue (defined in a config map, not arbitrary).

**No-image fallback:**
- When `imageUrl` is absent, the card shows a large typographic initial (first letter of event name) in very low opacity over the venue gradient
- Turns the limitation into a design element

**Stagger animation:**
- Cards animate in on load with `translateY(20px) → 0` and `opacity: 0 → 1`
- Sequential `animation-delay` per card (0.05s increments)
- `cubic-bezier(0.2, 0, 0, 1)` easing

### 6. Quick-Peek Interaction

Reveals event details without leaving the page:
- **Desktop**: Hover over a card reveals a content overlay with description snippet + "Zur Website →" button
- **Mobile**: Long-press on a card reveals the same overlay (not swipe — swipe conflicts with page scroll)
- **Tap/click** on the card navigates to the external venue URL (`event.url`)
- Overlay slides up from bottom of card with CSS transition, semi-transparent Crust background with backdrop-filter blur
- Shows: description text (2-3 lines, truncated), venue name, external link button
- Dismissed by tapping outside the card or pressing back

### 7. Venue List Section

Collapsible section at the bottom of the page:
- Accessible via header icon (scrolls to section)
- Lists all 8 venues with name + external link to their website
- Compact, informational — not a primary interaction surface

### 8. Accessibility FAB + Drawer

Fixed-position floating action button (bottom-right):
- 48px circle on mobile, 56px on desktop
- Teal background, accessibility icon (universal accessibility symbol)
- z-index: 10000 to sit above all content
- Positioned with `env(safe-area-inset-bottom)` padding on iOS (home indicator) and Android gesture navigation zones

**Drawer (slides in from right, 360px wide on desktop, full-width on mobile):**
- Font size scaling (3 levels): applies `font-size` multiplier via CSS variable `--a11y-font-scale` on `<html>`
- High contrast toggle: increases text/background contrast ratio by forcing Text color to pure white (`#ffffff`) and backgrounds to pure black (`#000000`), with increased border widths (2px)
- Dyslexia-friendly font toggle: loads OpenDyslexic via `FontFace` API on demand, applies via CSS variable `--a11y-font-family`
- Reading line: semi-transparent horizontal bar (40px height, Teal at 10% opacity) that follows cursor (desktop) or touch position (mobile), helping users track lines of text
- Dark/light mode toggle: switches between Catppuccin Mocha and Latte palettes
- All settings persisted in localStorage under key `wosweat-a11y`

## Backend Data Model Changes Required

Before frontend implementation, the shared `EventData` interface must be extended:

```typescript
interface EventData {
  id: string;
  title: string;
  date: string;       // ISO format (YYYY-MM-DD)
  time?: string;      // NEW: "21:00" format, extracted from venue pages
  description: string;
  url: string;
  venue?: string;     // Fallback: "Unbekannt" if missing
  imageUrl?: string;
  tags?: string[];    // NEW: genre/category tags where available
}
```

Changes:
- Add `time?: string` — extractors already scrape time data (Die Bäckerei has `.event-thumb__time`), but it's discarded. Route it through to `EventData`.
- Add `tags?: string[]` — Die Bäckerei extracts tags into description text. Parse them into a proper field. Other venues: derive from description keywords or leave empty.
- Both fields are optional — the UI degrades gracefully when absent (no time badge shown, no tags shown).

## Data Flow

1. App loads → fetch `/.netlify/functions/get-events`
2. Response: `{ success, events: EventData[], count, fromCache, timestamp }`
3. Events grouped by date client-side
4. Date strip shows a continuous range: today through 14 days forward. Days with no events are shown but visually dimmed.
5. Selected date (default: today) filters visible events
6. Backend `Cache-Control: max-age=300` handles HTTP caching. No additional localStorage cache layer — rely on browser HTTP cache. For offline support (Capacitor), a service worker cache strategy will be added later.
7. Pull-to-refresh (`IonRefresher`) or manual refresh icon in header triggers `?refresh=true`. During refresh, existing events remain visible with a subtle loading indicator (Teal progress bar at top of page).

### Empty & Error States

- **No events for selected date**: Show the date heading + a centered message: "Keine Events gefunden" in Subtext color with a subtle illustration or the wosweat wordmark.
- **API error / offline**: Show last cached data (if available via service worker) with a banner: "Offline — zeigt zuletzt geladene Events". If no cache, show error state with retry button.
- **Loading**: Skeleton cards (pulsing Surface0 rectangles) matching the grid layout, animated with CSS.

## Responsive Breakpoints

- **< 700px** (mobile): 2-column grid, featured card full-width, date strip compact
- **≥ 700px** (tablet/desktop): 3-column grid, featured card spans 2×2, larger typography

## Animation Stack

- **GSAP**: Month grid expand/collapse, scroll-triggered card reveals
- **Lenis**: Smooth scroll behavior across the page
- **CSS transitions**: Card hover effects, overlay reveals, FAB interactions
- **CSS @keyframes**: Initial card stagger animation on page load

## Performance Budget

- JavaScript bundle: < 250KB gzipped (React ~40KB, ReactDOM ~40KB, Ionic ~40KB, GSAP+ScrollTrigger ~30KB, Lenis ~8KB, app code ~50KB, headroom ~42KB)
- Initial load: < 3s on 4G
- 60fps scrolling on mid-range devices
- Fonts: 2 families, 4 weights total, `font-display: swap`
- OpenDyslexic (~1MB): loaded on-demand via `FontFace` API only when toggled in accessibility drawer. During load, show existing font with a brief loading indicator on the toggle button.

## Verification

1. `npm run dev` from root starts Netlify dev server (backend functions). Frontend runs separately via `npm run dev --workspace=frontend` or both together once the root dev script is updated.
2. Event grid loads with data from `/.netlify/functions/test-events` (or live scraper)
3. Date strip scrolls, today is highlighted and selected by default
4. Tapping a date changes the visible events
5. Month grid expands/collapses via chevron (desktop) or swipe (mobile)
6. Venue filters in month panel toggle event visibility
7. Hover (desktop) / swipe (mobile) on card reveals quick-peek overlay
8. Tap on card opens external URL
9. Accessibility FAB opens drawer, settings persist across sessions
10. Light mode (Catppuccin Latte) toggleable via accessibility drawer
11. Responsive: test at 375px, 768px, 1280px widths
