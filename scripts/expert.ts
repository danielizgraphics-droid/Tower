// Balance check for expert maps: the heuristic player tries each one.
// Usage: npx vite-node scripts/expert.ts [id|all] [runs] [talent level]
import { EXPERT_MAPS, expertMap } from '../src/data/expert';
import { ALL_TOWERS, AutoPlayer } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { ModifierSet } from '../src/game/modifiers';
import { BIOME_BY_ID } from '../src/data/biomes';
import { TOWERS, TOWER_LIST } from '../src/data/towers';
import { buyNode, defaultProfile, profileModifiers } from '../src/meta/profile';
import { GENERAL_TREE, MAX_TOWER_LEVEL, TOWER_LEVEL_XP, TOWER_TREES } from '../src/meta/talentTrees';

const [only, runsArg, level] = process.argv.slice(2);

function veteran(lvl: number): ModifierSet {
  const p = defaultProfile();
  p.stars = 1e9;
  for (const t of TOWER_LIST) {
    p.towers[t.id].unlocked = true;
    p.towers[t.id].xp = TOWER_LEVEL_XP[Math.min(MAX_TOWER_LEVEL, lvl)];
  }
  const trees = [GENERAL_TREE, ...TOWER_LIST.map((t) => TOWER_TREES[t.id])];
  for (let pass = 0; pass < 8; pass++) for (const tree of trees) for (const n of tree.nodes) buyNode(p, tree, n.id);
  return profileModifiers(p);
}
const runs = Number(runsArg ?? 3);
for (const x of EXPERT_MAPS) {
  if (only && only !== 'all' && !only.split(',').includes(x.id)) continue;
  const towers = ALL_TOWERS.filter(
    (id) => !TOWERS[id].exclusive && (!BIOME_BY_ID[x.biome].sky || TOWERS[id].targetsAir) && (!x.allWater || TOWERS[id].placement === 'water'),
  );
  let wins = 0;
  const waves: number[] = [];
  for (let r = 0; r < runs; r++) {
    const g = new Game({
      map: process.env.SINGLE ? { ...expertMap({ ...x, spawns: 1, forks: 0 }, 30) } : expertMap(x, 30),
      difficulty: 'hard',
      mods: level ? veteran(Number(level)) : new ModifierSet(),
      unlockedTowers: towers,
      rules: x.rules,
      seed: 100 + r,
    });
    const bot = new AutoPlayer(g, towers, 7 + r);
    let guard = 0;
    while (g.phase !== 'victory' && g.phase !== 'defeat' && guard++ < 60 * 60 * 60) {
      if (g.phase === 'augment') g.pickAugment(g.augmentOffer[0].id);
      bot.update(1 / 60);
      if (g.phase === 'build') g.startNextWave();
      g.step(1 / 60);
    }
    if (g.phase === 'victory') wins++;
    waves.push(g.wavesCleared);
  }
  console.log(`${x.id.padEnd(14)} wins ${wins}/${runs}  waves ${waves.join(',')}`);
}
