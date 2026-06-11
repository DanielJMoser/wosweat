import { useState, useRef, useEffect, useCallback } from 'react';
import type { EventData } from '../../../shared/types/events';
import { getVenueConfig } from '../config/venues';
import QuickPeek from './QuickPeek';
import './EventCard.css';

interface EventCardProps {
  event: EventData;
  featured?: boolean;
}

const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD = 10;

const EventCard: React.FC<EventCardProps> = ({ event, featured }) => {
  const venue = getVenueConfig(event.venue);
  const isAlt = venue.accent === 'lavender';
  const hasImage = !!event.imageUrl;

  const [showPeek, setShowPeek] = useState(false);
  const preventClick = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const hidePeek = useCallback(() => {
    setShowPeek(false);
    preventClick.current = false;
  }, []);

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    if (!showPeek) return;

    const dismiss = (e: Event) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        hidePeek();
      }
    };

    const dismissBack = () => hidePeek();

    document.addEventListener('click', dismiss, true);
    document.addEventListener('ionBackButton', dismissBack);

    return () => {
      document.removeEventListener('click', dismiss, true);
      document.removeEventListener('ionBackButton', dismissBack);
    };
  }, [showPeek, hidePeek]);

  useEffect(() => {
    return cancelLongPress;
  }, []);

  const openEvent = () => {
    window.open(event.url, '_blank', 'noopener');
  };

  const handleClick = () => {
    if (preventClick.current) {
      preventClick.current = false;
      return;
    }
    openEvent();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') openEvent();
    if (e.key === 'Escape') hidePeek();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => {
      setShowPeek(true);
      preventClick.current = true;
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
      cancelLongPress();
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    touchStart.current = null;
  };

  return (
    <div
      ref={cardRef}
      className={`event-card${featured ? ' event-card--featured' : ''}`}
      style={!hasImage ? { background: venue.gradient } : undefined}
      role="link"
      tabIndex={0}
      aria-label={`${event.title} — ${venue.displayName}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setShowPeek(true)}
      onMouseLeave={hidePeek}
      onFocus={() => setShowPeek(true)}
      onBlur={hidePeek}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {hasImage ? (
        <img
          className="event-card__img"
          src={event.imageUrl}
          alt={event.title}
          loading="lazy"
        />
      ) : (
        <div className="event-card__placeholder">
          <span className="event-card__initial">
            {event.title?.charAt(0) ?? ''}
          </span>
        </div>
      )}

      <div className="event-card__gradient" />
      <div className="event-card__hover" />

      <div className="event-card__content">
        <div className={`event-card__venue${isAlt ? ' event-card__venue--alt' : ''}`}>
          {venue.displayName}
        </div>
        <div className="event-card__title" role="heading" aria-level={3}>{event.title}</div>
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

      <QuickPeek event={event} visible={showPeek} />
    </div>
  );
};

export default EventCard;
