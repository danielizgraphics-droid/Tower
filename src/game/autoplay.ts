import { TOWERS } from '../data/towers';
import type { TowerId } from '../data/types';
import { Rng } from '../engine/rng';
import type { Game } from './game';

/**
 * Simple heuristic player used for balance simulations (tests) and the animated
 * menu background. It builds on the tiles that cover the most path, spreads gold
 * between new towers and upgrades, and always takes the first augment.
 */
export class AutoPlayer {
  private spots: { x: number; y: number; score: number }[];
  private rng: Rng;
  private timer = 0;
  private buildIndex = 0;

  constructor(
    private game: Game,
    private towerPool: TowerId[] = game.unlockedTowers,
    seed = 1,
    private branchPick: 'random' | number = 'random',
  ) {
    this.rng = new Rng(seed);
    const b = game.board;
    const pathCells: { x: number; y: number }[] = [];
    for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) if (b.isWalkable(x, y)) pathCells.push({ x: x + 0.5, y: y + 0.5 });
    this.spots = [];
    for (let y = 0; y < b.height; y++)
      for (let x = 0; x < b.width; x++) {
        if (!b.isBuildable(x, y)) continue;
        const score = pathCells.filter((p) => Math.hypot(p.x - x - 0.5, p.y - y - 0.5) <= 2.6).length;
        if (score > 0) this.spots.push({ x, y, score });
      }
    this.spots.sort((a, b) => b.score - a.score);
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
    this.timer = 0.4;
    this.spend();
    if (g.phase === 'build') g.startNextWave();
    if (g.spellReady('meteor') && g.enemies.length > 8) {
      const e = g.enemies.reduce((a, b) => (a.dist > b.dist ? a : b));
      g.castSpell('meteor', e.x, e.y);
    }
  }

  private spend(): void {
    const g = this.game;
    for (let guard = 0; guard < 6; guard++) {
      // Prefer upgrades once there are a handful of towers.
      const upgradable = g.towers
        .map((t) => {
          const branch = t.branch >= 0 ? t.branch : this.branchPick === 'random' ? this.rng.int(0, 2) : this.branchPick;
          return { t, branch, cost: g.upgradeCost(t, branch) };
        })
        .filter((u) => u.cost !== null)
        .sort((a, b) => a.cost! - b.cost!);
      const wantBuild = g.towers.length < 4 + g.wave * 0.6 && this.spots.some((s) => g.canBuildAt(s.x, s.y));
      const nextType = this.towerPool[this.buildIndex % this.towerPool.length];
      const buildCost = g.buildCost(nextType);
      if (wantBuild && g.gold >= buildCost) {
        const spot = this.spots.find((s) => g.canBuildAt(s.x, s.y));
        if (spot && g.build(nextType, spot.x, spot.y)) {
          this.buildIndex++;
          continue;
        }
      }
      const up = upgradable[0];
      if (up && (!wantBuild || g.towers.length >= 6) && g.gold >= up.cost!) {
        g.upgrade(up.t, up.branch);
        continue;
      }
      break;
    }
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
