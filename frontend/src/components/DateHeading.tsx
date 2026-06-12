import './DateHeading.css';

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

interface DateHeadingProps {
  date: string;
  eventCount: number;
  venueCount: number;
  isToday: boolean;
}

const DateHeading: React.FC<DateHeadingProps> = ({ date, eventCount, venueCount, isToday }) => {
  const d = new Date(date + 'T00:00:00');
  const weekday = WEEKDAYS[d.getDay()];
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];

  return (
    <div className="date-heading">
      {isToday && <span className="date-heading-stamp" aria-hidden="true">heute!</span>}
      <div role="heading" aria-level={2}>
        <span className="date-heading-weekday">{weekday}</span>
        <span className="date-heading-date">
          {day}. <span className="date-heading-month">{month}</span>
        </span>
      </div>
      {eventCount > 0 && (
        <p className="date-heading-meta" aria-hidden="true">
          {eventCount} EVENTS <b>///</b> {venueCount} VENUES
        </p>
      )}
    </div>
  );
};

export default DateHeading;
