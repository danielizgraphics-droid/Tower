import { describe, expect, it } from 'vitest';
import { ALL_TOWERS } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { generateMap } from '../src/game/mapgen';
import { ModifierSet } from '../src/game/modifiers';
import { computeStars } from '../src/meta/profile';

describe('continuing a won campaign in endless mode', () => {
  it('keeps the same battle and goes past the last wave', () => {
    const g = new Game({
      map: generateMap({ biome: 'meadow', seed: 3, waves: 2 }),
      difficulty: 'easy',
      mods: new ModifierSet(),
      unlockedTowers: ALL_TOWERS,
      seed: 1,
    });
    g.gold = 1e6;
    g.lives = 1e6;
    let guard = 0;
    while (g.phase !== 'victory' && guard++ < 60 * 600) {
      if (g.phase === 'augment') g.pickAugment(g.augmentOffer[0].id);
      if (g.phase === 'build') g.startNextWave();
      g.step(1 / 60);
    }
    expect(g.phase).toBe('victory');
    const gold = g.gold;
    expect(g.continueEndless()).toBe(true);
    expect(g.phase).toBe('build');
    expect(g.gold).toBe(gold);
    expect(g.startNextWave()).toBe(0);
    expect(g.wave).toBe(3);
  });

  it('only pays stars for the waves after the campaign', () => {
    const base = {
      mapId: 'meadow',
      difficulty: 'normal' as const,
      totalWaves: Infinity,
      victory: false,
      towerXp: {},
      kills: 0,
      bossesKilled: 0,
      starGain: 0,
      xpGain: 0,
      endless: true,
    };
    expect(computeStars({ ...base, wavesCleared: 30, rewardedWaves: 30 }, true)).toBe(0);
    expect(computeStars({ ...base, wavesCleared: 40, rewardedWaves: 30 }, true)).toBeLessThan(computeStars({ ...base, wavesCleared: 40 }, true));
  });
});
