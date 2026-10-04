import { TOWERS, TOWER_LIST } from '../data/towers';
import type { Difficulty, TowerId } from '../data/types';
import { ModifierSet } from '../game/modifiers';
import { GENERAL_TREE, TOWER_TREES, isAnyRequirement, towerLevelFromXp, type TalentNode, type TalentTree } from './talentTrees';

export const SAVE_KEY = 'bastion-arcano.save';
export const SAVE_VERSION = 2;

export interface TowerProgress {
  unlocked: boolean;
  xp: number;
  talents: Record<string, number>;
}

export interface MapProgress {
  bestWave: number;
  cleared: Partial<Record<Difficulty, boolean>>;
}

export interface Settings {
  sfxVolume: number;
  musicVolume: number;
  showDamageNumbers: boolean;
  showRanges: boolean;
  screenShake: boolean;
}

export interface Profile {
  version: number;
  stars: number;
  starsEarned: number;
  general: Record<string, number>;
  towers: Record<TowerId, TowerProgress>;
  maps: Record<string, MapProgress>;
  settings: Settings;
  stats: { runs: number; wins: number; kills: number; bossesKilled: number };
  /** Ids of codex entries (enemies) the player has encountered. */
  seenEnemies: string[];
  tutorialDone: boolean;
}

export function defaultProfile(): Profile {
  const towers = {} as Record<TowerId, TowerProgress>;
  for (const t of TOWER_LIST) towers[t.id] = { unlocked: t.unlockCost === 0, xp: 0, talents: {} };
  return {
    version: SAVE_VERSION,
    stars: 0,
    starsEarned: 0,
    general: {},
    towers,
    maps: {},
    settings: { sfxVolume: 0.7, musicVolume: 0.4, showDamageNumbers: true, showRanges: true, screenShake: true },
    stats: { runs: 0, wins: 0, kills: 0, bossesKilled: 0 },
    seenEnemies: [],
    tutorialDone: false,
  };
}

/** Upgrades older saves and fills in any missing fields so new content never breaks a profile. */
export function migrateProfile(raw: unknown): Profile {
  const base = defaultProfile();
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<Profile> & { version?: number };
  const out: Profile = {
    ...base,
    ...p,
    version: SAVE_VERSION,
    settings: { ...base.settings, ...(p.settings ?? {}) },
    stats: { ...base.stats, ...(p.stats ?? {}) },
    general: { ...(p.general ?? {}) },
    maps: { ...(p.maps ?? {}) },
    seenEnemies: Array.isArray(p.seenEnemies) ? p.seenEnemies : [],
    towers: { ...base.towers },
  };
  for (const id of Object.keys(base.towers) as TowerId[]) {
    const t = p.towers?.[id];
    if (t) out.towers[id] = { unlocked: !!t.unlocked || TOWERS[id].unlockCost === 0, xp: t.xp ?? 0, talents: { ...(t.talents ?? {}) } };
  }
  if (typeof out.stars !== 'number' || !isFinite(out.stars)) out.stars = 0;
  return out;
}

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadProfile(storage: Storage | undefined): Profile {
  try {
    const txt = storage?.getItem(SAVE_KEY);
    return txt ? migrateProfile(JSON.parse(txt)) : defaultProfile();
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(storage: Storage | undefined, p: Profile): void {
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private mode) — progress lives for this session only */
  }
}

// ---------------------------------------------------------------- talents

export function treeRanks(p: Profile, tree: TalentTree): Record<string, number> {
  return tree.currency === 'stars' ? p.general : p.towers[tree.id as TowerId].talents;
}

export function towerLevel(p: Profile, id: TowerId): number {
  return towerLevelFromXp(p.towers[id].xp);
}

export function spentPoints(tree: TalentTree, ranks: Record<string, number>): number {
  let n = 0;
  for (const node of tree.nodes) for (let r = 0; r < (ranks[node.id] ?? 0); r++) n += node.costs[r] ?? 0;
  return n;
}

/** Talent points available for a tower tree (levels earned - spent). */
export function towerPointsAvailable(p: Profile, id: TowerId): number {
  return towerLevel(p, id) - spentPoints(TOWER_TREES[id], p.towers[id].talents);
}

export function currencyAvailable(p: Profile, tree: TalentTree): number {
  return tree.currency === 'stars' ? p.stars : towerPointsAvailable(p, tree.id as TowerId);
}

export type NodeState = 'maxed' | 'available' | 'locked' | 'unaffordable';

export function requirementsMet(node: TalentNode, ranks: Record<string, number>): boolean {
  if (node.requires.length === 0) return true;
  const has = (id: string) => (ranks[id] ?? 0) > 0;
  return isAnyRequirement(node) ? node.requires.some(has) : node.requires.every(has);
}

export function nodeState(p: Profile, tree: TalentTree, node: TalentNode): NodeState {
  const ranks = treeRanks(p, tree);
  const rank = ranks[node.id] ?? 0;
  if (rank >= node.maxRank) return 'maxed';
  if (!requirementsMet(node, ranks)) return 'locked';
  if (tree.currency === 'points' && !p.towers[tree.id as TowerId].unlocked) return 'locked';
  return currencyAvailable(p, tree) >= node.costs[rank] ? 'available' : 'unaffordable';
}

export function buyNode(p: Profile, tree: TalentTree, nodeId: string): boolean {
  const node = tree.nodes.find((n) => n.id === nodeId);
  if (!node || nodeState(p, tree, node) !== 'available') return false;
  const ranks = treeRanks(p, tree);
  const rank = ranks[node.id] ?? 0;
  if (tree.currency === 'stars') p.stars -= node.costs[rank];
  ranks[node.id] = rank + 1;
  return true;
}

/** Refunds every rank of a tree. Stars are returned; tower points are simply freed. */
export function resetTree(p: Profile, tree: TalentTree): void {
  const ranks = treeRanks(p, tree);
  if (tree.currency === 'stars') p.stars += spentPoints(tree, ranks);
  for (const k of Object.keys(ranks)) delete ranks[k];
}

export function unlockTower(p: Profile, id: TowerId): boolean {
  const t = p.towers[id];
  const cost = TOWERS[id].unlockCost;
  if (t.unlocked || p.stars < cost) return false;
  p.stars -= cost;
  t.unlocked = true;
  return true;
}

/** Collects every permanent modifier from the profile for a new run. */
export function profileModifiers(p: Profile): ModifierSet {
  const set = new ModifierSet();
  const addTree = (tree: TalentTree, ranks: Record<string, number>) => {
    for (const node of tree.nodes) set.add(node.mods, ranks[node.id] ?? 0);
  };
  addTree(GENERAL_TREE, p.general);
  for (const t of TOWER_LIST) if (p.towers[t.id].unlocked) addTree(TOWER_TREES[t.id], p.towers[t.id].talents);
  return set;
}

// ---------------------------------------------------------------- run rewards

export interface RunResult {
  mapId: string;
  difficulty: Difficulty;
  wavesCleared: number;
  totalWaves: number;
  victory: boolean;
  /** XP earned per tower type during the run. */
  towerXp: Partial<Record<TowerId, number>>;
  kills: number;
  bossesKilled: number;
  starGain: number;
  xpGain: number;
}

export interface RewardSummary {
  stars: number;
  firstClear: boolean;
  levelUps: { tower: TowerId; from: number; to: number }[];
}

export const STAR_MULT = { easy: 0.6, normal: 1, hard: 1.6 } as const;

export function computeStars(r: RunResult, alreadyCleared: boolean): number {
  const perWave = r.wavesCleared * 0.5;
  const victory = r.victory ? (alreadyCleared ? 4 : 10) : 0;
  return Math.max(r.wavesCleared > 0 ? 1 : 0, Math.round((perWave + victory) * STAR_MULT[r.difficulty] * (1 + r.starGain)));
}

export function applyRunResult(p: Profile, r: RunResult): RewardSummary {
  const mp = (p.maps[r.mapId] ??= { bestWave: 0, cleared: {} });
  const alreadyCleared = !!mp.cleared[r.difficulty];
  const stars = computeStars(r, alreadyCleared);
  p.stars += stars;
  p.starsEarned += stars;
  mp.bestWave = Math.max(mp.bestWave, r.wavesCleared);
  if (r.victory) mp.cleared[r.difficulty] = true;
  p.stats.runs++;
  if (r.victory) p.stats.wins++;
  p.stats.kills += r.kills;
  p.stats.bossesKilled += r.bossesKilled;
  const levelUps: RewardSummary['levelUps'] = [];
  for (const [id, xp] of Object.entries(r.towerXp) as [TowerId, number][]) {
    const before = towerLevel(p, id);
    p.towers[id].xp += Math.round(xp * (1 + r.xpGain));
    const after = towerLevel(p, id);
    if (after > before) levelUps.push({ tower: id, from: before, to: after });
  }
  return { stars, firstClear: r.victory && !alreadyCleared, levelUps };
}

export function isMapUnlocked(p: Profile, mapRequires: string | undefined): boolean {
  if (!mapRequires) return true;
  const m = p.maps[mapRequires];
  return !!m && Object.values(m.cleared).some(Boolean);
}
