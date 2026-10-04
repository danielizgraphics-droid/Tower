import { MAPS } from '../src/data/maps';
import { AutoPlayer, ALL_TOWERS, simulate } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { ModifierSet } from '../src/game/modifiers';
import type { Difficulty } from '../src/data/types';

const [mapId = 'meadow', diff = 'normal', seed = '2'] = process.argv.slice(2);
const map = MAPS.find((m) => m.id === mapId)!;
const g = new Game({ map, difficulty: diff as Difficulty, mods: new ModifierSet(), unlockedTowers: ALL_TOWERS, seed: +seed });
const p = new AutoPlayer(g, ALL_TOWERS, +seed);
let livesBefore = g.lives;
g.events.on('waveCleared', ({ wave }) => {
  console.log(
    `w${wave} lost ${livesBefore - g.lives} lives=${g.lives} gold=${Math.round(g.gold)} towers=${g.towers.map((t) => t.def.id[0] + t.tier + (t.branch >= 0 ? t.branch : '')).join(',')}`,
  );
  livesBefore = g.lives;
});
g.events.on('leak', ({ enemy }) => {
  if (enemy.def.boss || g.lives <= 0) console.log(`  leak ${enemy.def.id} at wave ${g.wave}`);
});
simulate(g, p);
console.log(g.phase, 'wave', g.wave);
