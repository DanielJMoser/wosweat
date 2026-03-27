import type { EventData } from '../../../shared/types/events';

interface QuickPeekProps {
  event: EventData;
  visible: boolean;
}

const QuickPeek: React.FC<QuickPeekProps> = ({ event, visible }) => {
  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(event.url, '_blank', 'noopener');
  };

  return (
    <div className={`quick-peek${visible ? ' quick-peek--visible' : ''}`}>
      {event.description && (
        <p className="quick-peek__description">{event.description}</p>
      )}
      <span className="quick-peek__venue">{event.venue ?? 'Unbekannt'}</span>
      <button className="quick-peek__link" onClick={handleLinkClick}>
        Zur Website →
      </button>
    </div>
  );
};

export default QuickPeek;
