import { describe, expect, it } from 'vitest';
import {
  applyRunResult,
  buyNode,
  defaultProfile,
  isMapUnlocked,
  loadProfile,
  migrateProfile,
  nodeState,
  profileModifiers,
  resetTree,
  saveProfile,
  towerPointsAvailable,
  unlockTower,
} from '../src/meta/profile';
import { GENERAL_TREE, TOWER_TREES, towerLevelFromXp } from '../src/meta/talentTrees';

describe('profile & talents', () => {
  it('starts with 5 unlocked towers (incl. the naval fort) and no stars', () => {
    const p = defaultProfile();
    expect(Object.values(p.towers).filter((t) => t.unlocked)).toHaveLength(5);
    expect(p.stars).toBe(0);
  });

  it('buys general talents with stars respecting prerequisites', () => {
    const p = defaultProfile();
    p.stars = 10;
    expect(
      nodeState(
        p,
        GENERAL_TREE,
        GENERAL_TREE.nodes.find((n) => n.id === 'plunder')!,
      ),
    ).toBe('locked');
    expect(buyNode(p, GENERAL_TREE, 'plunder')).toBe(false);
    expect(buyNode(p, GENERAL_TREE, 'treasury')).toBe(true);
    expect(p.stars).toBe(8);
    expect(buyNode(p, GENERAL_TREE, 'plunder')).toBe(true);
    expect(profileModifiers(p).global().startGold).toBe(280);
    resetTree(p, GENERAL_TREE);
    expect(p.stars).toBe(10);
    expect(p.general).toEqual({});
  });

  it('tower talent points come from tower XP levels', () => {
    const p = defaultProfile();
    expect(towerPointsAvailable(p, 'archer')).toBe(0);
    p.towers.archer.xp = 100;
    expect(towerLevelFromXp(100)).toBe(2);
    expect(towerPointsAvailable(p, 'archer')).toBe(2);
    expect(buyNode(p, TOWER_TREES.archer, 'archer.training')).toBe(true);
    expect(towerPointsAvailable(p, 'archer')).toBe(1);
  });

  it('capstone needs any branch node', () => {
    const tree = TOWER_TREES.cannon;
    const p = defaultProfile();
    p.towers.cannon.xp = 99999;
    for (const id of ['cannon.training', 'cannon.rate', 'cannon.branch1']) expect(buyNode(p, tree, id)).toBe(true);
    expect(buyNode(p, tree, 'cannon.capstone')).toBe(true);
  });

  it('unlocks towers with stars', () => {
    const p = defaultProfile();
    expect(unlockTower(p, 'ballista')).toBe(false);
    p.stars = 4;
    expect(unlockTower(p, 'ballista')).toBe(true);
    expect(p.towers.ballista.unlocked).toBe(true);
  });

  it('rewards runs and unlocks the next map after a victory', () => {
    const p = defaultProfile();
    expect(isMapUnlocked(p, 'meadow')).toBe(false);
    const r = applyRunResult(p, {
      mapId: 'meadow',
      difficulty: 'normal',
      wavesCleared: 30,
      totalWaves: 30,
      victory: true,
      towerXp: { archer: 150 },
      kills: 500,
      bossesKilled: 3,
      starGain: 0,
      xpGain: 0,
    });
    expect(r.firstClear).toBe(true);
    expect(r.stars).toBeGreaterThan(20);
    expect(isMapUnlocked(p, 'meadow')).toBe(true);
    expect(r.levelUps[0]).toMatchObject({ tower: 'archer', from: 0, to: 2 });
    const again = applyRunResult(p, {
      mapId: 'meadow',
      difficulty: 'normal',
      wavesCleared: 30,
      totalWaves: 30,
      victory: true,
      towerXp: {},
      kills: 0,
      bossesKilled: 0,
      starGain: 0,
      xpGain: 0,
    });
    expect(again.stars).toBeLessThan(r.stars);
  });

  it('migrates partial / corrupt saves safely', () => {
    expect(migrateProfile(null).version).toBeGreaterThan(0);
    const m = migrateProfile({ stars: 5, towers: { archer: { unlocked: true, xp: 50 } }, settings: { sfxVolume: 0.1 } });
    expect(m.stars).toBe(5);
    expect(m.towers.archer.xp).toBe(50);
    expect(m.towers.obelisk.unlocked).toBe(false);
    expect(m.settings.sfxVolume).toBe(0.1);
    expect(m.settings.musicVolume).toBeGreaterThan(0);
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    saveProfile(storage, m);
    expect(loadProfile(storage).stars).toBe(5);
    mem.set('bastion-arcano.save', '{not json');
    expect(loadProfile(storage).stars).toBe(0);
  });
});
