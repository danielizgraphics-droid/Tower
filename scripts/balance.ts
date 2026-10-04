import { MAPS } from '../src/data/maps';
import { AutoPlayer, ALL_TOWERS, simulate } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { ModifierSet } from '../src/game/modifiers';
import type { Difficulty, TowerId } from '../src/data/types';

const args = process.argv.slice(2);
const mapId = args[0] ?? 'meadow';
const diff = (args[1] ?? 'normal') as Difficulty;
const pools: Record<string, TowerId[]> = {
  starter: ['archer', 'cannon', 'arcane', 'frost'],
  all: ALL_TOWERS,
};
for (const poolName of Object.keys(pools)) {
  for (const seed of [1, 2, 3]) {
    const map = MAPS.find((m) => m.id === mapId)!;
    const g = new Game({ map, difficulty: diff, mods: new ModifierSet(), unlockedTowers: pools[poolName], seed });
    const p = new AutoPlayer(g, pools[poolName], seed);
    const t0 = Date.now();
    simulate(g, p);
    console.log(`${mapId} ${diff} ${poolName} seed${seed}: ${g.phase} wave ${g.wavesCleared}/${g.totalWaves} lives ${g.lives}/${g.maxLives} towers ${g.towers.length} gold ${Math.round(g.gold)} kills ${g.kills} (${Date.now() - t0}ms)`);
  }
}
