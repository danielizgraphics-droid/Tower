import type { MapDef } from './types';

/*
 * Legend:  .  grass (buildable)   F  flowers (buildable)   #  path
 *          S  spawn               C  castle                 T  tree
 *          R  rock                W  water
 * Rows run from the back of the board (top of the screen) to the front.
 */
export const MAPS: MapDef[] = [
  {
    id: 'meadow',
    name: 'Prados del Alba',
    description: 'Un valle tranquilo con un camino largo y sinuoso. Perfecto para empezar.',
    theme: 'meadow',
    waves: 30,
    hpScale: 0.9,
    tiles: [
      'TT.....F...TT..R..TT',
      'S#######.....T.....T',
      'T......#...........R',
      '.F.....#..#######...',
      '..R....#..#.....#...',
      '.......#..#..W..#..T',
      'T......#..#..WW.#...',
      '.......####.....#...',
      '..F.............#.F.',
      'T...#############...',
      '....#...........R..T',
      '.R..#######C.......T',
      'TT........TT...F..TT',
    ],
  },
  {
    id: 'autumn',
    name: 'Bosque Otoñal',
    description: 'Dos curvas cerradas bajo los arces. Los enemigos llegan antes.',
    theme: 'autumn',
    waves: 30,
    hpScale: 1.1,
    requires: 'meadow',
    tiles: [
      'TT..T.....TT...T..TT',
      'T....F..........R..T',
      'S##########........T',
      '..........#..T.....T',
      '.T..#######...######',
      '....#.........#....C',
      '....#..WWW....#....T',
      '.R..#..WWW....#....T',
      '....#.........#..F..',
      'T...###########....T',
      '..F...........T....T',
      'TT..R....TT......TTT',
    ],
  },
  {
    id: 'snow',
    name: 'Paso Helado',
    description: 'Un camino estrecho en zigzag a través de la montaña nevada.',
    theme: 'snow',
    waves: 30,
    hpScale: 1.25,
    requires: 'autumn',
    tiles: [
      'RRT..T.S..T..RR..TRR',
      'R......#.........R.R',
      'T..#####......#####T',
      '...#..........#...#.',
      '...#..R...T...#...#.',
      'T..#####......#...#T',
      '.......#..W...#...#.',
      '.R.....########...#.',
      '..................#.',
      'T..F...############.',
      '.......#...........T',
      'RT.....C....T...R.RR',
    ],
  },
  {
    id: 'dusk',
    name: 'Ruinas del Crepúsculo',
    description: 'El último bastión. Un laberinto de ruinas bajo un cielo violeta.',
    theme: 'dusk',
    waves: 30,
    hpScale: 1.4,
    requires: 'snow',
    tiles: [
      'TR..T...R...T...RR.T',
      'S#####....R.......TR',
      '.....#..#######....T',
      '.R...#..#.....#....R',
      '.....#..#..W..#.....',
      'T....#..#..W..####..',
      '.....####.......R#..',
      '..R..............#.T',
      'T..#############.#..',
      '...#...........#.#..',
      '.F.#..R....T...###..',
      'T..#..............T.',
      'RT.C..T....RR...T.RR',
    ],
  },
];

export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export const DIFFICULTY: Record<'easy' | 'normal' | 'hard', { name: string; hp: number; gold: number; stars: number; lives: number }> = {
  easy: { name: 'Fácil', hp: 0.75, gold: 1.15, stars: 0.6, lives: 30 },
  normal: { name: 'Normal', hp: 1, gold: 1, stars: 1, lives: 20 },
  hard: { name: 'Heroico', hp: 1.35, gold: 0.9, stars: 1.6, lives: 12 },
};
