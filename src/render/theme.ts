import type { MapDef } from '../data/types';

export interface Theme {
  bgTop: string;
  bgBottom: string;
  grass: string;
  grassAlt: string;
  path: string;
  pathEdge: string;
  dirt: string;
  stone: string;
  water: string;
  leaves: string[];
  trunk: string;
  rock: string;
  flowers: string[];
  /** Snow caps on trees/rocks. */
  snow: boolean;
  fog: string;
}

export const THEMES: Record<MapDef['theme'], Theme> = {
  meadow: {
    bgTop: '#b3bff0',
    bgBottom: '#8592d4',
    grass: '#8fd46a',
    grassAlt: '#86cc61',
    path: '#f2dca4',
    pathEdge: '#e2c584',
    dirt: '#c99a62',
    stone: '#a29cb8',
    water: '#6cc8ea',
    leaves: ['#5fae55', '#6dbd5c', '#4f9c4c'],
    trunk: '#8a5a3c',
    rock: '#b8b3c6',
    flowers: ['#ffb3c7', '#fff3a0', '#ffffff', '#c7b3ff'],
    snow: false,
    fog: 'rgba(160,170,230,0.0)',
  },
  autumn: {
    bgTop: '#f4d2ae',
    bgBottom: '#d99a86',
    grass: '#bccb6a',
    grassAlt: '#b3c264',
    path: '#f0d6a6',
    pathEdge: '#dcbb82',
    dirt: '#b9875a',
    stone: '#a8988f',
    water: '#6fb9d6',
    leaves: ['#e8893a', '#d95b3f', '#f0b13c'],
    trunk: '#7a4a32',
    rock: '#b9ada6',
    flowers: ['#ffe08a', '#ffb07a', '#ffffff'],
    snow: false,
    fog: 'rgba(255,200,160,0.0)',
  },
  snow: {
    bgTop: '#cfe2f7',
    bgBottom: '#93b2db',
    grass: '#eef3fa',
    grassAlt: '#e6edf7',
    path: '#cdbda5',
    pathEdge: '#b8a68c',
    dirt: '#9aa6bf',
    stone: '#8e98b3',
    water: '#9fd8f0',
    leaves: ['#3f7a62', '#4a8a6d', '#36705a'],
    trunk: '#6b4a3a',
    rock: '#a9b2c6',
    flowers: ['#c9e6ff', '#ffffff'],
    snow: true,
    fog: 'rgba(230,240,255,0.0)',
  },
  dusk: {
    bgTop: '#7a69b0',
    bgBottom: '#3f3570',
    grass: '#79b48f',
    grassAlt: '#71ab87',
    path: '#dccaa9',
    pathEdge: '#c7b28c',
    dirt: '#8a6f7a',
    stone: '#8d86a8',
    water: '#6aa6d9',
    leaves: ['#4f8f74', '#5d9e7d', '#447d66'],
    trunk: '#5d4044',
    rock: '#a49dbd',
    flowers: ['#ffd1f0', '#c9b3ff', '#fff3a0'],
    snow: false,
    fog: 'rgba(80,60,140,0.0)',
  },
};
