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
  test('classic injection strings are rejected or inert', () => {
    expect(() => lex('"); alert(1); --')).toThrowError(WqlError);
    expect(() => lex('a'.repeat(10_000))).toThrowError(/zu lang/i);
  });
});
