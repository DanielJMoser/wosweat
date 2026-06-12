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
const EXPORT_CAP = 500;

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
      if (c.field === 'venue' && ORDERED_OPS.includes(c.op)) {
        throw new WqlError('venue unterstützt nur =, !=, IN, LIKE', c.pos);
      }
      const expected = resolveValue(c.value, c.field, todayIso, c.pos);
      const actual = GETTERS[c.field](e);
      if (actual == null) return false;
      return matches(c.field, actual, c.op, expected);
    }
  }
}

export function runQuery(
  q: Query, events: readonly EventData[], todayIso: string,
): SelectResult | ExportResult {
  let matched = events.filter(e => (q.where ? evalCondition(q.where, e, todayIso) : true));
  if (q.kind === 'export') return { kind: 'export', events: matched.slice(0, EXPORT_CAP) };
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
