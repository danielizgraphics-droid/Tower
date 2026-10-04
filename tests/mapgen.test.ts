import { describe, expect, it } from 'vitest';
import { Board } from '../src/game/board';
import { BIOMES } from '../src/data/biomes';
import { generateMap } from '../src/game/mapgen';

describe('procedural maps', () => {
  it('always produce a valid single path with room to build', () => {
    for (const biome of BIOMES)
      for (let seed = 1; seed <= 60; seed++) {
        const def = generateMap({ biome: biome.id, seed: seed * 7919 });
        const b = new Board(def);
        expect(b.length, `${def.id} length`).toBeGreaterThan(30);
        let buildable = 0;
        for (let y = 0; y < b.height; y++)
          for (let x = 0; x < b.width; x++)
            if (
              b.isBuildable(x, y) &&
              [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ].some(([dx, dy]) => b.isWalkable(x + dx, y + dy))
            )
              buildable++;
        expect(buildable, `${def.id} buildable`).toBeGreaterThan(25);
      }
  });

  it('is deterministic per seed and varies between seeds', () => {
    const a = generateMap({ biome: 'meadow', seed: 42 });
    expect(generateMap({ biome: 'meadow', seed: 42 })).toEqual(a);
    expect(generateMap({ biome: 'meadow', seed: 43 }).tiles).not.toEqual(a.tiles);
  });
});
