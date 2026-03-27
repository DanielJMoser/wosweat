import type { EventData } from '../../../shared/types/events';
import { getVenueConfig } from '../config/venues';
import './EventCard.css';

interface EventCardProps {
  event: EventData;
  featured?: boolean;
  onClick?: () => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, featured, onClick }) => {
  const venue = getVenueConfig(event.venue);
  const isAlt = venue.accent === 'lavender';
  const hasImage = !!event.imageUrl;

  const handleClick = () => {
    if (onClick) return onClick();
    window.open(event.url, '_blank', 'noopener');
  };

  return (
    <div
      className={`event-card${featured ? ' event-card--featured' : ''}`}
      style={!hasImage ? { background: venue.gradient } : undefined}
      onClick={handleClick}
    >
      {hasImage ? (
        <img
          className="event-card__img"
          src={event.imageUrl}
          alt={event.title}
          loading="lazy"
        />
      ) : (
        <span className="event-card__initial">
          {event.title?.charAt(0) ?? ''}
        </span>
      )}

      <div className="event-card__gradient" />
      <div className="event-card__hover" />

      <div className="event-card__content">
        <div className={`event-card__venue${isAlt ? ' event-card__venue--alt' : ''}`}>
          {venue.displayName}
        </div>
        <div className="event-card__title">{event.title}</div>
        {(event.time || event.tags?.length) && (
          <div className="event-card__meta">
            {event.time && (
              <span className={`event-card__time${isAlt ? ' event-card__time--alt' : ''}`}>
                {event.time}
              </span>
            )}
            {event.tags?.map(tag => (
              <span key={tag} className="event-card__tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCard;
