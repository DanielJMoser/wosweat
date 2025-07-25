import React from 'react';
import { IonIcon, IonButton } from '@ionic/react';
import { close, informationCircle, time, refresh } from 'ionicons/icons';
import { DebugPanelProps } from '../../types/ui';
import { GlassCard } from '../GlassCard';
import './DebugPanel.scss';

/**
 * Debug Panel Component
 * Displays debugging information for developers
 * Hidden by default, activated via useDebugMode hook
 */
export const DebugPanel: React.FC<DebugPanelProps> = ({
  visible,
  debugInfo,
  onClose
}) => {
  if (!visible) return null;

  const formatTimestamp = (date: Date | null): string => {
    if (!date) return 'Never';
    return date.toLocaleString();
  };

  const getCacheStatusColor = (status: string): string => {
    switch (status) {
      case 'hit': return '#4CAF50'; // Green
      case 'miss': return '#FF9800'; // Orange  
      case 'expired': return '#F44336'; // Red
      default: return '#9E9E9E'; // Gray
    }
  };

  return (
    <div className="debug-panel-overlay">
      <GlassCard className="debug-panel" variant="accent">
        <div className="debug-panel__header">
          <div className="debug-panel__title">
            <IonIcon icon={informationCircle} />
            <span>Debug Information</span>
          </div>
          {onClose && (
            <IonButton 
              fill="clear" 
              size="small" 
              onClick={onClose}
              className="debug-panel__close"
            >
              <IonIcon icon={close} />
            </IonButton>
          )}
        </div>

        <div className="debug-panel__content">
          <div className="debug-info-grid">
            <div className="debug-info-item">
              <label>Events Count:</label>
              <span className="debug-value">{debugInfo.eventsCount}</span>
            </div>

            <div className="debug-info-item">
              <label>Cache Status:</label>
              <span 
                className="debug-value debug-cache-status"
                style={{ color: getCacheStatusColor(debugInfo.cacheStatus) }}
              >
                {debugInfo.cacheStatus.toUpperCase()}
              </span>
            </div>

            <div className="debug-info-item">
              <label>Loading:</label>
              <span className={`debug-value ${debugInfo.loadingState ? 'loading' : ''}`}>
                {debugInfo.loadingState ? 'YES' : 'NO'}
              </span>
            </div>

            <div className="debug-info-item">
              <label>
                <IonIcon icon={time} />
                Last Updated:
              </label>
              <span className="debug-value debug-timestamp">
                {formatTimestamp(debugInfo.lastUpdated)}
              </span>
            </div>

            {debugInfo.errorMessage && (
              <div className="debug-info-item debug-error">
                <label>Error:</label>
                <span className="debug-value debug-error-message">
                  {debugInfo.errorMessage}
                </span>
              </div>
            )}
          </div>

          <div className="debug-panel__actions">
            <IonButton 
              size="small" 
              fill="outline"
              onClick={() => console.log('Debug Info:', debugInfo)}
            >
              <IonIcon icon={informationCircle} slot="start" />
              Log to Console
            </IonButton>
            
            <IonButton 
              size="small" 
              fill="outline"
              onClick={() => {
                navigator.clipboard?.writeText(JSON.stringify(debugInfo, null, 2))
                  .then(() => console.log('Debug info copied to clipboard'))
                  .catch(err => console.error('Failed to copy:', err));
              }}
            >
              Copy JSON
            </IonButton>
          </div>
        </div>

        <div className="debug-panel__footer">
          <small>Press Ctrl+Shift+D to toggle debug mode</small>
        </div>
      </GlassCard>
    </div>
  );
};