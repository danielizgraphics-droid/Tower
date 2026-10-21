import type { MissionRules } from '../game/game';
import { generateMap } from '../game/mapgen';
import type { Biome, MapDef } from './types';

/**
 * Expert maps: fixed, hand-picked layouts with several entrances and forks,
 * so no set of towers can watch every road at once. Always heroic difficulty.
 */
export interface ExpertDef {
  id: string;
  name: string;
  description: string;
  biome: Biome;
  seed: number;
  size: number;
  spawns: number;
  forks: number;
  /** Extra enemy health on top of the region's. */
  hp: number;
  /** Sky: floating islands of one or two tiles; flyers only. */
  islandMax?: number;
  /** Open sea: only naval towers (and the hero, on a raft). */
  allWater?: boolean;
  rules?: MissionRules;
  /** Short tags shown on the card. */
  tags: string[];
}

export const EXPERT_MAPS: ExpertDef[] = [
  {
    id: 'x-crossroads',
    name: 'La Encrucijada',
    description: 'Dos caminos llegan desde lados opuestos del valle y se unen a las puertas del castillo.',
    biome: 'meadow',
    seed: 1101,
    size: 17,
    spawns: 2,
    forks: 0,
    hp: 0.9,
    tags: ['2 entradas'],
  },
  {
    id: 'x-forks',
    name: 'Senda Bífida',
    description: 'Un solo camino que se parte una y otra vez: los enemigos se reparten por cada desvío.',
    biome: 'autumn',
    seed: 2207,
    size: 17,
    spawns: 1,
    forks: 3,
    hp: 1,
    tags: ['Caminos múltiples'],
  },
  {
    id: 'x-three',
    name: 'Las Tres Puertas',
    description: 'Tres desfiladeros desembocan en el cañón. Habrá que elegir qué puerta defender mejor.',
    biome: 'canyon',
    seed: 5531,
    size: 19,
    spawns: 3,
    forks: 0,
    hp: 1,
    tags: ['3 entradas'],
  },
  {
    id: 'x-sea',
    name: 'Mar Abierto',
    description: 'No hay tierra firme: solo calzadas sobre el mar. Únicamente las torres navales pueden defenderlo.',
    biome: 'coast',
    seed: 4421,
    size: 17,
    spawns: 2,
    forks: 1,
    hp: 1.3,
    allWater: true,
    rules: { groundOnly: true },
    tags: ['Solo agua', 'Torres navales', '2 entradas'],
  },
  {
    id: 'x-sky',
    name: 'Archipiélago Celeste',
    description: 'Islotes flotantes donde apenas caben una o dos torres. Las bestias aladas vuelan por rutas de nubes.',
    biome: 'sky',
    seed: 3313,
    size: 17,
    spawns: 2,
    forks: 1,
    hp: 1,
    islandMax: 2,
    tags: ['Celeste', 'Solo voladores', '2 entradas'],
  },
  {
    id: 'x-frost',
    name: 'Cruce Helado',
    description: 'Tres sendas nevadas y un desvío traicionero. El frío no perdona descuidos.',
    biome: 'snow',
    seed: 7727,
    size: 19,
    spawns: 3,
    forks: 1,
    hp: 1.3,
    tags: ['3 entradas', 'Caminos múltiples'],
  },
  {
    id: 'x-ash',
    name: 'Laberinto de Ceniza',
    description: 'Dos ríos de enemigos que se bifurcan entre coladas de lava.',
    biome: 'volcano',
    seed: 6619,
    size: 19,
    spawns: 2,
    forks: 2,
    hp: 0.9,
    tags: ['2 entradas', 'Caminos múltiples'],
  },
  {
    id: 'x-chaos',
    name: 'Corona del Caos',
    description: 'Cuatro portales se abren alrededor del castillo. La prueba definitiva.',
    biome: 'dusk',
    seed: 8849,
    size: 21,
    spawns: 4,
    forks: 1,
    hp: 0.7,
    tags: ['4 entradas', 'Caminos múltiples'],
  },
];

export const EXPERT_BY_ID: Record<string, ExpertDef> = Object.fromEntries(EXPERT_MAPS.map((x) => [x.id, x]));

export function expertMap(x: ExpertDef, waves: number): MapDef {
  const def = generateMap({
    biome: x.biome,
    seed: x.seed,
    size: x.size,
    waves,
    lanes: { spawns: x.spawns, forks: x.forks },
    islandMax: x.islandMax,
    allWater: x.allWater,
  });
  return { ...def, id: x.id, name: x.name, hpScale: def.hpScale * x.hp };
}
