import { lex, Token } from './lexer';

export interface Suggestion {
  text: string;
  replaceLast: boolean;
}

const FIELDS = ['venue', 'date', 'title', 'time'];
const ALL_OPS = ['=', '!=', '<', '<=', '>', '>='];
const VENUE_OPS = ['=', '!=', 'IN (', 'LIKE'];

function valueSuggestions(field: string, venues: string[]): string[] {
  if (field === 'venue') return venues.map(v => `'${v.replace(/'/g, "''")}'`);
  if (field === 'date') return ['today()', 'today() + 7'];
  if (field === 'time') return ["'20:00'"];
  return ["'…'"];
}

function expectations(tokens: Token[], venues: string[]): string[] {
  let i = 0;
  let depth = 0;
  const end = () => i >= tokens.length;
  const at = (type: Token['type'], value?: string) => {
    const t = tokens[i];
    return !!t && t.type === type && (value === undefined || t.value === value);
  };
  const eat = () => tokens[i++];

  if (end()) return ['SELECT', 'EXPORT', 'help', 'clear'];

  let isSelect: boolean;
  if (at('keyword', 'select')) { isSelect = true; eat(); }
  else if (at('keyword', 'export')) { isSelect = false; eat(); }
  else return [];

  if (isSelect) {
    if (end()) return ['*'];
    if (!at('star')) return [];
    eat();
    if (end()) return ['FROM'];
    if (!at('keyword', 'from')) return [];
    eat();
    if (end()) return ['events'];
    if (!at('keyword', 'events')) return [];
    eat();
  } else {
    if (end()) return ['ICS'];
    if (!at('keyword', 'ics')) return [];
    eat();
  }

  const tail = () => (isSelect ? ['ORDER BY', 'LIMIT', ';'] : [';']);

  // consume one value; returns expectations if input ends inside it, true on success, null on mismatch
  const value = (field: string): string[] | true | null => {
    if (at('string') || at('number')) { eat(); return true; }
    if (at('keyword', 'today')) {
      eat();
      if (end()) return ['()'];
      if (!at('lparen')) return null;
      eat();
      if (end()) return [')'];
      if (!at('rparen')) return null;
      eat();
      if (at('op') && (tokens[i].value === '+' || tokens[i].value === '-')) {
        eat();
        if (end()) return ['7'];
        if (!at('number')) return null;
        eat();
      }
      return true;
    }
    return null;
  };

  const afterCondition = (): string[] | null => {
    for (;;) {
      if (end()) return ['AND', 'OR', ...(depth > 0 ? [')'] : []), ...tail()];
      if (at('rparen') && depth > 0) { depth--; eat(); continue; }
      if (at('keyword', 'and') || at('keyword', 'or')) {
        eat();
        return operand();
      }
      return null;
    }
  };

  const operand = (): string[] | null => {
    while (at('lparen')) { depth++; eat(); }
    if (end()) return [...FIELDS, '('];
    if (!(at('keyword') && FIELDS.includes(tokens[i].value))) return [];
    const field = eat().value;
    if (end()) return field === 'venue' ? VENUE_OPS : [...ALL_OPS, 'IN (', 'LIKE'];
    if (at('keyword', 'in')) {
      eat();
      if (end()) return ['('];
      if (!at('lparen')) return [];
      eat();
      for (;;) {
        if (end()) return valueSuggestions(field, venues);
        const v = value(field);
        if (Array.isArray(v)) return v;
        if (v === null) return [];
        if (end()) return [',', ')'];
        if (at('comma')) { eat(); continue; }
        if (at('rparen')) { eat(); break; }
        return [];
      }
      return afterCondition();
    }
    if (at('keyword', 'like')) {
      eat();
      if (end()) return ["'%…%'"];
      if (!at('string')) return [];
      eat();
      return afterCondition();
    }
    if (at('op') && ALL_OPS.includes(tokens[i].value)) {
      if (field === 'venue' && !['=', '!='].includes(tokens[i].value)) return [];
      eat();
      if (end()) return valueSuggestions(field, venues);
      const v = value(field);
      if (Array.isArray(v)) return v;
      if (v === null) return [];
      return afterCondition();
    }
    return [];
  };

  if (at('keyword', 'where')) {
    eat();
    const r = operand();
    if (r !== null) return r;
  } else if (end()) {
    return ['WHERE', ...tail()];
  }

  if (isSelect && at('keyword', 'order')) {
    eat();
    if (end()) return ['BY'];
    if (!at('keyword', 'by')) return [];
    eat();
    if (end()) return [...FIELDS];
    if (!(at('keyword') && FIELDS.includes(tokens[i].value))) return [];
    eat();
    if (end()) return ['ASC', 'DESC', 'LIMIT', ';'];
    if (at('keyword', 'asc') || at('keyword', 'desc')) {
      eat();
      if (end()) return ['LIMIT', ';'];
    }
  }

  if (isSelect && at('keyword', 'limit')) {
    eat();
    if (end()) return ['10', '50'];
    if (!at('number')) return [];
    eat();
    if (end()) return [';'];
  }

  if (at('semicolon')) {
    eat();
    return [];
  }

  if (end()) return isSelect ? ['ORDER BY', 'LIMIT', ';'] : [';'];
  return [];
}

export function suggest(input: string, venues: string[]): Suggestion[] {
  const partialMatch = input.match(/[a-zA-Z_äöüÄÖÜß]+$/);
  const partial = partialMatch ? partialMatch[0] : '';
  const base = partial ? input.slice(0, -partial.length) : input;

  let tokens: Token[];
  try {
    tokens = lex(base);
  } catch {
    return [];
  }

  const candidates = expectations(tokens, venues);
  const filtered = partial
    ? candidates.filter(c => c.toLowerCase().startsWith(partial.toLowerCase()))
    : candidates;
  return filtered.map(text => ({ text, replaceLast: partial.length > 0 }));
}
