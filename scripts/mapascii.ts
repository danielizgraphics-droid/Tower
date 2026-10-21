// Prints generated maps as text: npx vite-node scripts/mapascii.ts <biome> <seed> [spawns] [forks] [size] [islandMax] [allWater]
import { generateMap } from '../src/game/mapgen';
import { Board } from '../src/game/board';
import type { Biome } from '../src/data/types';

const [biome = 'meadow', seed = '1', spawns = '1', forks = '0', size = '17', islandMax = '5', allWater = '0'] = process.argv.slice(2);
const def = generateMap({
  biome: biome as Biome,
  seed: +seed,
  size: +size,
  lanes: { spawns: +spawns, forks: +forks },
  islandMax: +islandMax,
  allWater: allWater === '1',
});
console.log(def.tiles.join('\n'));
const b = new Board(def);
console.log(`spawns ${b.spawns.length} routes ${b.routes.length}`, b.routes.map((r) => r.length.toFixed(0)).join(' '));
