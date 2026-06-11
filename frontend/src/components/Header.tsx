import './Header.css';

interface HeaderProps {
  onVenueListClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onVenueListClick }) => (
  <header className="header-bar">
    <div className="header-inner">
      <span className="header-wordmark">wosweat</span>
      <button
        className="header-venue-btn"
        onClick={onVenueListClick}
        aria-label="Zur Venue-Liste"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2" y="4" width="7" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="7" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <line x1="5.5" y1="4" x2="5.5" y2="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  </header>
);

export default Header;
