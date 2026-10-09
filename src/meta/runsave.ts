// A battle in progress, saved between waves so it can be resumed if the page is
// closed or reloaded (phones may reload a page that uses a lot of memory).
// Only the state at the start of a wave is kept: towers, resources, blessings.

import { AUGMENT_MAP } from '../data/augments';
import { TOWERS } from '../data/towers';
import type { Biome, Difficulty, TargetMode, TowerId } from '../data/types';
import type { Game } from '../game/game';
import type { Storage } from './profile';

const KEY = 'bastion-arcano.run';

export interface RunSave {
  v: 1;
  savedAt: number;
  biome: Biome;
  seed: number;
  difficulty: Difficulty;
  endless: boolean;
  /** A won campaign continued in endless mode: what had already been rewarded. */
  continued: { waves: number; kills: number; bosses: number; xp: Partial<Record<TowerId, number>> } | null;
  wave: number;
  wavesCleared: number;
  gold: number;
  lives: number;
  maxLives: number;
  mana: number;
  rerollsLeft: number;
  kills: number;
  bossesKilled: number;
  goldEarned: number;
  leaked: number;
  towerXp: Partial<Record<TowerId, number>>;
  augments: string[];
  towers: { id: TowerId; x: number; y: number; tier: number; branch: number; target: TargetMode; kills: number; damage: number; souls: number }[];
}

export function captureRun(
  game: Game,
  run: { biome: Biome; seed: number; difficulty: Difficulty; endless: boolean; continued: RunSave['continued'] },
): RunSave {
  return {
    v: 1,
    savedAt: Date.now(),
    ...run,
    wave: game.wave,
    wavesCleared: game.wavesCleared,
    gold: game.gold,
    lives: game.lives,
    maxLives: game.maxLives,
    mana: game.mana,
    rerollsLeft: game.rerollsLeft,
    kills: game.kills,
    bossesKilled: game.bossesKilled,
    goldEarned: game.goldEarned,
    leaked: game.leaked,
    towerXp: { ...game.towerXp },
    augments: game.augments.map((a) => a.id),
    towers: game.towers.map((t) => ({
      id: t.def.id,
      x: t.tx,
      y: t.ty,
      tier: t.tier,
      branch: t.branch,
      target: t.targetMode,
      kills: t.kills,
      damage: t.damageDealt,
      souls: t.souls,
    })),
  };
}

/** Rebuilds a saved battle on a fresh game of the same map and seed. */
export function restoreRun(game: Game, s: RunSave): void {
  if (s.endless) game.totalWaves = Infinity;
  for (const id of new Set(s.towers.map((t) => t.id))) if (!game.unlockedTowers.includes(id)) game.unlockedTowers.push(id);
  for (const id of s.augments) {
    const a = AUGMENT_MAP[id];
    if (!a) continue;
    game.augments.push(a);
    game.mods.add(a.mods);
  }
  game.gold = 1e12;
  for (const st of s.towers) {
    if (!TOWERS[st.id]) continue;
    const t = game.build(st.id, st.x, st.y);
    if (!t) continue;
    while (t.tier < st.tier && game.upgrade(t, st.branch >= 0 ? st.branch : undefined));
    t.targetMode = st.target;
    t.kills = st.kills;
    t.damageDealt = st.damage;
    t.souls = st.souls;
    t.buildAnim = 1;
  }
  game.wave = s.wave;
  game.wavesCleared = s.wavesCleared;
  game.gold = s.gold;
  game.lives = s.lives;
  game.maxLives = s.maxLives;
  game.mana = s.mana;
  game.rerollsLeft = s.rerollsLeft;
  game.kills = s.kills;
  game.bossesKilled = s.bossesKilled;
  game.goldEarned = s.goldEarned;
  game.leaked = s.leaked;
  game.towerXp = { ...s.towerXp };
}

export function loadRun(storage: Storage | undefined): RunSave | null {
  try {
    const txt = storage?.getItem(KEY);
    const s = txt ? (JSON.parse(txt) as RunSave) : null;
    return s && s.v === 1 && Array.isArray(s.towers) ? s : null;
  } catch {
    return null;
  }
}

export function saveRun(storage: Storage | undefined, s: RunSave): void {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

export function clearRun(storage: (Storage & { removeItem?(key: string): void }) | undefined): void {
  try {
    storage?.removeItem?.(KEY);
  } catch {
    /* storage unavailable */
  }
}
