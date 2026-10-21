// Torre infinita: a roguelike climb. Each floor is a short battle on a new
// map; lives, blessings and the towers recruited carry over from floor to
// floor, and the climb ends at the first defeat. Saved between floors.

import { AUGMENTS, AUGMENT_MAP, RARITY_WEIGHT } from '../data/augments';
import { BIOMES, type Biome } from '../data/biomes';
import { TOWERS, TOWER_LIST } from '../data/towers';
import type { AugmentDef, MapDef, TowerId } from '../data/types';
import { Rng } from '../engine/rng';
import { generateMap } from '../game/mapgen';
import { PROGRESS_EPOCH, type Profile, type Storage } from './profile';

const KEY = 'bastion-arcano.climb';

/** Waves fought on each floor. */
export const FLOOR_WAVES = 4;
/** Lives at the start of a climb (also the most it can hold). */
export const CLIMB_LIVES = 20;
/** Lives recovered after each floor won. */
export const FLOOR_HEAL = 2;
/** Enemy health on climb floors (the climb has no campaign economy to grow into). */
export const CLIMB_HP = 0.85;
/** Each floor starts this many waves further on (enemy strength, bosses). */
const OFFSET_PER_FLOOR = 2;

export type Reward =
  { kind: 'tower'; tower: TowerId } | { kind: 'blessing'; id: string } | { kind: 'heal'; lives: number } | { kind: 'gold'; gold: number };

export interface ClimbRun {
  v: 1;
  epoch: number;
  seed: number;
  /** Floor about to be played (1-based). */
  floor: number;
  lives: number;
  /** Blessings won so far (kept for the whole climb). */
  blessings: string[];
  /** Towers recruited for this climb. */
  towers: TowerId[];
  /** Extra starting gold on every floor. */
  goldBonus: number;
  kills: number;
  /** Rewards offered after the last floor cleared, until one is picked. */
  offer: Reward[] | null;
}

/** Towers a climb can recruit: the player's own (no exclusives, no naval: floors may have no water). */
export function climbPool(p: Profile): TowerId[] {
  return TOWER_LIST.filter((t) => p.towers[t.id]?.unlocked && !t.hero && !t.exclusive && t.placement !== 'water').map((t) => t.id);
}

export function newClimb(p: Profile, seed = (Math.random() * 2 ** 31) >>> 0): ClimbRun {
  const rng = new Rng(seed ^ 0x2f6b);
  const pool = climbPool(p);
  // Archers plus two more of the player's towers, picked at random.
  const towers: TowerId[] = pool.includes('archer') ? ['archer'] : [];
  const rest = pool.filter((id) => !towers.includes(id));
  while (towers.length < 3 && rest.length) towers.push(rest.splice(rng.int(0, rest.length - 1), 1)[0]);
  return { v: 1, epoch: PROGRESS_EPOCH, seed, floor: 1, lives: CLIMB_LIVES, blessings: [], towers, goldBonus: 0, kills: 0, offer: null };
}

const FLOOR_BIOMES: Biome[] = BIOMES.filter((b) => !b.exclusive && !b.sky).map((b) => b.id);

/** Every floor's map is decided by the climb's seed: the same floor is the same map if replayed. */
export function floorMap(run: ClimbRun): MapDef {
  const rng = new Rng(run.seed + run.floor * 7919);
  const biome = rng.pick(FLOOR_BIOMES);
  const f = run.floor;
  // Higher floors bring more entrances and forks; boards stay small and roads short.
  const spawns = f >= 12 && rng.chance(0.5) ? 3 : f >= 6 && rng.chance(0.55) ? 2 : 1;
  const forks = f >= 3 && rng.chance(0.4) ? 1 : 0;
  const def = generateMap({
    biome,
    seed: rng.int(0, 2 ** 30),
    size: spawns > 2 ? 17 : 15,
    waves: FLOOR_WAVES,
    lanes: spawns > 1 || forks ? { spawns, forks } : undefined,
  });
  return { ...def, id: `climb-${f}`, name: `Piso ${f} · ${def.name}` };
}

export function floorOffset(floor: number): number {
  return (floor - 1) * OFFSET_PER_FLOOR;
}

/** A floor whose waves include a boss (every tenth wave). */
export function isBossFloor(floor: number): boolean {
  const first = floorOffset(floor) + 1;
  for (let w = first; w < first + FLOOR_WAVES; w++) if (w % 10 === 0) return true;
  return false;
}

/**
 * Starting gold of a floor: roughly what a campaign player would have earned
 * by those waves, so a floor's towers can match its enemies.
 */
export function floorGold(run: ClimbRun, base: number): number {
  const w = floorOffset(run.floor);
  // Floors with a boss get a war chest to prepare for it.
  return Math.round(base + run.goldBonus + 0.85 * (80 * w + 8 * w * w) * (isBossFloor(run.floor) ? 1.4 : 1) + (isBossFloor(run.floor) ? 150 : 0));
}

export function blessingsOf(run: ClimbRun): AugmentDef[] {
  return run.blessings.map((id) => AUGMENT_MAP[id]).filter((a): a is AugmentDef => !!a);
}

/** Three rewards to choose from after a floor (always one blessing). */
export function rollRewards(run: ClimbRun, p: Profile): Reward[] {
  const rng = new Rng(run.seed * 31 + run.floor * 104729);
  const out: Reward[] = [];
  const taken = new Set(run.blessings);
  const pool = AUGMENTS.filter(
    (a) => (a.stackable || !taken.has(a.id)) && !a.gold && !a.lives && (!a.requiresTower || run.towers.includes(a.requiresTower)),
  );
  const weights = pool.map((a) => RARITY_WEIGHT[a.rarity] * (a.rarity === 'common' ? 1 : 1 + run.floor * 0.04));
  const blessing = () => {
    const i = rng.weighted(weights);
    if (i < 0) return null;
    weights[i] = 0;
    return { kind: 'blessing', id: pool[i].id } as Reward;
  };
  const first = blessing();
  if (first) out.push(first);
  const recruits = climbPool(p).filter((id) => !run.towers.includes(id));
  const extras: (() => Reward | null)[] = [
    () => (recruits.length ? { kind: 'tower', tower: recruits.splice(rng.int(0, recruits.length - 1), 1)[0] } : null),
    () => (recruits.length ? { kind: 'tower', tower: recruits.splice(rng.int(0, recruits.length - 1), 1)[0] } : null),
    () => (run.lives < CLIMB_LIVES ? { kind: 'heal', lives: Math.min(CLIMB_LIVES - run.lives, 6) } : null),
    () => ({ kind: 'gold', gold: 60 }),
    blessing,
  ];
  while (out.length < 3 && extras.length) {
    const r = extras.splice(rng.int(0, extras.length - 1), 1)[0]();
    if (r && !out.some((o) => JSON.stringify(o) === JSON.stringify(r))) out.push(r);
  }
  return out;
}

/** After a floor is won: lives left, kills, and the rewards to choose from. */
export function clearFloor(run: ClimbRun, p: Profile, lives: number, kills: number): void {
  // A short rest between floors heals a little.
  run.lives = Math.min(CLIMB_LIVES, lives + FLOOR_HEAL);
  run.kills += kills;
  run.floor++;
  run.offer = rollRewards(run, p);
}

export function takeReward(run: ClimbRun, r: Reward): void {
  if (r.kind === 'tower' && !run.towers.includes(r.tower) && TOWERS[r.tower]) run.towers.push(r.tower);
  if (r.kind === 'blessing') run.blessings.push(r.id);
  if (r.kind === 'heal') run.lives = Math.min(CLIMB_LIVES, run.lives + r.lives);
  if (r.kind === 'gold') run.goldBonus += r.gold;
  run.offer = null;
}

export function loadClimb(storage: Storage | undefined): ClimbRun | null {
  try {
    const txt = storage?.getItem(KEY);
    const r = txt ? (JSON.parse(txt) as ClimbRun) : null;
    return r && r.v === 1 && r.epoch === PROGRESS_EPOCH && Array.isArray(r.towers) ? r : null;
  } catch {
    return null;
  }
}

export function saveClimb(storage: Storage | undefined, r: ClimbRun): void {
  try {
    storage?.setItem(KEY, JSON.stringify(r));
  } catch {
    /* storage unavailable */
  }
}

export function clearClimb(storage: (Storage & { removeItem?(key: string): void }) | undefined): void {
  try {
    storage?.removeItem?.(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Stars for a finished climb: grows with every floor cleared. */
export function climbStars(floorsCleared: number): number {
  return Math.round(floorsCleared * 1.5 + Math.max(0, floorsCleared - 10) * 0.5);
}
