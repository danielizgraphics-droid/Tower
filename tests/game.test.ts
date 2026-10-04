import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { generateMap } from '../src/game/mapgen';

const MAP = generateMap({ biome: 'meadow', seed: 2024 });
import { AutoPlayer, ALL_TOWERS, simulate } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { ModifierSet } from '../src/game/modifiers';
import { generateWave, waveHpMultiplier } from '../src/game/waves';
import { buyNode, defaultProfile, profileModifiers } from '../src/meta/profile';
import { GENERAL_TREE, TOWER_TREES } from '../src/meta/talentTrees';

const newGame = (seed = 1) => new Game({ map: MAP, difficulty: 'normal', mods: new ModifierSet(), unlockedTowers: ALL_TOWERS, seed });

/** First buildable tile next to the path. */
function spotNearPath(g: Game): { x: number; y: number } {
  const b = g.board;
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++)
      if (
        g.canBuildAt(x, y) &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => b.isWalkable(x + dx, y + dy))
      )
        return { x, y };
  throw new Error('no spot');
}

describe('waves', () => {
  it('are deterministic and grow over time', () => {
    const a = generateWave(MAP, 7);
    const b = generateWave(MAP, 7);
    expect(a).toEqual(b);
    expect(waveHpMultiplier(30)).toBeGreaterThan(waveHpMultiplier(10));
    for (let w = 1; w <= 30; w++) {
      const wave = generateWave(MAP, w);
      expect(wave.groups.length).toBeGreaterThan(0);
      for (const g of wave.groups) expect(ENEMIES[g.enemy].minWave <= w || ENEMIES[g.enemy].boss).toBe(true);
    }
    expect(generateWave(MAP, 10).boss).toBe('warlord');
    expect(generateWave(MAP, 20).boss).toBe('lich');
    expect(generateWave(MAP, 30).boss).toBe('dragon');
    // Endless: bosses keep cycling and enemies keep scaling.
    expect(generateWave(MAP, 40).boss).toBe('warlord');
    expect(generateWave(MAP, 90).boss).toBe('dragon');
    expect(waveHpMultiplier(60) / waveHpMultiplier(30)).toBeGreaterThan(5);
  });
});

describe('combat', () => {
  it('damage goes through shield, then armor, then health', () => {
    const g = newGame();
    const e = g.spawnEnemy('runeguard', 1, 1);
    const shield = e.shield;
    g.damageEnemy(e, 10, 'lightning', null);
    expect(e.shield).toBeCloseTo(shield - 16);
    expect(e.hp).toBe(e.maxHp);
    const k = g.spawnEnemy('knight', 1, 1);
    g.damageEnemy(k, 10, 'physical', null);
    expect(k.armor).toBeCloseTo(k.maxArmor - 5.5);
    expect(k.hp).toBe(k.maxHp);
  });

  it('holy damage is stronger against undead', () => {
    const g = newGame();
    const s = g.spawnEnemy('skeleton', 1, 1);
    s.armor = 0;
    g.damageEnemy(s, 10, 'holy', null);
    expect(s.maxHp - s.hp).toBeCloseTo(16);
  });

  it('kills give gold and split slimes', () => {
    const g = newGame();
    const gold = g.gold;
    const slime = g.spawnEnemy('slime', 6, 3);
    g.killEnemy(slime, null);
    expect(g.gold).toBeGreaterThan(gold);
    expect(g.enemies.filter((e) => e.def.id === 'slimeling' && e.alive)).toHaveLength(2);
  });

  it('a tower shoots and kills enemies in range', () => {
    const g = newGame();
    const spot = spotNearPath(g);
    const t = g.build('arcane', spot.x, spot.y)!;
    expect(t).toBeTruthy();
    g.startNextWave();
    for (let i = 0; i < 60 * 40; i++) g.step(1 / 60);
    expect(t.kills).toBeGreaterThan(0);
    expect(t.damageDealt).toBeGreaterThan(0);
  });

  it('economy: build, upgrade through a branch, sell', () => {
    const g = newGame();
    g.gold = 5000;
    const spot = spotNearPath(g);
    const t = g.build('cannon', spot.x, spot.y)!;
    expect(g.upgrade(t)).toBe(true);
    expect(g.upgrade(t)).toBe(true);
    expect(g.upgrade(t)).toBe(false); // needs a branch
    expect(g.upgrade(t, 2)).toBe(true);
    expect(t.branch).toBe(2);
    expect(g.upgrade(t)).toBe(true);
    expect(t.tier).toBe(5);
    expect(g.upgrade(t)).toBe(false);
    const before = g.gold;
    const refund = g.sell(t);
    expect(refund).toBe(t.spent); // sold during the build phase: full refund
    expect(g.gold).toBe(before + refund);
    expect(g.towers).toHaveLength(0);
  });

  it('cannot build on the path or on another tower', () => {
    const g = newGame();
    const p = g.board.path[2];
    expect(g.build('archer', Math.floor(p.x), Math.floor(p.y))).toBeNull();
    const spot = spotNearPath(g);
    expect(g.build('archer', spot.x, spot.y)).toBeTruthy();
    expect(g.build('archer', spot.x, spot.y)).toBeNull();
  });

  it('spells consume mana and respect cooldowns', () => {
    const g = newGame();
    g.mana = 1000;
    expect(g.castSpell('meteor', 5, 5)).toBe(true);
    expect(g.castSpell('meteor', 5, 5)).toBe(false);
    expect(g.castSpell('frostNova', 5, 5)).toBe(false); // locked by default
  });
});

describe('endless mode', () => {
  it('never runs out of waves', () => {
    const g = new Game({
      map: generateMap({ biome: 'meadow', seed: 3, waves: Infinity }),
      difficulty: 'easy',
      mods: new ModifierSet(),
      unlockedTowers: ALL_TOWERS,
      seed: 1,
    });
    g.wave = 120;
    expect(g.canStartWave()).toBe(true);
    expect(g.nextWaveDef()?.index).toBe(121);
  });
});

describe('augments', () => {
  it('are offered every 5 waves and apply their modifiers', () => {
    const g = newGame(3);
    g.gold = 1e6;
    const p = new AutoPlayer(g, ALL_TOWERS, 3);
    let offered = 0;
    g.events.on('augmentOffer', () => offered++);
    for (let i = 0; i < 60 * 600 && g.wavesCleared < 5 && !g.isOver; i++) {
      if (g.phase === 'augment') break;
      p.update(1 / 60);
      g.step(1 / 60);
    }
    expect(g.phase).toBe('augment');
    expect(offered).toBe(1);
    expect(g.augmentOffer).toHaveLength(3);
    const pick = g.augmentOffer[0];
    expect(g.pickAugment(pick.id)).toBe(true);
    expect(g.augments).toContain(pick);
    expect(g.phase).not.toBe('augment');
  });

  it('never offers duplicates in one roll', () => {
    const g = newGame(9);
    for (let i = 0; i < 50; i++) {
      const roll = g.rollAugments();
      expect(new Set(roll.map((a) => a.id)).size).toBe(roll.length);
    }
  });
});

describe('full runs (balance smoke tests)', () => {
  it('a fully-talented auto player beats the first map on normal', () => {
    const prof = defaultProfile();
    prof.stars = 9999;
    for (const t of ALL_TOWERS) {
      prof.towers[t].unlocked = true;
      prof.towers[t].xp = 1e6;
    }
    for (let pass = 0; pass < 8; pass++) {
      for (const n of GENERAL_TREE.nodes) buyNode(prof, GENERAL_TREE, n.id);
      for (const t of ['archer', 'cannon', 'arcane', 'frost'] as const) for (const n of TOWER_TREES[t].nodes) buyNode(prof, TOWER_TREES[t], n.id);
    }
    const g = new Game({
      map: MAP,
      difficulty: 'normal',
      mods: profileModifiers(prof),
      unlockedTowers: ['archer', 'cannon', 'arcane', 'frost'],
      seed: 1,
    });
    simulate(g, new AutoPlayer(g, ['archer', 'cannon', 'arcane', 'frost'], 1));
    expect(g.phase).toBe('victory');
  }, 60000);

  it('an untalented auto player cannot steamroll heroic difficulty', () => {
    const g = new Game({
      map: MAP,
      difficulty: 'hard',
      mods: new ModifierSet(),
      unlockedTowers: ['archer', 'cannon', 'arcane', 'frost'],
      seed: 2,
    });
    simulate(g, new AutoPlayer(g, ['archer', 'cannon', 'arcane', 'frost'], 2));
    expect(g.phase).toBe('defeat');
  }, 60000);
});
