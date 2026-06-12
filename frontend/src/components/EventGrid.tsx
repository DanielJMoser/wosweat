import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { EventData } from '../../../shared/types/events';
import EventCard from './EventCard';
import './EventGrid.css';

interface EventGridProps {
  events: EventData[];
}

function getFeaturedIndex(events: EventData[]): number {
  const withImage = events.findIndex(e => !!e.imageUrl);
  return withImage >= 0 ? withImage : 0;
}

const EventGrid: React.FC<EventGridProps> = ({ events }) => {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (events.length === 0 || !gridRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cards = gridRef.current.querySelectorAll('.event-grid__card');
    gsap.fromTo(cards,
      { y: 20, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.5,
        stagger: 0.05,
        ease: 'power2.out',
      }
    );

    return () => { gsap.killTweensOf(cards); };
  }, [events]);

  const featuredIndex = getFeaturedIndex(events);

  return (
    <div className="event-grid" ref={gridRef}>
      {events.map((event, i) => {
        const isFeatured = i === featuredIndex;
        return (
          <div
            key={event.id}
            className={`event-grid__card${isFeatured ? ' event-grid__card--featured' : ''}`}
          >
            <EventCard event={event} featured={isFeatured} />
          </div>
        );
      })}
    </div>
  );
};

export default EventGrid;
