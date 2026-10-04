import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { Board } from '../src/game/board';

describe('maps', () => {
  for (const def of MAPS) {
    it(`${def.id} parses with a single valid path`, () => {
      const b = new Board(def);
      expect(b.path.length).toBeGreaterThan(3);
      expect(b.length).toBeGreaterThan(20);
      // Every row has the same width.
      for (const row of def.tiles) expect(row.length).toBe(b.width);
      // Enough buildable tiles next to the path.
      let buildableNearPath = 0;
      for (let y = 0; y < b.height; y++)
        for (let x = 0; x < b.width; x++)
          if (b.isBuildable(x, y) && [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => b.isWalkable(x + dx, y + dy))) buildableNearPath++;
      expect(buildableNearPath).toBeGreaterThan(30);
    });
  }

  it('pointAt walks the polyline', () => {
    const b = new Board(MAPS[0]);
    const end = b.pointAt(b.length);
    expect(end.x).toBeCloseTo(b.castle.x + 0.5);
    expect(end.y).toBeCloseTo(b.castle.y + 0.5);
  });
});
