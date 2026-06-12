import { useEffect, useRef, useState } from 'react';
import type { EventData } from '../../../shared/types/events';
import { WqlError } from '../lib/wql/lexer';
import { parse } from '../lib/wql/parser';
import { runQuery } from '../lib/wql/evaluate';
import { buildIcs, downloadIcs } from '../lib/wql/ics';
import { suggest, Suggestion } from '../lib/wql/suggest';
import { VENUE_CONFIG } from '../config/venues';
import './QueryConsole.css';

const VENUE_KEYS = Object.keys(VENUE_CONFIG);

const HELP_LINES = [
  "SELECT * FROM events [WHERE …] [ORDER BY feld [ASC|DESC]] [LIMIT n]",
  'EXPORT ICS [WHERE …]   → lädt die treffer als .ics-kalender herunter',
  'clear                  → konsole leeren',
  "felder: venue, date, title, time · operatoren: = != < <= > >= IN (…) LIKE ('%…%')",
  "datum: today(), today() + 7 · strings in 'einfachen quotes'",
  "beispiel: SELECT * FROM events WHERE venue = 'PMK' AND date <= today() + 7;",
];

interface QueryConsoleProps {
  events: EventData[];
  todayIso: string;
}

interface Entry {
  query: string;
  lines: string[];
  summary: string;
  isError: boolean;
}

const MAX_HISTORY = 50;

const QueryConsole: React.FC<QueryConsoleProps> = ({ events, todayIso }) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [entries]);

  const run = (raw: string) => {
    const command = raw.toLowerCase().replace(/;$/, '').trim();
    if (command === 'clear') {
      setEntries([]);
      return;
    }
    if (command === 'help') {
      setEntries(prev => [...prev.slice(-MAX_HISTORY + 1), {
        query: raw, lines: HELP_LINES, summary: '→ hilfe', isError: false,
      }]);
      return;
    }
    const started = performance.now();
    try {
      const result = runQuery(parse(raw), events, todayIso);
      if (result.kind === 'select') {
        const lines = result.events.slice(0, 50).map(e =>
          `${e.time ? e.time + ' — ' : ''}${e.title ?? ''} [${e.venue ?? 'unbekannt'}]`);
        if (result.total > 50) lines.push(`… ${result.total - 50} weitere`);
        const ms = (performance.now() - started).toFixed(1);
        setEntries(prev => [...prev.slice(-MAX_HISTORY + 1), {
          query: raw, lines, summary: `→ ${result.total} events (${ms} ms, lokal)`, isError: false,
        }]);
      } else {
        const ics = buildIcs(result.events, new Date().toISOString());
        if (!ics) {
          setEntries(prev => [...prev.slice(-MAX_HISTORY + 1), {
            query: raw, lines: [], summary: '→ 0 events — kein Download', isError: false,
          }]);
        } else {
          const name = `wosweat-${todayIso.replace(/-/g, '')}-${result.events.length}events.ics`;
          downloadIcs(ics, name);
          setEntries(prev => [...prev.slice(-MAX_HISTORY + 1), {
            query: raw, lines: [], summary: `→ ${name} (${result.events.length} events) ↓`, isError: false,
          }]);
        }
      }
    } catch (err) {
      const summary = err instanceof WqlError
        ? `✗ ${err.message} (Position ${err.pos})`
        : '✗ Abfrage konnte nicht verarbeitet werden';
      setEntries(prev => [...prev.slice(-MAX_HISTORY + 1), { query: raw, lines: [], summary, isError: true }]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;
    run(raw);
    setInput('');
    setHistIdx(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (entries.length === 0) return;
    e.preventDefault();
    const idx = histIdx === null
      ? (e.key === 'ArrowUp' ? entries.length - 1 : null)
      : e.key === 'ArrowUp'
        ? Math.max(0, histIdx - 1)
        : histIdx + 1 >= entries.length ? null : histIdx + 1;
    setHistIdx(idx);
    setInput(idx === null ? '' : entries[idx]?.query ?? '');
  };

  const latest = entries[entries.length - 1];
  const suggestions = suggest(input, VENUE_KEYS);
  const inputRef = useRef<HTMLInputElement>(null);

  const applySuggestion = (s: Suggestion) => {
    const base = s.replaceLast ? input.replace(/[a-zA-Z_äöüÄÖÜß]+$/, '') : input;
    const needsSpace = base.length > 0 && !base.endsWith(' ');
    setInput(`${base}${needsSpace ? ' ' : ''}${s.text}${s.text === ';' ? '' : ' '}`);
    inputRef.current?.focus();
  };

  return (
    <section className="console" aria-label="Query-Konsole">
      <div className="console__chrome">
        <span className="console__dot" aria-hidden="true" />
        <span className="console__dot" aria-hidden="true" />
        <span className="console__dot" aria-hidden="true" />
        wosweat query console
        <span className="console__status">● 100% lokal — kein server, kein eval</span>
      </div>
      <div className="console__body">
        <div className="console__comment">
          -- filtere events, exportiere kalender. nur lesend, läuft komplett im browser.
        </div>
        <div className="console__log" ref={logRef} role="log" aria-label="Abfrage-Ausgabe" tabIndex={0}>
          {entries.map((entry, i) => (
            <div key={i} className="console__entry">
              <div className="console__echo"><span className="console__prompt">wql&gt;</span> {entry.query}</div>
              {entry.lines.map((line, j) => (
                <div key={j} className="console__line">{line}</div>
              ))}
              <div className={entry.isError ? 'console__err' : 'console__ok'}>{entry.summary}</div>
            </div>
          ))}
        </div>
        <div className="visually-hidden" role="status" aria-live="polite">
          {latest ? latest.summary : ''}
        </div>
        <form className="console__form" onSubmit={handleSubmit}>
          <span className="console__prompt" aria-hidden="true">wql&gt;</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="WQL-Abfrage"
            autoComplete="off"
            spellCheck={false}
            maxLength={300}
            placeholder="SELECT * FROM events WHERE venue = 'PMK';  (help für hilfe)"
          />
        </form>
        {suggestions.length > 0 && (
          <div className="console__suggest" role="group" aria-label="Vorschläge">
            {suggestions.map(s => (
              <button
                key={s.text}
                type="button"
                className="console__chip"
                onClick={() => applySuggestion(s)}
              >
                {s.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default QueryConsole;
