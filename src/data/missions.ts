// Missions: hand-picked battles with special rules. Each one is played on a
// fixed map, and completing it pays stars or opens exclusive content
// (towers and regions that can't be bought with stars).

import type { MissionRules } from '../game/game';
import { BIOME_BY_ID } from './biomes';
import { masteryMissions } from './mastery';
import type { Biome, Difficulty, TowerId } from './types';

export interface MissionReward {
  stars?: number;
  tower?: TowerId;
  region?: Biome;
  /** Completes a tower's mastery series: its golden look. */
  mastery?: TowerId;
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
  /** Amount of ponds (flooded maps for naval missions); default: the region's. */
  water?: number;
  /** Towers that may be built (they can be tried even if not unlocked yet). */
  towers: TowerId[];
  rules: MissionRules;
  /** Missions to complete first. */
  requires: string[];
  reward: MissionReward;
  /** Part of a tower's mastery series (step 1..4). */
  mastery?: { tower: TowerId; step: number };
  /** Only playable once this tower is owned. */
  needsTower?: TowerId;
}

export const CHAPTERS = ['Pruebas del Reino', 'Maestros de la Guerra', 'Leyendas', 'Tierras Lejanas'];

/** Tower sets for themed missions. */
const NAVAL: TowerId[] = ['harbor', 'tide'];
const MAGIC: TowerId[] = ['arcane', 'frost', 'storm', 'sanctum', 'obelisk'];
const SIEGE: TowerId[] = ['ballista', 'cannon', 'alchemist', 'quake'];
const ELEMENTAL: TowerId[] = ['pyre', 'frost', 'storm', 'alchemist', 'tide', 'quake'];

const STORY: MissionDef[] = [
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
    id: 'tides',
    chapter: 0,
    name: 'Mareas',
    story: 'La costa se ha inundado: solo se puede construir sobre el agua. Por suerte la tormenta mantiene lejos a los voladores.',
    biome: 'coast',
    seed: 2207,
    water: 6,
    difficulty: 'normal',
    waves: 15,
    towers: NAVAL,
    rules: { groundOnly: true },
    requires: [],
    reward: { stars: 6 },
  },
  {
    id: 'fireice',
    chapter: 0,
    name: 'Fuego y hielo',
    story: 'Dos hermanas hechiceras, una de fuego y otra de hielo, defienden juntas el paso.',
    biome: 'snow',
    seed: 3301,
    difficulty: 'normal',
    waves: 18,
    towers: ['pyre', 'frost'],
    rules: {},
    requires: [],
    reward: { stars: 6 },
  },
  {
    id: 'mages',
    chapter: 0,
    name: 'Escuela de magos',
    story: 'Examen final de la academia: solo torres mágicas contra la ciénaga.',
    biome: 'swamp',
    seed: 6603,
    difficulty: 'normal',
    waves: 20,
    towers: MAGIC,
    rules: { hpMult: 1.45, maxTowers: 12 },
    requires: ['fireice'],
    reward: { tower: 'hexhut' },
  },
  // ---------------------------------------------------------------- chapter 2
  {
    id: 'nomagic',
    chapter: 1,
    name: 'Acero y pólvora',
    story: 'Los magos de la corte han perdido la voz: no hay hechizos. Solo flechas, acero, pólvora y alquimia.',
    biome: 'autumn',
    seed: 3307,
    difficulty: 'normal',
    waves: 18,
    towers: ['archer', 'ballista', 'cannon', 'alchemist', 'falconer'],
    rules: { noSpells: true },
    requires: ['archers'],
    reward: { tower: 'sawmill' },
  },
  {
    id: 'flawless',
    chapter: 1,
    name: 'Defensa perfecta',
    story: 'El rey visita el castillo. Ni un solo enemigo puede cruzar la puerta.',
    biome: 'coast',
    seed: 4409,
    difficulty: 'easy',
    waves: 12,
    towers: ['cannon', 'arcane', 'frost', 'storm', 'harbor', 'tide'],
    rules: { noLeaks: true },
    requires: ['tides'],
    reward: { region: 'sakura' },
  },
  {
    id: 'wild',
    chapter: 1,
    name: 'Tierras salvajes',
    story: 'En el cañón no hay canteros ni magos: solo geomantes, halconeros y mercaderes.',
    biome: 'canyon',
    seed: 7713,
    difficulty: 'normal',
    waves: 18,
    towers: ['quake', 'falconer', 'market'],
    rules: {},
    requires: ['mages'],
    reward: { stars: 8 },
  },
  {
    id: 'skies',
    chapter: 1,
    name: 'Islas del Cielo',
    story: 'Un archipiélago flota sobre las nubes. Los enemigos llegan volando por el aire y solo puedes construir en los islotes.',
    biome: 'sky',
    seed: 4243,
    difficulty: 'normal',
    waves: 20,
    towers: ['arcane', 'frost', 'storm', 'sanctum', 'obelisk', 'falconer'],
    rules: { hpMult: 1.4 },
    requires: ['mages'],
    reward: { region: 'sky' },
  },
  {
    id: 'elements',
    chapter: 1,
    name: 'Los cuatro elementos',
    story: 'Fuego, hielo, rayo y tierra (y algo de veneno): solo torres elementales.',
    biome: 'swamp',
    seed: 5521,
    water: 3,
    difficulty: 'normal',
    waves: 20,
    towers: ELEMENTAL,
    rules: {},
    requires: ['fireice', 'tides'],
    reward: { stars: 10 },
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
    towers: ['ballista', 'cannon', 'arcane', 'frost', 'storm', 'alchemist', 'pyre', 'market'],
    rules: { startGold: 110, maxTowers: 9 },
    requires: ['flawless', 'nomagic'],
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
    towers: SIEGE,
    rules: {},
    requires: ['nomagic'],
    reward: { stars: 12 },
  },
  // ---------------------------------------------------------------- chapter 3
  {
    id: 'opensea',
    chapter: 2,
    name: 'Mar abierto',
    story: 'La gran inundación: otra vez solo sobre el agua, más lejos y durante más oleadas.',
    biome: 'coast',
    seed: 9127,
    water: 7,
    difficulty: 'normal',
    waves: 22,
    towers: NAVAL,
    rules: { groundOnly: true, hpMult: 1.7 },
    requires: ['elements'],
    reward: { stars: 15 },
  },
  {
    id: 'lastwall',
    chapter: 2,
    name: 'La última muralla',
    story: 'El paso de montaña es la última defensa y solo hay piedra para 12 torres.',
    biome: 'snow',
    seed: 9901,
    difficulty: 'easy',
    waves: 20,
    towers: ['ballista', 'cannon', 'arcane', 'pyre', 'frost', 'storm', 'alchemist', 'sanctum', 'obelisk', 'falconer'],
    rules: { lives: 20, maxTowers: 12 },
    requires: ['poor', 'siege'],
    reward: { tower: 'warden' },
  },
  {
    id: 'lightdark',
    chapter: 2,
    name: 'Luz y sombra',
    story: 'Sacerdotes y brujos, por una vez del mismo lado: solo torres sagradas y oscuras.',
    biome: 'dusk',
    seed: 1319,
    difficulty: 'normal',
    waves: 25,
    towers: ['sanctum', 'obelisk', 'hexhut'],
    rules: { hpMult: 1.8, maxTowers: 8 },
    requires: ['mages', 'wild'],
    reward: { stars: 15 },
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
    towers: ['frost', 'storm', 'sanctum', 'sawmill', 'hexhut', 'tide'],
    rules: { hpMult: 1.4 },
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
    towers: ['ballista', 'cannon', 'arcane', 'pyre', 'frost', 'storm', 'alchemist', 'sanctum', 'obelisk', 'warden', 'sawmill', 'hexhut'],
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
  // ---------------------------------------------------------------- chapter 4
  {
    id: 'dragonsky',
    chapter: 3,
    name: 'Cielo de dragones',
    story: 'Las islas del cielo vuelven a llenarse de alas. Esta vez vienen más, y más fuertes.',
    biome: 'sky',
    seed: 4243,
    difficulty: 'normal',
    waves: 22,
    towers: ['arcane', 'frost', 'storm', 'sanctum', 'obelisk', 'falconer', 'hexhut', 'warden'],
    rules: { hpMult: 1.4 },
    requires: ['skies', 'darkcrown'],
    reward: { stars: 20 },
  },
  {
    id: 'goldrush',
    chapter: 3,
    name: 'Fiebre del oro',
    story: 'En el Valle Dorado todo se compra. Empiezas casi sin nada y con sitio para pocas torres: los mercados son la clave.',
    biome: 'gilded',
    seed: 2713,
    difficulty: 'normal',
    waves: 22,
    towers: ['market', 'archer', 'cannon', 'arcane', 'frost', 'alchemist', 'ballista'],
    rules: { startGold: 90, maxTowers: 11 },
    requires: ['darkcrown'],
    reward: { stars: 20 },
  },
  {
    id: 'blackwater',
    chapter: 3,
    name: 'Aguas negras',
    story: 'La ciénaga se ha envenenado. Dificultad heroica: solo venenos, sombras y agua.',
    biome: 'swamp',
    seed: 2717,
    water: 4,
    difficulty: 'hard',
    waves: 20,
    towers: ['alchemist', 'obelisk', 'tide', 'harbor', 'frost', 'hexhut'],
    rules: {},
    requires: ['darkcrown'],
    reward: { stars: 22 },
  },
  {
    id: 'crystalcrown',
    chapter: 3,
    name: 'La corona de cristal',
    story: 'En el Páramo de Cristal las maestrías no funcionan: torres hasta nivel 4 y 25 oleadas.',
    biome: 'crystal',
    seed: 2719,
    difficulty: 'normal',
    waves: 25,
    towers: ['archer', 'ballista', 'cannon', 'arcane', 'pyre', 'frost', 'storm', 'alchemist', 'sanctum', 'obelisk', 'quake', 'falconer'],
    rules: { maxTier: 4 },
    requires: ['goldrush', 'blackwater'],
    reward: { stars: 25 },
  },
  {
    id: 'eternalnight',
    chapter: 3,
    name: 'Noche eterna',
    story: 'El reino de las sombras contraataca: sin hechizos y con sus criaturas más duras que nunca.',
    biome: 'shadow',
    seed: 2729,
    difficulty: 'normal',
    waves: 25,
    towers: ['warden', 'sawmill', 'hexhut', 'sanctum', 'frost', 'storm', 'arcane', 'pyre'],
    rules: { noSpells: true, hpMult: 1.1 },
    requires: ['dragonsky', 'crystalcrown'],
    reward: { stars: 25 },
  },
  {
    id: 'lastking',
    chapter: 3,
    name: 'El último rey',
    story: 'La batalla final por el reino: dificultad heroica, 30 oleadas y sitio para 16 torres. Todo lo que has aprendido, a la vez.',
    biome: 'volcano',
    seed: 2731,
    difficulty: 'hard',
    waves: 30,
    towers: [
      'archer',
      'ballista',
      'cannon',
      'arcane',
      'pyre',
      'frost',
      'storm',
      'alchemist',
      'sanctum',
      'obelisk',
      'quake',
      'falconer',
      'warden',
      'sawmill',
      'hexhut',
    ],
    rules: { maxTowers: 16 },
    requires: ['eternalnight'],
    reward: { stars: 40 },
  },
];

export const MISSIONS: MissionDef[] = [...STORY, ...masteryMissions()];

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
  if (r.groundOnly) out.push('Sin enemigos voladores');
  if (BIOME_BY_ID[m.biome].sky) out.push('Solo enemigos voladores');
  if (r.hpMult && r.hpMult > 1) out.push(`Enemigos +${Math.round((r.hpMult - 1) * 100)}% de vida`);
  return out;
}
