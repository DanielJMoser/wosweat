import { useRef, useEffect, useMemo } from 'react';
import './DateStrip.css';

interface DateStripProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  monthGridOpen: boolean;
  onToggleMonthGrid: () => void;
  countsByDate: Map<string, number>;
  todayIso: string;
}

const DAY_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const FULL_DATE = new Intl.DateTimeFormat('de-AT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function countLabel(count: number): string {
  if (count === 0) return 'keine Events';
  if (count === 1) return '1 Event';
  return `${count} Events`;
}

function buildDays(today: string): string[] {
  const base = new Date(today + 'T00:00:00');
  return Array.from({ length: 15 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
}

const DateStrip: React.FC<DateStripProps> = ({
  selectedDate,
  onDateSelect,
  monthGridOpen,
  onToggleMonthGrid,
  countsByDate,
  todayIso,
}) => {
  const todayRef = useRef<HTMLButtonElement>(null);
  const days = useMemo(() => buildDays(todayIso), [todayIso]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    todayRef.current?.scrollIntoView?.({ inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, []);

  return (
    <div className="date-strip">
      <div className="date-strip-inner">
        <div className="date-strip-scroll">
          {days.map((iso) => {
            const d = new Date(iso + 'T00:00:00');
            const dayIdx = d.getDay();
            const dayNum = d.getDate();
            const isToday = iso === todayIso;
            const isSelected = iso === selectedDate;
            const count = countsByDate.get(iso) ?? 0;

            let className = 'date-pill';
            if (isToday) className += ' date-pill--today';
            if (isToday && isSelected) className += ' date-pill--today-selected';
            else if (isSelected) className += ' date-pill--selected';
            else if (!isToday && iso < todayIso) className += ' date-pill--past';

            return (
              <button
                key={iso}
                ref={isToday ? todayRef : undefined}
                className={className}
                onClick={() => onDateSelect(iso)}
                aria-label={`${FULL_DATE.format(d)}, ${countLabel(count)}`}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
              >
                <span className="date-pill-day">{DAY_ABBR[dayIdx]}</span>
                <span className="date-pill-num">{dayNum}</span>
                {count > 0 && <span className="date-pill-count" aria-hidden="true">{count} EV</span>}
              </button>
            );
          })}
        </div>
        <button
          className="date-strip-chevron"
          onClick={onToggleMonthGrid}
          aria-label="Monatsansicht umschalten"
          aria-expanded={monthGridOpen}
          aria-controls="month-grid"
        >
          &#9660;
        </button>
      </div>
    </div>
  );
};

export default DateStrip;
