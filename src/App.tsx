import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

import EventsPage from './pages/EventsPage';
import DirectEventsPage from './pages/DirectEventsPage';
import { EventsProvider } from './context/EventsContext';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
    <IonApp>
      <EventsProvider>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route exact path="/events">
              <EventsPage />
            </Route>
            <Route exact path="/direct">
              <DirectEventsPage />
            </Route>
            <Route exact path="/">
              <Redirect to="/events" />
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      </EventsProvider>
    </IonApp>
);

export default App;
