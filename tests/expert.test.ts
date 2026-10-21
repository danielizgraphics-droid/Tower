import { describe, expect, it } from 'vitest';
import { EXPERT_MAPS, expertMap } from '../src/data/expert';
import { Board } from '../src/game/board';
import { Game } from '../src/game/game';
import { ModifierSet } from '../src/game/modifiers';

describe('expert maps', () => {
  for (const x of EXPERT_MAPS)
    it(`${x.id}: every entrance and branch is a real road to the castle`, () => {
      const def = expertMap(x, 30);
      const b = new Board(def);
      expect(b.spawns.length).toBe(x.spawns);
      expect(b.routes.length).toBeGreaterThanOrEqual(x.spawns + (x.forks > 0 ? 1 : 0));
      for (const r of b.routes) {
        // Contiguous walkable cells from a spawn to the castle.
        const cells = def.routes!.find((c) => c[0].x === r.spawn.x && c[0].y === r.spawn.y)!;
        expect(cells).toBeDefined();
        // Short roads, but always some room to react.
        expect(r.length).toBeGreaterThan(15);
      }
      for (const cells of def.routes!) {
        const end = cells[cells.length - 1];
        expect(end).toEqual(b.castle);
        for (let i = 1; i < cells.length; i++) {
          expect(Math.abs(cells[i].x - cells[i - 1].x) + Math.abs(cells[i].y - cells[i - 1].y)).toBe(1);
          expect(b.isWalkable(cells[i].x, cells[i].y)).toBe(true);
        }
      }
    });

  it('the sea map has no land and the hero goes on the water', () => {
    const x = EXPERT_MAPS.find((m) => m.allWater)!;
    const g = new Game({ map: expertMap(x, 30), difficulty: 'hard', mods: new ModifierSet(), unlockedTowers: ['harbor'], hero: 'lyra' });
    expect(g.board.hasLand).toBe(false);
    expect(g.onWater('lyra')).toBe(true);
    expect(g.onWater('archer')).toBe(false);
  });

  it('enemies take turns at every entrance and leak at the end of their own route', () => {
    const x = EXPERT_MAPS.find((m) => m.spawns >= 3)!;
    const g = new Game({ map: expertMap(x, 30), difficulty: 'hard', mods: new ModifierSet(), unlockedTowers: [] });
    const spawnsUsed = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const e = g.spawnEnemy('goblin', 1, 0);
      const r = g.board.routes[e.route];
      spawnsUsed.add(`${r.spawn.x},${r.spawn.y}`);
    }
    expect(spawnsUsed.size).toBe(g.board.spawns.length);
    const e = g.enemies[1];
    e.dist = g.board.routeLength(e.route) - 0.01;
    const lives = g.lives;
    g.step(1 / 60);
    expect(g.lives).toBeLessThan(lives);
  });
});
