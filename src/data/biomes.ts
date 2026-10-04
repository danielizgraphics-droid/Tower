import type { MapDef } from './types';

export type Biome = MapDef['theme'];

export interface BiomeDef {
  id: Biome;
  name: string;
  description: string;
  hpScale: number;
  /** Biome that must be cleared (30 waves) before this one unlocks. */
  requires?: Biome;
  /** Decoration densities. */
  trees: number;
  rocks: number;
  water: number;
  flowers: number;
  places: string[];
  prefixes: string[];
}

export const BIOMES: BiomeDef[] = [
  {
    id: 'meadow',
    name: 'Prados',
    description: 'Valles verdes y caminos de tierra. El lugar ideal para empezar.',
    hpScale: 0.9,
    trees: 0.07,
    rocks: 0.02,
    water: 1,
    flowers: 0.08,
    prefixes: ['Prados de', 'Valle de', 'Colinas de', 'Vega de'],
    places: ['Alborada', 'Robledal', 'Trigal Alto', 'Fuentesol', 'Villaverde', 'Monteluz', 'Riachuelo', 'Brezales'],
  },
  {
    id: 'autumn',
    name: 'Bosque Otoñal',
    description: 'Arces rojizos y senderos estrechos. Los enemigos son más resistentes.',
    hpScale: 1.1,
    requires: 'meadow',
    trees: 0.13,
    rocks: 0.025,
    water: 1,
    flowers: 0.04,
    prefixes: ['Bosque de', 'Arboleda de', 'Hayedo de', 'Umbría de'],
    places: ['Hojarasca', 'Valdecuervo', 'Castañar', 'Ocaso Rojo', 'Robleda', 'Piedrafita', 'Bellotas'],
  },
  {
    id: 'snow',
    name: 'Montañas Heladas',
    description: 'Pinos nevados y roca desnuda. El frío endurece a los invasores.',
    hpScale: 1.25,
    requires: 'autumn',
    trees: 0.08,
    rocks: 0.06,
    water: 0.6,
    flowers: 0.01,
    prefixes: ['Paso de', 'Cumbres de', 'Puerto de', 'Glaciar de'],
    places: ['Escarcha', 'Peñablanca', 'Ventisquero', 'Hielo Eterno', 'Cuervonevado', 'Lobos Grises'],
  },
  {
    id: 'dusk',
    name: 'Ruinas del Crepúsculo',
    description: 'Tierras malditas bajo un cielo violeta. Solo para comandantes veteranos.',
    hpScale: 1.4,
    requires: 'snow',
    trees: 0.06,
    rocks: 0.07,
    water: 0.8,
    flowers: 0.03,
    prefixes: ['Ruinas de', 'Cripta de', 'Santuario de', 'Bastión de'],
    places: ['Ceniza', 'Velo Oscuro', 'Lunanegra', 'Ultratumba', 'Tres Coronas', 'Sombraluz'],
  },
];

export const BIOME_BY_ID: Record<Biome, BiomeDef> = Object.fromEntries(BIOMES.map((b) => [b.id, b])) as Record<Biome, BiomeDef>;
