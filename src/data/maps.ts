import type { Difficulty } from './types';

/** Maps are generated procedurally (see game/mapgen.ts); this file only holds difficulty presets. */
export const DIFFICULTY: Record<Difficulty, { name: string; hp: number; gold: number; stars: number; lives: number }> = {
  easy: { name: 'Fácil', hp: 0.75, gold: 1.15, stars: 0.6, lives: 30 },
  normal: { name: 'Normal', hp: 1, gold: 1, stars: 1, lives: 20 },
  hard: { name: 'Heroico', hp: 1.35, gold: 0.9, stars: 1.6, lives: 12 },
};
