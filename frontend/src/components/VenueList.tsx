import { VENUE_CONFIG } from '../config/venues';
import './VenueList.css';

interface VenueListProps {
  isOpen: boolean;
  onToggle: () => void;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const venues = Object.values(VENUE_CONFIG).filter(v => v.url);

const VenueList: React.FC<VenueListProps> = ({ isOpen, onToggle }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <section className="venue-list">
      <div
        className="venue-list__header"
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
      >
        <h2>Venues</h2>
        <span className={isOpen ? 'venue-list__chevron--open' : ''} aria-hidden="true">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>
      <div className={`venue-list__content${isOpen ? ' venue-list__content--open' : ''}`} inert={!isOpen}>
        <div className="venue-list__inner">
          {venues.map(venue => (
            <div className="venue-list__item" key={venue.displayName}>
              <div className="venue-list__accent" style={{ background: venue.gradient }} />
              <div className="venue-list__info">
                <span className="venue-list__name">{venue.displayName}</span>
                <a
                  className="venue-list__link"
                  href={venue.url}
                  target="_blank"
                  rel="noopener"
                >
                  {extractDomain(venue.url)}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default VenueList;
