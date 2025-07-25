# Night Sky Implementation for AnimatedMesh

## Overview

This document describes how to transform the existing AnimatedMesh component to accurately display the current night sky above Innsbruck, Austria (47.2692°N, 11.4041°E) with real-time constellation positioning.

## Core Requirements

### Astronomical Data Integration

**1. Star Catalog Integration**
- Use the Hipparcos Star Catalog (HIP) for accurate star positions
- Filter for stars visible to naked eye (magnitude < 4.5-5.0)
- Include all 88 modern constellations with connecting lines

**2. Real-Time Positioning**
- Calculate current Julian Date for precise astronomical time
- Apply proper coordinate transformations (Equatorial → Horizontal)
- Account for Earth's rotation, precession, and nutation
- Adjust for Innsbruck's specific latitude/longitude and elevation (574m)

**3. Required Libraries**
```bash
npm install astronomy-engine suncalc
```

## Implementation Architecture

### Data Structure

```typescript
interface Star {
  id: string;
  name?: string;
  constellation: string;
  magnitude: number;
  rightAscension: number; // hours (0-24)
  declination: number;    // degrees (-90 to +90)
  azimuth?: number;       // calculated
  altitude?: number;      // calculated
  visible: boolean;
}

interface Constellation {
  name: string;
  abbreviation: string;
  stars: string[];        // star IDs
  connections: [string, string][]; // pairs of connected star IDs
  mythology?: string;
}

interface NightSkyConfig extends AnimationConfig {
  location: {
    latitude: number;
    longitude: number;
    elevation: number;
    timezone: string;
  };
  displayOptions: {
    showConstellationLines: boolean;
    showConstellationLabels: boolean;
    showMilkyWay: boolean;
    showPlanets: boolean;
    magnitudeLimit: number;
  };
}
```

### Core Components

**1. Astronomical Calculator Service**

```typescript
// src/services/AstronomyService.ts
export class AstronomyService {
  private static INNSBRUCK_COORDS = {
    latitude: 47.2692,
    longitude: 11.4041,
    elevation: 574
  };

  static calculateStarPositions(date: Date): Star[] {
    const jd = this.getJulianDate(date);
    const siderealTime = this.getLocalSiderealTime(jd);
    
    return STAR_CATALOG.map(star => ({
      ...star,
      ...this.equatorialToHorizontal(
        star.rightAscension,
        star.declination,
        siderealTime
      )
    })).filter(star => star.altitude > 0); // Only visible stars
  }

  private static equatorialToHorizontal(
    ra: number, 
    dec: number, 
    lst: number
  ): {azimuth: number, altitude: number, visible: boolean} {
    // Hour angle calculation
    const hourAngle = lst - ra;
    
    // Convert to radians
    const lat = this.INNSBRUCK_COORDS.latitude * Math.PI / 180;
    const decRad = dec * Math.PI / 180;
    const haRad = hourAngle * Math.PI / 180;

    // Calculate altitude
    const sinAlt = Math.sin(decRad) * Math.sin(lat) + 
                   Math.cos(decRad) * Math.cos(lat) * Math.cos(haRad);
    const altitude = Math.asin(sinAlt) * 180 / Math.PI;

    // Calculate azimuth
    const cosAz = (Math.sin(decRad) - Math.sin(lat) * sinAlt) / 
                  (Math.cos(lat) * Math.cos(Math.asin(sinAlt)));
    let azimuth = Math.acos(cosAz) * 180 / Math.PI;
    
    if (Math.sin(haRad) > 0) azimuth = 360 - azimuth;

    return {
      azimuth,
      altitude,
      visible: altitude > 0
    };
  }
}
```

**2. Enhanced AnimatedMesh Component**

```typescript
// Key modifications to AnimatedMesh.tsx

interface NightSkyMeshProps extends AnimatedMeshProps {
  mode: 'abstract' | 'nightsky';
  nightSkyConfig?: NightSkyConfig;
}

export const AnimatedMesh: React.FC<NightSkyMeshProps> = ({
  mode = 'abstract',
  nightSkyConfig,
  ...props
}) => {
  const [stars, setStars] = useState<Star[]>([]);
  const [constellations, setConstellations] = useState<Constellation[]>([]);

  // Real-time star position updates
  useEffect(() => {
    if (mode !== 'nightsky') return;

    const updateStarPositions = () => {
      const currentStars = AstronomyService.calculateStarPositions(new Date());
      setStars(currentStars);
    };

    updateStarPositions();
    const interval = setInterval(updateStarPositions, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [mode]);

  // Convert astronomical coordinates to screen coordinates
  const astronomicalToScreen = useCallback((azimuth: number, altitude: number) => {
    const containerWidth = window.innerWidth;
    const containerHeight = window.innerHeight;

    // Stereographic projection for realistic sky dome
    const x = containerWidth * (azimuth / 360);
    const y = containerHeight * (1 - (altitude + 10) / 100); // +10 for horizon buffer

    return { x, y };
  }, []);

  // Render stars instead of random points in nightsky mode
  const createNightSkyPoints = useCallback(() => {
    if (mode !== 'nightsky' || !containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    // Create SVG for constellation lines
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'constellation-lines');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    container.appendChild(svg);

    // Render visible stars
    stars.forEach(star => {
      if (!star.visible) return;

      const { x, y } = astronomicalToScreen(star.azimuth!, star.altitude!);
      const brightness = Math.max(0.1, (6 - star.magnitude) / 6); // Brighter = higher magnitude
      const size = Math.max(2, 8 - star.magnitude);

      const point = document.createElement('div');
      point.className = 'star-point';
      point.dataset.starId = star.id;
      point.dataset.constellation = star.constellation;
      
      point.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        background: radial-gradient(circle, 
          rgba(255, 255, 255, ${brightness}) 0%,
          rgba(200, 200, 255, ${brightness * 0.8}) 50%,
          transparent 100%);
        border-radius: 50%;
        left: ${x}px;
        top: ${y}px;
        box-shadow: 0 0 ${size * 2}px rgba(255, 255, 255, ${brightness * 0.6});
        pointer-events: none;
        z-index: 1000;
      `;

      container.appendChild(point);
      meshPointsRef.current.push(point);
    });

    // Draw constellation lines
    drawConstellationLines(svg);
  }, [mode, stars, astronomicalToScreen]);
};
```

### Advanced Features

**3. Constellation Line Drawing**

```typescript
const drawConstellationLines = (svg: SVGElement) => {
  constellations.forEach(constellation => {
    constellation.connections.forEach(([star1Id, star2Id]) => {
      const star1 = stars.find(s => s.id === star1Id);
      const star2 = stars.find(s => s.id === star2Id);
      
      if (!star1?.visible || !star2?.visible) return;

      const pos1 = astronomicalToScreen(star1.azimuth!, star1.altitude!);
      const pos2 = astronomicalToScreen(star2.azimuth!, star2.altitude!);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', pos1.x.toString());
      line.setAttribute('y1', pos1.y.toString());
      line.setAttribute('x2', pos2.x.toString());
      line.setAttribute('y2', pos2.y.toString());
      line.setAttribute('stroke', 'rgba(100, 150, 255, 0.3)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('class', `constellation-line ${constellation.abbreviation}`);

      svg.appendChild(line);
    });
  });
};
```

**4. Interactive Features**

- **Star Information**: Click/hover on stars to show name, magnitude, constellation
- **Time Controls**: Speed up/slow down time to see sky rotation
- **Constellation Highlighting**: Hover over constellation to highlight all stars
- **Planet Tracking**: Show current positions of visible planets
- **Meteor Showers**: Animate meteors during active shower periods

**5. Environmental Effects**

```typescript
// Additional atmospheric effects
interface AtmosphereConfig {
  lightPollution: number;    // 0-10 Bortle scale
  weather: 'clear' | 'hazy' | 'cloudy';
  moonPhase: number;         // 0-1
  twilight: 'day' | 'civil' | 'nautical' | 'astronomical' | 'night';
}

// Modify star visibility based on conditions
const applyAtmosphericEffects = (star: Star, atmosphere: AtmosphereConfig) => {
  let visibility = star.magnitude < (6 - atmosphere.lightPollution * 0.5);
  
  if (atmosphere.weather === 'hazy') visibility &&= Math.random() > 0.3;
  if (atmosphere.weather === 'cloudy') visibility = false;
  
  return { ...star, visible: visibility };
};
```

## Data Sources

**Star Catalogs:**
- Hipparcos Catalog: https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239
- Yale Bright Star Catalog: https://tdc-www.harvard.edu/catalogs/bsc5.html
- Constellation boundaries: IAU official boundaries

**Real-time Data:**
- Current time/date from system
- Optional: Weather API integration for cloud cover
- Optional: Light pollution data from Bortle scale maps

## Performance Considerations

- **Culling**: Only render stars above horizon (altitude > 0°)
- **LOD**: Reduce star count based on device performance
- **Caching**: Cache constellation data and star positions
- **Updates**: Only recalculate positions every minute instead of every frame

## Future Enhancements

1. **Deep Sky Objects**: Nebulae, galaxies, star clusters
2. **Satellite Tracking**: ISS and bright satellite passes
3. **Augmented Reality**: Use device orientation for accurate pointing
4. **Historical Mode**: View sky from any date/time in history
5. **Astrophotography Mode**: Long exposure simulation effects

This implementation would create a scientifically accurate, real-time representation of Innsbruck's night sky within the existing AnimatedMesh framework.