import type { AttackKind, TowerStats } from '../data/types';

/** Rough damage per second against a single target (shown in the UI). */
export function estimateDps(s: TowerStats, kind: AttackKind): number {
  const shots = 1 + Math.round(s.multishot);
  const crit = 1 + s.critChance * (s.critMult - 1);
  let hit = s.damage * crit;
  if (kind === 'beam') hit *= 1 + s.beamRampMax * 0.6;
  if (kind === 'orb') hit *= 0.5 * 2; // half damage, ~2 touches per target
  let dps = hit * s.rate * (kind === 'chain' || kind === 'pulse' || kind === 'cone' ? 1 : Math.min(shots, 1));
  if (s.burnDps > 0) dps += s.burnDps * Math.min(1, s.burnDuration * s.rate);
  if (s.poisonDps > 0) dps += s.poisonDps * Math.min(Math.max(1, Math.round(s.poisonStacks)), Math.max(1, s.rate * (s.poisonDuration || 3)));
  return dps;
}

/** Average number of enemies an attack touches in a typical group (balance tool). */
export function targetFactor(s: TowerStats, kind: AttackKind): number {
  switch (kind) {
    case 'chain':
      return 1 + Math.min(s.chains, 6) * 0.75 * s.chainFalloff;
    case 'cone':
      return 2.4 + s.coneAngle / 30;
    case 'pulse':
      return 2 + s.range;
    case 'orb':
      return 1 + s.splash * 2;
    case 'bolt':
      return 1 + Math.min(s.pierce, 6) * 0.45;
    case 'beam':
      return 1;
    default: {
      const multi = 1 + Math.round(s.multishot) * 0.85;
      const area = s.splash > 0 ? 1 + s.splash * 1.6 + s.bomblets * 0.35 : 1;
      const pierce = 1 + Math.min(s.pierce, 6) * 0.4;
      return multi * area * pierce;
    }
  }
}
