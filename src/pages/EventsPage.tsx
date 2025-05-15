import React, { useState } from 'react';
import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonList,
    IonItem,
    IonLabel,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonButton,
    IonToast,
    IonSkeletonText,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonFooter,
    IonBadge,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    RefresherEventDetail,
    IonLoading,
    IonIcon,
    IonFab,
    IonFabButton
} from '@ionic/react';
import { refresh, calendar, time, locate, link } from 'ionicons/icons';
import { useEvents } from '../context/EventsContext';
import './EventsPage.css';

// Helper function to format dates
const formatDate = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString; // If parsing fails, return the original string
        }
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        }).format(date);
    } catch (e) {
        return dateString;
    }
};

const EventsPage: React.FC = () => {
    const { state, fetchEvents, triggerUpdate } = useEvents();
    const [showToast, setShowToast] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');
    const [searchText, setSearchText] = useState<string>('');
    const [showLoading, setShowLoading] = useState<boolean>(false);

    // Handle refresh (pull-to-refresh)
    const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
        try {
            await fetchEvents(true); // Force refresh from API
            setToastMessage('Events refreshed successfully');
            setShowToast(true);
        } catch (error) {
            setToastMessage('Failed to refresh events');
            setShowToast(true);
        } finally {
            event.detail.complete();
        }
    };

    // Handle manual update
    const handleManualUpdate = async () => {
        setShowLoading(true);
        try {
            await triggerUpdate();
            setToastMessage('Events updated successfully');
            setShowToast(true);
        } catch (error) {
            setToastMessage('Failed to update events');
            setShowToast(true);
        } finally {
            setShowLoading(false);
        }
    };

    // Filter events based on search text
    const filteredEvents = state.events.filter(event => {
        if (!searchText) return true;
        const searchLower = searchText.toLowerCase();

        return (
            event.title.toLowerCase().includes(searchLower) ||
            event.description.toLowerCase().includes(searchLower) ||
            (event.venue && event.venue.toLowerCase().includes(searchLower))
        );
    });

    // Sort events by date (most recent first)
    const sortedEvents = [...filteredEvents].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        return dateA - dateB; // Ascending order (upcoming events first)
    });

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Event Listings</IonTitle>
                    <IonButton
                        slot="end"
                        onClick={handleManualUpdate}
                        disabled={state.loading}
                    >
                        <IonIcon slot="start" icon={refresh} />
                        Update Now
                    </IonButton>
                </IonToolbar>
            </IonHeader>

            <IonContent>
                {/* Pull-to-refresh */}
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent></IonRefresherContent>
                </IonRefresher>

                {/* Search bar */}
                <div className="ion-padding">
                    <IonSearchbar
                        value={searchText}
                        onIonChange={e => setSearchText(e.detail.value || '')}
                        placeholder="Search events..."
                        animated
                    />
                </div>

                {/* Loading skeletons */}
                {state.loading && (
                    <div className="ion-padding">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <IonCard key={i}>
                                <IonCardHeader>
                                    <IonSkeletonText animated style={{ width: '70%', height: '16px' }} />
                                    <IonSkeletonText animated style={{ width: '40%', height: '12px' }} />
                                </IonCardHeader>
                                <IonCardContent>
                                    <IonSkeletonText animated style={{ width: '90%' }} />
                                    <IonSkeletonText animated style={{ width: '80%' }} />
                                </IonCardContent>
                            </IonCard>
                        ))}
                    </div>
                )}

                {/* No events found */}
                {!state.loading && sortedEvents.length === 0 && !state.error && (
                    <div className="ion-text-center ion-padding">
                        <h3>No events found</h3>
                        {searchText ? (
                            <p>Try adjusting your search criteria</p>
                        ) : (
                            <>
                                <p>No upcoming events in the database</p>
                                <IonButton onClick={() => fetchEvents(true)}>Try Again</IonButton>
                            </>
                        )}
                    </div>
                )}

                {/* Error state */}
                {!state.loading && state.error && (
                    <div className="ion-text-center ion-padding">
                        <h3>Error loading events</h3>
                        <p>{state.error}</p>
                        <IonButton onClick={() => fetchEvents(true)}>Try Again</IonButton>
                    </div>
                )}

                {/* Event cards */}
                {!state.loading && sortedEvents.length > 0 && (
                    <div className="event-grid ion-padding">
                        {sortedEvents.map((event) => (
                            <IonCard key={event.id} href={event.url} target="_blank" className="event-card">
                                {event.imageUrl && (
                                    <div className="event-image-container">
                                        <img src={event.imageUrl} alt={event.title} className="event-image" />
                                    </div>
                                )}
                                <IonCardHeader>
                                    <IonCardSubtitle>
                                        <IonIcon icon={calendar} /> {formatDate(event.date)}
                                        {event.venue && (
                                            <span>
                        <IonIcon icon={locate} /> {event.venue}
                      </span>
                                        )}
                                    </IonCardSubtitle>
                                    <IonCardTitle>{event.title}</IonCardTitle>
                                </IonCardHeader>
                                <IonCardContent>
                                    <p className="event-description">{event.description}</p>
                                    <IonButton fill="clear" size="small" className="event-link">
                                        <IonIcon slot="start" icon={link} />
                                        Visit Website
                                    </IonButton>
                                </IonCardContent>
                            </IonCard>
                        ))}
                    </div>
                )}

                {/* Toast notification */}
                <IonToast
                    isOpen={showToast}
                    onDidDismiss={() => setShowToast(false)}
                    message={toastMessage}
                    duration={2000}
                    position="bottom"
                />

                {/* Loading overlay */}
                <IonLoading
                    isOpen={showLoading}
                    message="Updating events..."
                    spinner="circles"
                />
            </IonContent>

            {/* Footer with last updated timestamp */}
            <IonFooter>
                <div className="ion-text-center ion-padding-vertical">
                    {state.lastUpdated && (
                        <small>Last updated: {state.lastUpdated.toLocaleString()}</small>
                    )}
                </div>
            </IonFooter>
        </IonPage>
    );
};

export default EventsPage;