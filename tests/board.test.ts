import { describe, expect, it } from 'vitest';
import { Board } from '../src/game/board';
import { generateMap } from '../src/game/mapgen';

describe('board', () => {
  it('pointAt walks the polyline from spawn to castle', () => {
    const b = new Board(generateMap({ biome: 'meadow', seed: 99 }));
    const end = b.pointAt(b.length);
    expect(end.x).toBeCloseTo(b.castle.x + 0.5);
    expect(end.y).toBeCloseTo(b.castle.y + 0.5);
    const mid = b.pointAt(b.length / 2);
    expect(b.isWalkable(Math.floor(mid.x), Math.floor(mid.y))).toBe(true);
  });

  it('rejects maps with forks', () => {
    const def = generateMap({ biome: 'meadow', seed: 5 });
    const tiles = def.tiles.map((r) => r.split(''));
    // Add a branch next to the second path tile.
    const b = new Board(def);
    const p = b.path[2];
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (['.', 'F', 'W', 'T', 'R', 'L'].includes(tiles[y + dy]?.[x + dx] ?? '#')) {
        tiles[y + dy][x + dx] = '#';
        break;
      }
    expect(() => new Board({ ...def, tiles: tiles.map((r) => r.join('')) })).toThrow();
  });
});
