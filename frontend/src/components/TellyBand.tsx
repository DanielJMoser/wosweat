import { useState } from 'react';
import type { EventData } from '../../../shared/types/events';
import { getVenueConfig } from '../config/venues';
import './TellyBand.css';

interface TellyBandProps {
  events: EventData[];
}

const TellyBand: React.FC<TellyBandProps> = ({ events }) => {
  const [paused, setPaused] = useState(false);
  const items = events.map(
    e => `${getVenueConfig(e.venue).displayName.toUpperCase()}: ${(e.title ?? '').toUpperCase()}`,
  );
  const text = items.length ? items.join(' ★ ') + ' ★ ' : 'HEUTE NIX — SCHAU MORGEN';

  return (
    <section className="telly" aria-label="Events des ausgewählten Tages (Laufband)">
      <div className={`telly__track${paused ? ' telly__track--paused' : ''}${items.length === 0 ? ' telly__track--static' : ''}`}>
        <span className="telly__copy">{text}</span>
        {items.length > 0 && <span className="telly__copy" aria-hidden="true">{text}</span>}
      </div>
      <button
        className="telly__pause"
        onClick={() => setPaused(p => !p)}
        aria-pressed={paused}
        aria-label="Laufband pausieren"
      >
        {paused ? '▶' : '⏸'}
      </button>
    </section>
  );
};

export default TellyBand;
