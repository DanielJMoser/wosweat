import { useEffect, useMemo, useRef, useState } from 'react';
import { IonApp, IonContent, IonRefresher, IonRefresherContent } from '@ionic/react';
import { setupIonicReact } from '@ionic/react';
import { useEvents } from './hooks/useEvents';
import Header from './components/Header';
import DateStrip from './components/DateStrip';
import MonthGrid from './components/MonthGrid';
import DateHeading from './components/DateHeading';
import EventGrid from './components/EventGrid';
import EventList from './components/EventList';
import QueryConsole from './components/QueryConsole';
import VenueList from './components/VenueList';
import ViewControls, { View } from './components/ViewControls';
import AccessibilityFab from './components/AccessibilityFab';
import TellyBand from './components/TellyBand';
import Impressum from './components/Impressum';

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
  const [view, setView] = useState<View>(() => {
    try {
      const stored = localStorage.getItem('wosweat-view');
      return stored === 'cards' || stored === 'console' ? stored : 'list';
    } catch { return 'list'; }
  });
  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem('wosweat-view', v); } catch { /* private mode */ }
  };
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
      />
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { refresh().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {refreshing && <div className="refresh-progress-bar" />}

        <main className="app-main">
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
          <DateHeading
            date={selectedDate}
            eventCount={eventsForDate.length}
            venueCount={new Set(eventsForDate.map(e => e.venue).filter(Boolean)).size}
            isToday={selectedDate === todayIso}
          />
          <ViewControls
            venueFilter={venueFilter}
            onVenueFilterChange={setVenueFilter}
            view={view}
            onViewChange={changeView}
          />
          {view === 'console' ? (
            <QueryConsole events={allEvents} todayIso={todayIso} />
          ) : loading ? (
            <div className="event-grid" role="status" aria-label="Events werden geladen">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className={`event-grid__skeleton${i === 0 ? ' event-grid__skeleton--featured' : ''}`}
                />
              ))}
            </div>
          ) : eventsForDate.length === 0 ? (
            <div className="event-grid__empty">Keine Events gefunden</div>
          ) : view === 'list' ? (
            <EventList events={eventsForDate} />
          ) : (
            <EventGrid events={eventsForDate} />
          )}
        </main>
        <div ref={venueListRef}>
          <VenueList isOpen={venueListOpen} onToggle={() => setVenueListOpen(v => !v)} />
          <Impressum />
        </div>
      </IonContent>
      <AccessibilityFab />
      {!loading && <TellyBand events={eventsForDate} />}
    </IonApp>
  );
};

export default App;
