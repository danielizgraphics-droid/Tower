import { generateMap } from '../src/game/mapgen';
const MAPS = (['meadow', 'coast', 'autumn', 'desert', 'swamp', 'snow', 'volcano', 'dusk', 'jungle', 'canyon', 'crystal'] as const).map((b) =>
  generateMap({ biome: b, seed: 777 }),
);
import { AutoPlayer, ALL_TOWERS, simulate } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { ModifierSet } from '../src/game/modifiers';
import type { Difficulty, TowerId } from '../src/data/types';
import { buyNode, defaultProfile, profileModifiers } from '../src/meta/profile';
import { GENERAL_TREE, TOWER_TREES } from '../src/meta/talentTrees';

const [mapArg = 'meadow', diffArg = 'normal', talentArg = 'none', seedsArg = '3'] = process.argv.slice(2);
const STARTER: TowerId[] = ['archer', 'cannon', 'arcane', 'frost', 'harbor'];

function modsFor(level: string, pool: TowerId[]): ModifierSet {
  if (level === 'none') return new ModifierSet();
  const p = defaultProfile();
  p.stars = level === 'full' ? 9999 : 60;
  for (const id of pool) {
    p.towers[id].unlocked = true;
    p.towers[id].xp = level === 'full' ? 99999 : 400;
  }
  // Buy greedily in tree order.
  for (let pass = 0; pass < 10; pass++) {
    for (const n of GENERAL_TREE.nodes) buyNode(p, GENERAL_TREE, n.id);
    for (const id of pool) for (const n of TOWER_TREES[id].nodes) buyNode(p, TOWER_TREES[id], n.id);
  }
  return profileModifiers(p);
}

const maps = mapArg === 'all' ? MAPS.map((m) => m.theme) : [mapArg];
for (const mapId of maps) {
  for (const [poolName, pool] of [
    ['starter', STARTER],
    ['all', ALL_TOWERS],
  ] as const) {
    const results: string[] = [];
    for (let seed = 1; seed <= Number(seedsArg); seed++) {
      const map = MAPS.find((m) => m.theme === mapId)!;
      const g = new Game({ map, difficulty: diffArg as Difficulty, mods: modsFor(talentArg, [...pool]), unlockedTowers: [...pool], seed });
      simulate(g, new AutoPlayer(g, [...pool], seed));
      results.push(`${g.phase === 'victory' ? 'WIN' : 'w' + g.wavesCleared}(${g.lives})`);
    }
    console.log(`${mapId.padEnd(7)} ${diffArg.padEnd(6)} talents:${talentArg.padEnd(4)} ${poolName.padEnd(7)} ${results.join(' ')}`);
  }
}
