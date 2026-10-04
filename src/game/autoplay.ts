import { TOWERS } from '../data/towers';
import type { TowerId, TowerStats } from '../data/types';
import { Rng } from '../engine/rng';
import type { Tower } from './entities';
import { estimateDps, targetFactor } from './estimate';
import type { Game } from './game';
import { effectiveAttack, effectiveTargetsAir } from './modifiers';

interface Action {
  value: number;
  cost: number;
  run: () => void;
}

/**
 * Heuristic player used for balance simulations (tests, scripts) and the
 * animated menu backdrop. It greedily picks the action with the best
 * "effective DPS gained per gold", weighted by how much path a tile covers, and
 * keeps some anti-air around.
 */
export class AutoPlayer {
  private pathCells: { x: number; y: number }[] = [];
  private rng: Rng;
  private timer = 0;
  /** Lower skill → worse choices (used for the casual backdrop). */
  skill = 1;

  constructor(
    private game: Game,
    private towerPool: TowerId[] = game.unlockedTowers,
    seed = 1,
  ) {
    this.rng = new Rng(seed);
    const b = game.board;
    for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) if (b.isWalkable(x, y)) this.pathCells.push({ x: x + 0.5, y: y + 0.5 });
  }

  private coverage(x: number, y: number, range: number): number {
    let n = 0;
    const r2 = range * range;
    for (const p of this.pathCells) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r2) n++;
    return n;
  }

  private eff(s: TowerStats, id: TowerId, branch: number): number {
    const kind = effectiveAttack(TOWERS[id], branch);
    let v = estimateDps(s, kind) * targetFactor(s, kind);
    // Utility value for control/support stats.
    v *= 1 + s.slow * 1.2 + s.vulnerability * 1.5 + s.stunChance + s.freezeChance;
    v += (s.auraDamage + s.auraRate) * 120 + s.waveGold * 0.6;
    return v;
  }

  update(dt: number): void {
    const g = this.game;
    if (g.isOver) return;
    if (g.phase === 'augment') {
      g.pickAugment(g.augmentOffer[0].id);
      return;
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.25;
    for (let i = 0; i < 4 && this.spendOnce(); i++);
    if (g.phase === 'build') g.startNextWave();
    if (g.spellReady('meteor') && g.enemies.length > 6) {
      const e = g.enemies.reduce((a, b) => (a.dist > b.dist ? a : b));
      g.castSpell('meteor', e.x, e.y);
    }
    if (g.spellReady('frostNova') && g.enemies.some((e) => e.dist > g.board.length * 0.8)) {
      const e = g.enemies.reduce((a, b) => (a.dist > b.dist ? a : b));
      g.castSpell('frostNova', e.x, e.y);
    }
    if (g.spellReady('blessing') && g.enemies.length > 15) g.castSpell('blessing');
  }

  private spendOnce(): boolean {
    const g = this.game;
    const actions: Action[] = [];
    const hasAir = g.towers.some((t) => effectiveTargetsAir(t.def, t.branch));
    const airSoon = g.wave >= 3;

    // Build candidates: best free spot per tower type.
    const landSpots: { x: number; y: number }[] = [];
    const waterSpots: { x: number; y: number }[] = [];
    const b = g.board;
    for (let y = 0; y < b.height; y++)
      for (let x = 0; x < b.width; x++) {
        if (g.canBuildAt(x, y)) landSpots.push({ x, y });
        else if (g.canBuildAt(x, y, 'harbor')) waterSpots.push({ x, y });
      }
    for (const id of this.towerPool) {
      const freeSpots = TOWERS[id].placement === 'water' ? waterSpots : landSpots;
      const cost = g.buildCost(id);
      const s = g.previewStats(id, 1, -1);
      let best = 0;
      let spot: { x: number; y: number } | null = null;
      for (const sp of freeSpots) {
        const c = this.coverage(sp.x + 0.5, sp.y + 0.5, s.range);
        if (c > best) {
          best = c;
          spot = sp;
        }
      }
      if (!spot) continue;
      let value = (this.eff(s, id, -1) * Math.sqrt(best)) / Math.max(1, cost);
      if (airSoon && !hasAir && TOWERS[id].targetsAir) value *= 2.5;
      const sx = spot.x;
      const sy = spot.y;
      actions.push({ value, cost, run: () => g.build(id, sx, sy) });
    }
    // Upgrade candidates
    for (const t of g.towers) {
      const branches = t.tier === 3 ? [0, 1, 2] : [t.branch];
      for (const br of branches) {
        const cost = g.upgradeCost(t, br);
        if (cost === null) continue;
        const now = this.eff(t.stats, t.def.id, t.branch);
        const next = this.eff(g.previewStats(t.def.id, t.tier + 1, br), t.def.id, br);
        const cov = Math.sqrt(this.coverage(t.x, t.y, g.previewStats(t.def.id, t.tier + 1, br).range));
        // Upgrades also save tiles; give them a small bonus.
        const value = ((next - now) * cov * 1.15) / cost;
        actions.push({ value, cost, run: () => this.upgrade(t, br) });
      }
    }
    if (!actions.length) return false;
    actions.sort((a, b) => b.value - a.value);
    const pickIdx = this.skill < 1 && this.rng.chance(1 - this.skill) ? Math.min(actions.length - 1, this.rng.int(0, 3)) : 0;
    const best = actions[pickIdx];
    if (g.gold >= best.cost) {
      best.run();
      return true;
    }
    // Spend on a cheaper, still-good action instead of hoarding forever.
    const alt = actions.find((a) => a.cost <= g.gold && a.value >= best.value * 0.7);
    if (alt) {
      alt.run();
      return true;
    }
    return false;
  }

  private upgrade(t: Tower, branch: number): void {
    this.game.upgrade(t, branch);
  }
}

/** Runs a whole game headless. Returns the game for inspection. */
export function simulate(game: Game, player: AutoPlayer, maxSeconds = 3600): Game {
  const dt = 1 / 60;
  let t = 0;
  while (!game.isOver && t < maxSeconds) {
    player.update(dt);
    if (!game.halted) game.step(dt);
    t += dt;
  }
  return game;
}

export const ALL_TOWERS = Object.keys(TOWERS) as TowerId[];
