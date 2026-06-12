import { describe, expect, test } from 'vitest';
import { suggest } from './suggest';

const VENUES = ['PMK', 'Treibhaus', 'Bäckerei'];
const s = (input: string) => suggest(input, VENUES).map(x => x.text);

describe('suggest', () => {
  test('empty input offers entry points', () => {
    expect(s('')).toEqual(expect.arrayContaining(['SELECT', 'EXPORT', 'help', 'clear']));
  });
  test('walks the select chain', () => {
    expect(s('SELECT ')).toEqual(['*']);
    expect(s('SELECT * ')).toEqual(['FROM']);
    expect(s('SELECT * FROM ')).toEqual(['events']);
    expect(s('SELECT * FROM events ')).toEqual(expect.arrayContaining(['WHERE', 'ORDER BY', 'LIMIT', ';']));
  });
  test('where expects fields or paren', () => {
    expect(s('SELECT * FROM events WHERE ')).toEqual(expect.arrayContaining(['venue', 'date', 'title', 'time', '(']));
  });
  test('after a field comes its operators (venue restricted)', () => {
    expect(s('SELECT * FROM events WHERE venue ')).toEqual(expect.arrayContaining(['=', '!=', 'IN (', 'LIKE']));
    expect(s('SELECT * FROM events WHERE venue ')).not.toEqual(expect.arrayContaining(['<']));
    expect(s('SELECT * FROM events WHERE date ')).toEqual(expect.arrayContaining(['=', '<=', '>=']));
  });
  test('venue values come from the live venue list', () => {
    expect(s("SELECT * FROM events WHERE venue = ")).toEqual(["'PMK'", "'Treibhaus'", "'Bäckerei'"]);
  });
  test('date values suggest today()', () => {
    expect(s('SELECT * FROM events WHERE date <= ')).toEqual(expect.arrayContaining(['today()', 'today() + 7']));
  });
  test('after a complete comparison: connectors and tail', () => {
    expect(s("SELECT * FROM events WHERE venue = 'PMK' ")).toEqual(
      expect.arrayContaining(['AND', 'OR', 'ORDER BY', 'LIMIT', ';']));
  });
  test('partial word filters and is marked for replacement', () => {
    const result = suggest('SELECT * FROM events WHERE ven', VENUES);
    expect(result).toEqual([{ text: 'venue', replaceLast: true }]);
  });
  test('export chain', () => {
    expect(s('EXPORT ')).toEqual(['ICS']);
    expect(s('EXPORT ICS ')).toEqual(expect.arrayContaining(['WHERE', ';']));
  });
  test('order by chain', () => {
    expect(s('SELECT * FROM events ORDER BY ')).toEqual(expect.arrayContaining(['venue', 'date', 'title', 'time']));
    expect(s('SELECT * FROM events ORDER BY date ')).toEqual(expect.arrayContaining(['ASC', 'DESC', 'LIMIT', ';']));
  });
  test('unterminated string or finished query yields nothing', () => {
    expect(s("SELECT * FROM events WHERE venue = 'PM")).toEqual([]);
    expect(s('SELECT * FROM events;')).toEqual([]);
  });
  test('IN list flows values, comma, close', () => {
    expect(s("SELECT * FROM events WHERE venue IN ( ")).toEqual(["'PMK'", "'Treibhaus'", "'Bäckerei'"]);
    expect(s("SELECT * FROM events WHERE venue IN ('PMK' ")).toEqual(expect.arrayContaining([',', ')']));
  });
});
