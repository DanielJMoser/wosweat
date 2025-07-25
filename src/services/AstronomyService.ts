import { BRIGHT_STARS, CONSTELLATIONS, INNSBRUCK_LOCATION, Star, Constellation } from '../data/starCatalog';

export interface NightSkyConfig {
  location: {
    latitude: number;
    longitude: number;
    elevation: number;
    timezone: string;
  };
  displayOptions: {
    showConstellationLines: boolean;
    showConstellationLabels: boolean;
    magnitudeLimit: number;
  };
}

export class AstronomyService {
  private static readonly INNSBRUCK_COORDS = INNSBRUCK_LOCATION;

  // Calculate Julian Date from JavaScript Date
  static getJulianDate(date: Date): number {
    return (date.getTime() / 86400000) + 2440587.5;
  }

  // Calculate Greenwich Mean Sidereal Time
  static getGreenwichMeanSiderealTime(julianDate: number): number {
    const t = (julianDate - 2451545.0) / 36525.0;
    let gmst = 280.46061837 + 360.98564736629 * (julianDate - 2451545.0) + 0.000387933 * t * t - t * t * t / 38710000.0;
    
    // Normalize to 0-360 degrees
    gmst = gmst % 360;
    if (gmst < 0) gmst += 360;
    
    return gmst / 15; // Convert to hours
  }

  // Calculate Local Sidereal Time for Innsbruck
  static getLocalSiderealTime(julianDate: number): number {
    const gmst = this.getGreenwichMeanSiderealTime(julianDate);
    const lst = gmst + (this.INNSBRUCK_COORDS.longitude / 15);
    return lst % 24; // Normalize to 0-24 hours
  }

  // Convert equatorial coordinates (RA, Dec) to horizontal coordinates (Alt, Az)
  static equatorialToHorizontal(
    rightAscension: number, 
    declination: number, 
    localSiderealTime: number
  ): { azimuth: number; altitude: number; visible: boolean } {
    // Calculate hour angle
    const hourAngle = localSiderealTime - rightAscension;
    
    // Convert to radians
    const lat = this.INNSBRUCK_COORDS.latitude * Math.PI / 180;
    const decRad = declination * Math.PI / 180;
    const haRad = hourAngle * Math.PI / 180;

    // Calculate altitude (elevation angle)
    const sinAlt = Math.sin(decRad) * Math.sin(lat) + 
                   Math.cos(decRad) * Math.cos(lat) * Math.cos(haRad);
    const altitude = Math.asin(sinAlt) * 180 / Math.PI;

    // Calculate azimuth
    const cosAz = (Math.sin(decRad) - Math.sin(lat) * sinAlt) / 
                  (Math.cos(lat) * Math.cos(Math.asin(sinAlt)));
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
    
    // Adjust azimuth quadrant based on hour angle
    if (Math.sin(haRad) > 0) {
      azimuth = 360 - azimuth;
    }

    return {
      azimuth,
      altitude,
      visible: altitude > -5 // Show stars slightly below horizon for atmospheric refraction
    };
  }

  // Calculate current star positions for given date/time
  static calculateStarPositions(date: Date = new Date()): Star[] {
    const julianDate = this.getJulianDate(date);
    const localSiderealTime = this.getLocalSiderealTime(julianDate);
    
    return BRIGHT_STARS.map(star => {
      const horizontalCoords = this.equatorialToHorizontal(
        star.rightAscension,
        star.declination,
        localSiderealTime
      );
      
      return {
        ...star,
        azimuth: horizontalCoords.azimuth,
        altitude: horizontalCoords.altitude,
        visible: horizontalCoords.visible
      };
    });
  }

  // Get visible constellations based on current star positions
  static getVisibleConstellations(stars: Star[]): Constellation[] {
    return CONSTELLATIONS.filter(constellation => {
      // Check if at least 2 stars of the constellation are visible
      const visibleStars = constellation.stars.filter(starId => {
        const star = stars.find(s => s.id === starId);
        return star?.visible;
      });
      return visibleStars.length >= 2;
    });
  }

  // Convert astronomical coordinates to screen coordinates
  static astronomicalToScreen(
    azimuth: number, 
    altitude: number, 
    screenWidth: number, 
    screenHeight: number
  ): { x: number; y: number } {
    // Simple azimuthal projection
    // Azimuth 0° = North = top center
    // Azimuth 90° = East = right center
    // Azimuth 180° = South = bottom center
    // Azimuth 270° = West = left center
    
    const azimuthRad = (azimuth - 90) * Math.PI / 180; // Adjust so 0° is at top
    const altitudeNorm = Math.max(0, altitude + 10) / 100; // Normalize altitude (with horizon buffer)
    
    // Calculate radius from center based on altitude
    const maxRadius = Math.min(screenWidth, screenHeight) * 0.45;
    const radius = maxRadius * (1 - altitudeNorm);
    
    // Calculate screen position
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    
    const x = centerX + radius * Math.cos(azimuthRad);
    const y = centerY + radius * Math.sin(azimuthRad);
    
    return { x, y };
  }

  // Get star brightness factor based on magnitude
  static getStarBrightness(magnitude: number): number {
    // Brighter stars have lower magnitude values
    // Magnitude scale: -1.5 (very bright) to 6.5 (barely visible)
    const normalizedMag = Math.max(-1.5, Math.min(6.5, magnitude));
    return Math.max(0.1, (6.5 - normalizedMag) / 8.0);
  }

  // Get star size based on magnitude
  static getStarSize(magnitude: number): number {
    const brightness = this.getStarBrightness(magnitude);
    return Math.max(2, 12 * brightness);
  }

  // Get current sun position (for twilight calculations)
  static getSunPosition(date: Date = new Date()): { azimuth: number; altitude: number } {
    const julianDate = this.getJulianDate(date);
    const lst = this.getLocalSiderealTime(julianDate);
    
    // Simplified sun position calculation
    const dayOfYear = Math.floor((julianDate - 2451545.0) % 365.25);
    const sunLongitude = (dayOfYear / 365.25) * 360; // Approximate
    const sunRA = sunLongitude / 15; // Convert to hours
    const sunDec = 23.44 * Math.sin((dayOfYear - 81) * Math.PI / 182.625); // Approximate declination
    
    return this.equatorialToHorizontal(sunRA, sunDec, lst);
  }

  // Determine if it's dark enough to see stars
  static isDarkEnough(date: Date = new Date()): boolean {
    const sunPos = this.getSunPosition(date);
    return sunPos.altitude < -6; // Civil twilight threshold
  }

  // Get time until astronomical darkness
  static getTimeUntilDark(date: Date = new Date()): number | null {
    if (this.isDarkEnough(date)) return 0;
    
    // Simple approximation - check every 15 minutes for next 12 hours
    for (let minutes = 15; minutes <= 720; minutes += 15) {
      const futureDate = new Date(date.getTime() + minutes * 60000);
      if (this.isDarkEnough(futureDate)) {
        return minutes;
      }
    }
    
    return null; // Won't be dark within 12 hours
  }
}