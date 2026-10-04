import { ENEMIES, ENEMY_LIST } from '../data/enemies';
import type { EnemyId, MapDef } from '../data/types';
import { Rng } from '../engine/rng';

export interface SpawnGroup {
  enemy: EnemyId;
  count: number;
  /** Seconds between spawns inside the group. */
  interval: number;
  /** Seconds after wave start when the group starts. */
  start: number;
}

export interface WaveDef {
  index: number; // 1-based
  groups: SpawnGroup[];
  boss?: EnemyId;
  /** Gold given when the wave is cleared. */
  reward: number;
}

/** Health multiplier for enemies in a wave. */
export function waveHpMultiplier(wave: number): number {
  const w = wave - 1;
  return 1 + 0.12 * w + 0.006 * w * w;
}

export const BOSS_WAVES: Record<number, EnemyId> = { 10: 'warlord', 20: 'lich', 30: 'dragon' };

function threatBudget(wave: number): number {
  return 7 + 2.4 * wave + 0.07 * wave * wave;
}

/**
 * Deterministic wave generator: same map + wave always produces the same wave, so
 * players can learn a map and tests can rely on it.
 */
export function generateWave(map: MapDef, wave: number): WaveDef {
  const rng = new Rng(hashString(map.id) * 31 + wave * 7919);
  const groups: SpawnGroup[] = [];
  let budget = threatBudget(wave);
  const boss = BOSS_WAVES[wave];
  let t = 0;

  if (boss) {
    // Boss waves: a lighter escort first, then the boss.
    budget *= 0.45;
  }

  const eligible = ENEMY_LIST.filter((e) => e.minWave <= wave && !e.boss && e.threat > 0);
  // Newly introduced enemy types get the spotlight on their debut wave.
  const debut = eligible.filter((e) => e.minWave === wave);
  const groupCount = Math.min(eligible.length, wave < 4 ? 1 : wave < 12 ? rng.int(2, 3) : rng.int(2, 4));
  const chosen: EnemyId[] = debut.map((e) => e.id);
  const weights = eligible.map((e) => 1 + Math.max(0, 8 - (wave - e.minWave)) * 0.25);
  let guard = 0;
  while (chosen.length < groupCount && guard++ < 50) {
    const idx = rng.weighted(weights);
    const id = eligible[idx].id;
    if (!chosen.includes(id)) chosen.push(id);
  }

  // Every 5th non-boss wave is a "rush": one fast type, many units.
  const rush = wave % 5 === 0 && !boss && wave > 3;

  const list = rush ? [chosen.slice().sort((a, b) => ENEMIES[b].speed - ENEMIES[a].speed)[0]] : chosen;
  list.forEach((id, i) => {
    const def = ENEMIES[id];
    const share = budget / list.length;
    const count = Math.max(1, Math.round(share / def.threat));
    const baseInterval = Math.max(0.28, 0.85 / Math.sqrt(def.speed)) * (def.threat > 6 ? 1.6 : 1);
    const interval = rush ? baseInterval * 0.6 : baseInterval;
    groups.push({ enemy: id, count, interval, start: t });
    // Later groups overlap more as waves progress.
    const duration = count * interval;
    t += duration * (wave > 15 ? 0.55 : 0.8) + (i === list.length - 1 ? 0 : 1.2);
  });

  if (boss) {
    groups.push({ enemy: boss, count: 1, interval: 1, start: t + 2 });
  }

  return { index: wave, groups, boss, reward: 30 + Math.round(wave * 3) };
}

/** Enemy counts in a wave (for the "next wave" preview). Bosses' summons are not included. */
export function wavePreview(w: WaveDef): { enemy: EnemyId; count: number }[] {
  const map = new Map<EnemyId, number>();
  for (const g of w.groups) map.set(g.enemy, (map.get(g.enemy) ?? 0) + g.count);
  return [...map.entries()].map(([enemy, count]) => ({ enemy, count }));
}

export function waveDuration(w: WaveDef): number {
  return Math.max(...w.groups.map((g) => g.start + g.count * g.interval));
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
