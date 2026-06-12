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
    else throw new WqlError('Abfrage muss mit SELECT oder EXPORT beginnen', this.pos());
    if (this.peek()?.type === 'semicolon') this.next();
    const rest = this.peek();
    if (rest) throw new WqlError(`Unerwartetes '${rest.value}' nach Abfrageende`, rest.pos);
    return query;
  }

  private select(): SelectQuery {
    this.expectKeyword('select');
    const star = this.next();
    if (star?.type !== 'star') {
      throw new WqlError("'*' erwartet (nur SELECT * wird unterstützt)", star?.pos ?? this.pos());
    }
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
      if (limit < 1 || limit > MAX_LIMIT) {
        throw new WqlError(`LIMIT muss zwischen 1 und ${MAX_LIMIT} liegen`, n.pos);
      }
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
      if (++this.depth > MAX_DEPTH) {
        throw new WqlError(`Zu tief verschachtelt (max. ${MAX_DEPTH})`, this.pos());
      }
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
      const lp = this.next();
      const rp = this.next();
      if (lp?.type !== 'lparen' || rp?.type !== 'rparen') {
        throw new WqlError('today() erwartet', t.pos);
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
