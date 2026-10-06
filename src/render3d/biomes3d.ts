// How each biome looks in 3D: ground and road colours (painted into Kenney's
// palette texture), vegetation, far landscape, liquids and light.

import type { Biome } from '../data/types';

const N = (n: string) => `nature/${n}.glb`;
const HEX = (n: string) => `hex/nature/${n}.glb`;

export interface Biome3D {
  /** Gradient (top → bottom) replacing the grass swatch of the Kenney palette. */
  ground?: [string, string];
  /** Gradient replacing the dirt-road swatch. */
  path?: [string, string];
  /** Use Kenney's snow tile variants. */
  snow?: boolean;
  /** Free-standing trees for woods (empty = Kenney's tree tiles). */
  trees: string[];
  /** Share of woodland cells that actually grow trees (default 1). */
  sparse?: number;
  /** Replaces the colour of Kenney nature materials by name (leafsGreen, woodBark, grass...). */
  recolor?: Record<string, string>;
  /** Size of those trees in tiles (min, max). */
  treeH: [number, number];
  /** Small props scattered on open ground. */
  props: string[];
  /** Decoration of 'flowers' tiles on the board. */
  flowers: string[];
  /** Far landscape pieces (hex hills and mountains). */
  far: string[];
  /** Multiplier for the far pieces' colour. */
  farTint?: number;
  /** Fraction of the countryside covered by woods (0..1, 0.5 = default). */
  woods: number;
  water: string;
  /** Sea beyond the bottom and right shores. */
  ocean?: boolean;
  /** Extra ponds (water) or pools (lava) in the countryside. */
  pools?: 'water' | 'lava';
  light: { sky: string; ground: string; hemi: number; sun: string; sunI: number };
}

const GREEN_FAR = [HEX('mountain_A_grass_trees'), HEX('mountain_B_grass_trees'), HEX('hills_A_trees'), HEX('hills_B_trees')];
const ROCK_FAR = [HEX('mountain_A'), HEX('mountain_B'), HEX('mountain_C')];
const DAY = { sky: '#dfe9ff', ground: '#6b5a48', hemi: 1.6, sun: '#fff4dc', sunI: 2.6 };

export const BIOMES_3D: Record<Biome, Biome3D> = {
  meadow: {
    trees: [],
    treeH: [1, 1],
    props: [N('grass_large'), N('flower_yellowA')],
    flowers: [N('flower_redA'), N('flower_yellowA'), N('flower_purpleA')],
    far: GREEN_FAR,
    woods: 0.5,
    water: '#2f9fd0',
    light: DAY,
  },
  coast: {
    ground: ['#9fdc8c', '#4f9a62'],
    path: ['#f3dcaa', '#d9b57a'],
    trees: [N('tree_palmTall'), N('tree_palmBend'), N('tree_palm'), N('tree_palmShort'), N('tree_palmDetailedTall')],
    treeH: [0.8, 1.3],
    props: [N('grass_large'), N('rock_smallFlatA'), N('plant_bushSmall')],
    flowers: [N('flower_yellowA'), N('flower_redA'), N('plant_bushSmall')],
    far: [HEX('hills_A_trees'), HEX('hills_B_trees'), HEX('mountain_A_grass_trees')],
    woods: 0.3,
    recolor: { leafsGreen: '#5fc27a' },
    water: '#27b3d6',
    ocean: true,
    light: { sky: '#e6f4ff', ground: '#7a6a50', hemi: 1.7, sun: '#fff6e0', sunI: 2.7 },
  },
  autumn: {
    ground: ['#c8c56d', '#7d7a3c'],
    path: ['#c9875a', '#9a5f3a'],
    trees: [N('tree_default_fall'), N('tree_oak_fall'), N('tree_fat_fall'), N('tree_cone_fall'), N('tree_detailed_fall'), N('tree_tall_fall')],
    treeH: [0.75, 1.15],
    props: [N('stump_round'), N('mushroom_red'), N('log'), N('grass_leafs')],
    flowers: [N('mushroom_redGroup'), N('mushroom_tanGroup'), N('grass_leafs')],
    far: [HEX('hills_A_trees'), HEX('hills_B_trees'), HEX('mountain_A_grass'), HEX('mountain_B_grass')],
    farTint: 0.95,
    woods: 0.62,
    recolor: { grass: '#b9b25a', leafsGreen: '#c9a24a', leafsFall: '#e8803a' },
    water: '#3a96b8',
    light: { sky: '#ffe9cf', ground: '#6b4a38', hemi: 1.55, sun: '#ffd9a8', sunI: 2.6 },
  },
  desert: {
    ground: ['#f2d49a', '#c9975a'],
    path: ['#d99a60', '#a8673a'],
    trees: [N('cactus_tall'), N('cactus_short'), N('tree_palmDetailedShort'), N('cactus_tall')],
    treeH: [0.5, 0.95],
    props: [N('stone_smallFlatB'), N('stone_smallC'), N('cactus_short'), N('stone_smallFlatA')],
    flowers: [N('cactus_short'), N('stone_smallFlatC')],
    far: [HEX('mountain_A'), HEX('mountain_B'), HEX('mountain_C')],
    farTint: 1.1,
    woods: 0.3,
    sparse: 0.22,
    recolor: { leafsGreen: '#6fae5f', grass: '#c9b06a' },
    water: '#2fb0c8',
    light: { sky: '#fff1d8', ground: '#a07a50', hemi: 1.75, sun: '#fff0d0', sunI: 2.9 },
  },
  swamp: {
    ground: ['#7f9a5f', '#3e5a3a'],
    path: ['#8b7355', '#5e4a36'],
    trees: [N('tree_default_dark'), N('tree_oak_dark'), N('tree_thin_dark'), N('tree_blocks_dark'), N('tree_simple_dark')],
    treeH: [0.8, 1.2],
    props: [N('mushroom_tanTall'), N('mushroom_red'), N('stump_old'), N('log_large'), N('grass_leafsLarge')],
    flowers: [N('mushroom_tanGroup'), N('mushroom_redGroup'), N('grass_leafsLarge')],
    far: [HEX('hills_A_trees'), HEX('hills_B_trees'), HEX('hills_C_trees')],
    farTint: 0.75,
    woods: 0.6,
    recolor: { leafsDark: '#4f7a45', woodBarkDark: '#5a4636', grass: '#5f7a42' },
    water: '#3f7a5a',
    pools: 'water',
    light: { sky: '#cfe0c8', ground: '#4a4a38', hemi: 1.45, sun: '#f2ffd8', sunI: 2.2 },
  },
  snow: {
    snow: true,
    trees: [],
    treeH: [1, 1],
    props: [N('rock_smallFlatA'), N('stump_round')],
    flowers: [N('rock_smallFlatB'), N('rock_smallA')],
    far: ROCK_FAR,
    farTint: 1.15,
    woods: 0.5,
    water: '#5ab8e0',
    light: { sky: '#e8f2ff', ground: '#8a94a8', hemi: 1.7, sun: '#f4f8ff', sunI: 2.5 },
  },
  volcano: {
    ground: ['#7a6660', '#3d3030'],
    path: ['#8a5040', '#5a2e26'],
    trees: [N('stump_oldTall'), N('tree_thin_dark'), N('stump_old'), N('stone_tallB'), N('tree_thin_dark')],
    treeH: [0.45, 0.9],
    props: [N('stone_smallC'), N('stone_tallA'), N('stone_smallB'), N('stone_smallFlatA')],
    flowers: [N('stone_smallA'), N('stone_smallFlatB')],
    far: [HEX('mountain_C'), HEX('mountain_B'), HEX('mountain_A')],
    farTint: 0.55,
    woods: 0.4,
    sparse: 0.5,
    recolor: { leafsDark: '#3a3030', woodBarkDark: '#2e2422', woodBark: '#3a2a26', grass: '#5a4a40', dirt: '#4a3a34', stone: '#6a5c56' },
    water: '#2f9fd0',
    pools: 'lava',
    light: { sky: '#ffcfb8', ground: '#3a2020', hemi: 1.35, sun: '#ffb27a', sunI: 2.6 },
  },
  dusk: {
    ground: ['#9b97c4', '#4e4a7a'],
    path: ['#b39a8a', '#7a6470'],
    trees: [N('tree_blocks_dark'), N('tree_cone_dark'), N('tree_thin_dark'), N('tree_plateau_dark'), N('stump_oldTall')],
    treeH: [0.8, 1.2],
    props: [N('stone_tallC'), N('stump_old'), N('mushroom_tanTall'), N('stone_smallB')],
    flowers: [N('mushroom_tanGroup'), N('flower_purpleA'), N('flower_purpleB')],
    far: [HEX('mountain_A'), HEX('mountain_C'), HEX('hills_C_trees')],
    farTint: 0.7,
    woods: 0.5,
    recolor: { leafsDark: '#6d5fa8', woodBarkDark: '#5a4a5a', woodBark: '#7a5a6a', grass: '#7a72a8' },
    water: '#4a6ab0',
    light: { sky: '#d8c8ff', ground: '#3a2a50', hemi: 1.45, sun: '#ffc4a0', sunI: 2.3 },
  },
};

/** Kenney tower-defense tile in the biome's variant (snow or default). */
export const tdTile = (b: Biome3D, name: string) => `td/${b.snow ? 'snow-' : ''}${name}.glb`;

const TD_TILES = [
  'tile',
  'tile-straight',
  'tile-corner-round',
  'tile-end-round',
  'tile-spawn-end-round',
  'tile-tree',
  'tile-tree-double',
  'tile-tree-quad',
  'tile-rock',
  'tile-crystal',
  'detail-rocks',
];

/** Every model a biome's terrain may use (for preloading and packaging). */
export function biomeModels(b: Biome3D): string[] {
  return [...new Set([...TD_TILES.map((t) => tdTile(b, t)), ...b.trees, ...b.props, ...b.flowers, ...b.far])];
}
