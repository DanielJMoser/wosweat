import { useRef, useEffect, useMemo } from 'react';
import './DateStrip.css';

interface DateStripProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  monthGridOpen: boolean;
  onToggleMonthGrid: () => void;
}

const DAY_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const FULL_DATE = new Intl.DateTimeFormat('de-AT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

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
}) => {
  const todayRef = useRef<HTMLButtonElement>(null);
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const days = useMemo(() => buildDays(today), [today]);

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
            const isToday = iso === today;
            const isSelected = iso === selectedDate;
            const isPast = iso < today;

            let className = 'date-pill';
            if (isToday && isSelected) className += ' date-pill--today-selected';
            else if (isSelected) className += ' date-pill--selected';
            else if (isPast) className += ' date-pill--past';

            return (
              <button
                key={iso}
                ref={isToday ? todayRef : undefined}
                className={className}
                onClick={() => onDateSelect(iso)}
                aria-label={FULL_DATE.format(d)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
              >
                <span className="date-pill-day">{DAY_ABBR[dayIdx]}</span>
                <span className="date-pill-num">{dayNum}</span>
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
