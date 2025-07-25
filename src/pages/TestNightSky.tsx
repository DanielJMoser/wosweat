import React from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonButtons, IonBackButton } from '@ionic/react';
import { AnimatedMesh } from '../components/AnimatedMesh';
import { AnimationConfig } from '../types/ui';

const TestNightSky: React.FC = () => {
  const nightSkyConfig: Partial<AnimationConfig> = {
    mode: 'nightsky',
    showConstellationLines: true,
    showConstellationLabels: false,
    magnitudeLimit: 3.5,
    gravityStrength: 200, // Reduced for subtle stellar effects
    maxGravityDistance: 250
  };

  const abstractConfig: Partial<AnimationConfig> = {
    mode: 'abstract',
    intensity: 0.8,
    particleCount: 20,
    gravityStrength: 300,
    maxGravityDistance: 350
  };

  const [currentMode, setCurrentMode] = React.useState<'nightsky' | 'abstract'>('nightsky');

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/events" />
          </IonButtons>
          <IonTitle>Night Sky Test</IonTitle>
          <IonButtons slot="end">
            <IonButton 
              fill="clear" 
              onClick={() => setCurrentMode(currentMode === 'nightsky' ? 'abstract' : 'nightsky')}
            >
              {currentMode === 'nightsky' ? 'Abstract' : 'Night Sky'}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          height: '100%', 
          background: currentMode === 'nightsky' 
            ? 'radial-gradient(ellipse at center, #0a0a1e 0%, #000000 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          overflow: 'hidden'
        }}>
          <AnimatedMesh 
            config={currentMode === 'nightsky' ? nightSkyConfig : abstractConfig}
            className={`animated-mesh-${currentMode}`}
          />
          
          {currentMode === 'nightsky' && (
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '14px',
              fontFamily: 'monospace',
              background: 'rgba(0, 0, 0, 0.5)',
              padding: '10px',
              borderRadius: '5px',
              zIndex: 2000
            }}>
              <div>🌟 Current Night Sky over Innsbruck</div>
              <div>📍 47.2692°N, 11.4041°E</div>
              <div>🕐 {new Date().toLocaleTimeString()}</div>
              <div>✨ Magnitude limit: {nightSkyConfig.magnitudeLimit}</div>
              <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.7 }}>
                Move mouse to create gravity wells around stars
              </div>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default TestNightSky;