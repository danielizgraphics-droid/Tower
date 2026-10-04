import type { MapDef } from '../data/types';

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
  /** Pines with snow instead of round trees. */
  snow: boolean;
  /** Trees are pines. */
  pines: boolean;
}

export const THEMES: Record<MapDef['theme'], Theme> = {
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
    pines: false,
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
    pines: false,
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
    pines: true,
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
    pines: true,
  },
};
