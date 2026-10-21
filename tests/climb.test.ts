import { describe, expect, it } from 'vitest';
import { Board } from '../src/game/board';
import { Game } from '../src/game/game';
import { generateWave } from '../src/game/waves';
import { ModifierSet } from '../src/game/modifiers';
import {
  CLIMB_LIVES,
  clearFloor,
  climbStars,
  floorGold,
  floorMap,
  floorOffset,
  FLOOR_HEAL,
  FLOOR_WAVES,
  isBossFloor,
  newClimb,
  rollRewards,
  takeReward,
} from '../src/meta/climb';
import { defaultProfile } from '../src/meta/profile';
import { leaderboard } from '../src/meta/leaderboard';

const veteran = () => {
  const p = defaultProfile();
  for (const id of ['cannon', 'arcane', 'frost', 'pyre', 'storm'] as const) p.towers[id].unlocked = true;
  return p;
};

describe('torre infinita', () => {
  it('starts with archers and two more of the player’s towers', () => {
    const run = newClimb(veteran(), 42);
    expect(run.towers).toHaveLength(3);
    expect(run.towers[0]).toBe('archer');
    expect(run.lives).toBe(CLIMB_LIVES);
  });

  it('every floor is a playable short map, the same each time it is generated', () => {
    const run = newClimb(veteran(), 7);
    for (let f = 1; f <= 20; f++) {
      run.floor = f;
      const def = floorMap(run);
      expect(def.waves).toBe(FLOOR_WAVES);
      expect(() => new Board(def)).not.toThrow();
      expect(floorMap(run).tiles).toEqual(def.tiles);
    }
  });

  it('later floors fight later waves and start with more gold', () => {
    const run = newClimb(veteran(), 7);
    run.floor = 6;
    const g = new Game({ map: floorMap(run), difficulty: 'normal', mods: new ModifierSet(), unlockedTowers: ['archer'], waveOffset: floorOffset(6) });
    expect(g.nextWaveDef()!.index).toBe(floorOffset(6) + 1);
    expect(g.nextWaveDef()).toEqual(generateWave(g.board.def, floorOffset(6) + 1));
    const early = { ...run, floor: 2 };
    expect(floorGold(run, 240)).toBeGreaterThan(floorGold(early, 240));
    expect([1, 2, 3, 4, 5].some(isBossFloor)).toBe(true);
  });

  it('a floor won heals a little and offers three different rewards', () => {
    const p = veteran();
    const run = newClimb(p, 3);
    clearFloor(run, p, 10, 25);
    expect(run.floor).toBe(2);
    expect(run.lives).toBe(10 + FLOOR_HEAL);
    expect(run.kills).toBe(25);
    const offer = run.offer!;
    expect(offer).toHaveLength(3);
    expect(new Set(offer.map((o) => JSON.stringify(o))).size).toBe(3);
    expect(offer.some((o) => o.kind === 'blessing')).toBe(true);
    expect(rollRewards(run, p)).toEqual(offer);
  });

  it('rewards change the climb', () => {
    const run = newClimb(veteran(), 3);
    run.lives = 5;
    takeReward(run, { kind: 'heal', lives: 6 });
    takeReward(run, { kind: 'gold', gold: 60 });
    takeReward(run, { kind: 'tower', tower: 'frost' });
    takeReward(run, { kind: 'blessing', id: 'sharp' });
    expect(run.lives).toBe(11);
    expect(run.goldBonus).toBe(60);
    expect(run.towers).toContain('frost');
    expect(run.blessings).toContain('sharp');
    expect(run.offer).toBeNull();
  });

  it('stars grow with the floors cleared', () => {
    expect(climbStars(0)).toBe(0);
    expect(climbStars(10)).toBeGreaterThan(climbStars(5));
  });

  it('the online ranking is simply unavailable outside claude.ai', async () => {
    expect(await leaderboard.available()).toBe(false);
    expect(await leaderboard.top('floor')).toBeNull();
    await expect(leaderboard.submit(defaultProfile())).resolves.toBeUndefined();
  });
});
