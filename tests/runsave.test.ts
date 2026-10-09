import { describe, expect, it } from 'vitest';
import { ALL_TOWERS } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { generateMap } from '../src/game/mapgen';
import { ModifierSet } from '../src/game/modifiers';
import { captureRun, restoreRun } from '../src/meta/runsave';

const newGame = () =>
  new Game({
    map: generateMap({ biome: 'meadow', seed: 9 }),
    difficulty: 'normal',
    mods: new ModifierSet(),
    unlockedTowers: [...ALL_TOWERS],
    seed: 1,
  });

describe('saving a battle between waves', () => {
  it('restores towers, upgrades, resources and blessings', () => {
    const g = newGame();
    g.gold = 5000;
    const spots: [number, number][] = [];
    for (let y = 0; y < g.board.height; y++) for (let x = 0; x < g.board.width; x++) if (g.canBuildAt(x, y, 'archer')) spots.push([x, y]);
    const a = g.build('archer', ...spots[0])!;
    const c = g.build('cannon', ...spots[3])!;
    for (let i = 0; i < 4; i++) g.upgrade(a, 1);
    g.setTargetMode(c, 'strong');
    g.wave = 7;
    g.wavesCleared = 7;
    g.lives = 13;
    g.gold = 321;
    g.towerXp = { archer: 40 };
    const save = captureRun(g, { biome: 'meadow', seed: 9, difficulty: 'normal', endless: false, continued: null });
    const json = JSON.parse(JSON.stringify(save));

    const h = newGame();
    restoreRun(h, json);
    expect(h.towers.map((t) => [t.def.id, t.tx, t.ty, t.tier, t.branch])).toEqual(g.towers.map((t) => [t.def.id, t.tx, t.ty, t.tier, t.branch]));
    expect(h.towers[1].targetMode).toBe('strong');
    expect([h.gold, h.lives, h.wave, h.wavesCleared]).toEqual([321, 13, 7, 7]);
    expect(h.towerXp.archer).toBe(40);
    expect(h.startNextWave()).toBe(0);
    expect(h.wave).toBe(8);
  });
});
