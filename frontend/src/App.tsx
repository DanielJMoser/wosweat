import { IonApp, IonContent } from '@ionic/react';
import { setupIonicReact } from '@ionic/react';
import { useEvents } from './hooks/useEvents';

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
  const { events, loading, error } = useEvents();

  return (
    <IonApp>
      <IonContent>
        <main style={{ maxWidth: 960, margin: '0 auto', padding: '0 1rem' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--ctp-text)', paddingTop: '2rem' }}>wosweat</p>
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--ctp-subtext0)' }}>
            {error ? `Error: ${error}` : loading ? 'Loading...' : `${events.length} events loaded`}
          </p>
        </main>
      </IonContent>
    </IonApp>
  );
};

export default App;
