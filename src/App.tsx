import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

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
        </IonReactRouter>
      </EventsProvider>
    </IonApp>
);

export default App;