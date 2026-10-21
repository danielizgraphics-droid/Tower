// Prints the expert maps: npx vite-node scripts/expertascii.ts [id]
import { EXPERT_MAPS, expertMap } from '../src/data/expert';
import { Board } from '../src/game/board';

for (const x of EXPERT_MAPS) {
  if (process.argv[2] && process.argv[2] !== x.id) continue;
  const def = expertMap(x, 30);
  const b = new Board(def);
  console.log(
    `\n${x.id}: spawns ${b.spawns.length}/${x.spawns} routes ${b.routes.length} lengths ${b.routes.map((r) => r.length.toFixed(0)).join(' ')}`,
  );
  console.log(def.tiles.join('\n'));
}
