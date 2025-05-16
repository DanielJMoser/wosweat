import React, { useState, useEffect, useRef, RefCallback } from 'react';
import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
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
    IonSearchbar,
    RefresherEventDetail,
    IonLoading,
    IonIcon,
    IonText,
    IonRow,
    IonCol,
    IonGrid,
} from '@ionic/react';
import { refresh, calendar, locate, link, bug } from 'ionicons/icons';
import { useEvents } from '../context/EventsContext';
import { EventService } from '../services/events-service';
import { EventData } from '../../shared/types/events';
import './EventsPage.scss';

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
        }).format(date);
    } catch (e) {
        return dateString;
    }
};

// Helper function to get short date for navigation
const getShortDate = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString;
        }
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
        }).format(date);
    } catch {
        return dateString;
    }
};

// Helper function to get day name
const getDayName = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '';
        }
        return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
    } catch {
        return '';
    }
};

// Helper function to group events by day
const groupEventsByDay = (events: EventData[]): { [key: string]: EventData[] } => {
    return events.reduce((groups: { [key: string]: EventData[] }, event) => {
        // Use only the date part for grouping (YYYY-MM-DD)
        const dateKey = event.date.split('T')[0];

        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }

        groups[dateKey].push(event);
        return groups;
    }, {});
};

// Check if a date is today
const isToday = (dateString: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);

    return date.getTime() === today.getTime();
};

const EventsPage: React.FC = () => {
    const { state, fetchEvents, triggerUpdate } = useEvents();
    const [showToast, setShowToast] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');
    const [searchText, setSearchText] = useState<string>('');
    const [showLoading, setShowLoading] = useState<boolean>(false);
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [activeDayId, setActiveDayId] = useState<string | null>(null);

    // Refs for each day section for scrolling
    const daySectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Debug effect - log state changes
    useEffect(() => {
        console.log('Events state updated:', state);
        setDebugInfo(`Events: ${state.events.length}, Loading: ${state.loading}, Error: ${state.error}, Last updated: ${state.lastUpdated?.toLocaleString() || 'never'}`);
    }, [state]);

    // Handle refresh (pull-to-refresh)
    const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
        try {
            console.log('Pull-to-refresh triggered');
            await fetchEvents(true); // Force refresh from API
            setToastMessage('Events refreshed successfully');
            setShowToast(true);
        } catch (error) {
            console.error('Refresh error:', error);
            setToastMessage('Failed to refresh events');
            setShowToast(true);
        } finally {
            event.detail.complete();
        }
    };

    // Handle manual update
    const handleManualUpdate = async () => {
        console.log('Manual update button clicked');
        setShowLoading(true);
        try {
            await triggerUpdate();
            setToastMessage('Events updated successfully');
            setShowToast(true);
        } catch (error) {
            console.error('Manual update error:', error);
            setToastMessage('Failed to update events');
            setShowToast(true);
        } finally {
            setShowLoading(false);
        }
    };

    // Create a ref callback function with proper TypeScript types
    const createRefCallback = (dayId: string): RefCallback<HTMLDivElement> => {
        return (element) => {
            daySectionRefs.current[dayId] = element;
            return undefined; // Fixed: Return void, not HTMLDivElement | null
        };
    };

    // Scroll to a day section
    const scrollToDay = (dayId: string) => {
        setActiveDayId(dayId);
        const element = daySectionRefs.current[dayId];
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const dateA = new Date(a.date).getTime() || 0;
        const dateB = new Date(b.date).getTime() || 0;

        return dateA - dateB; // Ascending order (upcoming events first)
    });

    // Group events by day
    const eventsByDay = groupEventsByDay(sortedEvents);

    // Sort days chronologically
    const sortedDays = Object.keys(eventsByDay).sort((a, b) => {
        return new Date(a).getTime() - new Date(b).getTime();
    });

    // Set active day to first day or today if present
    useEffect(() => {
        if (sortedDays.length > 0) {
            // Try to find today in the sorted days
            const today = sortedDays.find(day => isToday(day));
            if (today) {
                setActiveDayId(today);
            } else {
                setActiveDayId(sortedDays[0]);
            }
        }
    }, [sortedDays]);

    return (
        <IonPage>
            {/* Vaporwave background elements */}
            <div className="stars"></div>
            <div className="horizon-lines"></div>
            <div className="vaporwave-sun"></div>

            <IonHeader>
                <IonToolbar className="custom-toolbar">
                    <IonTitle className="custom-title">wosWeat 2.0</IonTitle>
                    <IonButton
                        slot="end"
                        className="update-button"
                        onClick={handleManualUpdate}
                        disabled={state.loading}
                    >
                        <IonIcon slot="start" icon={refresh} />
                        Update
                    </IonButton>
                </IonToolbar>
            </IonHeader>

            <IonContent>
                {/* Pull-to-refresh */}
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent></IonRefresherContent>
                </IonRefresher>

                {/* Search bar */}
                <div className="search-container">
                    <IonSearchbar
                        className="custom-searchbar"
                        value={searchText}
                        onIonChange={e => setSearchText(e.detail.value || '')}
                        placeholder="Search events..."
                        animated
                    />
                </div>

                {/* Debug info - remove in production */}
                <div className="ion-padding">
                    <IonGrid>
                        <IonRow>
                            <IonCol>
                                <div className="debug-info">
                                    {debugInfo}
                                </div>
                            </IonCol>
                            <IonCol size="auto">
                                <IonButton size="small" className="debug-button" onClick={async () => {
                                    console.log('Debug button clicked');
                                    try {
                                        await EventService.debugFetchEvents();
                                        setToastMessage('Check console for debug info');
                                        setShowToast(true);
                                    } catch (error) {
                                        console.error('Debug error:', error);
                                    }
                                }}>
                                    <IonIcon slot="start" icon={bug} />
                                    Debug
                                </IonButton>
                            </IonCol>
                        </IonRow>
                    </IonGrid>
                </div>

                {/* Day navigation */}
                {!state.loading && sortedDays.length > 0 && (
                    <div className="day-nav">
                        {sortedDays.map(day => (
                            <div
                                key={`nav-${day}`}
                                className={`day-nav-item ${day === activeDayId ? 'active' : ''}`}
                                onClick={() => scrollToDay(day)}
                            >
                                {isToday(day) ? 'Today' : getShortDate(day)}
                            </div>
                        ))}
                    </div>
                )}

                <div className="events-container">
                    {/* Loading skeletons */}
                    {state.loading && (
                        <div className="events-grid">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <IonCard key={i} className="skeleton-card">
                                    <div style={{ height: '160px' }}>
                                        <IonSkeletonText animated style={{ width: '100%', height: '100%' }} />
                                    </div>
                                    <IonCardHeader>
                                        <IonSkeletonText animated style={{ width: '40%', height: '12px' }} />
                                        <IonSkeletonText animated style={{ width: '70%', height: '24px' }} />
                                    </IonCardHeader>
                                    <IonCardContent>
                                        <IonSkeletonText animated style={{ width: '90%' }} />
                                        <IonSkeletonText animated style={{ width: '80%' }} />
                                        <IonSkeletonText animated style={{ width: '60%' }} />
                                    </IonCardContent>
                                </IonCard>
                            ))}
                        </div>
                    )}

                    {/* No events found */}
                    {!state.loading && sortedEvents.length === 0 && !state.error && (
                        <div className="no-events-container">
                            <h2 className="neon-text">No events found</h2>
                            {searchText ? (
                                <p>Try adjusting your search criteria</p>
                            ) : (
                                <>
                                    <p>No upcoming events in the database</p>
                                    <IonButton className="retry-button" onClick={() => fetchEvents(true)}>Try Again</IonButton>
                                </>
                            )}
                        </div>
                    )}

                    {/* Error state */}
                    {!state.loading && state.error && (
                        <div className="no-events-container">
                            <h2 className="neon-text">Error loading events</h2>
                            <p>{state.error}</p>
                            <IonButton className="retry-button" onClick={() => fetchEvents(true)}>Try Again</IonButton>
                        </div>
                    )}

                    {/* Events grouped by day */}
                    {!state.loading && sortedEvents.length > 0 && (
                        <div>
                            {sortedDays.map(day => (
                                <div
                                    key={day}
                                    className="day-section"
                                    ref={createRefCallback(day)}
                                    id={`day-${day}`}
                                >
                                    <div className="day-header">
                                        <div className="day-date">
                                            {formatDate(day)}
                                            {isToday(day) && " (Today)"}
                                        </div>
                                        <div className="day-name">{getDayName(day)}</div>
                                    </div>

                                    <div className="events-grid">
                                        {eventsByDay[day].map(event => (
                                            <IonCard key={event.id} href={event.url} target="_blank" className="event-card">
                                                {event.imageUrl && (
                                                    <div className="event-image-container">
                                                        <img src={event.imageUrl} alt={event.title} className="event-image" />
                                                    </div>
                                                )}
                                                <IonCardHeader className="event-card-header">
                                                    <IonCardSubtitle className="event-card-subtitle">
                                                        <span>
                                                            <IonIcon icon={calendar} /> {formatDate(event.date)}
                                                        </span>
                                                        {event.venue && (
                                                            <span style={{ marginLeft: '12px' }}>
                                                                <IonIcon icon={locate} /> {event.venue}
                                                            </span>
                                                        )}
                                                    </IonCardSubtitle>
                                                    <IonCardTitle className="event-card-title">{event.title}</IonCardTitle>
                                                </IonCardHeader>
                                                <IonCardContent className="event-card-content">
                                                    <p className="event-description">{event.description}</p>
                                                    <div className="event-link">
                                                        <IonIcon icon={link} />
                                                        Visit Website
                                                    </div>
                                                </IonCardContent>
                                            </IonCard>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

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
            <IonFooter className="custom-footer">
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