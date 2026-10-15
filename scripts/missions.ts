// Balance check for missions: the heuristic player tries each one on several
// game seeds. Usage: npx vite-node scripts/missions.ts [missionId|all] [runs] [free|rules] [talent level]
import { MISSIONS } from '../src/data/missions';
import { ALL_TOWERS, AutoPlayer } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { generateMap } from '../src/game/mapgen';
import { ModifierSet } from '../src/game/modifiers';
import { TOWER_LIST } from '../src/data/towers';
import { buyNode, defaultProfile, profileModifiers } from '../src/meta/profile';
import { GENERAL_TREE, MAX_TOWER_LEVEL, TOWER_LEVEL_XP, TOWER_TREES } from '../src/meta/talentTrees';

const [only, runsArg, free, level] = process.argv.slice(2);

/** A player with talents: every general talent and tower talents at a given mastery level. */
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
const mods = () => (level ? veteran(Number(level)) : new ModifierSet());
/** 'free': same maps without the mission's rules (baseline). */
const baseline = free === 'free';
const runs = Number(runsArg ?? 4);
for (const m of MISSIONS) {
  if (only && only !== 'all' && !only.split(',').includes(m.id)) continue;
  let wins = 0;
  const waves: number[] = [];
  const lives: number[] = [];
  for (let r = 0; r < runs; r++) {
    const g = new Game({
      map: generateMap({ biome: m.biome, seed: m.seed, waves: m.waves, water: m.water }),
      difficulty: m.difficulty,
      mods: mods(),
      unlockedTowers: baseline ? ALL_TOWERS : m.towers,
      rules: baseline ? {} : m.rules,
      seed: 100 + r,
    });
    const bot = new AutoPlayer(g, baseline ? ALL_TOWERS : m.towers, 7 + r);
    let guard = 0;
    while (g.phase !== 'victory' && g.phase !== 'defeat' && guard++ < 60 * 60 * 60) {
      if (g.phase === 'augment') g.pickAugment(g.augmentOffer[0].id);
      bot.update(1 / 60);
      if (g.phase === 'build') g.startNextWave();
      g.step(1 / 60);
    }
    if (g.phase === 'victory') wins++;
    waves.push(g.wavesCleared);
    lives.push(g.lives);
  }
  console.log(`${m.id.padEnd(10)} wins ${wins}/${runs}  waves ${waves.join(',')}  lives ${lives.join(',')}`);
}
