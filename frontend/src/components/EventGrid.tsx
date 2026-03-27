import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { EventData } from '../../../shared/types/events';
import EventCard from './EventCard';
import './EventGrid.css';

gsap.registerPlugin(ScrollTrigger);

interface EventGridProps {
  events: EventData[];
  loading: boolean;
}

function getFeaturedIndex(events: EventData[]): number {
  const withImage = events.findIndex(e => !!e.imageUrl);
  return withImage >= 0 ? withImage : 0;
}

const SKELETON_COUNT = 6;

const EventGrid: React.FC<EventGridProps> = ({ events, loading }) => {
  useEffect(() => {
    if (events.length === 0) return;

    const timer = setTimeout(() => {
      const cards = document.querySelectorAll('.event-grid__card');
      cards.forEach((card, i) => {
        gsap.fromTo(card,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            delay: i * 0.05,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 90%',
              once: true
            }
          }
        );
      });
    }, 50);

    return () => {
      clearTimeout(timer);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [events]);

  if (loading) {
    return (
      <div className="event-grid">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <div
            key={i}
            className={`event-grid__skeleton${i === 0 ? ' event-grid__skeleton--featured' : ''}`}
          />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return <div className="event-grid__empty">Keine Events gefunden</div>;
  }

  const featuredIndex = getFeaturedIndex(events);

  return (
    <div className="event-grid">
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
