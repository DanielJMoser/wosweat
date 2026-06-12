export const TARGET_SITES = [
    'https://www.treibhaus.at/programm',
    'https://pmk.or.at/de/events/',
    'https://artilleryproductions.bigcartel.com/',
    'https://www.music-hall.at/veranstaltungen/',
    'https://diebaeckerei.at/programm/',
    'https://www.brux.at/spielplan/',
    'https://www.kellertheater.at/spielplan/terminuebersicht/',
    'https://www.livestage-tirol.com/'
] as const;

export const VENUES = {
    treibhaus: 'Treibhaus Innsbruck',
    pmk: 'PMK Innsbruck',
    artillery: 'Artillery Productions',
    musicHall: 'Music Hall Innsbruck',
    baeckerei: 'Die Bäckerei',
    brux: 'BRUX Freies Theater Innsbruck',
    kellertheater: 'Innsbrucker Kellertheater',
    livestage: 'LiveStage Tirol',
} as const;

export const VENUE_NAMES = Object.values(VENUES);
