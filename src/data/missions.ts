// Missions: hand-picked battles with special rules. Each one is played on a
// fixed map, and completing it pays stars or opens exclusive content
// (towers and regions that can't be bought with stars).

import type { MissionRules } from '../game/game';
import type { Biome, Difficulty, TowerId } from './types';

export interface MissionReward {
  stars?: number;
  tower?: TowerId;
  region?: Biome;
}

export interface MissionDef {
  id: string;
  chapter: number;
  name: string;
  /** Short story / flavour line. */
  story: string;
  biome: Biome;
  /** Fixed map seed: everyone plays the same battlefield. */
  seed: number;
  difficulty: Difficulty;
  waves: number;
  /** Towers that may be built (they can be tried even if not unlocked yet). */
  towers: TowerId[];
  rules: MissionRules;
  /** Missions to complete first. */
  requires: string[];
  reward: MissionReward;
}

export const CHAPTERS = ['Pruebas del Reino', 'Maestros de la Guerra', 'Leyendas'];

const BASIC: TowerId[] = ['archer', 'cannon', 'arcane', 'frost'];

export const MISSIONS: MissionDef[] = [
  // ---------------------------------------------------------------- chapter 1
  {
    id: 'archers',
    chapter: 0,
    name: 'Solo arqueros',
    story: 'El capitán quiere ver de qué es capaz la guardia de arqueros sin ayuda de nadie.',
    biome: 'meadow',
    seed: 1101,
    difficulty: 'normal',
    waves: 15,
    towers: ['archer'],
    rules: {},
    requires: [],
    reward: { stars: 5 },
  },
  {
    id: 'few',
    chapter: 0,
    name: 'Pocas manos',
    story: 'Media guarnición está de permiso. Defiende el valle con muy pocas torres.',
    biome: 'meadow',
    seed: 2203,
    difficulty: 'normal',
    waves: 15,
    towers: BASIC,
    rules: { maxTowers: 6 },
    requires: [],
    reward: { stars: 6 },
  },
  {
    id: 'nomagic',
    chapter: 0,
    name: 'Sin magia',
    story: 'Los magos de la corte han perdido la voz: no hay hechizos. Solo acero, pólvora y alquimia.',
    biome: 'autumn',
    seed: 3307,
    difficulty: 'easy',
    waves: 18,
    towers: ['archer', 'ballista', 'cannon', 'alchemist'],
    rules: { noSpells: true },
    requires: ['archers', 'few'],
    reward: { tower: 'sawmill' },
  },
  {
    id: 'flawless',
    chapter: 0,
    name: 'Defensa perfecta',
    story: 'El rey visita el castillo. Ni un solo enemigo puede cruzar la puerta.',
    biome: 'coast',
    seed: 4409,
    difficulty: 'easy',
    waves: 12,
    towers: ['archer', 'cannon', 'arcane', 'frost', 'storm', 'harbor'],
    rules: { noLeaks: true },
    requires: ['archers'],
    reward: { region: 'sakura' },
  },
  // ---------------------------------------------------------------- chapter 2
  {
    id: 'basics',
    chapter: 1,
    name: 'Vuelta a lo básico',
    story: 'La academia está cerrada: nada de especializaciones, solo torres de nivel 3.',
    biome: 'desert',
    seed: 5501,
    difficulty: 'normal',
    waves: 20,
    towers: ['archer', 'ballista', 'cannon', 'arcane', 'frost', 'storm', 'alchemist'],
    rules: { maxTier: 3 },
    requires: ['nomagic'],
    reward: { stars: 10 },
  },
  {
    id: 'mages',
    chapter: 1,
    name: 'Escuela de magos',
    story: 'Una prueba para los aprendices: solo torres mágicas contra la ciénaga.',
    biome: 'swamp',
    seed: 6603,
    difficulty: 'normal',
    waves: 20,
    towers: ['arcane', 'frost', 'storm', 'sanctum', 'obelisk'],
    rules: {},
    requires: ['nomagic'],
    reward: { tower: 'hexhut' },
  },
  {
    id: 'poor',
    chapter: 1,
    name: 'Arcas vacías',
    story: 'El tesoro real está vacío. Empiezas sin apenas oro y con un límite de torres.',
    biome: 'canyon',
    seed: 7707,
    difficulty: 'normal',
    waves: 20,
    towers: ['archer', 'ballista', 'cannon', 'arcane', 'frost', 'storm', 'alchemist', 'pyre'],
    rules: { startGold: 110, maxTowers: 9 },
    requires: ['flawless', 'basics'],
    reward: { region: 'gilded' },
  },
  {
    id: 'siege',
    chapter: 1,
    name: 'Artillería pesada',
    story: 'Solo máquinas de asedio contra la horda del crepúsculo.',
    biome: 'dusk',
    seed: 8803,
    difficulty: 'normal',
    waves: 20,
    towers: ['ballista', 'cannon', 'alchemist', 'quake'],
    rules: {},
    requires: ['basics'],
    reward: { stars: 12 },
  },
  // ---------------------------------------------------------------- chapter 3
  {
    id: 'lastwall',
    chapter: 2,
    name: 'La última muralla',
    story: 'El paso de montaña es la última defensa y solo hay piedra para 12 torres.',
    biome: 'snow',
    seed: 9901,
    difficulty: 'easy',
    waves: 20,
    towers: ['archer', 'ballista', 'cannon', 'arcane', 'pyre', 'frost', 'storm', 'alchemist', 'sanctum', 'obelisk'],
    rules: { lives: 20, maxTowers: 12 },
    requires: ['poor', 'siege'],
    reward: { tower: 'warden' },
  },
  {
    id: 'blossom',
    chapter: 2,
    name: 'Pétalos y acero',
    story: 'El jardín secreto está en peligro. Defiéndelo con las torres que has ganado.',
    biome: 'sakura',
    seed: 1213,
    difficulty: 'normal',
    waves: 22,
    towers: ['archer', 'frost', 'storm', 'sanctum', 'sawmill', 'hexhut'],
    rules: {},
    requires: ['mages', 'flawless'],
    reward: { stars: 15 },
  },
  {
    id: 'veil',
    chapter: 2,
    name: 'Al otro lado del velo',
    story: 'Más allá del Páramo de Cristal se abre una grieta hacia las sombras. Resiste con pocas torres.',
    biome: 'crystal',
    seed: 1415,
    difficulty: 'normal',
    waves: 25,
    towers: ['archer', 'ballista', 'cannon', 'arcane', 'pyre', 'frost', 'storm', 'alchemist', 'sanctum', 'obelisk', 'warden', 'sawmill', 'hexhut'],
    rules: { maxTowers: 14 },
    requires: ['lastwall', 'blossom'],
    reward: { region: 'shadow' },
  },
  {
    id: 'darkcrown',
    chapter: 2,
    name: 'La corona oscura',
    story: 'El Liche reina en las sombras. Solo las torres exclusivas pueden derrotarlo.',
    biome: 'shadow',
    seed: 1617,
    difficulty: 'normal',
    waves: 25,
    towers: ['warden', 'sawmill', 'hexhut', 'frost', 'sanctum'],
    rules: {},
    requires: ['veil'],
    reward: { stars: 25 },
  },
];

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

/** Human-readable list of a mission's rules. */
export function ruleLines(m: MissionDef): string[] {
  const r = m.rules;
  const out: string[] = [];
  out.push(`Supera ${m.waves} oleadas`);
  if (m.towers.length <= 6) out.push(`Torres: solo ${m.towers.length === 1 ? 'una clase' : `${m.towers.length} clases`}`);
  if (r.maxTowers) out.push(`Máximo ${r.maxTowers} torres`);
  if (r.maxTier === 1) out.push('Sin mejoras');
  else if (r.maxTier && r.maxTier < 4) out.push(`Mejoras hasta nivel ${r.maxTier}`);
  if (r.noLeaks) out.push('Ningún enemigo puede llegar al castillo');
  else if (r.lives) out.push(`Solo ${r.lives} vidas`);
  if (r.noSpells) out.push('Sin hechizos');
  if (r.noBlessings) out.push('Sin bendiciones');
  if (r.startGold !== undefined) out.push(`Empiezas con ${r.startGold} de oro`);
  if (r.hpMult && r.hpMult > 1) out.push(`Enemigos +${Math.round((r.hpMult - 1) * 100)}% de vida`);
  return out;
}
