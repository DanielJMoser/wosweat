import { VENUE_CONFIG } from '../config/venues';
import './ViewControls.css';

export type View = 'cards' | 'list' | 'console';

interface ViewControlsProps {
  venueFilter: string[];
  onVenueFilterChange: (venues: string[]) => void;
  view: View;
  onViewChange: (view: View) => void;
}

const ViewControls: React.FC<ViewControlsProps> = ({
  venueFilter,
  onVenueFilterChange,
  view,
  onViewChange,
}) => {
  const toggleVenue = (key: string) => {
    const next = venueFilter.includes(key)
      ? venueFilter.filter(v => v !== key)
      : [...venueFilter, key];
    onVenueFilterChange(next);
  };

  return (
    <div className="view-controls">
      <nav className="view-controls__chips" aria-label="Venue-Filter">
        <button
          className={`view-controls__chip${venueFilter.length === 0 ? ' view-controls__chip--on' : ''}`}
          onClick={() => onVenueFilterChange([])}
          aria-pressed={venueFilter.length === 0}
        >
          Alle
        </button>
        {Object.keys(VENUE_CONFIG).map(key => (
          <button
            key={key}
            className={`view-controls__chip${venueFilter.includes(key) ? ' view-controls__chip--on' : ''}`}
            onClick={() => toggleVenue(key)}
            aria-pressed={venueFilter.includes(key)}
          >
            {key}
          </button>
        ))}
      </nav>
      <div className="view-controls__toggle" role="group" aria-label="Ansicht">
        <button
          onClick={() => onViewChange('cards')}
          aria-pressed={view === 'cards'}
          className={view === 'cards' ? 'view-controls__toggle-btn--on' : ''}
        >
          KARTEN
        </button>
        <button
          onClick={() => onViewChange('list')}
          aria-pressed={view === 'list'}
          className={view === 'list' ? 'view-controls__toggle-btn--on' : ''}
        >
          LISTE
        </button>
        <button
          onClick={() => onViewChange('console')}
          aria-pressed={view === 'console'}
          className={view === 'console' ? 'view-controls__toggle-btn--on' : ''}
        >
          KONSOLE
        </button>
      </div>
    </div>
  );
};

export default ViewControls;
