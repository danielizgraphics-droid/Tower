import type { AttackKind, StatKey, TowerStats } from '../data/types';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const num = (v: number, d = 1) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(d));

interface StatSpec {
  key: StatKey | 'dps';
  label: string;
  fmt: (s: TowerStats) => string;
  show: (s: TowerStats, kind: AttackKind) => boolean;
  value: (s: TowerStats) => number;
}

/** Rough damage per second for comparisons in the UI. */
export function estimateDps(s: TowerStats, kind: AttackKind): number {
  const shots = 1 + Math.round(s.multishot);
  const crit = 1 + s.critChance * (s.critMult - 1);
  let base = s.damage * s.rate * shots * crit;
  if (kind === 'beam') base *= 1 + s.beamRampMax * 0.5;
  base += s.burnDps * Math.min(1, s.burnDuration * s.rate) + s.poisonDps * Math.max(1, Math.round(s.poisonStacks)) * 0.8;
  return base;
}

const SPECS: StatSpec[] = [
  { key: 'damage', label: 'Daño', fmt: (s) => num(s.damage), show: (s) => s.damage > 0, value: (s) => s.damage },
  { key: 'rate', label: 'Cadencia', fmt: (s) => `${s.rate.toFixed(2)}/s`, show: (s, k) => s.rate > 0 && k !== 'aura', value: (s) => s.rate },
  { key: 'range', label: 'Alcance', fmt: (s) => num(s.range, 1), show: () => true, value: (s) => s.range },
  { key: 'splash', label: 'Área', fmt: (s) => num(s.splash, 1), show: (s) => s.splash > 0, value: (s) => s.splash },
  { key: 'pierce', label: 'Perforación', fmt: (s) => `+${Math.round(s.pierce)}`, show: (s) => s.pierce > 0, value: (s) => s.pierce },
  { key: 'multishot', label: 'Proyectiles', fmt: (s) => `${1 + Math.round(s.multishot)}`, show: (s) => s.multishot > 0, value: (s) => s.multishot },
  { key: 'chains', label: 'Saltos', fmt: (s) => `${Math.round(s.chains)}`, show: (_s, k) => k === 'chain', value: (s) => s.chains },
  { key: 'critChance', label: 'Crítico', fmt: (s) => `${pct(s.critChance)} ×${num(s.critMult)}`, show: (s) => s.critChance > 0, value: (s) => s.critChance },
  { key: 'slow', label: 'Ralentiza', fmt: (s) => `${pct(s.slow)} ${num(s.slowDuration)}s`, show: (s) => s.slow > 0, value: (s) => s.slow },
  { key: 'burnDps', label: 'Quemadura', fmt: (s) => `${num(s.burnDps)}/s`, show: (s) => s.burnDps > 0, value: (s) => s.burnDps },
  { key: 'poisonDps', label: 'Veneno', fmt: (s) => `${num(s.poisonDps)}/s ×${Math.round(s.poisonStacks)}`, show: (s) => s.poisonDps > 0, value: (s) => s.poisonDps },
  { key: 'stunChance', label: 'Aturdir', fmt: (s) => pct(s.stunChance), show: (s) => s.stunChance > 0, value: (s) => s.stunChance },
  { key: 'freezeChance', label: 'Congelar', fmt: (s) => pct(s.freezeChance), show: (s) => s.freezeChance > 0, value: (s) => s.freezeChance },
  { key: 'vulnerability', label: 'Vulnerable', fmt: (s) => `+${pct(s.vulnerability)}`, show: (s) => s.vulnerability > 0, value: (s) => s.vulnerability },
  { key: 'bonusVsSlowed', label: 'vs Lentos', fmt: (s) => `+${pct(s.bonusVsSlowed)}`, show: (s) => s.bonusVsSlowed > 0, value: (s) => s.bonusVsSlowed },
  { key: 'armorShred', label: 'Corrosión', fmt: (s) => num(s.armorShred), show: (s) => s.armorShred > 0, value: (s) => s.armorShred },
  { key: 'knockback', label: 'Empuje', fmt: (s) => num(s.knockback, 1), show: (s) => s.knockback > 0, value: (s) => s.knockback },
  { key: 'execute', label: 'Ejecuta', fmt: (s) => `<${pct(s.execute)}`, show: (s) => s.execute > 0, value: (s) => s.execute },
  { key: 'beamRampMax', label: 'Rampa', fmt: (s) => `×${num(1 + s.beamRampMax)}`, show: (_s, k) => k === 'beam', value: (s) => s.beamRampMax },
  { key: 'bomblets', label: 'Bombas', fmt: (s) => `${Math.round(s.bomblets)}`, show: (s) => s.bomblets > 0, value: (s) => s.bomblets },
  { key: 'spreadOnDeath', label: 'Contagio', fmt: (s) => num(s.spreadOnDeath, 1), show: (s) => s.spreadOnDeath > 0, value: (s) => s.spreadOnDeath },
  { key: 'pull', label: 'Arrastre', fmt: (s) => num(s.pull, 1), show: (s) => s.pull > 0, value: (s) => s.pull },
  { key: 'auraDamage', label: 'Aura daño', fmt: (s) => `+${pct(s.auraDamage)}`, show: (s) => s.auraDamage > 0, value: (s) => s.auraDamage },
  { key: 'auraRate', label: 'Aura cadencia', fmt: (s) => `+${pct(s.auraRate)}`, show: (s) => s.auraRate > 0, value: (s) => s.auraRate },
  { key: 'auraRange', label: 'Aura alcance', fmt: (s) => `+${pct(s.auraRange)}`, show: (s) => s.auraRange > 0, value: (s) => s.auraRange },
  { key: 'auraCrit', label: 'Aura crítico', fmt: (s) => `+${pct(s.auraCrit)}`, show: (s) => s.auraCrit > 0, value: (s) => s.auraCrit },
  { key: 'goldChance', label: 'Oro', fmt: (s) => `${pct(s.goldChance)} +${Math.round(s.goldAmount)}`, show: (s) => s.goldChance > 0, value: (s) => s.goldChance },
  { key: 'waveGold', label: 'Oro/oleada', fmt: (s) => `+${Math.round(s.waveGold)}`, show: (s) => s.waveGold > 0, value: (s) => s.waveGold },
  { key: 'soulStacks', label: 'Almas', fmt: (s) => `+${num(s.soulStacks)}/baja`, show: (s) => s.soulStacks > 0, value: (s) => s.soulStacks },
  { key: 'bossDamage', label: 'vs Jefes', fmt: (s) => `+${pct(s.bossDamage)}`, show: (s) => s.bossDamage > 0, value: (s) => s.bossDamage },
  { key: 'airDamage', label: 'vs Voladores', fmt: (s) => `+${pct(s.airDamage)}`, show: (s) => s.airDamage > 0, value: (s) => s.airDamage },
  { key: 'shieldDamage', label: 'vs Escudos', fmt: (s) => `+${pct(s.shieldDamage)}`, show: (s) => s.shieldDamage > 0, value: (s) => s.shieldDamage },
  { key: 'armorDamage', label: 'vs Armadura', fmt: (s) => `+${pct(s.armorDamage)}`, show: (s) => s.armorDamage > 0, value: (s) => s.armorDamage },
];

export interface StatLine {
  label: string;
  value: string;
  /** Improvement indicator compared with `next` (if provided). */
  delta?: string;
}

export function statLines(s: TowerStats, kind: AttackKind, next?: TowerStats, nextKind?: AttackKind): StatLine[] {
  const out: StatLine[] = [];
  const dps = estimateDps(s, kind);
  if (kind !== 'aura') {
    const line: StatLine = { label: 'DPS aprox.', value: num(dps) };
    if (next) {
      const nd = estimateDps(next, nextKind ?? kind);
      if (nd > dps + 0.5) line.delta = `+${num(nd - dps)}`;
    }
    out.push(line);
  }
  for (const spec of SPECS) {
    const showNow = spec.show(s, kind);
    const showNext = next ? spec.show(next, nextKind ?? kind) : false;
    if (!showNow && !showNext) continue;
    const line: StatLine = { label: spec.label, value: showNow ? spec.fmt(s) : '—' };
    if (next && showNext) {
      const a = spec.value(s);
      const b = spec.value(next);
      if (Math.abs(b - a) > 1e-3) line.delta = showNow ? '↑' : 'nuevo';
      if (b < a && spec.key !== 'rate') line.delta = undefined;
    }
    out.push(line);
  }
  return out;
}

export const TARGET_LABELS = { first: 'Primero', last: 'Último', strong: 'Fuerte', close: 'Cercano' } as const;

export const ATTACK_LABELS: Record<AttackKind, string> = {
  projectile: 'Proyectil',
  lob: 'Parabólico',
  bolt: 'Perforante',
  chain: 'Cadena',
  beam: 'Rayo continuo',
  cone: 'Cono',
  pulse: 'Pulso en área',
  strike: 'Impacto celeste',
  orb: 'Orbe',
  rift: 'Grieta',
  aura: 'Aura',
};
