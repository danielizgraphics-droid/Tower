import { TOWERS } from '../data/towers';
import type { ModifierDef, TowerId } from '../data/types';

export interface TalentNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxRank: number;
  /** Cost of each rank (index = rank being bought - 1). */
  costs: number[];
  /** Modifiers applied once per owned rank. */
  mods: ModifierDef[];
  /** All listed nodes must have at least one rank. */
  requires: string[];
  /** Grid placement for the tree view. */
  col: number;
  row: number;
}

export interface TalentTree {
  id: string;
  name: string;
  /** Currency: 'stars' for the general tree, 'points' for tower trees. */
  currency: 'stars' | 'points';
  nodes: TalentNode[];
  cols: number;
  rows: number;
  /** Optional column titles shown above the tree. */
  columns?: string[];
}

const g = (stat: Extract<ModifierDef, { target: 'global' }>['stat'], add: number): ModifierDef => ({ target: 'global', stat, add });
const allPct = (stat: Extract<ModifierDef, { target: 'tower' }>['stat'], pct: number): ModifierDef => ({
  target: 'tower',
  scope: { kind: 'all' },
  stat,
  pct,
});

/** General (player) talent tree, paid with stars earned in runs. */
export const GENERAL_TREE: TalentTree = {
  id: 'general',
  name: 'Comandante',
  currency: 'stars',
  cols: 4,
  rows: 5,
  columns: ['Economía', 'Defensa', 'Arcano', 'Estrategia'],
  nodes: [
    // Economy column
    {
      id: 'treasury',
      name: 'Tesoro Inicial',
      description: '+40 de oro inicial por rango.',
      icon: 'coin',
      maxRank: 3,
      costs: [2, 3, 4],
      mods: [g('startGold', 40)],
      requires: [],
      col: 0,
      row: 0,
    },
    {
      id: 'plunder',
      name: 'Saqueo',
      description: '+8% de oro por baja por rango.',
      icon: 'coins',
      maxRank: 3,
      costs: [3, 4, 5],
      mods: [g('killGold', 0.08)],
      requires: ['treasury'],
      col: 0,
      row: 1,
    },
    {
      id: 'merchant',
      name: 'Mercader',
      description: 'Las torres cuestan un 4% menos por rango.',
      icon: 'scale',
      maxRank: 2,
      costs: [4, 6],
      mods: [g('buildCost', -0.04)],
      requires: ['plunder'],
      col: 0,
      row: 2,
    },
    {
      id: 'refund',
      name: 'Desmontaje',
      description: '+8% de oro al vender torres por rango.',
      icon: 'recycle',
      maxRank: 2,
      costs: [3, 4],
      mods: [g('sellRefund', 0.08)],
      requires: ['plunder'],
      col: 0,
      row: 3,
    },
    {
      id: 'banker',
      name: 'Banca Real',
      description: '+2% de interés al final de cada oleada (máx. 60 de oro).',
      icon: 'bank',
      maxRank: 2,
      costs: [6, 9],
      mods: [g('interest', 0.02)],
      requires: ['merchant'],
      col: 0,
      row: 4,
    },
    // Defence column
    {
      id: 'walls',
      name: 'Murallas',
      description: '+3 vidas por rango.',
      icon: 'wall',
      maxRank: 3,
      costs: [2, 3, 4],
      mods: [g('lives', 3)],
      requires: [],
      col: 1,
      row: 0,
    },
    {
      id: 'forge',
      name: 'Forja Real',
      description: '+4% de daño para todas las torres por rango.',
      icon: 'hammer',
      maxRank: 3,
      costs: [3, 5, 7],
      mods: [allPct('damage', 0.04)],
      requires: ['walls'],
      col: 1,
      row: 1,
    },
    {
      id: 'watchtowers',
      name: 'Atalayas',
      description: '+4% de alcance para todas las torres por rango.',
      icon: 'telescope',
      maxRank: 2,
      costs: [4, 6],
      mods: [allPct('range', 0.04)],
      requires: ['forge'],
      col: 1,
      row: 2,
    },
    {
      id: 'drills',
      name: 'Instrucción',
      description: '+4% de cadencia para todas las torres por rango.',
      icon: 'drum',
      maxRank: 2,
      costs: [4, 6],
      mods: [allPct('rate', 0.04)],
      requires: ['forge'],
      col: 1,
      row: 3,
    },
    {
      id: 'masons',
      name: 'Albañiles',
      description: 'Recupera 1 vida cada 5 oleadas.',
      icon: 'castle',
      maxRank: 1,
      costs: [8],
      mods: [g('livesRegen', 1)],
      requires: ['watchtowers'],
      col: 1,
      row: 4,
    },
    // Arcane column
    {
      id: 'manaWell',
      name: 'Pozo de Maná',
      description: '+25 de maná máximo por rango.',
      icon: 'gem',
      maxRank: 2,
      costs: [2, 3],
      mods: [g('maxMana', 25)],
      requires: [],
      col: 2,
      row: 0,
    },
    {
      id: 'flow',
      name: 'Flujo Arcano',
      description: '+0.6 de maná por segundo por rango.',
      icon: 'drop',
      maxRank: 2,
      costs: [3, 4],
      mods: [g('manaRegen', 0.6)],
      requires: ['manaWell'],
      col: 2,
      row: 1,
    },
    {
      id: 'novaSpell',
      name: 'Nova de Escarcha',
      description: 'Desbloquea el hechizo Nova de Escarcha.',
      icon: 'snow',
      maxRank: 1,
      costs: [5],
      mods: [{ target: 'unlockSpell', spell: 'frostNova' }],
      requires: ['flow'],
      col: 2,
      row: 2,
    },
    {
      id: 'spellPower',
      name: 'Poder Arcano',
      description: '+15% de poder de hechizos por rango.',
      icon: 'sparkle',
      maxRank: 2,
      costs: [4, 6],
      mods: [g('spellPower', 0.15)],
      requires: ['flow'],
      col: 2,
      row: 3,
    },
    {
      id: 'blessingSpell',
      name: 'Bendición de Batalla',
      description: 'Desbloquea el hechizo Bendición de Batalla.',
      icon: 'star',
      maxRank: 1,
      costs: [8],
      mods: [{ target: 'unlockSpell', spell: 'blessing' }],
      requires: ['novaSpell'],
      col: 2,
      row: 4,
    },
    // Strategy column
    {
      id: 'veteran',
      name: 'Veteranía',
      description: '+20% de experiencia para las torres por rango.',
      icon: 'medal',
      maxRank: 2,
      costs: [2, 4],
      mods: [g('xpGain', 0.2)],
      requires: [],
      col: 3,
      row: 0,
    },
    {
      id: 'vision',
      name: 'Visión',
      description: '+1 renovación de mejoras por partida por rango.',
      icon: 'refresh',
      maxRank: 2,
      costs: [3, 5],
      mods: [g('augmentRerolls', 1)],
      requires: ['veteran'],
      col: 3,
      row: 1,
    },
    {
      id: 'fortune',
      name: 'Fortuna',
      description: 'Más probabilidad de mejoras raras y épicas.',
      icon: 'clover',
      maxRank: 2,
      costs: [4, 6],
      mods: [g('augmentLuck', 0.5)],
      requires: ['vision'],
      col: 3,
      row: 2,
    },
    {
      id: 'collector',
      name: 'Coleccionista',
      description: '+10% de estrellas obtenidas por rango.',
      icon: 'star',
      maxRank: 2,
      costs: [5, 7],
      mods: [g('starGain', 0.1)],
      requires: ['vision'],
      col: 3,
      row: 3,
    },
    {
      id: 'sage',
      name: 'Sabio',
      description: 'Eliges entre 4 mejoras en lugar de 3.',
      icon: 'scroll',
      maxRank: 1,
      costs: [10],
      mods: [g('augmentChoices', 1)],
      requires: ['fortune'],
      col: 3,
      row: 4,
    },
  ],
};

const towerPct = (tower: TowerId, stat: Extract<ModifierDef, { target: 'tower' }>['stat'], pct: number): ModifierDef => ({
  target: 'tower',
  scope: { kind: 'tower', tower },
  stat,
  pct,
});

/**
 * Builds the talent tree of a tower: four generic nodes shared by every tower
 * plus the tower-specific branch boosters and capstone defined in its data.
 *
 *            row0:        [Entrenamiento]
 *            row1:  [Alcance] [Cadencia] [Logística]
 *            row2:  [Rama A]  [Rama B]   [Rama C]
 *            row3:            [Capstone]
 */
export function buildTowerTree(id: TowerId): TalentTree {
  const def = TOWERS[id];
  const t = def.talents;
  const pre = (s: string) => `${id}.${s}`;
  const branchNodes: TalentNode[] = t.branchBoost.map((b, i) => ({
    id: pre(`branch${i}`),
    name: b.name,
    description: b.description,
    icon: `branch${i}`,
    maxRank: b.maxRank ?? 2,
    costs: [2, 3, 4].slice(0, b.maxRank ?? 2),
    mods: b.mods,
    requires: [pre(['range', 'rate', 'logistics'][i])],
    col: i,
    row: 2,
  }));
  return {
    id,
    name: def.name,
    currency: 'points',
    cols: 3,
    rows: 4,
    nodes: [
      {
        id: pre('training'),
        name: 'Entrenamiento',
        description: '+6% de daño por rango.',
        icon: 'sword',
        maxRank: 3,
        costs: [1, 1, 2],
        mods: [towerPct(id, 'damage', 0.06)],
        requires: [],
        col: 1,
        row: 0,
      },
      {
        id: pre('range'),
        name: 'Óptica',
        description: '+5% de alcance por rango.',
        icon: 'telescope',
        maxRank: 2,
        costs: [1, 2],
        mods: [towerPct(id, 'range', 0.05)],
        requires: [pre('training')],
        col: 0,
        row: 1,
      },
      {
        id: pre('rate'),
        name: 'Disciplina',
        description: '+6% de cadencia por rango.',
        icon: 'hourglass',
        maxRank: 2,
        costs: [1, 2],
        mods: [towerPct(id, 'rate', 0.06)],
        requires: [pre('training')],
        col: 1,
        row: 1,
      },
      {
        id: pre('logistics'),
        name: 'Logística',
        description: 'Esta torre y sus mejoras cuestan un 6% menos por rango.',
        icon: 'bag',
        maxRank: 2,
        costs: [1, 2],
        mods: [{ target: 'towerCost', tower: id, pct: -0.06 }],
        requires: [pre('training')],
        col: 2,
        row: 1,
      },
      ...branchNodes,
      {
        id: pre('capstone'),
        name: t.capstone.name,
        description: t.capstone.description,
        icon: 'star',
        maxRank: t.capstone.maxRank ?? 1,
        costs: [5],
        mods: t.capstone.mods,
        requires: branchNodes.map((n) => n.id),
        col: 1,
        row: 3,
      },
    ],
  };
}

/** Capstones need ANY branch node, the rest need ALL prerequisites. */
export function isAnyRequirement(node: TalentNode): boolean {
  return node.id.endsWith('.capstone');
}

export const TOWER_TREES: Record<TowerId, TalentTree> = Object.fromEntries(
  (Object.keys(TOWERS) as TowerId[]).map((id) => [id, buildTowerTree(id)]),
) as Record<TowerId, TalentTree>;

/** Tower XP needed to reach each mastery level (index = level). Each level grants a talent point. */
export const TOWER_LEVEL_XP = [0, 40, 100, 180, 280, 400, 550, 730, 940, 1180, 1450, 1750, 2100, 2500, 2950, 3450, 4000, 4600, 5250, 6000, 6800];
export const MAX_TOWER_LEVEL = TOWER_LEVEL_XP.length - 1;

export function towerLevelFromXp(xp: number): number {
  let lvl = 0;
  while (lvl < MAX_TOWER_LEVEL && xp >= TOWER_LEVEL_XP[lvl + 1]) lvl++;
  return lvl;
}
