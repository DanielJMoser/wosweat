import { useEffect, useRef, useState } from 'react';
import type { EventData } from '../../../shared/types/events';
import { WqlError } from '../lib/wql/lexer';
import { parse } from '../lib/wql/parser';
import { runQuery } from '../lib/wql/evaluate';
import { buildIcs, downloadIcs } from '../lib/wql/ics';
import './QueryConsole.css';

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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="WQL-Abfrage"
            autoComplete="off"
            spellCheck={false}
            maxLength={300}
            placeholder="SELECT * FROM events WHERE venue = 'PMK';"
          />
        </form>
      </div>
    </section>
  );
};

export default QueryConsole;
