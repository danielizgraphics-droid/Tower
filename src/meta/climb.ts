// Torre infinita: a roguelike climb. Each floor is a short battle on the roof
// of a tower; lives, blessings and the towers recruited carry over from floor
// to floor, and the climb ends at the first defeat. Between floors the player
// picks a reward and then one of two doors: a floor with a twist (and double
// loot), or now and then a room with no battle — a treasure, an altar of pacts
// or a fountain. Reaching new heights unlocks lasting perks, and feats earn
// achievements. Saved between floors.

import { AUGMENTS, AUGMENT_MAP, RARITY_WEIGHT } from '../data/augments';
import type { Biome } from '../data/biomes';
import { TOWERS, TOWER_LIST } from '../data/towers';
import type { AugmentDef, MapDef, TowerId } from '../data/types';
import { Rng } from '../engine/rng';
import type { MissionRules } from '../game/game';
import { generateMap } from '../game/mapgen';
import { PROGRESS_EPOCH, type Profile, type Storage } from './profile';

const KEY = 'bastion-arcano.climb';

/** Waves fought on each floor. */
export const FLOOR_WAVES = 4;
/** Lives at the start of a climb (also the most it can hold, before perks). */
export const CLIMB_LIVES = 20;
/** Lives recovered after each floor won. */
export const FLOOR_HEAL = 2;
/** Enemy health on climb floors (the climb has no campaign economy to grow into). */
export const CLIMB_HP = 0.85;
/** Each floor starts this many waves further on (enemy strength, bosses). */
const OFFSET_PER_FLOOR = 2;

// ---------------------------------------------------------------- floor twists

export type FloorModId = 'horde' | 'elite' | 'swift' | 'fog' | 'flyers' | 'siege' | 'goldrush' | 'nomagic' | 'few';

export interface FloorMod {
  id: FloorModId;
  name: string;
  icon: string;
  text: string;
  rules: MissionRules;
  /** Only flying enemies. */
  flyers?: boolean;
  /** Starting gold multiplier. */
  startGold?: number;
}

export const FLOOR_MODS: Record<FloorModId, FloorMod> = {
  horde: { id: 'horde', name: 'Horda', icon: 'skull', text: 'Casi el doble de enemigos, pero más débiles.', rules: { countMult: 1.8, hpMult: 0.62 } },
  elite: {
    id: 'elite',
    name: 'Élite',
    icon: 'crown',
    text: 'Pocos enemigos, mucho más duros. Sueltan el doble de oro.',
    rules: { countMult: 0.5, hpMult: 1.85, goldMult: 2 },
  },
  swift: { id: 'swift', name: 'Prisa', icon: 'fast', text: 'Los enemigos corren un 30% más.', rules: { speedMult: 1.3, hpMult: 0.9 } },
  fog: { id: 'fog', name: 'Niebla', icon: 'cloud', text: 'Tus torres ven un 20% menos.', rules: { rangeMult: 0.8 } },
  flyers: { id: 'flyers', name: 'Cielo abierto', icon: 'wave', text: 'Solo llegan enemigos voladores.', rules: {}, flyers: true },
  siege: {
    id: 'siege',
    name: 'Asedio',
    icon: 'shield',
    text: 'Ningún volador, pero los de tierra aguantan un 40% más.',
    rules: { groundOnly: true, hpMult: 1.4 },
  },
  goldrush: {
    id: 'goldrush',
    name: 'Fiebre del oro',
    icon: 'coins',
    text: 'Las bajas dan el doble de oro, pero empiezas con la mitad.',
    rules: { goldMult: 2 },
    startGold: 0.5,
  },
  nomagic: {
    id: 'nomagic',
    name: 'Sin magia',
    icon: 'eye',
    text: 'No puedes lanzar hechizos. Enemigos un 15% más débiles.',
    rules: { noSpells: true, hpMult: 0.85 },
  },
  few: {
    id: 'few',
    name: 'Espacio justo',
    icon: 'tower',
    text: 'Como mucho 8 torres. Enemigos un 15% más débiles.',
    rules: { maxTowers: 8, hpMult: 0.85 },
  },
};

// ---------------------------------------------------------------- rewards, doors and rooms

export type Reward =
  { kind: 'tower'; tower: TowerId } | { kind: 'blessing'; id: string } | { kind: 'heal'; lives: number } | { kind: 'gold'; gold: number };

export type RoomKind = 'treasure' | 'altar' | 'fountain';

export const ROOMS: Record<RoomKind, { name: string; icon: string; text: string }> = {
  treasure: { name: 'Sala del tesoro', icon: 'gem', text: 'Sin batalla: elige una bendición rara o épica.' },
  altar: { name: 'Altar del pacto', icon: 'flame', text: 'Sin batalla: cambia vidas por poder… si te atreves.' },
  fountain: { name: 'Fuente de la vida', icon: 'drop', text: 'Sin batalla: recupera vidas o llena la bolsa.' },
};

export type Door = { kind: 'battle'; mod: FloorModId | null; loot: boolean } | { kind: 'room'; room: RoomKind };

/** A choice inside a room: what it costs (lives) and what it gives. */
export interface RoomChoice {
  cost: number;
  reward: Reward | null;
}

export interface ClimbStats {
  /** Floors won in a row without losing a life (and the best streak). */
  flawless: number;
  bestFlawless: number;
  bosses: number;
  recruits: number;
  modFloors: number;
  rooms: RoomKind[];
  pacts: number;
  /** Won a floor with a single life left. */
  edge: boolean;
}

export interface ClimbRun {
  v: 2;
  epoch: number;
  seed: number;
  /** Floor about to be played (1-based); floors cleared = floor - 1. */
  floor: number;
  lives: number;
  maxLives: number;
  /** Blessings won so far (kept for the whole climb). */
  blessings: string[];
  /** Towers recruited for this climb. */
  towers: TowerId[];
  /** Extra starting gold on every floor. */
  goldBonus: number;
  kills: number;
  /** Where the climb stands between floors. */
  stage: 'reward' | 'doors' | 'room' | 'ready';
  /** Rewards on offer after a floor, and how many may still be taken. */
  offer: Reward[] | null;
  picks: number;
  doors: Door[] | null;
  room: { kind: RoomKind; choices: RoomChoice[] } | null;
  /** The battle behind the door chosen. */
  next: { mod: FloorModId | null; loot: boolean };
  stats: ClimbStats;
  /** The player's record when this climb began (to tell a new record). */
  startBest: number;
}

// ---------------------------------------------------------------- lasting progress

export type Perk = 'purse' | 'blessed' | 'recruit' | 'hero' | 'stout' | 'crown';

/** Heights that unlock something for good (floors cleared in a single climb). */
export const MILESTONES: { floor: number; stars: number; perk: Perk; text: string }[] = [
  { floor: 5, stars: 50, perk: 'purse', text: 'Bolsa de viaje: empiezas cada escalada con +80 de oro inicial.' },
  { floor: 10, stars: 80, perk: 'blessed', text: 'Bendición inicial: empiezas con una bendición al azar.' },
  { floor: 15, stars: 120, perk: 'recruit', text: 'Refuerzos: empiezas con 4 torres en vez de 3.' },
  { floor: 20, stars: 160, perk: 'hero', text: 'Desbloquea a Sidonia, la Vigía de la Torre (héroe).' },
  { floor: 25, stars: 200, perk: 'stout', text: 'Muros firmes: +5 vidas máximas en la torre.' },
  { floor: 30, stars: 300, perk: 'crown', text: 'Corona de la Torre: luces una corona en la clasificación.' },
];

export function hasPerk(p: Profile, perk: Perk): boolean {
  return MILESTONES.some((m) => m.perk === perk && p.climb.best >= m.floor);
}

export interface Achievement {
  id: string;
  name: string;
  text: string;
  stars: number;
  /** Progress towards it (have / need). */
  progress(run: ClimbRun | null, p: Profile): [number, number];
}

const runStat = (run: ClimbRun | null, f: (r: ClimbRun) => number) => (run ? f(run) : 0);

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'flawless',
    name: 'Intocable',
    text: 'Supera 5 pisos seguidos sin perder vidas.',
    stars: 40,
    progress: (r) => [runStat(r, (x) => x.stats.bestFlawless), 5],
  },
  { id: 'edge', name: 'Al filo', text: 'Supera un piso con una sola vida.', stars: 30, progress: (r) => [runStat(r, (x) => +x.stats.edge), 1] },
  {
    id: 'collector',
    name: 'Coleccionista',
    text: 'Reúne 6 bendiciones en una escalada.',
    stars: 40,
    progress: (r) => [runStat(r, (x) => x.blessings.length), 6],
  },
  {
    id: 'daring',
    name: 'Temerario',
    text: 'Supera 6 pisos con giro en una escalada.',
    stars: 50,
    progress: (r) => [runStat(r, (x) => x.stats.modFloors), 6],
  },
  {
    id: 'explorer',
    name: 'Explorador',
    text: 'Visita las tres salas especiales en una escalada.',
    stars: 40,
    progress: (r) => [runStat(r, (x) => new Set(x.stats.rooms).size), 3],
  },
  {
    id: 'pacts',
    name: 'Pacto de sangre',
    text: 'Acepta 3 pactos del altar en una escalada.',
    stars: 30,
    progress: (r) => [runStat(r, (x) => x.stats.pacts), 3],
  },
  {
    id: 'hunter',
    name: 'Cazaguardianes',
    text: 'Derrota a 3 guardianes en una escalada.',
    stars: 60,
    progress: (r) => [runStat(r, (x) => x.stats.bosses), 3],
  },
  {
    id: 'purist',
    name: 'Purista',
    text: 'Llega al piso 10 sin reclutar torres.',
    stars: 80,
    progress: (r) => [runStat(r, (x) => (x.stats.recruits === 0 ? x.floor - 1 : 0)), 10],
  },
  { id: 'veteran', name: 'Veterano de la torre', text: 'Supera 100 pisos en total.', stars: 100, progress: (_, p) => [p.climb.total, 100] },
];

/** Newly earned achievements (and their stars), recorded in the profile. */
export function checkAchievements(run: ClimbRun | null, p: Profile): Achievement[] {
  const out: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (p.climb.achievements.includes(a.id)) continue;
    const [have, need] = a.progress(run, p);
    if (have < need) continue;
    p.climb.achievements.push(a.id);
    p.stars += a.stars;
    p.starsEarned += a.stars;
    out.push(a);
  }
  return out;
}

/** Records a new height; returns the milestones reached just now (their stars are granted). */
export function reachHeight(p: Profile, floorsCleared: number): typeof MILESTONES {
  const before = p.climb.best;
  if (floorsCleared <= before) return [];
  p.climb.best = floorsCleared;
  const reached = MILESTONES.filter((m) => m.floor > before && m.floor <= floorsCleared);
  for (const m of reached) {
    p.stars += m.stars;
    p.starsEarned += m.stars;
  }
  return reached;
}

// ---------------------------------------------------------------- the climb

/** Towers a climb can recruit: the player's own (no exclusives, no naval: floors have no water). */
export function climbPool(p: Profile): TowerId[] {
  return TOWER_LIST.filter((t) => p.towers[t.id]?.unlocked && !t.hero && !t.exclusive && t.placement !== 'water').map((t) => t.id);
}

const freshStats = (): ClimbStats => ({ flawless: 0, bestFlawless: 0, bosses: 0, recruits: 0, modFloors: 0, rooms: [], pacts: 0, edge: false });

export function newClimb(p: Profile, seed = (Math.random() * 2 ** 31) >>> 0): ClimbRun {
  const rng = new Rng(seed ^ 0x2f6b);
  const pool = climbPool(p);
  // Archers plus two (or three) more of the player's towers, picked at random.
  const towers: TowerId[] = pool.includes('archer') ? ['archer'] : [];
  const rest = pool.filter((id) => !towers.includes(id));
  const size = hasPerk(p, 'recruit') ? 4 : 3;
  while (towers.length < size && rest.length) towers.push(rest.splice(rng.int(0, rest.length - 1), 1)[0]);
  const maxLives = CLIMB_LIVES + (hasPerk(p, 'stout') ? 5 : 0);
  const run: ClimbRun = {
    v: 2,
    epoch: PROGRESS_EPOCH,
    seed,
    floor: 1,
    lives: maxLives,
    maxLives,
    blessings: [],
    towers,
    goldBonus: hasPerk(p, 'purse') ? 80 : 0,
    kills: 0,
    stage: 'ready',
    offer: null,
    picks: 0,
    doors: null,
    room: null,
    next: { mod: null, loot: false },
    stats: freshStats(),
    startBest: p.climb.best,
  };
  if (hasPerk(p, 'blessed')) {
    const pool = blessingPool(run).filter((a) => a.rarity !== 'epic');
    if (pool.length) run.blessings.push(pool[rng.int(0, pool.length - 1)].id);
  }
  return run;
}

/** Every floor's map is decided by the climb's seed: the same floor is the same map if replayed. */
export function floorMap(run: ClimbRun): MapDef {
  const rng = new Rng(run.seed + run.floor * 7919);
  const biome: Biome = 'keep';
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
  const mod = run.next.mod ? FLOOR_MODS[run.next.mod] : null;
  return { ...def, id: `climb-${f}`, name: `Piso ${f} · ${def.name}`, flyers: !!mod?.flyers };
}

/** The battle rules of the floor about to be played (its twist included). */
export function floorRules(run: ClimbRun): MissionRules {
  const mod = run.next.mod ? FLOOR_MODS[run.next.mod] : null;
  return { lives: run.lives, noBlessings: true, ...(mod?.rules ?? {}), hpMult: CLIMB_HP * (mod?.rules.hpMult ?? 1) };
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
  const boss = isBossFloor(run.floor);
  // Floors with a boss get a war chest to prepare for it.
  const gold = base + run.goldBonus + 0.85 * (80 * w + 8 * w * w) * (boss ? 1.4 : 1) + (boss ? 150 : 0);
  const mod = run.next.mod ? FLOOR_MODS[run.next.mod] : null;
  return Math.round(gold * (mod?.startGold ?? 1));
}

export function blessingsOf(run: ClimbRun): AugmentDef[] {
  return run.blessings.map((id) => AUGMENT_MAP[id]).filter((a): a is AugmentDef => !!a);
}

function blessingPool(run: ClimbRun): AugmentDef[] {
  const taken = new Set(run.blessings);
  return AUGMENTS.filter(
    (a) => (a.stackable || !taken.has(a.id)) && !a.gold && !a.lives && (!a.requiresTower || run.towers.includes(a.requiresTower)),
  );
}

/** Three rewards to choose from after a floor (always one blessing). */
export function rollRewards(run: ClimbRun, p: Profile): Reward[] {
  const rng = new Rng(run.seed * 31 + run.floor * 104729);
  const out: Reward[] = [];
  const pool = blessingPool(run);
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
    () => (run.lives < run.maxLives ? { kind: 'heal', lives: Math.min(run.maxLives - run.lives, 6) } : null),
    () => ({ kind: 'gold', gold: 60 }),
    blessing,
  ];
  while (out.length < 3 && extras.length) {
    const r = extras.splice(rng.int(0, extras.length - 1), 1)[0]();
    if (r && !out.some((o) => JSON.stringify(o) === JSON.stringify(r))) out.push(r);
  }
  return out;
}

/** The two doors to the next floor. */
export function rollDoors(run: ClimbRun, afterRoom = false): Door[] {
  const rng = new Rng(run.seed * 17 + run.floor * 15485863);
  const twists = (Object.keys(FLOOR_MODS) as FloorModId[]).filter((id) => {
    // Flyers-only floors need towers that can hit them.
    if (id === 'flyers') return run.towers.filter((t) => TOWERS[t].targetsAir).length >= 2;
    return true;
  });
  const twist = () => twists[rng.int(0, twists.length - 1)];
  // A guardian waits: both doors lead to it, one of them with a twist.
  if (isBossFloor(run.floor))
    return [
      { kind: 'battle', mod: null, loot: false },
      { kind: 'battle', mod: twist(), loot: true },
    ];
  const first: Door = run.floor > 2 && rng.chance(0.45) ? { kind: 'battle', mod: twist(), loot: true } : { kind: 'battle', mod: null, loot: false };
  let second: Door;
  // Never two rooms in a row.
  if (run.floor >= 3 && !afterRoom && rng.chance(0.4)) {
    const rooms: RoomKind[] = ['treasure', 'altar', 'fountain'];
    second = { kind: 'room', room: rooms[rng.int(0, rooms.length - 1)] };
  } else {
    let mod = twist();
    if (first.kind === 'battle' && first.mod === mod) mod = twists[(twists.indexOf(mod) + 1) % twists.length];
    second = { kind: 'battle', mod, loot: true };
  }
  return [first, second];
}

/** What a room offers. */
export function rollRoom(run: ClimbRun, p: Profile, kind: RoomKind): RoomChoice[] {
  const rng = new Rng(run.seed * 7 + run.floor * 49979687);
  const pool = blessingPool(run);
  const pick = (rarities: string[]) => {
    const list = pool.filter((a) => rarities.includes(a.rarity));
    return list.length ? list.splice(rng.int(0, list.length - 1), 1)[0] : null;
  };
  if (kind === 'treasure') {
    const out: RoomChoice[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 6 && out.length < 3; i++) {
      const a = pick(i === 0 ? ['epic'] : ['rare', 'epic']);
      if (a && !seen.has(a.id)) {
        seen.add(a.id);
        out.push({ cost: 0, reward: { kind: 'blessing', id: a.id } });
      }
    }
    return out;
  }
  if (kind === 'fountain')
    return [
      { cost: 0, reward: { kind: 'heal', lives: 8 } },
      { cost: 0, reward: { kind: 'gold', gold: 90 } },
    ];
  // Altar: power for lives (never more than the climb can pay).
  const recruits = climbPool(p).filter((id) => !run.towers.includes(id));
  const epic = pick(['epic']);
  const pacts = (
    [
      epic ? { cost: 5, reward: { kind: 'blessing', id: epic.id } } : null,
      recruits.length ? { cost: 3, reward: { kind: 'tower', tower: recruits[rng.int(0, recruits.length - 1)] } } : null,
      { cost: 4, reward: { kind: 'gold', gold: 150 } },
    ] as (RoomChoice | null)[]
  ).filter((c): c is RoomChoice => !!c && c.cost < run.lives);
  return [...pacts, { cost: 0, reward: null }];
}

/** After a floor is won: lives left, kills, and the rewards to choose from. */
export function clearFloor(run: ClimbRun, p: Profile, lives: number, kills: number): void {
  const lost = run.lives - lives;
  const s = run.stats;
  s.flawless = lost > 0 ? 0 : s.flawless + 1;
  s.bestFlawless = Math.max(s.bestFlawless, s.flawless);
  if (lives === 1) s.edge = true;
  if (isBossFloor(run.floor)) s.bosses++;
  if (run.next.mod) s.modFloors++;
  // A short rest between floors heals a little.
  run.lives = Math.min(run.maxLives, lives + FLOOR_HEAL);
  run.kills += kills;
  run.floor++;
  p.climb.total++;
  run.picks = run.next.loot ? 2 : 1;
  run.offer = rollRewards(run, p);
  run.stage = 'reward';
}

function applyReward(run: ClimbRun, r: Reward): void {
  if (r.kind === 'tower' && !run.towers.includes(r.tower) && TOWERS[r.tower]) {
    run.towers.push(r.tower);
    run.stats.recruits++;
  }
  if (r.kind === 'blessing') run.blessings.push(r.id);
  if (r.kind === 'heal') run.lives = Math.min(run.maxLives, run.lives + r.lives);
  if (r.kind === 'gold') run.goldBonus += r.gold;
}

/** Takes one of the rewards on offer; once all picks are used, the doors open. */
export function takeReward(run: ClimbRun, r: Reward): void {
  applyReward(run, r);
  run.offer = (run.offer ?? []).filter((o) => o !== r && JSON.stringify(o) !== JSON.stringify(r));
  run.picks--;
  if (run.picks <= 0 || !run.offer.length) {
    run.offer = null;
    run.picks = 0;
    run.stage = 'doors';
    run.doors = rollDoors(run);
  }
}

export function chooseDoor(run: ClimbRun, p: Profile, d: Door): void {
  run.doors = null;
  if (d.kind === 'battle') {
    run.next = { mod: d.mod, loot: d.loot };
    run.stage = 'ready';
    return;
  }
  run.room = { kind: d.room, choices: rollRoom(run, p, d.room) };
  run.stage = 'room';
}

/** A room's choice is made: the room counts as a floor climbed, then new doors. */
export function resolveRoom(run: ClimbRun, choice: RoomChoice): void {
  const kind = run.room!.kind;
  if (choice.reward) {
    run.lives -= choice.cost;
    applyReward(run, choice.reward);
    if (kind === 'altar' && choice.cost > 0) run.stats.pacts++;
  }
  run.stats.rooms.push(kind);
  run.room = null;
  run.floor++;
  run.stage = 'doors';
  run.doors = rollDoors(run, true);
}

export function loadClimb(storage: Storage | undefined): ClimbRun | null {
  try {
    const txt = storage?.getItem(KEY);
    const r = txt ? (JSON.parse(txt) as ClimbRun) : null;
    return r && r.v === 2 && r.epoch === PROGRESS_EPOCH && Array.isArray(r.towers) ? r : null;
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
