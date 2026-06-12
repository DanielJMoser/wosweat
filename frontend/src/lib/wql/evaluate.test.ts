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
  test('venue != negates the substring match', () => {
    expect(run("SELECT * FROM events WHERE venue != 'innsbruck'").events).toEqual([]);
  });
  test('date with today() offset', () => {
    expect(run('SELECT * FROM events WHERE date <= today() + 1').events.map(e => e.id)).toEqual(['1', '2']);
  });
  test('missing field is no match', () => {
    expect(run("SELECT * FROM events WHERE time > '19:00'").events.map(e => e.id)).toEqual(['2']);
  });
  test('LIKE with % and case-insensitive', () => {
    expect(run("SELECT * FROM events WHERE title LIKE '%doma%'").events.map(e => e.id)).toEqual(['1']);
  });
  test('LIKE regex metacharacters are inert', () => {
    expect(run("SELECT * FROM events WHERE title LIKE '(((('").events).toEqual([]);
  });
  test('IN over venues', () => {
    expect(run("SELECT * FROM events WHERE venue IN ('pmk', 'treibhaus')").events.map(e => e.id)).toEqual(['1', '2']);
  });
  test('ORDER BY date DESC + LIMIT keeps total', () => {
    const r = run('SELECT * FROM events ORDER BY date DESC LIMIT 2');
    expect(r.events.map(e => e.id)).toEqual(['3', '2']);
    expect(r.kind === 'select' && r.total).toBe(3);
  });
  test('number compared to title is an error', () => {
    expect(() => run('SELECT * FROM events WHERE title = 5')).toThrowError(/Zahl/);
  });
  test('venue does not support <', () => {
    expect(() => run("SELECT * FROM events WHERE venue < 'x'")).toThrowError(/venue/i);
  });
  test('export returns matches without ordering', () => {
    const r = run("EXPORT ICS WHERE date = today()");
    expect(r.kind).toBe('export');
    expect(r.events.map(e => e.id)).toEqual(['1']);
  });
});
