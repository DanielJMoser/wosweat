import { useRef, useEffect, useMemo } from 'react';
import './DateStrip.css';

interface DateStripProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onToggleMonthGrid: () => void;
}

const DAY_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function buildDays(today: string): string[] {
  const base = new Date(today + 'T00:00:00');
  return Array.from({ length: 15 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

const DateStrip: React.FC<DateStripProps> = ({
  selectedDate,
  onDateSelect,
  onToggleMonthGrid,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const days = useMemo(() => buildDays(today), [today]);

  useEffect(() => {
    todayRef.current?.scrollIntoView({ inline: 'center', behavior: 'smooth' });
  }, []);

  return (
    <div className="date-strip">
      <div className="date-strip-inner">
        <div className="date-strip-scroll" ref={scrollRef}>
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
          aria-label="Toggle month grid"
        >
          &#9660;
        </button>
      </div>
    </div>
  );
};

export default DateStrip;
