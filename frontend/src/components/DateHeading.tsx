import './DateHeading.css';

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

interface DateHeadingProps {
  date: string;
}

const DateHeading: React.FC<DateHeadingProps> = ({ date }) => {
  const d = new Date(date);
  const weekday = WEEKDAYS[d.getDay()];
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];

  return (
    <div className="date-heading">
      <div className="date-heading-weekday">{weekday}</div>
      <div className="date-heading-date">
        {day}. <span className="date-heading-month">{month}</span>
      </div>
    </div>
  );
};

export default DateHeading;
