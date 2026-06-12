import type { EventData } from '../../../shared/types/events';
import { getVenueConfig } from '../config/venues';
import './EventList.css';

interface EventListProps {
  events: EventData[];
}

const openEvent = (url: string) => {
  window.open(url, '_blank', 'noopener');
};

const EventList: React.FC<EventListProps> = ({ events }) => {
  const hasTimes = events.some(e => !!e.time);
  return (
    <div className={`event-list${hasTimes ? '' : ' event-list--no-times'}`}>
      {events.map((event, i) => {
        const venue = getVenueConfig(event.venue);
        return (
          <div
            key={event.id}
            className={`event-list__row${i === 0 ? ' event-list__row--feat' : ''}`}
            role="link"
            tabIndex={0}
            aria-label={`${event.title} — ${venue.displayName}`}
            onClick={() => openEvent(event.url)}
            onKeyDown={(e) => { if (e.key === 'Enter') openEvent(event.url); }}
          >
            <span className="event-list__meta">
              {hasTimes && <span className="event-list__time">{event.time ?? ''}</span>}
              <span className="event-list__venue">{venue.displayName}</span>
            </span>
            <span className="event-list__title" role="heading" aria-level={3}>
              {event.title}
{/*
              {i === 0 && <span className="event-list__mk" aria-hidden="true"> heißer tipp!</span>}
*/}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default EventList;
