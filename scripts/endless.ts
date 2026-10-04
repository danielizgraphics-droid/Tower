import { AutoPlayer, ALL_TOWERS, simulate } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { generateMap } from '../src/game/mapgen';
import { buyNode, defaultProfile, profileModifiers } from '../src/meta/profile';
import { GENERAL_TREE, TOWER_TREES } from '../src/meta/talentTrees';

const p = defaultProfile();
p.stars = 9999;
for (const t of ALL_TOWERS) {
  p.towers[t].unlocked = true;
  p.towers[t].xp = 1e6;
}
for (let i = 0; i < 8; i++) {
  for (const n of GENERAL_TREE.nodes) buyNode(p, GENERAL_TREE, n.id);
  for (const t of ALL_TOWERS) for (const n of TOWER_TREES[t].nodes) buyNode(p, TOWER_TREES[t], n.id);
}
for (const seed of [1, 2]) {
  const g = new Game({
    map: generateMap({ biome: 'meadow', seed: seed * 31, waves: Infinity }),
    difficulty: 'easy',
    mods: profileModifiers(p),
    unlockedTowers: ['archer', 'cannon', 'arcane', 'frost', 'storm', 'pyre'],
    seed,
  });
  const t0 = Date.now();
  simulate(g, new AutoPlayer(g, ['archer', 'cannon', 'arcane', 'frost', 'storm', 'pyre'], seed), 7200);
  console.log(`endless seed${seed}: ${g.phase} wave ${g.wavesCleared} towers ${g.towers.length} (${Date.now() - t0}ms)`);
}
