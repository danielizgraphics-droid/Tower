import { TOWER_LIST } from '../src/data/towers';
import { ModifierSet, effectiveAttack } from '../src/game/modifiers';
import { estimateDps, targetFactor } from '../src/ui/format';
const eff = (s: Parameters<typeof estimateDps>[0], k: Parameters<typeof estimateDps>[1]) => estimateDps(s, k) * targetFactor(s, k);

const mods = new ModifierSet();
const rows: string[] = [];
for (const t of TOWER_LIST) {
  let spent = t.cost;
  const line: string[] = [];
  for (const tier of [1, 2, 3]) {
    if (tier > 1) spent += t.tiers[tier - 2].cost;
    const s = mods.towerStats(t.id, { tier, branch: -1 });
    line.push(`T${tier} ${eff(s, t.attack).toFixed(0)} ${((eff(s, t.attack) / spent) * 100).toFixed(1)}`);
  }
  for (let b = 0; b < 3; b++) {
    let sp = spent;
    for (const tier of [4, 5]) {
      sp += t.branches[b].steps[tier - 4].cost;
      const s = mods.towerStats(t.id, { tier, branch: b });
      const k = effectiveAttack(t, b);
      line.push(`${t.branches[b].id.slice(0, 6)}${tier} ${eff(s, k).toFixed(0)} ${((eff(s, k) / sp) * 100).toFixed(1)}`);
    }
  }
  rows.push(`${t.id.padEnd(10)} ${line.join(' | ')}`);
}
console.log(rows.join('\n'));
