import { useMemo } from 'react';
import { VENUE_CONFIG } from '../config/venues';
import './MonthGrid.css';

interface MonthGridProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  isOpen: boolean;
  venueFilter: string[];
  onVenueFilterChange: (venues: string[]) => void;
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const DAY_ABBR = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMondayOffset(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const MonthGrid: React.FC<MonthGridProps> = ({
  selectedDate,
  onDateSelect,
  isOpen,
  venueFilter,
  onVenueFilterChange,
}) => {
  const today = useMemo(() => toISO(new Date()), []);
  const viewDate = new Date(selectedDate + 'T00:00:00');
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const { offset, daysInMonth } = useMemo(() => ({
    offset: getMondayOffset(viewYear, viewMonth),
    daysInMonth: new Date(viewYear, viewMonth + 1, 0).getDate(),
  }), [viewYear, viewMonth]);

  const navigateMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    onDateSelect(toISO(d));
  };

  const toggleVenue = (key: string) => {
    const next = venueFilter.includes(key)
      ? venueFilter.filter(v => v !== key)
      : [...venueFilter, key];
    onVenueFilterChange(next);
  };

  return (
    <div id="month-grid" className={`month-grid${isOpen ? ' month-grid--open' : ''}`} inert={!isOpen}>
      <div className="month-grid__inner">
        <div className="month-grid__header">
          <button className="month-grid__nav" onClick={() => navigateMonth(-1)} aria-label="Voriger Monat">
            &#9664;
          </button>
          <span className="month-grid__header-title">
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button className="month-grid__nav" onClick={() => navigateMonth(1)} aria-label="Nächster Monat">
            &#9654;
          </button>
        </div>

        <div className="month-grid__days">
          {DAY_ABBR.map(d => (
            <span key={d} className="month-grid__day-label">{d}</span>
          ))}
        </div>

        <div className="month-grid__cells">
          {Array.from({ length: offset }, (_, i) => (
            <span key={`pad-${i}`} className="month-grid__cell month-grid__cell--outside" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isToday = iso === today;
            const isSelected = iso === selectedDate && !isToday;
            const isPast = iso < today;

            let className = 'month-grid__cell';
            if (isToday) className += ' month-grid__cell--today';
            if (isSelected) className += ' month-grid__cell--selected';
            if (isPast && !isToday) className += ' month-grid__cell--past';

            return (
              <button
                key={iso}
                className={className}
                onClick={() => onDateSelect(iso)}
                aria-label={`${dayNum}. ${MONTHS[viewMonth]} ${viewYear}`}
                aria-pressed={iso === selectedDate}
                aria-current={isToday ? 'date' : undefined}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        <div className="month-grid__filters">
          <div className="month-grid__filters-label">Venues</div>
          <div className="month-grid__chips">
            {Object.entries(VENUE_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                className={`month-grid__chip${venueFilter.includes(key) ? ' month-grid__chip--active' : ''}`}
                onClick={() => toggleVenue(key)}
                aria-pressed={venueFilter.includes(key)}
              >
                {cfg.displayName}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthGrid;
