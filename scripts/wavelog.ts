import { MAPS } from '../src/data/maps';
import { AutoPlayer, ALL_TOWERS, simulate } from '../src/game/autoplay';
import { Game } from '../src/game/game';
import { ModifierSet } from '../src/game/modifiers';
import { generateWave, waveHpMultiplier } from '../src/game/waves';
import { ENEMIES } from '../src/data/enemies';

const map = MAPS.find((m) => m.id === (process.argv[2] ?? 'meadow'))!;
const g = new Game({ map, difficulty: 'normal', mods: new ModifierSet(), unlockedTowers: ALL_TOWERS, seed: 1 });
const p = new AutoPlayer(g, ALL_TOWERS, 1);
g.events.on('waveCleared', ({ wave }) => {
  const w = generateWave(map, wave);
  const pool = w.groups.reduce((a, gr) => { const d = ENEMIES[gr.enemy]; return a + gr.count * (d.hp + d.armor + d.shield); }, 0) * waveHpMultiplier(wave);
  console.log(`w${wave} lives ${g.lives} gold ${Math.round(g.gold)} towers ${g.towers.length} tiers ${g.towers.map(t=>t.tier).join('')} pool ${Math.round(pool)} groups ${w.groups.map(gr=>gr.enemy+'x'+gr.count).join(',')}`);
});
simulate(g, p);
console.log(g.phase, g.augments.map(a=>a.id).join(','));
const dmg = new Map<string, number>();
for (const t of g.towers) dmg.set(t.def.id + t.tier + (t.branch>=0?'b'+t.branch:''), Math.round(t.damageDealt));
console.log([...dmg.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+v).join(' '));
