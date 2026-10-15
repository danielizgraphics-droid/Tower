import { describe, expect, it } from 'vitest';
import { HERO_LEVEL_KILLS, heroLevel } from '../src/data/heroes';
import { HERO_LIST, TOWER_LIST } from '../src/data/towers';
import { Game } from '../src/game/game';
import { generateMap } from '../src/game/mapgen';
import { ModifierSet } from '../src/game/modifiers';
import { activeHero, applyRunResult, defaultProfile, heroProgress } from '../src/meta/profile';
import { captureRun, restoreRun } from '../src/meta/runsave';

const newGame = (hero: Parameters<typeof Game.prototype.build>[0] | null) =>
  new Game({
    map: generateMap({ biome: 'meadow', seed: 9, waves: 10 }),
    difficulty: 'normal',
    mods: new ModifierSet(),
    unlockedTowers: ['archer'],
    hero,
    seed: 1,
  });

const spots = (g: Game) => {
  const out: [number, number][] = [];
  for (let y = 0; y < g.board.height; y++) for (let x = 0; x < g.board.width; x++) if (g.canBuildAt(x, y)) out.push([x, y]);
  return out;
};

describe('hero towers', () => {
  it('there are at least 7, separate from the regular towers, each with its own unlock', () => {
    expect(HERO_LIST.length).toBeGreaterThanOrEqual(7);
    for (const h of HERO_LIST) expect(TOWER_LIST.includes(h)).toBe(false);
    expect(new Set(HERO_LIST.map((h) => JSON.stringify(h.hero!.unlock))).size).toBe(HERO_LIST.length);
  });

  it('only one per battle, only the one brought, and never upgraded with gold', () => {
    const g = newGame('eldrin');
    g.gold = 1e5;
    const s = spots(g);
    expect(g.build('lyra', ...s[0])).toBeNull();
    const h = g.build('eldrin', ...s[0])!;
    expect(h).not.toBeNull();
    expect(g.build('eldrin', ...s[1])).toBeNull();
    g.sell(h);
    expect(g.build('eldrin', ...s[1])).toBeNull();
    expect(newGame(null).build('eldrin', ...s[0])).toBeNull();
    const g2 = newGame('lyra');
    g2.gold = 1e5;
    const l = g2.build('lyra', ...s[0])!;
    expect(g2.upgradeCost(l)).toBeNull();
    expect(g2.upgrade(l)).toBe(false);
  });

  it('levels up with kills during the battle, growing and gaining powers', () => {
    const g = newGame('lyra');
    g.gold = 1e5;
    const l = g.build('lyra', ...spots(g)[0])!;
    const before = g.liveStats(l);
    let levels = 0;
    g.events.on('heroLevel', () => levels++);
    l.kills = HERO_LEVEL_KILLS[2];
    g.checkHeroLevel(l);
    expect(l.heroLevel).toBe(3);
    expect(levels).toBe(1);
    const after = g.liveStats(l);
    expect(after.damage).toBeGreaterThan(before.damage);
    expect(after.multishot).toBe(before.multishot + 1);
    expect(heroLevel(99999)).toBe(10);
  });

  it('a new battle starts the hero again from level 1; heroes give no permanent mastery', () => {
    const p = defaultProfile();
    applyRunResult(p, {
      mapId: 'meadow',
      difficulty: 'normal',
      wavesCleared: 3,
      totalWaves: 30,
      victory: false,
      towerXp: { lyra: 500, archer: 10 },
      kills: 10,
      bossesKilled: 0,
      starGain: 0,
      xpGain: 0,
    });
    expect(p.towers.archer.xp).toBeGreaterThan(0);
    const g = newGame('lyra');
    g.gold = 1e5;
    expect(g.build('lyra', ...spots(g)[0])!.heroLevel).toBe(1);
  });

  it('unlocks from the player records and survives a saved battle', () => {
    const p = defaultProfile();
    p.hero = 'lyra';
    expect(heroProgress(p, 'lyra').done).toBe(false);
    expect(activeHero(p)).toBeNull();
    p.stats.wins = 1;
    expect(activeHero(p)).toBe('lyra');
    expect(heroProgress(p, 'eldrin').progress).toBe('0/2000');

    const g = newGame('lyra');
    g.gold = 1e5;
    const l = g.build('lyra', ...spots(g)[0])!;
    l.kills = 50;
    g.checkHeroLevel(l);
    const save = captureRun(g, { biome: 'meadow', seed: 9, difficulty: 'normal', endless: false, continued: null });
    const g2 = newGame(save.hero ?? null);
    restoreRun(g2, JSON.parse(JSON.stringify(save)));
    const back = g2.towers.find((t) => t.def.id === 'lyra')!;
    expect(back.heroLevel).toBe(l.heroLevel);
    expect(g2.heroUsed).toBe(true);
  });
});

describe('Midas', () => {
  it('unlocks with every tower mastered; marked enemies drop more gold and level him up', async () => {
    const { MASTERY_TOWERS } = await import('../src/data/mastery');
    const p = defaultProfile();
    expect(heroProgress(p, 'midas').done).toBe(false);
    for (const id of MASTERY_TOWERS) p.missions[`m-${id}-4`] = { done: true };
    expect(heroProgress(p, 'midas').done).toBe(true);

    const g = newGame('midas');
    g.gold = 1e5;
    const s = spots(g);
    const midas = g.build('midas', ...s[0])!;
    expect(g.liveStats(midas).damage).toBeLessThan(5);
    const plain = g.spawnEnemy('goblin', 5, 3);
    const marked = g.spawnEnemy('goblin', 5, 3);
    g.applyHit(marked, { tower: midas, stats: g.liveStats(midas), damage: 1, type: 'holy' });
    expect(marked.goldMark).toBeGreaterThan(0);
    let a = g.gold;
    g.killEnemy(plain, null);
    const plainGold = g.gold - a;
    a = g.gold;
    g.killEnemy(marked, null);
    expect(g.gold - a).toBeGreaterThan(plainGold);
    expect(midas.kills).toBe(1);
  });
});
