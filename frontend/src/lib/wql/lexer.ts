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
