import { TOWERS, TOWER_LIST } from '../data/towers';
import { BIOMES, BIOME_BY_ID } from '../data/biomes';
import { MASTERY_TOWERS } from '../data/mastery';
import { MISSIONS, type MissionDef, type MissionReward } from '../data/missions';
import type { Biome, Difficulty, TowerId } from '../data/types';
import { ModifierSet } from '../game/modifiers';
import { GENERAL_TREE, TOWER_TREES, isAnyRequirement, towerLevelFromXp, type TalentNode, type TalentTree } from './talentTrees';

export const SAVE_KEY = 'bastion-arcano.save';
export const SAVE_VERSION = 3;
/**
 * Bumping this wipes everyone's progress the next time they open the game
 * (local saves, cloud saves and old transfer codes alike); settings are kept.
 */
export const PROGRESS_EPOCH = 2;

export interface TowerProgress {
  unlocked: boolean;
  xp: number;
  talents: Record<string, number>;
}

/** Progress per biome. */
export interface MapProgress {
  bestWave: number;
  cleared: Partial<Record<Difficulty, boolean>>;
  /** Best wave reached in endless mode. */
  bestEndless?: number;
}

export interface Settings {
  sfxVolume: number;
  musicVolume: number;
  showDamageNumbers: boolean;
  showRanges: boolean;
  screenShake: boolean;
  /** Graphics level: automatic, always full quality, or battery saver. */
  graphics: 'auto' | 'high' | 'saver';
}

export interface Profile {
  version: number;
  /** Progress generation (see PROGRESS_EPOCH). */
  epoch: number;
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
  /** Missions completed (id → done). */
  missions: Record<string, { done: boolean }>;
  /** Exclusive regions opened by missions. */
  regions: Biome[];
  /** Hero tower brought to battles (null = none). */
  hero: TowerId | null;
  /** Highest rank already announced on the menu. */
  rankSeen: number;
  /** Torre infinita: highest floor reached, climbs started, and the name shown on the online ranking. */
  climb: { best: number; runs: number; nick: string };
  /** When this profile was last saved (ms since epoch) — the newer copy wins when syncing devices. */
  savedAt?: number;
}

export function defaultProfile(): Profile {
  const towers = {} as Record<TowerId, TowerProgress>;
  for (const t of TOWER_LIST) towers[t.id] = { unlocked: t.unlockCost === 0 && !t.exclusive, xp: 0, talents: {} };
  return {
    version: SAVE_VERSION,
    epoch: PROGRESS_EPOCH,
    stars: 0,
    starsEarned: 0,
    general: {},
    towers,
    maps: {},
    settings: { sfxVolume: 0.7, musicVolume: 0.4, showDamageNumbers: true, showRanges: true, screenShake: true, graphics: 'auto' },
    stats: { runs: 0, wins: 0, kills: 0, bossesKilled: 0 },
    seenEnemies: [],
    tutorialDone: false,
    missions: {},
    regions: [],
    hero: null,
    rankSeen: 0,
    climb: { best: 0, runs: 0, nick: '' },
  };
}

/** Upgrades older saves and fills in any missing fields so new content never breaks a profile. */
export function migrateProfile(raw: unknown): Profile {
  const base = defaultProfile();
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<Profile> & { version?: number };
  // Progress from before the last global reset: start over, keeping only the settings.
  if (p.epoch !== PROGRESS_EPOCH) return { ...base, settings: { ...base.settings, ...(p.settings ?? {}) } };
  const out: Profile = {
    ...base,
    ...p,
    version: SAVE_VERSION,
    settings: { ...base.settings, ...(p.settings ?? {}) },
    stats: { ...base.stats, ...(p.stats ?? {}) },
    climb: { ...base.climb, ...(p.climb ?? {}) },
    general: { ...(p.general ?? {}) },
    maps: { ...(p.maps ?? {}) },
    seenEnemies: Array.isArray(p.seenEnemies) ? p.seenEnemies : [],
    missions: { ...(p.missions ?? {}) },
    regions: Array.isArray(p.regions) ? p.regions.filter((r) => r in BIOME_BY_ID) : [],
    hero: p.hero && TOWERS[p.hero]?.hero ? p.hero : null,
    towers: { ...base.towers },
  };
  for (const id of Object.keys(base.towers) as TowerId[]) {
    const t = p.towers?.[id];
    if (t)
      out.towers[id] = {
        unlocked: !!t.unlocked || (TOWERS[id].unlockCost === 0 && !TOWERS[id].exclusive),
        xp: t.xp ?? 0,
        talents: { ...(t.talents ?? {}) },
      };
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

const CODE_PREFIX = 'BASTION1.';

/** A text code with the whole profile, to carry progress to another device. */
export function exportProfileCode(p: Profile): string {
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return CODE_PREFIX + btoa(bin);
}

/** Reads a code made by exportProfileCode; null if it is not valid. */
export function importProfileCode(code: string): Profile | null {
  const text = code.replace(/\s+/g, '');
  if (!text.startsWith(CODE_PREFIX)) return null;
  try {
    const bin = atob(text.slice(CODE_PREFIX.length));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!raw || typeof raw !== 'object' || !('towers' in raw)) return null;
    return migrateProfile(raw);
  } catch {
    return null;
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
  if (t.unlocked || TOWERS[id].exclusive || p.stars < cost) return false;
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
  /** Biome id. */
  mapId: string;
  endless?: boolean;
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
  /** Waves already rewarded earlier in this battle (a won campaign continued in endless mode). */
  rewardedWaves?: number;
}

export interface RewardSummary {
  stars: number;
  firstClear: boolean;
  levelUps: { tower: TowerId; from: number; to: number }[];
}

export const STAR_MULT = { easy: 0.6, normal: 1, hard: 1.6 } as const;

export function computeStars(r: RunResult, alreadyCleared: boolean): number {
  // Endless runs pay a little more for every wave survived past the campaign.
  const from = r.rewardedWaves ?? 0;
  const perWave = Math.max(0, r.wavesCleared - from) * 0.35 + (r.endless ? Math.max(0, r.wavesCleared - Math.max(30, from)) * 0.2 : 0);
  const victory = r.victory ? (alreadyCleared ? 3 : 8) : 0;
  return Math.max(r.wavesCleared > from ? 1 : 0, Math.round((perWave + victory) * STAR_MULT[r.difficulty] * (1 + r.starGain)));
}

export function applyRunResult(p: Profile, r: RunResult): RewardSummary {
  const mp = (p.maps[r.mapId] ??= { bestWave: 0, cleared: {} });
  const alreadyCleared = !!mp.cleared[r.difficulty];
  const stars = computeStars(r, alreadyCleared);
  p.stars += stars;
  p.starsEarned += stars;
  if (r.endless) mp.bestEndless = Math.max(mp.bestEndless ?? 0, r.wavesCleared);
  else mp.bestWave = Math.max(mp.bestWave, r.wavesCleared);
  if (r.victory || (r.endless && r.wavesCleared >= 30)) mp.cleared[r.difficulty] = true;
  p.stats.runs++;
  if (r.victory) p.stats.wins++;
  p.stats.kills += r.kills;
  p.stats.bossesKilled += r.bossesKilled;
  const levelUps: RewardSummary['levelUps'] = [];
  for (const [id, xp] of Object.entries(r.towerXp) as [TowerId, number][]) {
    // Heroes have no permanent mastery: their levels only last one battle.
    if (!p.towers[id]) continue;
    const before = towerLevel(p, id);
    p.towers[id].xp += Math.round(xp * (1 + r.xpGain));
    const after = towerLevel(p, id);
    if (after > before) levelUps.push({ tower: id, from: before, to: after });
  }
  return { stars, firstClear: r.victory && !alreadyCleared, levelUps };
}

/** Torre infinita: tower experience after each floor won. */
export function applyClimbXp(p: Profile, towerXp: Partial<Record<TowerId, number>>, xpGain: number): void {
  for (const [id, xp] of Object.entries(towerXp) as [TowerId, number][]) if (p.towers[id]) p.towers[id].xp += Math.round(xp * (1 + xpGain));
}

/** Torre infinita ended: record and stars. Returns whether it is a new record. */
export function applyClimbEnd(p: Profile, floorReached: number, stars: number, kills: number, bosses: number): boolean {
  const record = floorReached > p.climb.best;
  p.climb.best = Math.max(p.climb.best, floorReached);
  p.stars += stars;
  p.starsEarned += stars;
  p.stats.runs++;
  p.stats.kills += kills;
  p.stats.bossesKilled += bosses;
  return record;
}

/** Can the player start battles in this region? */
export function isRegionOpen(p: Profile, id: Biome): boolean {
  const b = BIOME_BY_ID[id];
  if (b.exclusive) return p.regions.includes(id);
  return isMapUnlocked(p, b.requires);
}

export function isMapUnlocked(p: Profile, mapRequires: string | undefined): boolean {
  if (!mapRequires) return true;
  const m = p.maps[mapRequires];
  return !!m && (Object.values(m.cleared).some(Boolean) || m.bestWave >= UNLOCK_WAVE || (m.bestEndless ?? 0) >= UNLOCK_WAVE);
}

/** Waves to reach in a region to open the next one. */
export const UNLOCK_WAVE = 15;

/** Expert mode opens once the player has reached this wave in any region's campaign. */
export const EXPERT_UNLOCK_WAVE = 20;

export function expertOpen(p: Profile): boolean {
  return BIOMES.some((b) => {
    const m = p.maps[b.id];
    return !!m && (Object.values(m.cleared).some(Boolean) || m.bestWave >= EXPERT_UNLOCK_WAVE || (m.bestEndless ?? 0) >= EXPERT_UNLOCK_WAVE);
  });
}

// ---------------------------------------------------------------- missions

export function missionAvailable(p: Profile, m: MissionDef): boolean {
  if (m.needsTower && !p.towers[m.needsTower]?.unlocked) return false;
  return m.requires.every((id) => p.missions[id]?.done);
}

/** A tower whose four mastery missions are done wears its golden look. */
export function towerMastered(p: Profile, id: TowerId): boolean {
  return !!p.missions[`m-${id}-4`]?.done;
}

export function masteredTowers(p: Profile): TowerId[] {
  return (Object.keys(p.towers) as TowerId[]).filter((id) => towerMastered(p, id));
}

export interface MissionOutcome {
  /** First completion: the reward was granted now. */
  firstTime: boolean;
  stars: number;
  reward: MissionReward | null;
  levelUps: RewardSummary['levelUps'];
}

/** Records a finished mission: tower experience always, the reward on the first victory. */
export function applyMissionResult(
  p: Profile,
  m: MissionDef,
  r: { victory: boolean; towerXp: Partial<Record<TowerId, number>>; kills: number; bossesKilled: number; xpGain: number },
): MissionOutcome {
  p.stats.runs++;
  if (r.victory) p.stats.wins++;
  p.stats.kills += r.kills;
  p.stats.bossesKilled += r.bossesKilled;
  const levelUps: RewardSummary['levelUps'] = [];
  for (const [id, xp] of Object.entries(r.towerXp) as [TowerId, number][]) {
    // Towers tried in a mission before owning them don't level up.
    if (!p.towers[id]?.unlocked) continue;
    const before = towerLevel(p, id);
    p.towers[id].xp += Math.round(xp * (1 + r.xpGain));
    const after = towerLevel(p, id);
    if (after > before) levelUps.push({ tower: id, from: before, to: after });
  }
  const firstTime = r.victory && !p.missions[m.id]?.done;
  if (firstTime) {
    p.missions[m.id] = { done: true };
    const rw = m.reward;
    if (rw.stars) {
      p.stars += rw.stars;
      p.starsEarned += rw.stars;
    }
    if (rw.tower) p.towers[rw.tower].unlocked = true;
    if (rw.region && !p.regions.includes(rw.region)) p.regions.push(rw.region);
  }
  return { firstTime, stars: firstTime ? (m.reward.stars ?? 0) : 0, reward: firstTime ? m.reward : null, levelUps };
}

/** The mission whose reward is this tower or region, if any. */
export function missionRewarding(what: { tower?: TowerId; region?: Biome }): MissionDef | undefined {
  return MISSIONS.find((m) => (what.tower && m.reward.tower === what.tower) || (what.region && m.reward.region === what.region));
}

// ---------------------------------------------------------------- heroes

/** Is a hero unlocked, and how far along is its unlock condition. */
export function heroProgress(p: Profile, id: TowerId): { done: boolean; text: string; progress?: string } {
  const u = TOWERS[id].hero!.unlock;
  const maps = Object.values(p.maps);
  const count = (have: number, need: number, text: string) => ({
    done: have >= need,
    text,
    progress: `${Math.min(have, need).toLocaleString('es')}/${need.toLocaleString('es')}`,
  });
  switch (u.kind) {
    case 'wins':
      return count(p.stats.wins, u.amount, u.amount === 1 ? 'Gana una batalla' : `Gana ${u.amount} batallas`);
    case 'kills':
      return count(p.stats.kills, u.amount, `Abate ${u.amount.toLocaleString('es')} enemigos en total`);
    case 'bosses':
      return count(p.stats.bossesKilled, u.amount, `Derrota ${u.amount} jefes`);
    case 'endless':
      return count(Math.max(0, ...maps.map((m) => m.bestEndless ?? 0)), u.amount, `Llega a la oleada ${u.amount} en modo infinito`);
    case 'hardClear':
      return { done: maps.some((m) => m.cleared.hard), text: 'Gana una campaña en dificultad Heroico' };
    case 'mission': {
      const m = MISSIONS.find((x) => x.id === u.id);
      return { done: !!p.missions[u.id]?.done, text: `Completa la misión «${m?.name ?? u.id}»` };
    }
    case 'missions':
      return count(Object.values(p.missions).filter((m) => m.done).length, u.amount, `Completa ${u.amount} misiones`);
    case 'masteries':
      return count(
        MASTERY_TOWERS.filter((t) => towerMastered(p, t)).length,
        MASTERY_TOWERS.length,
        'Consigue la maestría dorada de todas las torres',
      );
    case 'towers':
      return count(Object.values(p.towers).filter((t) => t.unlocked).length, u.amount, `Ten ${u.amount} torres desbloqueadas`);
  }
}

/** The hero to bring into a battle: the chosen one if it is (still) unlocked. */
export function activeHero(p: Profile): TowerId | null {
  return p.hero && heroProgress(p, p.hero).done ? p.hero : null;
}

// ---------------------------------------------------------------- ranks

/** Medieval ranks earned with progress (missions, masteries, towers, regions, heroes, victories). */
export const RANKS: { at: number; title: string; phrase: string }[] = [
  { at: 0, title: 'Campesino', phrase: 'Una horca, un sombrero de paja y muchas ganas de defender el reino.' },
  { at: 6, title: 'Escudero', phrase: 'Ya cargas con el escudo de un caballero. Sigue así.' },
  { at: 14, title: 'Soldado', phrase: 'La guarnición empieza a fiarse de ti.' },
  { at: 24, title: 'Sargento', phrase: 'Tus hombres te siguen sin dudar.' },
  { at: 36, title: 'Capitán', phrase: 'Las torres del reino obedecen tus órdenes.' },
  { at: 50, title: 'Caballero', phrase: 'Te han armado caballero. Los bardos ya cantan tus hazañas.' },
  { at: 66, title: 'Barón', phrase: 'Tienes tierras propias y un castillo que defender.' },
  { at: 84, title: 'Vizconde', phrase: 'Los nobles susurran tu nombre en la corte.' },
  { at: 104, title: 'Conde', phrase: 'Gobiernas un condado entero y nadie osa atacarlo.' },
  { at: 126, title: 'Marqués', phrase: 'Custodias las fronteras del reino.' },
  { at: 150, title: 'Duque', phrase: 'Solo la corona está por encima de ti.' },
  { at: 180, title: 'Príncipe', phrase: 'El trono te espera.' },
  { at: 215, title: 'Rey', phrase: 'Larga vida al rey. El reino es tuyo.' },
];

export function rankScore(p: Profile): number {
  const done = Object.entries(p.missions)
    .filter(([, m]) => m.done)
    .map(([id]) => id);
  const story = done.filter((id) => !id.startsWith('m-')).length;
  const mastery = done.length - story;
  const masteries = done.filter((id) => /^m-.*-4$/.test(id)).length;
  const towers = Object.values(p.towers).filter((t) => t.unlocked).length;
  const heroes = (Object.keys(TOWERS) as TowerId[]).filter((id) => TOWERS[id].hero && heroProgress(p, id).done).length;
  return story * 2 + mastery + masteries * 3 + towers + p.regions.length * 2 + heroes * 2 + Math.min(30, p.stats.wins);
}

/** Current rank (index into RANKS) and progress towards the next. */
export function rankOf(p: Profile): { index: number; score: number } {
  const score = rankScore(p);
  let index = 0;
  while (index + 1 < RANKS.length && score >= RANKS[index + 1].at) index++;
  return { index, score };
}
