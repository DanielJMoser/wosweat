# Hybrid UI + WQL Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Hybrid-v2 design (header band + rail, pixel date badges, poster heading, list view toggle, telly band, client-only WQL console) per `docs/superpowers/specs/2026-06-11-hybrid-ui-wql-design.md`, WCAG AA and mobile-first.

**Architecture:** Pure-TS WQL library (`frontend/src/lib/wql/`) developed TDD-first, consumed by a `QueryConsole` component. UI work restyles `Header`/`DateStrip`/`DateHeading`, adds `ViewControls`/`EventList`/`TellyBand`, lifts loading/empty states into `App`, and extends `useEvents` with unfiltered data. **Styling source of truth:** `.superpowers/brainstorm/2026-06-11-styling-directions/e-hybrid-v2.html` — copy exact values from there unless the spec overrides them (contrast/light-theme/safe-area rules in spec win).

**Tech Stack:** React 19, TypeScript strict, Vitest + RTL, Cypress, CSS (no new deps).

**Conventions that apply to every task** (from CLAUDE.md/audit): German aria-labels; `aria-pressed`/`aria-current` on toggles; rem font sizes; `prefers-reduced-motion` for every animation; interactive rows follow the EventCard pattern (`role="link"`, `tabIndex=0`, Enter); decorative elements `aria-hidden`; defensive `?.` on event fields; verify per task with `npm run build && npm test` from repo root; never run the backend.

---

### Task 1: Fonts and design tokens

**Files:**
- Modify: `frontend/index.html` (font link)
- Modify: `frontend/src/theme/variables.css`

- [ ] **Step 1:** In `frontend/index.html`, replace the Google Fonts stylesheet href with:
```
https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600&family=Silkscreen&family=Permanent+Marker&family=IBM+Plex+Mono:wght@400;500&display=swap
```
- [ ] **Step 1b:** In `variables.css`, extend the global reduced-motion rule with `animation-delay: 0.01ms !important;` (delayed `both`-fill animations like the stamp are otherwise invisible during their delay under reduced motion).
- [ ] **Step 2:** In `variables.css` `:root`, after the existing font vars add:
```css
  --font-pixel: 'Silkscreen', monospace;
  --font-marker: 'Permanent Marker', cursive;
  --font-mono: 'IBM Plex Mono', monospace;
  --telly-height: 32px;
  /* Console: pinned Mocha — terminal stays dark in both themes (spec §7/§10) */
  --console-bg: #11111b;
  --console-border: #313244;
  --console-text: #cdd6f4;
  --console-dim: #a6adc8;
  --console-prompt: #94e2d5;
  --console-keyword: #b4befe;
  --console-string: #fab387;
  --console-ok: #a6e3a1;
```
- [ ] **Step 3:** Run `npm run build` (expect ✓) and `npm test` (expect 1 passed).
- [ ] **Step 4:** Commit: `feat(ui): add pixel/marker/mono fonts and hybrid design tokens`

### Task 2: WQL lexer (TDD)

**Files:**
- Create: `frontend/src/lib/wql/lexer.ts`
- Create: `frontend/src/lib/wql/lexer.test.ts`

- [ ] **Step 1: Failing tests** — `lexer.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { lex, WqlError } from './lexer';

describe('lex', () => {
  test('tokenizes a select query', () => {
    const t = lex("SELECT * FROM events WHERE venue = 'PMK'");
    expect(t.map(x => x.type)).toEqual([
      'keyword', 'star', 'keyword', 'keyword', 'keyword', 'keyword', 'op', 'string',
    ]);
    expect(t[7].value).toBe('PMK');
  });
  test('keywords are case-insensitive, value lowercased', () => {
    expect(lex('SeLeCt')[0]).toMatchObject({ type: 'keyword', value: 'select' });
  });
  test("'' escapes a quote inside strings", () => {
    expect(lex("'O''Brien'")[0].value).toBe("O'Brien");
  });
  test('two-char operators win over one-char', () => {
    expect(lex('<= >= !=').map(t => t.value)).toEqual(['<=', '>=', '!=']);
  });
  test('unterminated string throws WqlError with position', () => {
    expect(() => lex("'abc")).toThrowError(WqlError);
  });
  test('input cap 300 chars', () => {
    expect(() => lex('a'.repeat(301))).toThrowError(/zu lang/i);
  });
  test('token cap 80', () => {
    expect(() => lex('( '.repeat(81))).toThrowError(/Tokens/);
  });
  test('unknown character rejected', () => {
    expect(() => lex('venue = `x`')).toThrowError(WqlError);
  });
  test('classic injection strings are rejected or inert (spec adversarial cases)', () => {
    expect(() => lex('"); alert(1); --')).toThrowError(WqlError); // '"' unknown char
    expect(() => lex('a'.repeat(10_000))).toThrowError(/zu lang/i); // 10k input
  });
});
```
- [ ] **Step 2:** Run `cd frontend && npx vitest run src/lib/wql` — expect FAIL (module not found).
- [ ] **Step 3: Implementation** — `lexer.ts`:
```ts
export type TokenType =
  | 'keyword' | 'ident' | 'string' | 'number'
  | 'op' | 'lparen' | 'rparen' | 'comma' | 'star' | 'semicolon';

export interface Token { type: TokenType; value: string; pos: number; }

export class WqlError extends Error {
  constructor(message: string, readonly pos: number) { super(message); this.name = 'WqlError'; }
}

const KEYWORDS = new Set([
  'select', 'from', 'events', 'where', 'and', 'or', 'in', 'like',
  'order', 'by', 'asc', 'desc', 'limit', 'export', 'ics', 'today',
  'venue', 'date', 'title', 'time',
]);
const OPS = ['<=', '>=', '!=', '=', '<', '>', '+', '-'];
const MAX_INPUT = 300;
const MAX_TOKENS = 80;
const SINGLE: Record<string, TokenType> = {
  '(': 'lparen', ')': 'rparen', ',': 'comma', '*': 'star', ';': 'semicolon',
};

export function lex(input: string): Token[] {
  if (input.length > MAX_INPUT) {
    throw new WqlError(`Abfrage zu lang (max. ${MAX_INPUT} Zeichen)`, 0);
  }
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (tokens.length >= MAX_TOKENS) throw new WqlError('Zu viele Tokens', i);
    if (SINGLE[c]) { tokens.push({ type: SINGLE[c], value: c, pos: i }); i++; continue; }
    if (c === "'") {
      let j = i + 1;
      let out = '';
      while (j < input.length) {
        if (input[j] === "'" && input[j + 1] === "'") { out += "'"; j += 2; continue; }
        if (input[j] === "'") break;
        out += input[j]; j++;
      }
      if (j >= input.length) throw new WqlError('String nicht geschlossen', i);
      tokens.push({ type: 'string', value: out, pos: i });
      i = j + 1; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < input.length && /[0-9]/.test(input[j])) j++;
      tokens.push({ type: 'number', value: input.slice(i, j), pos: i });
      i = j; continue;
    }
    const op = OPS.find(o => input.startsWith(o, i));
    if (op) { tokens.push({ type: 'op', value: op, pos: i }); i += op.length; continue; }
    if (/[a-zA-Z_äöüÄÖÜß]/.test(c)) {
      let j = i;
      while (j < input.length && /[a-zA-Z_äöüÄÖÜß]/.test(input[j])) j++;
      const word = input.slice(i, j).toLowerCase();
      tokens.push({ type: KEYWORDS.has(word) ? 'keyword' : 'ident', value: word, pos: i });
      i = j; continue;
    }
    throw new WqlError(`Unbekanntes Zeichen '${c}'`, i);
  }
  return tokens;
}
```
- [ ] **Step 4:** Run tests — expect all PASS.
- [ ] **Step 5:** Commit: `feat(wql): lexer with input caps and friendly errors`

### Task 3: WQL parser (TDD)

**Files:**
- Create: `frontend/src/lib/wql/parser.ts`
- Create: `frontend/src/lib/wql/parser.test.ts`

- [ ] **Step 1: Failing tests** — `parser.test.ts` (representative; engineer writes all):
```ts
import { describe, expect, test } from 'vitest';
import { parse } from './parser';
import { WqlError } from './lexer';

describe('parse', () => {
  test('select with where/order/limit', () => {
    const q = parse("SELECT * FROM events WHERE venue = 'PMK' AND date >= today() ORDER BY date DESC LIMIT 10;");
    expect(q).toMatchObject({
      kind: 'select',
      orderBy: { field: 'date', desc: true },
      limit: 10,
      where: { kind: 'and' },
    });
  });
  test('export ics with today offset', () => {
    const q = parse("EXPORT ICS WHERE date <= today() + 7");
    expect(q).toMatchObject({ kind: 'export', where: { kind: 'cmp', value: { kind: 'today', offset: 7 } } });
  });
  test('IN list and LIKE', () => {
    const q = parse("SELECT * FROM events WHERE venue IN ('pmk','treibhaus') OR title LIKE '%doma%'");
    expect(q.where).toMatchObject({ kind: 'or', left: { kind: 'in' }, right: { kind: 'like' } });
  });
  test('parens override AND/OR precedence', () => {
    const q = parse("SELECT * FROM events WHERE (venue='a' OR venue='b') AND date=today()");
    expect(q.where).toMatchObject({ kind: 'and', left: { kind: 'or' } });
  });
  test('unknown field lists allowed fields', () => {
    expect(() => parse("SELECT * FROM events WHERE genre = 'x'"))
      .toThrowError(/venue, date, title, time/);
  });
  test('paren depth cap 5', () => {
    expect(() => parse("SELECT * FROM events WHERE ((((((venue='x'))))))")).toThrowError(WqlError);
  });
  test('IN list cap 20', () => {
    const vals = Array.from({ length: 21 }, (_, i) => `'v${i}'`).join(',');
    expect(() => parse(`SELECT * FROM events WHERE venue IN (${vals})`)).toThrowError(/maximal 20/i);
  });
  test('LIMIT cap 200 and floor 1', () => {
    expect(() => parse('SELECT * FROM events LIMIT 0')).toThrowError(WqlError);
    expect(() => parse('SELECT * FROM events LIMIT 201')).toThrowError(WqlError);
  });
  test('trailing garbage rejected', () => {
    expect(() => parse("SELECT * FROM events; DROP")).toThrowError(WqlError);
  });
  test('prototype-pollution identifiers are just unknown fields', () => {
    expect(() => parse("SELECT * FROM events WHERE __proto__ = 'x'")).toThrowError(/venue, date, title, time/);
    expect(() => parse("SELECT * FROM events WHERE constructor = 'x'")).toThrowError(/venue, date, title, time/);
  });
});
```
- [ ] **Step 2:** Run — expect FAIL.
- [ ] **Step 3: Implementation** — `parser.ts`:
```ts
import { lex, Token, WqlError } from './lexer';

export type Field = 'venue' | 'date' | 'title' | 'time';
export type CompOp = '=' | '!=' | '<' | '<=' | '>' | '>=';
export type Value =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'today'; offset: number };
export type Condition =
  | { kind: 'cmp'; field: Field; op: CompOp; value: Value; pos: number }
  | { kind: 'in'; field: Field; values: Value[]; pos: number }
  | { kind: 'like'; field: Field; pattern: string; pos: number }
  | { kind: 'and'; left: Condition; right: Condition }
  | { kind: 'or'; left: Condition; right: Condition };
export interface SelectQuery {
  kind: 'select'; where?: Condition;
  orderBy?: { field: Field; desc: boolean }; limit?: number;
}
export interface ExportQuery { kind: 'export'; where?: Condition; }
export type Query = SelectQuery | ExportQuery;

const FIELDS: Field[] = ['venue', 'date', 'title', 'time'];
const FIELD_LIST = FIELDS.join(', ');
const MAX_DEPTH = 5;
const MAX_IN = 20;
const MAX_LIMIT = 200;

class Parser {
  private i = 0;
  private depth = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined { return this.tokens[this.i]; }
  private next(): Token | undefined { return this.tokens[this.i++]; }
  private pos(): number { return this.peek()?.pos ?? this.tokens[this.tokens.length - 1]?.pos ?? 0; }
  private expectKeyword(kw: string): void {
    const t = this.next();
    if (!t || t.type !== 'keyword' || t.value !== kw) {
      throw new WqlError(`'${kw.toUpperCase()}' erwartet`, t?.pos ?? this.pos());
    }
  }
  private isKeyword(kw: string): boolean {
    const t = this.peek();
    return t?.type === 'keyword' && t.value === kw;
  }

  parse(): Query {
    let query: Query;
    if (this.isKeyword('select')) query = this.select();
    else if (this.isKeyword('export')) query = this.export_();
    else throw new WqlError("Abfrage muss mit SELECT oder EXPORT beginnen", this.pos());
    if (this.peek()?.type === 'semicolon') this.next();
    const rest = this.peek();
    if (rest) throw new WqlError(`Unerwartetes '${rest.value}' nach Abfrageende`, rest.pos);
    return query;
  }

  private select(): SelectQuery {
    this.expectKeyword('select');
    const star = this.next();
    if (star?.type !== 'star') throw new WqlError("'*' erwartet (nur SELECT * wird unterstützt)", star?.pos ?? this.pos());
    this.expectKeyword('from');
    this.expectKeyword('events');
    const q: SelectQuery = { kind: 'select' };
    if (this.isKeyword('where')) { this.next(); q.where = this.orExpr(); }
    if (this.isKeyword('order')) {
      this.next(); this.expectKeyword('by');
      const field = this.field();
      let desc = false;
      if (this.isKeyword('asc')) this.next();
      else if (this.isKeyword('desc')) { this.next(); desc = true; }
      q.orderBy = { field, desc };
    }
    if (this.isKeyword('limit')) {
      this.next();
      const n = this.next();
      if (n?.type !== 'number') throw new WqlError('Zahl nach LIMIT erwartet', n?.pos ?? this.pos());
      const limit = Number(n.value);
      if (limit < 1 || limit > MAX_LIMIT) throw new WqlError(`LIMIT muss zwischen 1 und ${MAX_LIMIT} liegen`, n.pos);
      q.limit = limit;
    }
    return q;
  }

  private export_(): ExportQuery {
    this.expectKeyword('export');
    this.expectKeyword('ics');
    const q: ExportQuery = { kind: 'export' };
    if (this.isKeyword('where')) { this.next(); q.where = this.orExpr(); }
    return q;
  }

  private orExpr(): Condition {
    let left = this.andExpr();
    while (this.isKeyword('or')) { this.next(); left = { kind: 'or', left, right: this.andExpr() }; }
    return left;
  }
  private andExpr(): Condition {
    let left = this.atom();
    while (this.isKeyword('and')) { this.next(); left = { kind: 'and', left, right: this.atom() }; }
    return left;
  }
  private atom(): Condition {
    if (this.peek()?.type === 'lparen') {
      if (++this.depth > MAX_DEPTH) throw new WqlError(`Zu tief verschachtelt (max. ${MAX_DEPTH})`, this.pos());
      this.next();
      const inner = this.orExpr();
      const close = this.next();
      if (close?.type !== 'rparen') throw new WqlError("')' erwartet", close?.pos ?? this.pos());
      this.depth--;
      return inner;
    }
    return this.comparison();
  }

  private field(): Field {
    const t = this.next();
    if (t?.type === 'keyword' && (FIELDS as string[]).includes(t.value)) return t.value as Field;
    throw new WqlError(`Unbekanntes Feld '${t?.value ?? ''}' — erlaubt: ${FIELD_LIST}`, t?.pos ?? this.pos());
  }

  private value(): Value {
    const t = this.next();
    if (!t) throw new WqlError('Wert erwartet', this.pos());
    if (t.type === 'string') return { kind: 'string', value: t.value };
    if (t.type === 'number') return { kind: 'number', value: Number(t.value) };
    if (t.type === 'keyword' && t.value === 'today') {
      const lp = this.next(); const rp = this.next();
      if (lp?.type !== 'lparen' || rp?.type !== 'rparen') {
        throw new WqlError("today() erwartet", t.pos);
      }
      let offset = 0;
      const sign = this.peek();
      if (sign?.type === 'op' && (sign.value === '+' || sign.value === '-')) {
        this.next();
        const n = this.next();
        if (n?.type !== 'number') throw new WqlError('Zahl nach +/- erwartet', n?.pos ?? this.pos());
        offset = (sign.value === '-' ? -1 : 1) * Number(n.value);
      }
      return { kind: 'today', offset };
    }
    throw new WqlError(`Wert erwartet, '${t.value}' gefunden`, t.pos);
  }

  private comparison(): Condition {
    const start = this.pos();
    const field = this.field();
    const t = this.next();
    if (!t) throw new WqlError('Operator erwartet', this.pos());
    if (t.type === 'keyword' && t.value === 'in') {
      const lp = this.next();
      if (lp?.type !== 'lparen') throw new WqlError("'(' nach IN erwartet", lp?.pos ?? this.pos());
      const values: Value[] = [this.value()];
      while (this.peek()?.type === 'comma') {
        this.next();
        if (values.length >= MAX_IN) throw new WqlError(`IN-Liste: maximal ${MAX_IN} Werte`, this.pos());
        values.push(this.value());
      }
      const rp = this.next();
      if (rp?.type !== 'rparen') throw new WqlError("')' erwartet", rp?.pos ?? this.pos());
      return { kind: 'in', field, values, pos: start };
    }
    if (t.type === 'keyword' && t.value === 'like') {
      const p = this.next();
      if (p?.type !== 'string') throw new WqlError('String nach LIKE erwartet', p?.pos ?? this.pos());
      return { kind: 'like', field, pattern: p.value, pos: start };
    }
    if (t.type === 'op' && ['=', '!=', '<', '<=', '>', '>='].includes(t.value)) {
      return { kind: 'cmp', field, op: t.value as CompOp, value: this.value(), pos: start };
    }
    throw new WqlError(`Operator erwartet, '${t.value}' gefunden`, t.pos);
  }
}

export function parse(input: string): Query {
  return new Parser(lex(input)).parse();
}
```
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit: `feat(wql): recursive-descent parser with depth/size caps`

### Task 4: WQL evaluator (TDD)

**Files:**
- Create: `frontend/src/lib/wql/evaluate.ts`
- Create: `frontend/src/lib/wql/evaluate.test.ts`

- [ ] **Step 1: Failing tests** (representative — engineer covers every rule in spec §7 Semantics):
```ts
import { describe, expect, test } from 'vitest';
import { parse } from './parser';
import { runQuery } from './evaluate';
import type { EventData } from '../../../../shared/types/events';

const ev = (o: Partial<EventData>): EventData => ({
  id: 'x', title: 't', date: '2026-06-11', description: '', url: 'https://e.x', ...o,
});
const events = [
  ev({ id: '1', title: 'Molchat Doma', venue: 'PMK Innsbruck', date: '2026-06-11' }),
  ev({ id: '2', title: 'Jazz Trio', venue: 'Treibhaus Innsbruck', date: '2026-06-12', time: '20:30' }),
  ev({ id: '3', title: 'Der Revisor', venue: 'Innsbrucker Kellertheater', date: '2026-06-18' }),
];
const TODAY = '2026-06-11';
const run = (q: string) => runQuery(parse(q), events, TODAY);

describe('runQuery', () => {
  test('venue = matches by normalized substring', () => {
    const r = run("SELECT * FROM events WHERE venue = 'pmk'");
    expect(r.events.map(e => e.id)).toEqual(['1']);
  });
  test('date with today() offset', () => {
    expect(run('SELECT * FROM events WHERE date <= today() + 1').events.map(e => e.id)).toEqual(['1', '2']);
  });
  test('missing field → no match (time on event 1)', () => {
    expect(run("SELECT * FROM events WHERE time > '19:00'").events.map(e => e.id)).toEqual(['2']);
  });
  test('LIKE with % and case-insensitive', () => {
    expect(run("SELECT * FROM events WHERE title LIKE '%doma%'").events.map(e => e.id)).toEqual(['1']);
  });
  test('LIKE regex metacharacters are inert', () => {
    expect(run("SELECT * FROM events WHERE title LIKE '(((('").events).toEqual([]);
  });
  test('ORDER BY date DESC + LIMIT', () => {
    expect(run('SELECT * FROM events ORDER BY date DESC LIMIT 2').events.map(e => e.id)).toEqual(['3', '2']);
  });
  test('number compared to title is an error', () => {
    expect(() => run('SELECT * FROM events WHERE title = 5')).toThrowError(/Zahl/);
  });
  test('venue does not support <', () => {
    expect(() => run("SELECT * FROM events WHERE venue < 'x'")).toThrowError(/venue/i);
  });
});
```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3: Implementation** — `evaluate.ts`:
```ts
import type { EventData } from '../../../../shared/types/events';
import { WqlError } from './lexer';
import type { Condition, Field, Query, Value } from './parser';

export interface SelectResult { kind: 'select'; events: EventData[]; total: number; }
export interface ExportResult { kind: 'export'; events: EventData[]; }

const GETTERS: Record<Field, (e: EventData) => string | undefined> = {
  venue: (e) => e.venue,
  date: (e) => e.date,
  title: (e) => e.title,
  time: (e) => e.time,
};
const ORDERED_OPS = ['<', '<=', '>', '>='];

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resolveValue(v: Value, field: Field, todayIso: string, pos: number): string {
  if (v.kind === 'string') return v.value;
  if (v.kind === 'today') {
    if (field !== 'date') throw new WqlError('today() ist nur mit date vergleichbar', pos);
    return addDays(todayIso, v.offset);
  }
  throw new WqlError('Zahlen sind nur als today()-Offset oder LIMIT erlaubt', pos);
}

function likeToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i');
}

function evalCondition(c: Condition, e: EventData, todayIso: string): boolean {
  switch (c.kind) {
    case 'and': return evalCondition(c.left, e, todayIso) && evalCondition(c.right, e, todayIso);
    case 'or': return evalCondition(c.left, e, todayIso) || evalCondition(c.right, e, todayIso);
    case 'like': {
      const actual = GETTERS[c.field](e);
      return actual != null && likeToRegex(c.pattern).test(actual);
    }
    case 'in': {
      const actual = GETTERS[c.field](e);
      if (actual == null) return false;
      return c.values.some(v =>
        matches(c.field, actual, '=', resolveValue(v, c.field, todayIso, c.pos)));
    }
    case 'cmp': {
      const actual = GETTERS[c.field](e);
      if (actual == null) return false;
      if (c.field === 'venue' && ORDERED_OPS.includes(c.op)) {
        throw new WqlError("venue unterstützt nur =, !=, IN, LIKE", c.pos);
      }
      return matches(c.field, actual, c.op, resolveValue(c.value, c.field, todayIso, c.pos));
    }
  }
}

function matches(field: Field, actual: string, op: string, expected: string): boolean {
  const a = actual.toLowerCase();
  const b = expected.toLowerCase();
  if (field === 'venue') {
    const contains = a.includes(b);
    return op === '!=' ? !contains : contains;
  }
  switch (op) {
    case '=': return a === b;
    case '!=': return a !== b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '>=': return a >= b;
    default: return false;
  }
}

export function runQuery(
  q: Query, events: readonly EventData[], todayIso: string,
): SelectResult | ExportResult {
  let matched = events.filter(e => (q.where ? evalCondition(q.where, e, todayIso) : true));
  if (q.kind === 'export') return { kind: 'export', events: matched.slice(0, 500) };
  if (q.orderBy) {
    const { field, desc } = q.orderBy;
    matched = [...matched].sort((x, y) => {
      const a = GETTERS[field](x);
      const b = GETTERS[field](y);
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return desc ? b.localeCompare(a) : a.localeCompare(b);
    });
  }
  const total = matched.length;
  if (q.limit) matched = matched.slice(0, q.limit);
  return { kind: 'select', events: matched, total };
}
```
- [ ] **Step 4:** Run — PASS. **Step 5:** Commit: `feat(wql): evaluator with fixed field table and SQL-style null semantics`

### Task 5: ICS builder (TDD)

**Files:**
- Create: `frontend/src/lib/wql/ics.ts`
- Create: `frontend/src/lib/wql/ics.test.ts`

- [ ] **Step 1: Failing tests** — assert: `VERSION:2.0` + `PRODID` present; one `BEGIN:VEVENT` per event; `UID:<id>@wosweat`; `DTSTAMP:` present; `DTSTART;VALUE=DATE:20260611` for date-only and `DTSTART:20260611T203000` when `time: '20:30'`; `SUMMARY` escapes `, ; \n \\`; URL with `\r\n` stripped; every line ≤75 octets (TextEncoder check over split('\r\n')); CRLF endings; 0 events → `buildIcs` returns null.
```ts
import { describe, expect, test } from 'vitest';
import { buildIcs } from './ics';
import type { EventData } from '../../../../shared/types/events';

const base: EventData = { id: 'ev1', title: 'A, B; C\nD', date: '2026-06-11', description: '', url: 'https://x.y/a\r\nb', venue: 'PMK Innsbruck' };

describe('buildIcs', () => {
  test('rfc skeleton, uid, escaping, url sanitized', () => {
    const ics = buildIcs([base], '2026-06-11T12:00:00.000Z')!;
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//wosweat//WQL//DE');
    expect(ics).toContain('UID:ev1@wosweat');
    expect(ics).toContain('DTSTAMP:20260611T120000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260611');
    expect(ics).toContain('SUMMARY:A\\, B\\; C\\nD');
    expect(ics).toContain('URL:https://x.y/ab');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  test('time becomes local datetime DTSTART', () => {
    const ics = buildIcs([{ ...base, time: '20:30' }], '2026-06-11T12:00:00.000Z')!;
    expect(ics).toContain('DTSTART:20260611T203000');
  });
  test('lines fold at 75 octets', () => {
    const long = { ...base, title: 'Ä'.repeat(120) };
    const ics = buildIcs([long], '2026-06-11T12:00:00.000Z')!;
    const enc = new TextEncoder();
    for (const line of ics.split('\r\n')) {
      expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    }
  });
  test('empty input → null', () => {
    expect(buildIcs([], '2026-06-11T12:00:00.000Z')).toBeNull();
  });
});
```
- [ ] **Step 2:** FAIL. **Step 3: Implementation** — `ics.ts`:
```ts
import type { EventData } from '../../../../shared/types/events';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|[\r\n]/g, '\\n');
}
function sanitizeUrl(s: string): string {
  return s.replace(/[\u0000-\u001F\u007F]/g, '');
}
function fold(line: string): string[] {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    if (bytes + len > 75) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += ch;
    bytes += len;
  }
  out.push(current);
  return out;
}

export function buildIcs(events: EventData[], nowIso: string): string | null {
  if (events.length === 0) return null;
  const dtstamp = nowIso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//wosweat//WQL//DE'];
  for (const e of events.slice(0, 500)) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${esc(e.id ?? '')}@wosweat`);
    lines.push(`DTSTAMP:${dtstamp}`);
    const day = e.date?.replace(/-/g, '') ?? '';
    if (e.time && /^\d{2}:\d{2}$/.test(e.time)) {
      lines.push(`DTSTART:${day}T${e.time.replace(':', '')}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${day}`);
    }
    lines.push(`SUMMARY:${esc(e.title ?? '')}`);
    if (e.venue) lines.push(`LOCATION:${esc(e.venue)}`);
    if (e.url) lines.push(`URL:${sanitizeUrl(e.url)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.flatMap(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```
- [ ] **Step 4:** PASS. **Step 5:** Commit: `feat(wql): RFC 5545 ics builder with folding and url sanitization`

### Task 6: `useEvents` unfiltered data

**Files:**
- Modify: `frontend/src/hooks/useEvents.ts`

- [ ] **Step 1:** Extract the group-by-date logic into a helper inside the file and return unfiltered data alongside filtered:
```ts
function groupByDate(list: EventData[]): Map<string, EventData[]> {
  const map = new Map<string, EventData[]>();
  for (const event of list) {
    const key = event.date ?? 'unknown';
    const group = map.get(key);
    if (group) group.push(event);
    else map.set(key, [event]);
  }
  return map;
}
```
Use it for both `eventsByDate` (filtered, existing semantics) and a new `allEventsByDate = useMemo(() => groupByDate(events), [events])`; add `allEvents: events` to the return object and to `UseEventsReturn`.
- [ ] **Step 2:** `npm run build && npm test` — green. Commit: `feat(frontend): expose unfiltered events from useEvents`

### Task 7: Header band + accent rail

**Files:**
- Modify: `frontend/src/components/Header.tsx`, `Header.css`
- Modify: `frontend/src/App.tsx` (rail div), `frontend/src/theme/variables.css` (rail rule)

- [ ] **Step 1:** Header.tsx — inside `.header-inner`, after the wordmark add:
```tsx
<span className="header-artifact" aria-hidden="true">
  S.{String(dayOfYear()).padStart(2, '0')} — INNSBRUCK
</span>
```
with `function dayOfYear(): number { const now = new Date(); const start = new Date(now.getFullYear(), 0, 0); return Math.floor((now.getTime() - start.getTime()) / 86_400_000); }` at module level. Layout: wordmark left; artifact + venue button right (wrap both in a flex `<div className="header-right">`).
- [ ] **Step 2:** Header.css — band styling per mockup (`.band`): background `var(--ctp-crust)` (header-bar already mantle → change to crust), `.header-artifact { font-family: var(--font-pixel); font-size: 0.625rem; color: var(--ctp-teal); }` + `[data-theme="light"] .header-artifact { color: var(--ctp-subtext0); }`; `.header-right { display: flex; align-items: center; gap: 14px; }`.
- [ ] **Step 3:** App.tsx — first child inside `<IonApp>`: `<div className="accent-rail" aria-hidden="true" />`. variables.css:
```css
.accent-rail { position: fixed; left: 0; top: 0; bottom: 0; width: 8px; background: var(--ctp-teal); z-index: 1000; pointer-events: none; }
@media (max-width: 699px) { .accent-rail { width: 4px; } }
```
- [ ] **Step 4:** Build + unit test green; visual check deferred to Task 12. Commit: `feat(ui): header band with pixel artifact and accent rail`

### Task 8: DateStrip count badges

**Files:**
- Modify: `frontend/src/components/DateStrip.tsx`, `DateStrip.css`, `frontend/src/App.tsx`

- [ ] **Step 1:** DateStrip props gain `countsByDate: Map<string, number>`. In the pill render: `const count = countsByDate.get(iso) ?? 0;` — aria-label becomes `` `${FULL_DATE.format(d)}, ${count === 0 ? 'keine Events' : count === 1 ? '1 Event' : `${count} Events`}` ``; after the num span add `{count > 0 && <span className="date-pill-count" aria-hidden="true">{count} EV</span>}`.
- [ ] **Step 2:** Class logic: `isToday` alone adds `date-pill--today`; `isToday && isSelected` additionally adds `date-pill--today-selected` (replaces the old combo-only class). CSS:
```css
.date-pill--today { background: var(--ctp-teal); border-color: var(--ctp-teal); }
.date-pill--today .date-pill-day,
.date-pill--today .date-pill-num,
.date-pill--today .date-pill-count { color: var(--on-accent); font-weight: 800; }
.date-pill--today-selected { border-color: var(--on-accent); }
.date-pill-count { font-family: var(--font-pixel); font-size: 0.5625rem; line-height: 1.4; color: var(--ctp-teal); }
[data-theme="light"] .date-pill-count { color: var(--ctp-text); }
```
(The `--today` rules come after `.date-pill-count`'s base color so `--on-accent` wins on today pills in both themes; today+selected is distinguished by the on-accent ring.) Remove the now-unused old `.date-pill--today-selected` color block.
- [ ] **Step 3:** App passes `countsByDate` derived: `const countsByDate = useMemo(() => new Map([...allEventsByDate].map(([k, v]) => [k, v.length])), [allEventsByDate]);`
- [ ] **Step 4:** Build + tests green (App.test still passes — labels changed only by suffix; update the existing assertion if it broke). Commit: `feat(ui): pixel event-count badges on date pills`

### Task 9: Poster DateHeading

**Files:**
- Modify: `frontend/src/components/DateHeading.tsx`, `DateHeading.css`, `frontend/src/App.tsx`

- [ ] **Step 1:** Props: `{ date: string; eventCount: number; venueCount: number; isToday: boolean }`. Structure (heading role block unchanged):
```tsx
<div className="date-heading">
  {isToday && <span className="date-heading-stamp" aria-hidden="true">heute!</span>}
  <div role="heading" aria-level={2}>
    <span className="date-heading-weekday">{weekday}</span>
    <span className="date-heading-date">{day}. <span className="date-heading-month">{month}</span></span>
  </div>
  {eventCount > 0 && (
    <p className="date-heading-meta" aria-hidden="true">
      {eventCount} EVENTS <b>///</b> {venueCount} VENUES
    </p>
  )}
</div>
```
(Counts duplicated for SR via list content; meta is decorative pixel text.) App passes filtered `eventsForDate.length` and `new Set(eventsForDate.map(e => e.venue).filter(Boolean)).size`, `isToday={selectedDate === todayIso}` — lift a `todayIso` value into App (same local-date string code DateStrip uses) and pass it down to DateStrip too (single derivation).
- [ ] **Step 2:** CSS per mockup `.head`: weekday eyebrow teal uppercase 0.75rem letterspaced; date `font-family: var(--font-display); font-weight: 800; font-size: clamp(2.75rem, 11vw, 8rem); line-height: 0.9; letter-spacing: -0.045em;` month in teal; meta `font-family: var(--font-pixel); font-size: 0.625rem; color: var(--ctp-subtext0);` with teal `b`; stamp:
```css
.date-heading-stamp {
  position: absolute; right: 2%; top: -6px;
  font-family: var(--font-marker); font-size: 1.5rem;
  background: var(--ctp-teal); color: var(--on-accent);
  padding: 4px 16px 6px; transform: rotate(-6deg);
  box-shadow: 4px 4px 0 var(--ctp-crust);
  animation: stamp-pop 0.4s 0.4s cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
@keyframes stamp-pop { from { opacity: 0; transform: rotate(-6deg) scale(1.6); } to { opacity: 1; transform: rotate(-6deg) scale(1); } }
```
`.date-heading { position: relative; }`. Reduced motion is covered by the existing global damping rule.
- [ ] **Step 3:** Build + tests; commit: `feat(ui): poster-scale date heading with heute stamp and pixel meta`

### Task 10: ViewControls (chips + toggle) and MonthGrid chip removal

**Files:**
- Create: `frontend/src/components/ViewControls.tsx`, `ViewControls.css`
- Create: `frontend/src/components/ViewControls.test.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/MonthGrid.tsx`, `MonthGrid.css`

- [ ] **Step 1: Failing test** (RTL): renders "Alle" + 8 venue chips with `aria-pressed`; clicking "PMK" calls `onVenueFilterChange(['PMK'])`; clicking "Alle" clears; toggle buttons have `aria-pressed` and clicking LISTE calls `onViewChange('list')`.
- [ ] **Step 2:** Component contract:
```tsx
export type View = 'cards' | 'list';
interface ViewControlsProps {
  venueFilter: string[];
  onVenueFilterChange: (venues: string[]) => void;
  view: View;
  onViewChange: (view: View) => void;
}
```
Chips: `Object.keys(VENUE_CONFIG)` labels; toggle group `role="group" aria-label="Ansicht"`; buttons text `KARTEN`/`LISTE` (pixel font). CSS per mockup `.controls/.chips/.chip/.toggle` (marker underline = the mockup's `.chip.on::after` blob with `--ctp-lavender`); chip/toggle min-height 24px.
- [ ] **Step 3:** App: view state with safe persistence:
```ts
const [view, setView] = useState<View>(() => {
  try { return localStorage.getItem('wosweat-view') === 'list' ? 'list' : 'cards'; } catch { return 'cards'; }
});
const changeView = (v: View) => { setView(v); try { localStorage.setItem('wosweat-view', v); } catch { /* private mode */ } };
```
Render `<ViewControls …/>` between `DateHeading` and the events area. Remove `venueFilter`/`onVenueFilterChange` props + chips JSX from MonthGrid (and `MonthGridProps`), delete `.month-grid__filters*`/`.month-grid__chip*` CSS blocks.
- [ ] **Step 4:** Tests green; commit: `feat(ui): venue chips + card/list toggle; single source for venue filter`

### Task 11: EventList + view switch + hoisted states

**Files:**
- Create: `frontend/src/components/EventList.tsx`, `EventList.css`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/EventGrid.tsx`

- [ ] **Step 1:** Hoist loading/empty: EventGrid drops its `loading`/empty branches (keeps grid + GSAP only; skeleton CSS classes stay in EventGrid.css); App renders:
```tsx
{loading ? (
  <div className="event-grid" role="status" aria-label="Events werden geladen">…skeletons…</div>
) : eventsForDate.length === 0 ? (
  <div className="event-grid__empty">Keine Events gefunden</div>
) : view === 'list' ? (
  <EventList events={eventsForDate} />
) : (
  <EventGrid events={eventsForDate} />
)}
```
(Move the skeleton markup from EventGrid into App verbatim; EventGridProps loses `loading`.)
- [ ] **Step 2:** EventList — row contract per spec §6:
```tsx
const EventList: React.FC<{ events: EventData[] }> = ({ events }) => {
  const hasTimes = events.some(e => !!e.time);
  return (
    <div className={`event-list${hasTimes ? '' : ' event-list--no-times'}`}>
      {events.map((event, i) => (
        <div
          key={event.id}
          className={`event-list__row${i === 0 ? ' event-list__row--feat' : ''}`}
          role="link" tabIndex={0}
          aria-label={`${event.title} — ${getVenueConfig(event.venue).displayName}`}
          onClick={() => window.open(event.url, '_blank', 'noopener')}
          onKeyDown={(e) => { if (e.key === 'Enter') window.open(event.url, '_blank', 'noopener'); }}
        >
          {hasTimes && <span className="event-list__time">{event.time ?? ''}</span>}
          <span className="event-list__title" role="heading" aria-level={3}>
            {event.title}
            {i === 0 && <span className="event-list__mk" aria-hidden="true"> heißer tipp!</span>}
          </span>
          <span className="event-list__venue">{getVenueConfig(event.venue).displayName}</span>
        </div>
      ))}
    </div>
  );
};
```
- [ ] **Step 3:** CSS per mockup `.rows/.row` adapted to tokens: grid `84px 1fr auto` (or `1fr auto` in `--no-times`); title Syne 800 uppercase `clamp(1.5rem, 3.4vw, 2.5rem)`; hover/focus-visible → `transform: translateX(10px); text-decoration: underline;` (no color swap); featured row teal/`--on-accent`; stamps ±2° rotation; time pixel font; CSS stagger `rise` animation with per-child delays (cap at 8 like mockup) under reduced-motion damping. Mobile `<700px`: wrap time + venue in a `<span className="event-list__meta">` container (always present in markup; on desktop it participates in the row grid via `display: contents`, on mobile it becomes a single inline flex row above the title) — spec's two-line layout: meta row (time pixel + venue stamp inline), title below.
- [ ] **Step 4:** Build + tests; commit: `feat(ui): poster list view as alternative to the card grid`

### Task 12: TellyBand

**Files:**
- Create: `frontend/src/components/TellyBand.tsx`, `TellyBand.css`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/AccessibilityFab.css`, `frontend/src/theme/variables.css`

- [ ] **Step 1:** Component:
```tsx
const TellyBand: React.FC<{ events: EventData[] }> = ({ events }) => {
  const [paused, setPaused] = useState(false);
  const items = events.map(e => `${getVenueConfig(e.venue).displayName.toUpperCase()}: ${(e.title ?? '').toUpperCase()}`);
  const text = items.length ? items.join(' ★ ') + ' ★ ' : 'HEUTE NIX — SCHAU MORGEN';
  return (
    <section className="telly" aria-label="Events des ausgewählten Tages (Laufband)">
      <div className={`telly__track${paused ? ' telly__track--paused' : ''}${items.length === 0 ? ' telly__track--static' : ''}`}>
        <span className="telly__copy">{text}</span>
        {items.length > 0 && <span className="telly__copy" aria-hidden="true">{text}</span>}
      </div>
      <button
        className="telly__pause"
        onClick={() => setPaused(p => !p)}
        aria-pressed={paused}
        aria-label="Laufband pausieren"
      >
        {paused ? '▶' : '⏸'}
      </button>
    </section>
  );
};
```
- [ ] **Step 2:** CSS: fixed bottom, `left: 8px` (4px under 700px, matching the rail media query), height `var(--telly-height)` + `padding-bottom: env(safe-area-inset-bottom)`, teal bg, `--on-accent`, pixel font 0.6875rem; `.telly__track { display: flex; white-space: nowrap; overflow: hidden; flex: 1; } .telly__copy { animation: telly-scroll 30s linear infinite; padding-right: 2rem; } .telly__track--paused .telly__copy, .telly__track--static .telly__copy { animation: none; } @keyframes telly-scroll { to { transform: translateX(-100%); } } @media (prefers-reduced-motion: reduce) { .telly__copy { animation: none; overflow: hidden; text-overflow: ellipsis; } .telly__copy[aria-hidden] { display: none; } }` (ellipsis on the copy span, not the flex track); pause button ≥24×24, on-accent color, focus-visible visible on teal (`outline-color: var(--on-accent)`).
- [ ] **Step 3:** App renders `<TellyBand events={eventsForDate} />` after `<AccessibilityFab />`; variables.css adds to the IonContent area: `ion-content::part(scroll) { padding-bottom: calc(var(--telly-height) + env(safe-area-inset-bottom)); }` — if `::part` proves unreliable, fallback: bottom padding on `<main>` and the VenueList wrapper. AccessibilityFab.css: `bottom: calc(16px + var(--telly-height) + env(safe-area-inset-bottom));`
- [ ] **Step 4:** Build + tests; commit: `feat(ui): telly band marquee with pause control and safe-area handling`

### Task 13: QueryConsole

**Files:**
- Create: `frontend/src/components/QueryConsole.tsx`, `QueryConsole.css`
- Create: `frontend/src/components/QueryConsole.test.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Failing tests** (RTL): typing `SELECT * FROM events` + Enter renders a status line containing `→ 3 events`; typing `garbage` renders a line starting `✗`; input has accessible name "WQL-Abfrage".
- [ ] **Step 2:** Component: props `{ events: EventData[]; todayIso: string }`. State: `entries: { query: string; lines: string[]; summary: string; isError: boolean }[]`, `input`, `histIdx`. Submit handler:
```ts
const run = (raw: string) => {
  const started = performance.now();
  try {
    const result = runQuery(parse(raw), events, todayIso);
    if (result.kind === 'select') {
      const lines = result.events.slice(0, 50).map(e =>
        `${e.time ? e.time + ' — ' : ''}${e.title} [${e.venue ?? 'unbekannt'}]`);
      if (result.total > 50) lines.push(`… ${result.total - 50} weitere`);
      const ms = (performance.now() - started).toFixed(1);
      setEntries(prev => [...prev, { query: raw, lines, summary: `→ ${result.total} events (${ms} ms, lokal)`, isError: false }]);
    } else {
      const ics = buildIcs(result.events, new Date().toISOString());
      if (!ics) {
        setEntries(prev => [...prev, { query: raw, lines: [], summary: '→ 0 events — kein Download', isError: false }]);
      } else {
        const name = `wosweat-${todayIso.replace(/-/g, '')}-${result.events.length}events.ics`;
        downloadIcs(ics, name);
        setEntries(prev => [...prev, { query: raw, lines: [], summary: `→ ${name} (${result.events.length} events) ↓`, isError: false }]);
      }
    }
  } catch (err) {
    const msg = err instanceof WqlError ? `✗ ${err.message} (Position ${err.pos})` : '✗ Abfrage konnte nicht verarbeitet werden';
    setEntries(prev => [...prev, { query: raw, lines: [], summary: msg, isError: true }]);
  }
};
```
Render: section `aria-label="Query-Konsole"`, chrome (3 dots aria-hidden, title, green status `● 100% lokal — kein server, kein eval`), intro comment, log div (`role="log"` + `aria-label="Abfrage-Ausgabe"` + `tabIndex={0}`; entries render prompt-echo line, result lines, and each entry's summary inline as plain text), plus a **separate visually-hidden `role="status" aria-live="polite"` element** mirroring only the latest summary (announcement without flooding); form with `wql>` prefix + `<input aria-label="WQL-Abfrage" autoComplete="off" spellCheck={false} maxLength={300}>`; ArrowUp/ArrowDown walk history (max 50 entries). Auto-scroll log to bottom on new entry (`ref.scrollTop = ref.scrollHeight` in effect).
- [ ] **Step 3:** CSS with `--console-*` pinned tokens per mockup `.console` (chrome border, shadow `6px 6px 0 #181825` pinned, body 0.8125rem desktop / output 0.75rem mobile, input `font-size: 1rem`). Place in App inside `<main>` after the events area, before the VenueList wrapper: `<QueryConsole events={allEvents} todayIso={todayIso} />` — **`allEvents` (unfiltered), not `events`** (spec §7/§9).
- [ ] **Step 4:** Tests green; commit: `feat(wql): query console UI wired to the client-only engine`

### Task 14: Cypress e2e + axe-style assertions

**Files:**
- Modify: `frontend/cypress/e2e/test.cy.ts`
- Create: `frontend/cypress/e2e/hybrid.cy.ts`
- [ ] **Step 1:** `hybrid.cy.ts` — **no static fixture**: build the intercept body in the spec file so dates never rot, in the exact response envelope `useEvents` reads:
```ts
const iso = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const mkEvents = () => [
  { id: 'e1', title: 'Molchat Doma', date: iso(0), description: 'x', url: 'https://example.com/1', venue: 'PMK Innsbruck' },
  { id: 'e2', title: 'Jazz Trio', date: iso(0), description: 'x', url: 'https://example.com/2', venue: 'Treibhaus Innsbruck', time: '20:30' },
  { id: 'e3', title: 'Der Revisor', date: iso(0), description: 'x', url: 'https://example.com/3', venue: 'Innsbrucker Kellertheater' },
  { id: 'e4', title: 'DnB Bunker', date: iso(1), description: 'x', url: 'https://example.com/4', venue: 'Music Hall Innsbruck' },
];
beforeEach(() => {
  cy.intercept('GET', '/api/get-events', {
    body: { events: mkEvents(), lastUpdated: new Date().toISOString(), count: 4 },
  });
});
```
Then assert:
  - desktop (1280×900): toggle to LISTE → `.event-list__row` visible; reload → still list (persistence); first row `aria-pressed` states on chips; rows reachable by keyboard (`cy.get('.event-list__row').first().focus().type('{enter}')` with `window.open` stubbed → called with event url).
  - console: type `SELECT * FROM events{enter}` → summary contains `events (`; type `garbage{enter}` → `✗`; type `EXPORT ICS WHERE venue = 'PMK'{enter}` → summary contains `.ics`.
  - telly: pause button toggles `aria-pressed`.
  - mobile (390×844): no horizontal scroll (`cy.window().then(w => expect(w.document.documentElement.scrollWidth).to.be.lte(390))`), telly visible, list rows stacked.
- [ ] **Step 2:** Update `test.cy.ts` shell test if selectors changed (wordmark unchanged). Run full suite against Vite dev server — all green.
- [ ] **Step 3:** Commit: `test(e2e): hybrid ui coverage (views, console, telly, mobile)`

### Task 15: Cross-engine + final verification + docs

- [ ] **Step 1:** Firefox headless screenshots (desktop 1440 + mobile 390) of the dev server, dark + light (set localStorage), reduced-motion profile; visually inspect: rail, band, badges, heading, list view, console, telly, FAB clearance.
- [ ] **Step 2:** Full gate: `npm run build && npm test && npm run lint` + Cypress suite. Fix anything found.
- [ ] **Step 3:** Update `docs/audit-2026-06-11.md` (new features noted; any consciously deferred items). Commit: `docs: record hybrid ui implementation status`

## Self-review notes
- Spec §1–§10 each map to Tasks 7, 7, 8, 9, 10, 11, 13, 12, 6, 1 respectively; testing strategy → Tasks 2–5 (unit), 10/13 (RTL), 14 (e2e), 15 (cross-engine). Loading/empty hoist (spec §5) = Task 11 Step 1.
- Type names consistent: `View`, `Query`, `Condition`, `WqlError`, `SelectResult/ExportResult` defined once and imported.
- No placeholders: every code step shows the code or names the exact mockup selector to copy from.
