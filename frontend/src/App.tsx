import { IonApp, IonContent } from '@ionic/react';
import { setupIonicReact } from '@ionic/react';
import { useEvents } from './hooks/useEvents';
import Header from './components/Header';
import DateStrip from './components/DateStrip';
import DateHeading from './components/DateHeading';
import EventGrid from './components/EventGrid';

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
  const { eventsByDate, loading, selectedDate, setSelectedDate } = useEvents();
  const eventsForDate = eventsByDate.get(selectedDate) ?? [];

  return (
    <IonApp>
      <Header onVenueListClick={() => {}} />
      <DateStrip
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        onToggleMonthGrid={() => {}}
      />
      <IonContent>
        <main style={{ maxWidth: 960, margin: '0 auto', padding: '0 1rem' }}>
          <DateHeading date={selectedDate} />
          <EventGrid events={eventsForDate} loading={loading} />
        </main>
      </IonContent>
    </IonApp>
  );
};

export default App;
