import React, { useEffect, useState } from 'react';
import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonIcon,
    IonList,
    IonLoading,
    IonPage,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonTitle,
    IonToast,
    IonToolbar,
    RefresherEventDetail
} from '@ionic/react';
import { calendar, location, refresh, bug } from 'ionicons/icons';
import { EventData } from '../../shared/types/events';
import { formatDate } from '../utils/date-utils';
import './EventsPage.scss';

const DirectEventsPage: React.FC = () => {
    const [events, setEvents] = useState<EventData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [searchText, setSearchText] = useState<string>('');
    const [showToast, setShowToast] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchEvents = async (forceRefresh = false) => {
        setLoading(true);
        setError(null);

        try {
            const url = forceRefresh
                ? '/.netlify/functions/get-events?refresh=true'
                : '/.netlify/functions/get-events';

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch events: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch events');
            }

            if (!data.events || !Array.isArray(data.events)) {
                throw new Error('Invalid response format');
            }

            setEvents(data.events);
            setLastUpdated(new Date());
            setToastMessage(forceRefresh ? 'Events refreshed' : 'Events loaded');
            setShowToast(true);
        } catch (error) {
            console.error('Error fetching events:', error);
            setError(error instanceof Error ? error.message : 'Unknown error');

            try {
                const testResponse = await fetch('/.netlify/functions/test-events');
                if (testResponse.ok) {
                    const testData = await testResponse.json();
                    if (testData.events && testData.events.length > 0) {
                        setEvents(testData.events);
                        setLastUpdated(new Date());
                        setToastMessage('Test events loaded as fallback');
                        setShowToast(true);
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
        try {
            await fetchEvents(true);
        } finally {
            event.detail.complete();
        }
    };

    const handleManualUpdate = async () => {
        try {
            await fetchEvents(true);
        } catch (error) {
            console.error('Manual update failed:', error);
        }
    };

    const handleDebug = async () => {
        setToastMessage('Checking API status...');
        setShowToast(true);

        try {
            const testResponse = await fetch('/.netlify/functions/test-events');
            const testData = await testResponse.json();

            if (testData.events && testData.events.length > 0) {
                setEvents(testData.events);
                setLastUpdated(new Date());
                setToastMessage(`Loaded ${testData.events.length} test events`);
                setShowToast(true);
                return;
            }

            const response = await fetch('/.netlify/functions/get-events?refresh=true');
            const data = await response.json();

            if (data.events && data.events.length > 0) {
                setEvents(data.events);
                setLastUpdated(new Date());
                setToastMessage(`Loaded ${data.events.length} events`);
                setShowToast(true);
            } else {
                setToastMessage('No events found in API response');
                setShowToast(true);
            }
        } catch (error) {
            console.error('Debug check failed:', error);
            setToastMessage('API check failed. See console for details.');
            setShowToast(true);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const filteredEvents = events.filter(event => {
        if (!searchText) return true;
        const searchLower = searchText.toLowerCase();

        return (
            event.title?.toLowerCase().includes(searchLower) ||
            event.description?.toLowerCase().includes(searchLower) ||
            (event.venue && event.venue.toLowerCase().includes(searchLower))
        );
    });

    const sortedEvents = [...filteredEvents].sort((a, b) => {
        const dateA = new Date(a.date).getTime() || 0;
        const dateB = new Date(b.date).getTime() || 0;
        return dateA - dateB;
    });

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Events (Direct API)</IonTitle>
                    <IonButton slot="end" onClick={handleManualUpdate} disabled={loading}>
                        <IonIcon slot="start" icon={refresh} />
                        Update
                    </IonButton>
                    <IonButton slot="end" onClick={handleDebug} color="medium">
                        <IonIcon slot="start" icon={bug} />
                        Debug
                    </IonButton>
                </IonToolbar>
            </IonHeader>
            <IonContent>
                <div className="ion-padding">
                    <p>
                        <strong>Status:</strong> {loading ? 'Loading...' : 'Ready'} |
                        <strong> Events:</strong> {events.length} |
                        <strong> Last updated:</strong> {lastUpdated?.toLocaleString() || 'Never'}
                    </p>
                </div>

                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent></IonRefresherContent>
                </IonRefresher>

                <IonSearchbar
                    value={searchText}
                    onIonChange={e => setSearchText(e.detail.value || '')}
                    placeholder="Search events..."
                />

                <IonLoading isOpen={loading} message="Loading events..." />

                {error && (
                    <div className="ion-padding ion-text-center">
                        <h3>Error loading events</h3>
                        <p>{error}</p>
                        <IonButton onClick={() => fetchEvents(true)}>Retry</IonButton>
                    </div>
                )}

                {!loading && !error && sortedEvents.length === 0 && (
                    <div className="ion-padding ion-text-center">
                        <h3>No events found</h3>
                        <p>Try updating the events or clearing your search.</p>
                        <IonButton onClick={() => fetchEvents(true)}>Refresh Events</IonButton>
                    </div>
                )}

                {!loading && sortedEvents.length > 0 && (
                    <div className="ion-padding">
                        <IonList>
                            {sortedEvents.map((event) => (
                                <IonCard key={event.id} href={event.url} target="_blank">
                                    <IonCardHeader>
                                        <IonCardSubtitle>
                                            <IonIcon icon={calendar} /> {formatDate(event.date)}
                                            {event.venue && (
                                                <span>
                                                    <IonIcon icon={location} /> {event.venue}
                                                </span>
                                            )}
                                        </IonCardSubtitle>
                                        <IonCardTitle>{event.title}</IonCardTitle>
                                    </IonCardHeader>
                                    <IonCardContent>
                                        <p>{event.description}</p>
                                    </IonCardContent>
                                </IonCard>
                            ))}
                        </IonList>
                    </div>
                )}

                <IonToast
                    isOpen={showToast}
                    onDidDismiss={() => setShowToast(false)}
                    message={toastMessage}
                    duration={2000}
                />
            </IonContent>
        </IonPage>
    );
};

export default DirectEventsPage;
