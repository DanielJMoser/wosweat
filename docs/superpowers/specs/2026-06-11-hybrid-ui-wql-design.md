# wosweat Hybrid UI + WQL Console — Design Spec

Date: 2026-06-11
Basis: approved mockup `.superpowers/brainstorm/2026-06-11-styling-directions/e-hybrid-v2.html` (Hybrid v2).

## Context & Goals

Evolve the existing Catppuccin/Syne identity with elements the user selected from the
Konzertplakat (A) and Programmheft (B) directions:

1. A-style **header band** with a pixel-font artifact, and a fixed **accent rail** on the left edge.
2. **Event-count badges** (pixel font) on the date-strip pills.
3. **Poster-scale date heading** with a marker-font "heute!" stamp on today.
4. A **list view** (poster rows) as a toggleable alternative to the existing card view.
5. A client-only, SQL-like **query console ("WQL")** at the bottom of the page: filter events and export `.ics` — with no remote-code-execution surface by construction.
6. A **telly band**: fixed bottom marquee showing `VENUE: EVENT TITLE` pairs for the selected day.

Hard requirements: looks excellent on mobile **and** desktop; WCAG 2.1 AA compliance is the default, not an afterthought.

## Non-Goals

- No backend changes. The `time`/`tags` extraction pipeline stays a separate project; UI elements depending on `event.time` degrade gracefully while the field is absent.
- The card view (EventGrid/EventCard) is not redesigned.
- The a11y drawer, month grid calendar, and venue list section keep their behavior (styling may be touched only where the new band/rail demand it).
- No new build tooling; fonts via the existing Google Fonts `<link>`.

## Design System Additions

- Fonts (added weights kept minimal): `Silkscreen 400` (pixel artifact), `Permanent Marker 400` (stamp, chip underline is CSS-only), `IBM Plex Mono 400;500` (console).
- New CSS variables in `variables.css`:
  - `--font-pixel: 'Silkscreen', monospace;`
  - `--font-marker: 'Permanent Marker', cursive;`
  - `--font-mono: 'IBM Plex Mono', monospace;`
  - `--telly-height: 32px;`
- Color tokens: reuse existing (`--ctp-*`, `--on-accent`). Console syntax colors map to `--ctp-lavender` (keywords), `--ctp-peach` (strings), `--ctp-green` (results), `--ctp-teal` (prompt). Console comments/chrome use `--ctp-subtext0` — **not** `--ctp-overlay0` (fails 4.5:1 on crust).

## Components

### 1. Header band (`Header.tsx`, restyle)
- Crust background band, bottom hairline `--ctp-surface0`, sticky.
- Left: wordmark (unchanged element, `role="heading" aria-level=1` stays).
- Right: pixel artifact `S.{dayOfYear} — INNSBRUCK` (decorative, `aria-hidden="true"`) and the existing venue-list icon button (unchanged a11y).

### 2. Accent rail (App-level)
- Fixed left vertical bar, `--ctp-teal`; 8px ≥700px, 4px below. `aria-hidden`, `pointer-events: none`.
- Content containers gain matching left padding only where overlap occurs (header/strip already have padding ≥ rail width).

### 3. Date strip (`DateStrip.tsx`, extend)
- New prop `countsByDate: Map<string, number>` (derived in App from `allEventsByDate`, see §9).
- Pill gains third line: pixel font `{n} EV` (no badge when 0). Today pill: teal fill, `--on-accent` text (replaces current today styling); selected ring unchanged.
- Pixel text ≥ `0.5625rem`; counts are presentational duplicates of information available elsewhere → the pill `aria-label` is extended to "…, 4 Events" instead of exposing the pixel text (pixel span `aria-hidden`).
- Badge color: `--ctp-teal` in dark theme; light theme overrides to `--ctp-text` (Latte teal on light `surface0` is 2.43:1; Latte subtext1 is 4.05:1 — both fail; `--ctp-text` is 5.17:1). Today-pill badge uses `--on-accent` (passes in both).
- Zero-event days render no badge; the pill `aria-label` ends "…, keine Events".
- Badges show **unfiltered** totals (deliberate: they describe the day, not the current filter); the heading meta line shows **filtered** counts matching the visible list. `useEvents` must expose unfiltered data for this — see §9.
- Existing aria (`aria-pressed`, `aria-current`, full-date label) preserved.

### 4. Poster heading (`DateHeading.tsx`, restyle + new props)
- Eyebrow weekday (uppercase, teal, letterspaced), `Syne 800` date at `clamp(2.75rem, 11vw, 8rem)`, day number in `--ctp-text`, month in `--ctp-teal`. Long month names (September, Dezember) may wrap; `line-height: 0.9` tolerates two lines. Verified down to 320px (1.4.10 reflow).
- Meta line (pixel font, subtext): `{n} EVENTS /// {m} VENUES` — **filtered** counts for the selected day (matches the visible list); hidden when 0 events (empty state keeps current "Keine Events gefunden").
- "heute!" stamp (marker font, teal bg, `--on-accent` text, rotated, pop-in animation) renders only when `selectedDate === today`. Decorative: `aria-hidden="true"`. Respects reduced motion.
- Keeps `role="heading" aria-level=2` on the block; meta line is outside the heading element.

### 5. View toggle + venue chips (new `ViewControls.tsx`)
- Row between heading and content: venue chips left, view toggle right; wraps on mobile.
- Chips: "Alle" + one per `VENUE_CONFIG` key, labelled with the **short config key** ("PMK", "Treibhaus", "Bäckerei", …, as in the mockup; displayNames are too long and 9 chips already wrap to 2–3 rows at 390px — acceptable). Marker-style underline (CSS blob, `--ctp-lavender`) on active. Buttons with `aria-pressed`; min target 24px. Multi-select semantics identical to current MonthGrid chips.
- "Alle" is active iff the filter is empty; clicking it clears the filter.
- **MonthGrid's chip row is removed** (single source of truth; MonthGrid keeps the calendar). `venueFilter`/`onVenueFilterChange` leave `MonthGridProps`; its container CSS shrinks accordingly.
- Toggle: two buttons `KARTEN` / `LISTE` (pixel font, uppercase), grouped in a bordered pill; active = teal fill + `--on-accent`. `aria-pressed` on each; group has `role="group" aria-label="Ansicht"`.
- Selected view persists in `localStorage` (`wosweat-view`); reads are try/catch-wrapped (Safari private mode) and any value ≠ `'list'` falls back to `'cards'`.
- Loading and empty states stay **outside** the view switch in App: skeleton grid while loading, "Keine Events gefunden" when empty — identical for both views; `EventList`/`EventGrid` render only when events exist.

### 6. List view (new `EventList.tsx`)
- Replaces EventGrid when view = list. Rows top-hairlined (`--ctp-surface0`).
- Desktop row grid: `[time | title | venue-stamp]`. `time` column renders only when the day has any `event.time`; otherwise the column collapses (CSS `grid-template-columns` switches) — no fake data.
- Title: `Syne 800`, uppercase, `clamp(1.5rem, 3.4vw, 2.5rem)`, hover/focus → teal + translateX (transition respects reduced motion). `role="heading" aria-level=3` on the title element.
- Venue stamp: bordered uppercase chip, alternating ±2° rotation (decorative rotation only).
- Row = interactive element following the EventCard pattern: `role="link"`, `tabIndex=0`, `aria-label` "{title} — {venue}", Enter opens `event.url` (new tab, noopener), visible focus outline (global `:focus-visible` applies).
- Featured row (first event of the day): teal inversion (`--on-accent` text/border), marker-font annotation "heißer tipp!" (`aria-hidden`). Hover/focus feedback on rows = translateX + underline (no color swap on the featured row — the mockup's crust-on-teal hover is 2.83:1 in Latte and cannot be token-copied).
- Mobile (<700px): two-line layout — meta line (time pixel + venue stamp inline) above the title; no rotation overflow (stamps rotate ≤2°, `overflow-x: hidden` on row container not needed if margins suffice).
- Entry stagger (CSS animation, same pattern as EventGrid's GSAP — CSS-only here; respects reduced motion).

### 7. WQL console (new `QueryConsole.tsx` + `src/lib/wql/`)

UI:
- Section at page bottom (above VenueList section), styled as terminal window: chrome bar (3 decorative dots `aria-hidden`, title "wosweat query console", status `● 100% lokal — kein server, kein eval` in green), mono body.
- Body: intro comment line, scrollable output log (`tabIndex={0}` so keyboard users can scroll it), prompt line `wql>` + `<input>` + visually-hidden submit (Enter executes). Only the per-query **summary line** sits in a `role="status" aria-live="polite"` element (announcing 50 result lines would flood screen readers); result lines render as plain text below it. Input labelled "WQL-Abfrage"; section `aria-label="Query-Konsole"`.
- Up/Down arrow = query history (session only, max 50).
- The console window uses **pinned Mocha tokens** that do not flip with the theme (`--console-bg: #11111b`, `--console-border: #313244`, text/syntax colors pinned likewise) — the terminal stays dark on the light theme by design, exactly like mockup B's terminal card on paper; this is also what keeps every syntax color ≥4.5:1 in both themes (flipped Latte values would fail at 2.2–3.7:1).
- Mobile: full-width, output font `0.75rem` with horizontal scroll for long lines; the `<input>` itself stays ≥`1rem` (16px) to avoid iOS focus-zoom.

Language (case-insensitive keywords; single-quoted strings, `''` escapes a quote):

```
query   := select | export
select  := SELECT '*' FROM EVENTS [where] [order] [limit] [';']
export  := EXPORT ICS [where] [';']
where   := WHERE or_expr
or_expr := and_expr (OR and_expr)*
and_expr:= atom (AND atom)*
atom    := '(' or_expr ')' | comparison
comparison := field ('=' | '!=' | '<' | '<=' | '>' | '>=') value
            | field IN '(' value (',' value)* ')'
            | field LIKE string            -- % and _ wildcards
field   := venue | date | title | time
value   := string | number | datefn
datefn  := TODAY '(' ')' (('+'|'-') number)?   -- days offset
order   := ORDER BY field (ASC | DESC)?
limit   := LIMIT number                        -- 1..200
```

Semantics:
- Evaluates against the **already-fetched, unfiltered** events array (read-only; see §9 for the hook change). String comparisons case-insensitive; `date` compares ISO strings; `today()` uses the client's local date (same derivation as the rest of the app).
- **Venue matching**: comparisons on `venue` normalize both sides (lowercase) and match by **substring containment**, consistent with the app's venue filter — `venue = 'PMK'` matches "PMK Innsbruck" (scraped venue strings are long; exact equality would silently return 0 results). All other fields use exact comparison.
- **Missing values / type rules**: a comparison on a field the event lacks (e.g. `time` today) evaluates to no-match, SQL-style. Numbers are only valid as `today()` offsets, `LIMIT`, and `IN`-list members for `date` offsets; comparing `title`/`venue` to a number is an eval error with a friendly message.
- `SELECT` prints up to 50 result lines `{time? } — {title} [{venue}]` + a summary line `→ {n} events ({ms} ms, lokal)`. More than 50: prints first 50 + `… {n-50} weitere`.
- `EXPORT ICS` builds an RFC 5545-conformant iCalendar file client-side: `VCALENDAR` with `VERSION:2.0` + `PRODID`; one `VEVENT` per match with **`UID` (the stable event id + `@wosweat`), `DTSTAMP` (now)**, `DTSTART;VALUE=DATE` from `date` (or datetime when `time` exists), `SUMMARY`, `LOCATION` = venue, `URL`. Text fields ICS-escaped (backslash, semicolon, comma, newline); **URLs sanitized** (strip CR/LF/control characters — scraped data is untrusted); **CRLF line endings and 75-octet line folding** (long German titles/URLs exceed one line). Download via `Blob` + temporary object URL (revoked after click). Filename `wosweat-{yyyymmdd}-{n}events.ics`. Caps at 500 events; **0 matches → message, no download**.
- `LIKE`: the pattern is **escaped for every regex metacharacter first**, then `%`→`.*`, `_`→`.` — user input can never alter regex semantics or produce an invalid pattern (adversarial test: `title LIKE '(((('` must match literally/return 0, not throw).
- Errors: `✗ {message} (Position {i})`, no stack traces; unknown fields/keywords listed with the allowed set.

Security model (the load-bearing part):
- Hand-written lexer + recursive-descent parser producing a closed AST; evaluator walks the AST with a `switch` over known node types. **No `eval`, no `new Function`, no dynamic property access from user input** (field names map through a fixed lookup table).
- Input caps: 300 chars, 80 tokens, paren depth 5, `LIMIT ≤ 200`, `IN` list ≤ 20 values. Query never leaves the browser; no network calls in the module (enforced by review + test).
- Output rendering uses React text nodes only (no `dangerouslySetInnerHTML`); ICS strings escaped per RFC 5545.
- `src/lib/wql/` is pure (no DOM imports except the download helper in `ics.ts`) → fully unit-testable.

### 8. Telly band (new `TellyBand.tsx`)
- Fixed bottom bar (height `--telly-height`), teal bg, `--on-accent` pixel text, above everything except the a11y drawer/FAB.
- Content: selected day's (filtered) events as `VENUE: TITLE` pairs, joined with `★`. Empty day → static `HEUTE NIX — SCHAU MORGEN`. Marquee loop via duplicated track (duplicate `aria-hidden="true"`).
- **WCAG 2.2.2**: pause/play button at the band's right edge (`aria-pressed`, label "Laufband pausieren"); `prefers-reduced-motion` → animation disabled entirely (static, single copy, ellipsis overflow).
- **Safe area**: the band gets `padding-bottom: env(safe-area-inset-bottom)`; the a11y FAB moves up to `bottom: calc(16px + var(--telly-height) + env(safe-area-inset-bottom))`; IonContent bottom padding becomes `calc(var(--telly-height) + env(safe-area-inset-bottom))` so content/footer isn't obscured.
- Screen readers: band region `aria-label="Events des ausgewählten Tages (Laufband)"`; readable copy is the non-duplicated list.

### 9. `useEvents` hook extension
- The hook additionally returns the **unfiltered** `allEvents: EventData[]` and `allEventsByDate: Map<string, EventData[]>` (the existing filtered `events`/`eventsByDate` keep their semantics). Consumers: DateStrip badges and the WQL evaluator use unfiltered data; heading meta, views, and telly use filtered data.

### 10. Light-theme notes (cross-cutting)
- Header pixel artifact: `--ctp-teal` in dark; light overrides to `--ctp-subtext0` (Latte teal on light crust is 2.83:1).
- Console: pinned dark tokens (§7). Telly/today-pill/featured-row: `--on-accent` on `--ctp-teal` passes in both themes (12.6:1 / 5.0:1).

## Responsive matrix (verified in tests)

| Viewport | Expectations |
|---|---|
| 390×844 | rail 4px; heading ≤ `3.5rem`-class; pills scroll horizontally; list rows 2-line; console readable, no horizontal page scroll; telly visible, FAB above it |
| 768×1024 | 2-col grid in card view (existing); list rows single-line where titles fit |
| 1280×900+ | mockup-equivalent layout, max-width 1080–1124px center column |

## Accessibility acceptance criteria (AA)

- All new interactive elements: real `<button>`/`<input>` or the established `role="link"` pattern; visible focus; ≥24px targets; German `aria-label`s; `aria-pressed`/`aria-current` state.
- Marquee pausable + reduced-motion-disabled; stamp/stagger animations reduced-motion-safe.
- Contrast (both themes): console text/comments ≥4.5:1 on pinned crust; pixel badges `--ctp-teal` (dark) / `--ctp-text` (light) on `--ctp-surface0` ≥4.5:1; featured-row and telly text `--on-accent` on teal ≥4.5:1. Light theme: band/rail/console keep crust/teal tokens (terminal stays dark by design — like the B mockup's terminal card on paper); telly teal stays (on-accent ink).
- No information conveyed by color alone (active chip = underline + `aria-pressed`; featured row = position + annotation).
- Decorative artifacts (`S.{n}`, stamp, dots, rotation, pixel duplicates) `aria-hidden`.

## Testing strategy

- **Unit (vitest)**: `wql` lexer/parser/evaluator/ics — happy paths, every error class, caps, case-insensitivity, `''` escaping, wildcard LIKE, date math, ICS escaping; adversarial inputs (`"); alert(1); --`, `__proto__`, `constructor`, 10k-char input, deep parens) prove rejection without throwing uncaught.
- **Component (vitest + RTL)**: ViewControls toggling + persistence; DateStrip badge rendering; TellyBand pause button state.
- **E2E (Cypress, Chromium)**: desktop + mobile viewports — view toggle switches and persists across reload; list rows keyboard-activatable; console SELECT shows results, bad query shows friendly error; telly pause stops animation; axe-style spot checks via aria assertions.
- **Cross-engine**: Firefox headless screenshots (desktop + mobile width) against the dev server — layout sanity (lesson from the featured-card regression).
- Build + lint green; existing tests stay green.

## Risks / open points

- `event.time` absent until the extraction pipeline lands → time column/meta degrade as specified (no blockers).
- Fonts add ~3 small families; `display=swap` already used. Acceptable; bundle untouched.
- The telly band occupies 32px of mobile viewport permanently — mitigated by pause button remaining and the band being part of the approved design.
