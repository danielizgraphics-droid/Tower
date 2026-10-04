import { Board } from '../src/game/board';
import { generateMap } from '../src/game/mapgen';
const biome = (process.argv[2] ?? 'meadow') as 'meadow';
for (const s of [1, 2, 3]) {
  const m = generateMap({ biome, seed: s * 977 });
  console.log(m.name, 'path', new Board(m).length.toFixed(0));
  console.log(m.tiles.join('\n'));
}
