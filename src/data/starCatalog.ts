// Basic star catalog for night sky visualization
// Based on bright stars visible from Innsbruck

export interface Star {
  id: string;
  name: string;
  constellation: string;
  magnitude: number;
  rightAscension: number; // hours (0-24)
  declination: number;    // degrees (-90 to +90)
  azimuth?: number;       // calculated
  altitude?: number;      // calculated
  visible?: boolean;
}

export interface Constellation {
  name: string;
  abbreviation: string;
  stars: string[];
  connections: [string, string][];
  mythology?: string;
}

// Bright stars visible from Innsbruck (magnitude < 3.0)
export const BRIGHT_STARS: Star[] = [
  // Big Dipper / Ursa Major
  { id: 'HIP50801', name: 'Dubhe', constellation: 'UMa', magnitude: 1.79, rightAscension: 11.062, declination: 61.751 },
  { id: 'HIP53910', name: 'Merak', constellation: 'UMa', magnitude: 2.37, rightAscension: 11.031, declination: 56.382 },
  { id: 'HIP58001', name: 'Phecda', constellation: 'UMa', magnitude: 2.44, rightAscension: 11.897, declination: 53.695 },
  { id: 'HIP59774', name: 'Megrez', constellation: 'UMa', magnitude: 3.31, rightAscension: 12.257, declination: 57.032 },
  { id: 'HIP62956', name: 'Alioth', constellation: 'UMa', magnitude: 1.68, rightAscension: 12.900, declination: 55.960 },
  { id: 'HIP65378', name: 'Mizar', constellation: 'UMa', magnitude: 2.04, rightAscension: 13.421, declination: 54.925 },
  { id: 'HIP67301', name: 'Alkaid', constellation: 'UMa', magnitude: 1.86, rightAscension: 13.792, declination: 49.313 },

  // Cassiopeia
  { id: 'HIP3179', name: 'Schedar', constellation: 'Cas', magnitude: 2.23, rightAscension: 0.675, declination: 56.537 },
  { id: 'HIP746', name: 'Caph', constellation: 'Cas', magnitude: 2.27, rightAscension: 0.153, declination: 59.150 },
  { id: 'HIP4427', name: 'Gamma Cas', constellation: 'Cas', magnitude: 2.47, rightAscension: 0.945, declination: 60.717 },
  { id: 'HIP6686', name: 'Ruchbah', constellation: 'Cas', magnitude: 2.68, rightAscension: 1.430, declination: 60.235 },
  { id: 'HIP8886', name: 'Segin', constellation: 'Cas', magnitude: 3.38, rightAscension: 1.906, declination: 63.670 },

  // Orion (winter constellation)
  { id: 'HIP25336', name: 'Bellatrix', constellation: 'Ori', magnitude: 1.64, rightAscension: 5.418, declination: 6.350 },
  { id: 'HIP25428', name: 'Mintaka', constellation: 'Ori', magnitude: 2.23, rightAscension: 5.533, declination: -0.299 },
  { id: 'HIP25930', name: 'Alnilam', constellation: 'Ori', magnitude: 1.70, rightAscension: 5.603, declination: -1.202 },
  { id: 'HIP26311', name: 'Alnitak', constellation: 'Ori', magnitude: 1.77, rightAscension: 5.679, declination: -1.943 },
  { id: 'HIP27989', name: 'Betelgeuse', constellation: 'Ori', magnitude: 0.50, rightAscension: 5.919, declination: 7.407 },
  { id: 'HIP24436', name: 'Rigel', constellation: 'Ori', magnitude: 0.13, rightAscension: 5.242, declination: -8.202 },

  // Leo
  { id: 'HIP49669', name: 'Regulus', constellation: 'Leo', magnitude: 1.35, rightAscension: 10.139, declination: 11.967 },
  { id: 'HIP50335', name: 'Algieba', constellation: 'Leo', magnitude: 2.28, rightAscension: 10.333, declination: 19.842 },
  { id: 'HIP54872', name: 'Zosma', constellation: 'Leo', magnitude: 2.56, rightAscension: 11.235, declination: 20.524 },
  { id: 'HIP57632', name: 'Denebola', constellation: 'Leo', magnitude: 2.14, rightAscension: 11.818, declination: 14.572 },

  // Cygnus (summer constellation)
  { id: 'HIP100453', name: 'Deneb', constellation: 'Cyg', magnitude: 1.25, rightAscension: 20.690, declination: 45.280 },
  { id: 'HIP104732', name: 'Sadr', constellation: 'Cyg', magnitude: 2.20, rightAscension: 20.371, declination: 40.257 },
  { id: 'HIP102098', name: 'Gienah', constellation: 'Cyg', magnitude: 2.46, rightAscension: 20.220, declination: 40.256 },
  { id: 'HIP97165', name: 'Albireo', constellation: 'Cyg', magnitude: 3.18, rightAscension: 19.512, declination: 27.960 },

  // Polaris (North Star)
  { id: 'HIP11767', name: 'Polaris', constellation: 'UMi', magnitude: 1.98, rightAscension: 2.530, declination: 89.264 },

  // Vega, Altair (summer triangle)
  { id: 'HIP91262', name: 'Vega', constellation: 'Lyr', magnitude: 0.03, rightAscension: 18.615, declination: 38.784 },
  { id: 'HIP97649', name: 'Altair', constellation: 'Aql', magnitude: 0.77, rightAscension: 19.846, declination: 8.868 },

  // Capella (always visible from Innsbruck)
  { id: 'HIP24608', name: 'Capella', constellation: 'Aur', magnitude: 0.08, rightAscension: 5.278, declination: 45.998 },

  // Arcturus
  { id: 'HIP69673', name: 'Arcturus', constellation: 'Boo', magnitude: -0.05, rightAscension: 14.261, declination: 19.182 }
];

// Major constellation definitions with connecting lines
export const CONSTELLATIONS: Constellation[] = [
  {
    name: 'Ursa Major',
    abbreviation: 'UMa',
    stars: ['HIP50801', 'HIP53910', 'HIP58001', 'HIP59774', 'HIP62956', 'HIP65378', 'HIP67301'],
    connections: [
      ['HIP50801', 'HIP53910'], // Dubhe -> Merak
      ['HIP53910', 'HIP58001'], // Merak -> Phecda
      ['HIP58001', 'HIP59774'], // Phecda -> Megrez
      ['HIP59774', 'HIP62956'], // Megrez -> Alioth
      ['HIP62956', 'HIP65378'], // Alioth -> Mizar
      ['HIP65378', 'HIP67301'], // Mizar -> Alkaid
      ['HIP50801', 'HIP59774'], // Dubhe -> Megrez (bowl connection)
      ['HIP53910', 'HIP62956']  // Merak -> Alioth (bowl connection)
    ],
    mythology: 'The Great Bear, containing the Big Dipper asterism'
  },
  {
    name: 'Cassiopeia',
    abbreviation: 'Cas',
    stars: ['HIP746', 'HIP3179', 'HIP4427', 'HIP6686', 'HIP8886'],
    connections: [
      ['HIP746', 'HIP3179'],   // Caph -> Schedar
      ['HIP3179', 'HIP4427'],  // Schedar -> Gamma Cas
      ['HIP4427', 'HIP6686'],  // Gamma Cas -> Ruchbah
      ['HIP6686', 'HIP8886']   // Ruchbah -> Segin
    ],
    mythology: 'The vain queen, forming a distinctive W shape'
  },
  {
    name: 'Orion',
    abbreviation: 'Ori',
    stars: ['HIP27989', 'HIP25336', 'HIP25428', 'HIP25930', 'HIP26311', 'HIP24436'],
    connections: [
      ['HIP25336', 'HIP27989'], // Bellatrix -> Betelgeuse
      ['HIP25428', 'HIP25930'], // Mintaka -> Alnilam
      ['HIP25930', 'HIP26311'], // Alnilam -> Alnitak
      ['HIP27989', 'HIP25930'], // Betelgeuse -> Alnilam
      ['HIP25336', 'HIP25930'], // Bellatrix -> Alnilam
      ['HIP24436', 'HIP26311'], // Rigel -> Alnitak
      ['HIP24436', 'HIP25930']  // Rigel -> Alnilam
    ],
    mythology: 'The great hunter, visible in winter'
  },
  {
    name: 'Leo',
    abbreviation: 'Leo',
    stars: ['HIP49669', 'HIP50335', 'HIP54872', 'HIP57632'],
    connections: [
      ['HIP49669', 'HIP50335'], // Regulus -> Algieba
      ['HIP50335', 'HIP54872'], // Algieba -> Zosma
      ['HIP54872', 'HIP57632']  // Zosma -> Denebola
    ],
    mythology: 'The lion, a spring constellation'
  },
  {
    name: 'Cygnus',
    abbreviation: 'Cyg',
    stars: ['HIP100453', 'HIP104732', 'HIP102098', 'HIP97165'],
    connections: [
      ['HIP100453', 'HIP104732'], // Deneb -> Sadr
      ['HIP104732', 'HIP102098'], // Sadr -> Gienah
      ['HIP104732', 'HIP97165']   // Sadr -> Albireo
    ],
    mythology: 'The swan, flying along the Milky Way'
  }
];

// Innsbruck location constants
export const INNSBRUCK_LOCATION = {
  latitude: 47.2692,
  longitude: 11.4041,
  elevation: 574, // meters
  timezone: 'Europe/Vienna'
};