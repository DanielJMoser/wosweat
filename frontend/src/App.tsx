import { useEffect, useMemo, useRef, useState } from 'react';
import { IonApp, IonContent, IonRefresher, IonRefresherContent } from '@ionic/react';
import { setupIonicReact } from '@ionic/react';
import { useEvents } from './hooks/useEvents';
import Header from './components/Header';
import DateStrip from './components/DateStrip';
import MonthGrid from './components/MonthGrid';
import DateHeading from './components/DateHeading';
import EventGrid from './components/EventGrid';
import VenueList from './components/VenueList';
import AccessibilityFab from './components/AccessibilityFab';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Ionic Dark Mode */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact({ mode: 'md' });

const App: React.FC = () => {
  const [monthGridOpen, setMonthGridOpen] = useState(false);
  const [venueFilter, setVenueFilter] = useState<string[]>([]);
  const [venueListOpen, setVenueListOpen] = useState(false);
  const venueListRef = useRef<HTMLDivElement>(null);
  const { eventsByDate, allEvents, allEventsByDate, loading, error, refresh, refreshing, selectedDate, setSelectedDate, lastUpdated } = useEvents({ venueFilter });
  const [showError, setShowError] = useState(false);
  useEffect(() => { if (error) setShowError(true); }, [error]);
  const eventsForDate = eventsByDate.get(selectedDate) ?? [];
  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const countsByDate = useMemo(
    () => new Map([...allEventsByDate].map(([k, v]) => [k, v.length])),
    [allEventsByDate],
  );

  const handleVenueListClick = () => {
    setVenueListOpen(true);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    venueListRef.current?.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <IonApp>
      <div className="accent-rail" aria-hidden="true" />
      <Header onVenueListClick={handleVenueListClick} />
      <DateStrip
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        monthGridOpen={monthGridOpen}
        onToggleMonthGrid={() => setMonthGridOpen(prev => !prev)}
        countsByDate={countsByDate}
        todayIso={todayIso}
      />
      <MonthGrid
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        isOpen={monthGridOpen}
        venueFilter={venueFilter}
        onVenueFilterChange={setVenueFilter}
      />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { refresh().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {refreshing && <div className="refresh-progress-bar" />}

        <main style={{ maxWidth: 960, margin: '0 auto', padding: '0 1rem' }}>
          {showError && error && (
            <div className="error-banner" role="alert">
              <div className="error-banner__content">
                <span>Fehler beim Laden</span>
                <button className="error-banner__retry" onClick={() => refresh()}>
                  Erneut versuchen
                </button>
              </div>
              <button
                className="error-banner__dismiss"
                onClick={() => setShowError(false)}
                aria-label="Fehlermeldung schließen"
              >
                ×
              </button>
            </div>
          )}
          {lastUpdated && Date.now() - new Date(lastUpdated).getTime() > 30 * 60 * 60 * 1000 && (
            <div className="stale-hint">
              Daten vom {new Intl.DateTimeFormat('de-AT', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
              }).format(new Date(lastUpdated))}
            </div>
          )}
          <DateHeading date={selectedDate} />
          <EventGrid events={eventsForDate} loading={loading} />
        </main>
        <div ref={venueListRef}>
          <VenueList isOpen={venueListOpen} onToggle={() => setVenueListOpen(v => !v)} />
        </div>
      </IonContent>
      <AccessibilityFab />
    </IonApp>
  );
};

export default App;
