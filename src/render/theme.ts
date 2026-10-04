import type { Biome } from '../data/types';

export type TreeStyle = 'round' | 'pine' | 'palm' | 'desert' | 'swamp' | 'dead';
export type GroundStyle = 'grass' | 'sand' | 'ash' | 'bog';

export interface Theme {
  bgTop: string;
  bgBottom: string;
  /** Soft haze at the horizon behind the island. */
  haze: string;
  grass: string;
  grassLight: string;
  grassDark: string;
  path: string;
  pathLight: string;
  pathDark: string;
  dirt: string;
  dirtDark: string;
  stone: string;
  water: string;
  waterDeep: string;
  foam: string;
  leaves: string[];
  trunk: string;
  rock: string;
  moss: string;
  flowers: string[];
  /** Snow caps on trees and rocks. */
  snow: boolean;
  /** Vegetation family. */
  tree: TreeStyle;
  /** Surface texture of buildable ground. */
  ground: GroundStyle;
  lava: string;
  lavaDeep: string;
}

const LAVA = { lava: '#ff8a2b', lavaDeep: '#c4321c' };

export const THEMES: Record<Biome, Theme> = {
  meadow: {
    bgTop: '#c3cdf2',
    bgBottom: '#8b95d6',
    haze: '#dfe4fb',
    grass: '#86c95c',
    grassLight: '#a3dc72',
    grassDark: '#5f9e43',
    path: '#ecd59c',
    pathLight: '#f6e6bb',
    pathDark: '#cfb075',
    dirt: '#b98a58',
    dirtDark: '#8c623d',
    stone: '#9a93ab',
    water: '#5cb8e0',
    waterDeep: '#3a86c2',
    foam: '#e8f8ff',
    leaves: ['#5ea94e', '#6cb85a', '#4e9846'],
    trunk: '#7c5236',
    rock: '#a9a5b8',
    moss: '#7fae55',
    flowers: ['#ffb3c7', '#fff1a0', '#ffffff', '#c7b3ff'],
    snow: false,
    tree: 'round',
    ground: 'grass',
    ...LAVA,
  },
  autumn: {
    bgTop: '#f2d6bb',
    bgBottom: '#cf9a8a',
    haze: '#fbe8d8',
    grass: '#b3c06a',
    grassLight: '#c8d27e',
    grassDark: '#8a9a4c',
    path: '#e9cf9f',
    pathLight: '#f4e0b9',
    pathDark: '#c9a874',
    dirt: '#a8794f',
    dirtDark: '#7a5236',
    stone: '#9f9089',
    water: '#5fa9c9',
    waterDeep: '#3d7ea6',
    foam: '#f3f1e6',
    leaves: ['#e38534', '#d0583c', '#efb03a', '#c9472f'],
    trunk: '#6d4430',
    rock: '#b3a49d',
    moss: '#9aa65a',
    flowers: ['#ffe08a', '#ffb07a', '#ffffff'],
    snow: false,
    tree: 'round',
    ground: 'grass',
    ...LAVA,
  },
  snow: {
    bgTop: '#d7e6f8',
    bgBottom: '#93afd8',
    haze: '#eef5ff',
    grass: '#e9eff8',
    grassLight: '#f8fbff',
    grassDark: '#c4d1e4',
    path: '#cdbda4',
    pathLight: '#ddd0bb',
    pathDark: '#ad9b80',
    dirt: '#8d97b0',
    dirtDark: '#68718b',
    stone: '#7f89a4',
    water: '#8fcbe8',
    waterDeep: '#5d9fcb',
    foam: '#ffffff',
    leaves: ['#3d755f', '#47836a', '#346653'],
    trunk: '#5f4436',
    rock: '#a2abc0',
    moss: '#c9d6e6',
    flowers: ['#c9e6ff', '#ffffff'],
    snow: true,
    tree: 'pine',
    ground: 'grass',
    ...LAVA,
  },
  dusk: {
    bgTop: '#8a77bd',
    bgBottom: '#3d3470',
    haze: '#b9a8e0',
    grass: '#6fa98a',
    grassLight: '#85bd9d',
    grassDark: '#4f8169',
    path: '#d4c1a3',
    pathLight: '#e2d3ba',
    pathDark: '#b19d7f',
    dirt: '#80677a',
    dirtDark: '#5a465a',
    stone: '#837c9f',
    water: '#6b9fd6',
    waterDeep: '#4769a8',
    foam: '#e3e6ff',
    leaves: ['#4f8f74', '#5d9e7d', '#447d66'],
    trunk: '#56393f',
    rock: '#9d96b8',
    moss: '#6f9a80',
    flowers: ['#ffd1f0', '#c9b3ff', '#fff3a0'],
    snow: false,
    tree: 'pine',
    ground: 'grass',
    ...LAVA,
  },
  coast: {
    bgTop: '#bfe6f5',
    bgBottom: '#6fb0dc',
    haze: '#e8f8ff',
    grass: '#8fd06a',
    grassLight: '#ace37f',
    grassDark: '#68ab4b',
    path: '#f2deaa',
    pathLight: '#fcefcb',
    pathDark: '#d8bd84',
    dirt: '#d9b980',
    dirtDark: '#b08c55',
    stone: '#a89e8e',
    water: '#3fc6dc',
    waterDeep: '#1d84b8',
    foam: '#ffffff',
    leaves: ['#4fa64a', '#5eb954', '#3f9440'],
    trunk: '#a07850',
    rock: '#c2b9a8',
    moss: '#e9dcb2',
    flowers: ['#ff9fb8', '#ffe07a', '#ffffff'],
    snow: false,
    tree: 'palm',
    ground: 'grass',
    ...LAVA,
  },
  desert: {
    bgTop: '#f8e1b4',
    bgBottom: '#dc9d6c',
    haze: '#fdf0d6',
    grass: '#e7c47e',
    grassLight: '#f2d698',
    grassDark: '#cba15f',
    path: '#cf9663',
    pathLight: '#dcab7c',
    pathDark: '#ad744a',
    dirt: '#c9915a',
    dirtDark: '#9a6a3e',
    stone: '#b4886a',
    water: '#4cc6c8',
    waterDeep: '#2a8ea8',
    foam: '#effff6',
    leaves: ['#6aa13d', '#7ab249', '#5a8f34'],
    trunk: '#9a6a3e',
    rock: '#d9ab78',
    moss: '#ecd39a',
    flowers: ['#ff8fa3', '#fff1a0', '#ffb0d0'],
    snow: false,
    tree: 'desert',
    ground: 'sand',
    ...LAVA,
  },
  swamp: {
    bgTop: '#b3c3ab',
    bgBottom: '#5d7a6b',
    haze: '#d6e0cf',
    grass: '#7b9a52',
    grassLight: '#90ad62',
    grassDark: '#5d7a3e',
    path: '#a89070',
    pathLight: '#baa282',
    pathDark: '#866f50',
    dirt: '#6e5a3e',
    dirtDark: '#4f402c',
    stone: '#6f6f63',
    water: '#5f8f68',
    waterDeep: '#36624c',
    foam: '#cfe3b8',
    leaves: ['#5e7f3a', '#6f8f45', '#4d6b30'],
    trunk: '#4f3b2a',
    rock: '#8a8a78',
    moss: '#7f9a4a',
    flowers: ['#e9f5a0', '#c7b3ff', '#ffffff'],
    snow: false,
    tree: 'swamp',
    ground: 'bog',
    ...LAVA,
  },
  volcano: {
    bgTop: '#7a5560',
    bgBottom: '#2b1d28',
    haze: '#b47a68',
    grass: '#6e6563',
    grassLight: '#80766f',
    grassDark: '#514948',
    path: '#8c6c58',
    pathLight: '#9f7e68',
    pathDark: '#6a4c3e',
    dirt: '#4a3a36',
    dirtDark: '#30252a',
    stone: '#3a3036',
    water: '#5cb8e0',
    waterDeep: '#3a86c2',
    foam: '#ffd04a',
    leaves: ['#3a2e2c', '#45352f'],
    trunk: '#2e2422',
    rock: '#4d4549',
    moss: '#ff7a2b',
    flowers: ['#ff9a3a', '#ffd04a'],
    snow: false,
    tree: 'dead',
    ground: 'ash',
    ...LAVA,
  },
};
