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
    const q = parse('EXPORT ICS WHERE date <= today() + 7');
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
    expect(() => parse('SELECT * FROM events; DROP')).toThrowError(WqlError);
  });
  test('prototype-pollution identifiers are just unknown fields', () => {
    expect(() => parse("SELECT * FROM events WHERE __proto__ = 'x'")).toThrowError(/venue, date, title, time/);
    expect(() => parse("SELECT * FROM events WHERE constructor = 'x'")).toThrowError(/venue, date, title, time/);
  });
});
