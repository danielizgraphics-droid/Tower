import { describe, expect, it } from 'vitest';
import { BIOMES } from '../src/data/biomes';
import { ENEMIES, ENEMY_LIST } from '../src/data/enemies';
import { TOWERS } from '../src/data/towers';
import { ALL_TOWERS } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { generateMap } from '../src/game/mapgen';
import { ModifierSet } from '../src/game/modifiers';
import { bossFor, generateWave } from '../src/game/waves';

const gameOn = (biome: (typeof BIOMES)[number]['id'], seed = 11) =>
  new Game({ map: generateMap({ biome, seed }), difficulty: 'normal', mods: new ModifierSet(), unlockedTowers: ALL_TOWERS, seed: 1 });

describe('naval towers', () => {
  it('build only on water, land towers never on water', () => {
    const g = gameOn('coast');
    g.gold = 1e6;
    const b = g.board;
    let water: { x: number; y: number } | null = null;
    let grass: { x: number; y: number } | null = null;
    for (let y = 0; y < b.height; y++)
      for (let x = 0; x < b.width; x++) {
        if (!water && b.isWater(x, y)) water = { x, y };
        if (!grass && b.isBuildable(x, y)) grass = { x, y };
      }
    expect(water && grass).toBeTruthy();
    expect(g.build('harbor', grass!.x, grass!.y)).toBeNull();
    expect(g.build('archer', water!.x, water!.y)).toBeNull();
    expect(g.build('tide', water!.x, water!.y)).not.toBeNull();
    expect(g.canBuildAt(water!.x, water!.y, 'harbor')).toBe(false);
  });

  it('every water biome offers water next to the road', () => {
    for (const biome of BIOMES.filter((b) => b.water > 0))
      for (let seed = 1; seed <= 20; seed++) {
        const g = gameOn(biome.id, seed * 31);
        const b = g.board;
        let near = 0;
        for (let y = 0; y < b.height; y++)
          for (let x = 0; x < b.width; x++)
            if (b.isWater(x, y) && [-2, -1, 0, 1, 2].some((dy) => [-2, -1, 0, 1, 2].some((dx) => b.isWalkable(x + dx, y + dy)))) near++;
        expect(near, `${biome.id} #${seed}`).toBeGreaterThan(0);
      }
  });

  it('volcanic maps have lava but no water', () => {
    const g = gameOn('volcano');
    expect(g.hasWater).toBe(false);
    expect(g.board.tiles.flat().some((t) => t.kind === 'lava')).toBe(true);
    expect(TOWERS.harbor.placement).toBe('water');
  });
});

describe('enemy mechanics', () => {
  const spawn = (g: Game, id: keyof typeof ENEMIES, dist = 3) => {
    const e = g.spawnEnemy(id, 1, dist);
    g.step(1 / 60);
    return e;
  };

  it('mummies rise once before dying for good', () => {
    const g = gameOn('desert');
    const e = spawn(g, 'mummy');
    g.damageEnemy(e, 1e6, 'physical', null, null);
    expect(e.alive).toBe(true);
    expect(e.hp).toBeCloseTo(e.maxHp * 0.5, 0);
    g.damageEnemy(e, 1e6, 'physical', null, null);
    expect(e.alive).toBe(false);
  });

  it('berserkers speed up when wounded', () => {
    const g = gameOn('meadow');
    const e = spawn(g, 'orc');
    const calm = e.currentSpeed;
    e.hp = e.maxHp * 0.3;
    expect(e.currentSpeed).toBeCloseTo(calm * 1.75, 5);
  });

  it('imps blink forward along the path', () => {
    const g = gameOn('volcano');
    const e = spawn(g, 'imp');
    const start = e.dist;
    for (let i = 0; i < 60 * 3.5; i++) g.step(1 / 60);
    // 3.5 s of flight plus at least one 1.6-tile blink.
    expect(e.dist - start).toBeGreaterThan(ENEMIES.imp.speed * 3 + 1.5);
  });

  it('witches shield their neighbours', () => {
    const g = gameOn('swamp');
    const w = spawn(g, 'witch', 4);
    const ally = spawn(g, 'goblin', 4.3);
    expect(ally.shield).toBe(0);
    for (let i = 0; i < 60 * 4.2; i++) g.step(1 / 60);
    expect(w.alive).toBe(true);
    expect(ally.shield).toBeGreaterThan(0);
  });
});

describe('regional content', () => {
  it('regional enemies only appear in their biomes', () => {
    for (const biome of BIOMES) {
      const map = generateMap({ biome: biome.id, seed: 5 });
      for (let w = 1; w <= 30; w++)
        for (const gr of generateWave(map, w).groups) {
          const def = ENEMIES[gr.enemy];
          if (def.biomes && !def.boss) expect(def.biomes, `${gr.enemy} in ${biome.id}`).toContain(biome.id);
        }
    }
  });

  it('regional bosses replace the wave-20 boss', () => {
    expect(bossFor(20, 'swamp')).toBe('hydra');
    expect(bossFor(20, 'volcano')).toBe('colossus');
    expect(bossFor(20, 'desert')).toBe('scorpionKing');
    expect(bossFor(20, 'meadow')).toBe('lich');
    expect(bossFor(10, 'swamp')).toBe('warlord');
  });

  it('every enemy and biome is wired up', () => {
    expect(ENEMY_LIST.length).toBeGreaterThanOrEqual(30);
    expect(BIOMES).toHaveLength(8);
    for (const b of BIOMES) if (b.requires) expect(BIOMES.some((o) => o.id === b.requires)).toBe(true);
    for (const b of BIOMES) if (b.boss) expect(ENEMIES[b.boss].boss).toBe(true);
  });
});
