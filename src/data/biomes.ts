import type { Biome, EnemyId } from './types';

export type { Biome };

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
  /** Lava pools (volcanic regions). */
  lava?: number;
  /** A stretch of sea along the front shore. */
  sea?: boolean;
  /** Regional boss that replaces the wave-20 boss. */
  boss?: EnemyId;
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
    id: 'coast',
    name: 'Costa de Coral',
    description: 'Calas, palmeras y mucha agua: el sitio ideal para las torres marinas.',
    hpScale: 1,
    requires: 'meadow',
    trees: 0.06,
    rocks: 0.02,
    water: 2.2,
    flowers: 0.05,
    sea: true,
    prefixes: ['Cala de', 'Playa de', 'Bahía de', 'Arrecife de'],
    places: ['Coral', 'Espuma Blanca', 'Caracolas', 'Marea Alta', 'Puerto Sal', 'Gaviotas', 'Arenas Doradas'],
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
    id: 'desert',
    name: 'Desierto de Ámbar',
    description: 'Dunas, cactus y oasis escasos. Escorpiones y momias acechan.',
    hpScale: 1.15,
    requires: 'coast',
    trees: 0.05,
    rocks: 0.05,
    water: 1.1,
    flowers: 0.015,
    boss: 'scorpionKing',
    prefixes: ['Dunas de', 'Oasis de', 'Ruinas de', 'Cañón de'],
    places: ['Ámbar', 'Sol Eterno', 'Arena Roja', 'Kaharí', 'Espejismo', 'Siete Pozos', 'Escarabajo'],
  },
  {
    id: 'swamp',
    name: 'Pantano Sombrío',
    description: 'Aguas turbias entre sauces y setas gigantes. Hogar de brujas y de la Hidra.',
    hpScale: 1.2,
    requires: 'autumn',
    trees: 0.1,
    rocks: 0.02,
    water: 2,
    flowers: 0.03,
    boss: 'hydra',
    prefixes: ['Ciénaga de', 'Marismas de', 'Pantano de', 'Fangal de'],
    places: ['Niebla Verde', 'Sapo Viejo', 'Juncales', 'Agua Negra', 'Brujería', 'Lodazal'],
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
    id: 'volcano',
    name: 'Tierras Volcánicas',
    description: 'Ceniza, basalto y ríos de lava. Aquí no hay agua para torres marinas.',
    hpScale: 1.35,
    requires: 'desert',
    trees: 0.04,
    rocks: 0.07,
    water: 0,
    lava: 2.2,
    flowers: 0.03,
    boss: 'colossus',
    prefixes: ['Caldera de', 'Faldas de', 'Forja de', 'Cráter de'],
    places: ['Ceniza Ardiente', 'Magmar', 'Pico Negro', 'Brasas', 'Azufre', 'Obsidiana'],
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
  {
    id: 'jungle',
    name: 'Selva Esmeralda',
    description: 'Vegetación espesa, ríos y enjambres. La Reina de la Colmena gobierna desde las copas.',
    hpScale: 1.3,
    requires: 'swamp',
    trees: 0.16,
    rocks: 0.02,
    water: 1.6,
    flowers: 0.08,
    boss: 'hiveQueen',
    prefixes: ['Selva de', 'Espesura de', 'Ribera de', 'Templo de'],
    places: ['Esmeralda', 'Mil Lianas', 'Jaguar', 'Río Verde', 'Orquídea', 'Colmena Alta'],
  },
  {
    id: 'canyon',
    name: 'Cañón Carmesí',
    description: 'Paredes de roca roja y caminos de arcilla. Un Cíclope custodia los desfiladeros.',
    hpScale: 1.28,
    requires: 'desert',
    trees: 0.03,
    rocks: 0.1,
    water: 0.5,
    flowers: 0.01,
    boss: 'cyclopsKing',
    prefixes: ['Cañón de', 'Desfiladero de', 'Mesa de', 'Barranco de'],
    places: ['Carmesí', 'Óxido', 'Piedra Roja', 'Buitres', 'Eco Lejano', 'Arcilla'],
  },
  {
    id: 'crystal',
    name: 'Páramo de Cristal',
    description: 'Cristales arcanos brotan de la tierra. El reto final, vigilado por un Coloso de Cristal.',
    hpScale: 1.45,
    requires: 'dusk',
    trees: 0.05,
    rocks: 0.06,
    water: 0.9,
    flowers: 0.02,
    boss: 'prismGolem',
    prefixes: ['Páramo de', 'Grieta de', 'Geoda de', 'Prisma de'],
    places: ['Cristal', 'Luz Partida', 'Cuarzo', 'Resonancia', 'Amatista', 'Eco Arcano'],
  },
];

export const BIOME_BY_ID: Record<Biome, BiomeDef> = Object.fromEntries(BIOMES.map((b) => [b.id, b])) as Record<Biome, BiomeDef>;
