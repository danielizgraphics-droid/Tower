import { describe, expect, it } from 'vitest';
import { BIOME_BY_ID } from '../src/data/biomes';
import { MISSIONS, MISSION_BY_ID } from '../src/data/missions';
import { TOWERS } from '../src/data/towers';
import { Game } from '../src/game/game';
import { generateMap } from '../src/game/mapgen';
import { ModifierSet } from '../src/game/modifiers';
import { applyMissionResult, defaultProfile, isRegionOpen, migrateProfile, missionAvailable, unlockTower } from '../src/meta/profile';

describe('missions', () => {
  it('are well formed: known towers, regions and prerequisites, every exclusive item is a reward', () => {
    for (const m of MISSIONS) {
      expect(BIOME_BY_ID[m.biome]).toBeTruthy();
      for (const t of m.towers) expect(TOWERS[t]).toBeTruthy();
      for (const r of m.requires) expect(MISSION_BY_ID[r]).toBeTruthy();
    }
    for (const t of Object.values(TOWERS).filter((t) => t.exclusive)) expect(MISSIONS.some((m) => m.reward.tower === t.id)).toBe(true);
    for (const b of Object.values(BIOME_BY_ID).filter((b) => b.exclusive)) expect(MISSIONS.some((m) => m.reward.region === b.id)).toBe(true);
  });

  it('exclusive towers and regions start locked and cannot be bought with stars', () => {
    const p = defaultProfile();
    p.stars = 1e6;
    expect(p.towers.warden.unlocked).toBe(false);
    expect(unlockTower(p, 'warden')).toBe(false);
    expect(isRegionOpen(p, 'sakura')).toBe(false);
    expect(migrateProfile(JSON.parse(JSON.stringify(p))).towers.warden.unlocked).toBe(false);
  });

  it('pays the reward once, on the first victory', () => {
    const p = defaultProfile();
    const m = MISSION_BY_ID.nomagic;
    expect(missionAvailable(p, m)).toBe(false);
    p.missions.archers = { done: true };
    expect(missionAvailable(p, m)).toBe(true);
    const base = { towerXp: {}, kills: 10, bossesKilled: 0, xpGain: 0 };
    expect(applyMissionResult(p, m, { ...base, victory: false }).reward).toBeNull();
    expect(p.towers.sawmill.unlocked).toBe(false);
    const won = applyMissionResult(p, m, { ...base, victory: true });
    expect(won.firstTime).toBe(true);
    expect(p.towers.sawmill.unlocked).toBe(true);
    expect(applyMissionResult(p, m, { ...base, victory: true }).firstTime).toBe(false);
    const r = applyMissionResult(p, MISSION_BY_ID.flawless, { ...base, victory: true });
    expect(r.reward?.region).toBe('sakura');
    expect(isRegionOpen(p, 'sakura')).toBe(true);
  });

  it('rules are enforced by the game', () => {
    const g = new Game({
      map: generateMap({ biome: 'meadow', seed: 5, waves: 10 }),
      difficulty: 'normal',
      mods: new ModifierSet(),
      unlockedTowers: ['archer'],
      rules: { maxTowers: 2, maxTier: 2, noSpells: true, noLeaks: true, startGold: 1000 },
      seed: 1,
    });
    expect(g.gold).toBe(1000);
    expect(g.lives).toBe(1);
    expect(g.spellReady('meteor')).toBe(false);
    const spots: [number, number][] = [];
    for (let y = 0; y < g.board.height; y++) for (let x = 0; x < g.board.width; x++) if (g.canBuildAt(x, y)) spots.push([x, y]);
    expect(g.build('cannon', ...spots[0])).toBeNull();
    const a = g.build('archer', ...spots[0])!;
    expect(g.build('archer', ...spots[1])).not.toBeNull();
    expect(g.build('archer', ...spots[2])).toBeNull();
    expect(g.upgrade(a)).toBe(true);
    expect(g.upgrade(a)).toBe(false);
    expect(g.upgradeCost(a)).toBeNull();
  });

  it('ground-only missions never field flying enemies', () => {
    const g = new Game({
      map: generateMap({ biome: 'coast', seed: 2207, waves: 15, water: 6 }),
      difficulty: 'easy',
      mods: new ModifierSet(),
      unlockedTowers: ['harbor', 'tide'],
      rules: { groundOnly: true },
      seed: 1,
    });
    g.lives = 1e6;
    let flyers = 0;
    let guard = 0;
    while (g.phase !== 'victory' && guard++ < 60 * 3000) {
      if (g.phase === 'augment') g.pickAugment(g.augmentOffer[0].id);
      if (g.canStartWave()) g.startNextWave();
      g.step(1 / 60);
      flyers += g.enemies.filter((e) => e.alive && e.def.flying).length;
    }
    expect(g.phase).toBe('victory');
    expect(flyers).toBe(0);
  });
});
