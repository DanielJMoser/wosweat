export interface VenueConfig {
  gradient: string;
  accent: 'teal' | 'lavender';
  displayName: string;
  url: string;
}

export const VENUE_CONFIG: Record<string, VenueConfig> = {
  'PMK': {
    gradient: 'linear-gradient(160deg, #2d3a4a, #1a2332, #0f1720)',
    accent: 'teal',
    displayName: 'PMK Innsbruck',
    url: 'https://pmk.or.at/de/events/'
  },
  'Treibhaus': {
    gradient: 'linear-gradient(160deg, #3a2d2d, #2a1f22, #1a1215)',
    accent: 'lavender',
    displayName: 'Treibhaus Innsbruck',
    url: 'https://www.treibhaus.at/programm'
  },
  'Bäckerei': {
    gradient: 'linear-gradient(160deg, #2d3a2e, #1f2a20, #121a13)',
    accent: 'teal',
    displayName: 'Die Bäckerei',
    url: 'https://diebaeckerei.at/programm/'
  },
  'Music Hall': {
    gradient: 'linear-gradient(160deg, #35294a, #251c38, #160f24)',
    accent: 'lavender',
    displayName: 'Music Hall Innsbruck',
    url: 'https://www.music-hall.at/veranstaltungen/'
  },
  'BRUX': {
    gradient: 'linear-gradient(160deg, #3a3a2d, #2a2a1f, #1a1a12)',
    accent: 'teal',
    displayName: 'BRUX Freies Theater',
    url: 'https://www.brux.at/spielplan/'
  },
  'Artillery': {
    gradient: 'linear-gradient(160deg, #2d3540, #1c252e, #0e151c)',
    accent: 'lavender',
    displayName: 'Artillery Productions',
    url: 'https://artilleryproductions.bigcartel.com/'
  },
  'Kellertheater': {
    gradient: 'linear-gradient(160deg, #2d2d3a, #1f1f2a, #12121a)',
    accent: 'teal',
    displayName: 'Innsbrucker Kellertheater',
    url: 'https://www.kellertheater.at/spielplan/terminuebersicht/'
  },
  'LiveStage': {
    gradient: 'linear-gradient(160deg, #3a2d35, #2a1f25, #1a1218)',
    accent: 'lavender',
    displayName: 'LiveStage Tirol',
    url: 'https://www.livestage-tirol.com/'
  }
};

const FALLBACK_CONFIG: VenueConfig = {
  gradient: 'linear-gradient(160deg, #313244, #45475a, #313244)',
  accent: 'teal',
  displayName: 'Unbekannt',
  url: ''
};

export function getVenueConfig(venue?: string): VenueConfig {
  if (!venue) return FALLBACK_CONFIG;
  const key = Object.keys(VENUE_CONFIG).find(k => venue.includes(k));
  return key ? VENUE_CONFIG[key] : FALLBACK_CONFIG;
}
