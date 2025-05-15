import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { calendar, bug, settings } from 'ionicons/icons';

// Import your pages
import EventsPage from './pages/EventsPage';
import DirectEventsPage from './pages/DirectEventsPage';
// Import other pages as needed

/* Import the EventsProvider */
import { EventsProvider } from './context/EventsContext';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
    <IonApp>
      {/* Wrap the entire app with EventsProvider */}
      <EventsProvider>
        <IonReactRouter>
          <IonTabs>
            <IonRouterOutlet>
              <Route exact path="/events">
                <EventsPage />
              </Route>
              <Route exact path="/direct">
                <DirectEventsPage />
              </Route>
              {/* Add other routes as needed */}

              <Route exact path="/">
                <Redirect to="/events" />
              </Route>
            </IonRouterOutlet>
            <IonTabBar slot="bottom">
              <IonTabButton tab="events" href="/events">
                <IonIcon icon={calendar} />
                <IonLabel>Events</IonLabel>
              </IonTabButton>
              <IonTabButton tab="direct" href="/direct">
                <IonIcon icon={bug} />
                <IonLabel>Direct API</IonLabel>
              </IonTabButton>
              {/* Add other tab buttons as needed */}
            </IonTabBar>
          </IonTabs>
        </IonReactRouter>
      </EventsProvider>
    </IonApp>
);

export default App;