import { useRef, useState } from 'react';
import { IonApp, IonContent } from '@ionic/react';
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
  const { eventsByDate, loading, selectedDate, setSelectedDate } = useEvents({ venueFilter });
  const eventsForDate = eventsByDate.get(selectedDate) ?? [];

  const handleVenueListClick = () => {
    setVenueListOpen(true);
    venueListRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <IonApp>
      <Header onVenueListClick={handleVenueListClick} />
      <DateStrip
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        onToggleMonthGrid={() => setMonthGridOpen(prev => !prev)}
      />
      <MonthGrid
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        isOpen={monthGridOpen}
        venueFilter={venueFilter}
        onVenueFilterChange={setVenueFilter}
      />
      <IonContent>
        <main style={{ maxWidth: 960, margin: '0 auto', padding: '0 1rem' }}>
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
