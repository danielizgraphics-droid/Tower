import { describe, expect, it } from 'vitest';
import { ALL_TOWERS } from '../src/game/autoplay';
import { EXHAUST_AGE, type Enemy } from '../src/game/entities';
import { Game } from '../src/game/game';
import { generateMap } from '../src/game/mapgen';
import { ModifierSet } from '../src/game/modifiers';

function game(): Game {
  const g = new Game({
    map: generateMap({ biome: 'meadow', seed: 3, waves: 2 }),
    difficulty: 'normal',
    mods: new ModifierSet(),
    unlockedTowers: ALL_TOWERS,
    seed: 1,
  });
  g.totalWaves = Infinity;
  g.lives = 1e6;
  return g;
}

describe('late endless waves cannot stall', () => {
  it('a pack of healers heals each other only a little', () => {
    const g = game();
    const pack = Array.from({ length: 12 }, () => g.spawnEnemy('shaman', 53, 3));
    const hurt = pack[0];
    hurt.hp = hurt.maxHp * 0.1;
    hurt.shield = 0;
    for (let i = 0; i < 30; i++) g.step(1 / 60);
    expect(hurt.hp).toBeLessThan(hurt.maxHp * 0.17);
  });

  it('enemies on the field too long stop healing', () => {
    const g = game();
    const pack = Array.from({ length: 6 }, () => g.spawnEnemy('shaman', 53, 3));
    for (const e of pack) e.age = EXHAUST_AGE + 1;
    const hurt = pack[0];
    hurt.hp = hurt.maxHp * 0.1;
    const hp = hurt.hp;
    for (let i = 0; i < 120; i++) g.step(1 / 60);
    expect(hurt.hp).toBeLessThanOrEqual(hp);
  });

  it('knockback weakens and stops after a few tiles', () => {
    const g = game();
    const e = g.spawnEnemy('goblin', 53, 10);
    const push = (g as unknown as { pushBack(e: Enemy, t: number): void }).pushBack.bind(g);
    for (let i = 0; i < 200; i++) push(e, 0.5);
    expect(e.dist).toBeGreaterThanOrEqual(10 - 4 - 1e-9);
    e.age = EXHAUST_AGE + 1;
    const d = e.dist;
    push(e, 0.5);
    expect(e.dist).toBe(d);
  });
});
