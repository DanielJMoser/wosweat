import React, { useState, useEffect, useRef, useMemo, RefCallback } from 'react';
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
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonSearchbar,
    RefresherEventDetail,
    IonLoading,
    IonIcon,
} from '@ionic/react';
import { refresh, calendar, locate, link } from 'ionicons/icons';
import { useEvents } from '../context/EventsContext';
import { useDebugMode } from '../hooks/useDebugMode';
import { DebugPanel } from '../components/DebugPanel';
import { GlassCard } from '../components/GlassCard/GlassCard';
import { DebugInfo } from '../types/ui';
import { formatDate, getShortDate, getDayName, groupEventsByDay, isToday } from '../utils/date-utils';
import './EventsPage.scss';

const EventsPage: React.FC = () => {
    const { state, fetchEvents, triggerUpdate } = useEvents();
    const { isDebugMode, disableDebugMode } = useDebugMode();
    const [showToast, setShowToast] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');
    const [searchText, setSearchText] = useState<string>('');
    const [showLoading, setShowLoading] = useState<boolean>(false);
    const [activeDayId, setActiveDayId] = useState<string | null>(null);

    const daySectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const debugInfoObj: DebugInfo = {
        eventsCount: state.events.length,
        lastUpdated: state.lastUpdated,
        cacheStatus: 'hit',
        loadingState: state.loading,
        errorMessage: state.error || undefined
    };

    const { sortedEvents, eventsByDay, sortedDays } = useMemo(() => {
        const filtered = state.events.filter(event => {
            if (!searchText) return true;
            const searchLower = searchText.toLowerCase();
            return (
                event.title.toLowerCase().includes(searchLower) ||
                event.description.toLowerCase().includes(searchLower) ||
                (event.venue && event.venue.toLowerCase().includes(searchLower))
            );
        });

        const sorted = [...filtered].sort((a, b) => {
            const dateA = new Date(a.date).getTime() || 0;
            const dateB = new Date(b.date).getTime() || 0;
            return dateA - dateB;
        });

        const grouped = groupEventsByDay(sorted);

        const days = Object.keys(grouped).sort((a, b) =>
            new Date(a).getTime() - new Date(b).getTime()
        );

        return { sortedEvents: sorted, eventsByDay: grouped, sortedDays: days };
    }, [state.events, searchText]);

    const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
        try {
            await fetchEvents(true);
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

    const handleManualUpdate = async () => {
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

    const createRefCallback = (dayId: string): RefCallback<HTMLDivElement> => {
        return (element) => {
            daySectionRefs.current[dayId] = element;
            return undefined;
        };
    };

    const scrollToDay = (dayId: string) => {
        setActiveDayId(dayId);
        const element = daySectionRefs.current[dayId];
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    useEffect(() => {
        if (sortedDays.length > 0) {
            const today = sortedDays.find(day => isToday(day));
            setActiveDayId(today ?? sortedDays[0]);
        }
    }, [sortedDays]);

    return (
        <IonPage>
            <div className="background-layer">
                <svg className="grain-filter" aria-hidden="true">
                    <filter id="grain">
                        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                        <feColorMatrix type="saturate" values="0" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#grain)" />
                </svg>
            </div>

            <IonHeader style={{ position: 'relative', zIndex: 100 }}>
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

            <IonContent className="transparent-content" style={{ position: 'relative', zIndex: 50 }}>
                <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
                    <IonRefresherContent></IonRefresherContent>
                </IonRefresher>

                <div className="search-container">
                    <IonSearchbar
                        className="custom-searchbar"
                        value={searchText}
                        onIonChange={e => setSearchText(e.detail.value || '')}
                        placeholder="Search events..."
                        animated
                    />
                </div>

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
                    {state.loading && (
                        <div className="events-grid">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <GlassCard key={i} className="skeleton-card" variant="secondary">
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
                                </GlassCard>
                            ))}
                        </div>
                    )}

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

                    {!state.loading && state.error && (
                        <div className="no-events-container">
                            <h2 className="neon-text">Error loading events</h2>
                            <p>{state.error}</p>
                            <IonButton className="retry-button" onClick={() => fetchEvents(true)}>Try Again</IonButton>
                        </div>
                    )}

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
                                            <GlassCard key={event.id} href={event.url} target="_blank" className="event-card" variant="primary">
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
                                            </GlassCard>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <IonToast
                    isOpen={showToast}
                    onDidDismiss={() => setShowToast(false)}
                    message={toastMessage}
                    duration={2000}
                    position="bottom"
                />

                <IonLoading
                    isOpen={showLoading}
                    message="Updating events..."
                    spinner="circles"
                />
            </IonContent>

            <DebugPanel
                visible={isDebugMode}
                debugInfo={debugInfoObj}
                onClose={disableDebugMode}
            />
        </IonPage>
    );
};

export default EventsPage;
