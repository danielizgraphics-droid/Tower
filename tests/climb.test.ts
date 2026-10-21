import { describe, expect, it } from 'vitest';
import { Board } from '../src/game/board';
import { Game } from '../src/game/game';
import { generateWave } from '../src/game/waves';
import { ModifierSet } from '../src/game/modifiers';
import {
  checkAchievements,
  chooseDoor,
  CLIMB_HP,
  CLIMB_LIVES,
  clearFloor,
  floorRules,
  hasPerk,
  reachHeight,
  resolveRoom,
  rollDoors,
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
import { defaultProfile, heroProgress } from '../src/meta/profile';
import { ENEMIES } from '../src/data/enemies';
import { cleanNick, leaderboard } from '../src/meta/leaderboard';

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

describe('torre infinita: variety and incentives', () => {
  it('a door with a twist changes the battle and gives double loot', () => {
    const p = veteran();
    const run = newClimb(p, 11);
    chooseDoor(run, p, { kind: 'battle', mod: 'horde', loot: true });
    expect(run.stage).toBe('ready');
    const rules = floorRules(run);
    expect(rules.countMult).toBeGreaterThan(1);
    expect(rules.hpMult).toBeLessThan(CLIMB_HP);
    clearFloor(run, p, run.lives, 10);
    expect(run.picks).toBe(2);
    takeReward(run, run.offer![0]);
    expect(run.stage).toBe('reward');
    takeReward(run, run.offer![0]);
    expect(run.stage).toBe('doors');
    expect(run.doors).toHaveLength(2);
  });

  it('flyers-only floors ask for winged enemies', () => {
    const run = newClimb(veteran(), 12);
    run.next = { mod: 'flyers', loot: true };
    const def = floorMap(run);
    expect(def.flyers).toBe(true);
    for (let w = 1; w <= 8; w++) for (const g of generateWave(def, w).groups) expect(ENEMIES[g.enemy].flying, g.enemy).toBe(true);
  });

  it('rooms skip a battle and count as a floor', () => {
    const p = veteran();
    const run = newClimb(p, 13);
    run.floor = 4;
    run.lives = 12;
    chooseDoor(run, p, { kind: 'room', room: 'altar' });
    expect(run.stage).toBe('room');
    const pact = run.room!.choices.find((c) => c.cost > 0)!;
    resolveRoom(run, pact);
    expect(run.lives).toBe(12 - pact.cost);
    expect(run.floor).toBe(5);
    expect(run.stats.pacts).toBe(1);
    expect(run.stage).toBe('doors');
    // Never two rooms in a row.
    expect(run.doors!.every((d) => d.kind === 'battle')).toBe(true);
  });

  it('boss floors offer two battles', () => {
    const run = newClimb(veteran(), 14);
    run.floor = [1, 2, 3, 4, 5, 6].find(isBossFloor)!;
    expect(rollDoors(run).every((d) => d.kind === 'battle')).toBe(true);
  });

  it('heights unlock perks for good, once', () => {
    const p = veteran();
    const stars = p.stars;
    expect(reachHeight(p, 12).map((m) => m.floor)).toEqual([5, 10]);
    expect(p.stars).toBe(stars + 50 + 80);
    expect(reachHeight(p, 11)).toEqual([]);
    expect(hasPerk(p, 'purse')).toBe(true);
    expect(hasPerk(p, 'recruit')).toBe(false);
    const run = newClimb(p, 15);
    expect(run.goldBonus).toBe(80);
    expect(run.blessings).toHaveLength(1);
    reachHeight(p, 25);
    const strong = newClimb(p, 16);
    expect(strong.towers).toHaveLength(4);
    expect(strong.maxLives).toBe(CLIMB_LIVES + 5);
    expect(heroProgress(p, 'vigil').done).toBe(true);
  });

  it('feats earn achievements (and their stars) once', () => {
    const p = veteran();
    const run = newClimb(p, 17);
    for (let i = 0; i < 5; i++) {
      run.next = { mod: null, loot: false };
      clearFloor(run, p, run.lives, 5);
      takeReward(run, run.offer![0]);
    }
    const stars = p.stars;
    const got = checkAchievements(run, p).map((a) => a.id);
    expect(got).toContain('flawless');
    expect(p.stars).toBeGreaterThan(stars);
    expect(checkAchievements(run, p)).toEqual([]);
  });
});

describe('nicknames', () => {
  it('are cleaned up: printable, single-spaced, 16 characters at most', () => {
    expect(cleanNick('  Daniel   el  Grande ')).toBe('Daniel el Grande');
    expect(cleanNick('a\u0000b‮c')).toBe('abc');
    expect(cleanNick('x'.repeat(30))).toHaveLength(16);
  });
});
