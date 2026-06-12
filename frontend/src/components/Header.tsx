import './Header.css';

interface HeaderProps {
  onVenueListClick: () => void;
}

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

const Header: React.FC<HeaderProps> = ({ onVenueListClick }) => (
  <header className="header-bar">
    <div className="header-inner">
      <span className="header-wordmark" role="heading" aria-level={1}>wosweat</span>
      <div className="header-right">
        <span className="header-artifact" aria-hidden="true">
          S.{String(dayOfYear()).padStart(2, '0')} — INNSBRUCK
        </span>
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
    </div>
  </header>
);

export default Header;
