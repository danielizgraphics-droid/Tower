import { TOWERS } from '../data/towers';
import type {
  AttackKind,
  DamageType,
  GlobalKey,
  GlobalStats,
  ModifierDef,
  SpellId,
  StatKey,
  TowerDef,
  TowerId,
  TowerStats,
  UpgradeStep,
} from '../data/types';

export const STAT_DEFAULTS: TowerStats = {
  damage: 0, range: 0, rate: 0, projectileSpeed: 0, splash: 0, pierce: 0, multishot: 0, chains: 0,
  chainFalloff: 0.8, critChance: 0, critMult: 2, slow: 0, slowDuration: 0, burnDps: 0, burnDuration: 0,
  poisonDps: 0, poisonDuration: 0, poisonStacks: 0, stunChance: 0, stunDuration: 0, freezeChance: 0,
  freezeDuration: 0, vulnerability: 0, vulnerabilityDuration: 0, bonusVsSlowed: 0, armorShred: 0,
  knockback: 0, goldChance: 0, goldAmount: 0, execute: 0, beamRamp: 0, beamRampMax: 0, coneAngle: 0,
  bomblets: 0, spreadOnDeath: 0, minRange: 0, auraDamage: 0, auraRate: 0, auraRange: 0, auraCrit: 0,
  waveGold: 0, pull: 0, soulStacks: 0, bossDamage: 0, airDamage: 0, shieldDamage: 0, armorDamage: 0,
};

export const GLOBAL_DEFAULTS: GlobalStats = {
  startGold: 240, lives: 0, interest: 0, interestCap: 60, killGold: 0, waveGold: 0, sellRefund: 0.7,
  buildCost: 0, upgradeCost: 0, maxMana: 100, manaRegen: 2, spellPower: 0, spellCooldown: 0,
  augmentChoices: 3, augmentRerolls: 0, augmentLuck: 0, augmentInterval: 5, livesRegen: 0, starGain: 0,
  xpGain: 0, bossGold: 0, freeTowers: 0, shieldBreak: 0, armorBreak: 0,
};

/** Hard caps that keep stacked modifiers sane. */
const CAPS: Partial<Record<StatKey, number>> = {
  slow: 0.8, critChance: 0.9, stunChance: 0.8, freezeChance: 0.7, execute: 0.35, goldChance: 1, chainFalloff: 1,
};

export interface TowerConfig {
  tier: number; // 1..5
  branch: number; // -1 until chosen
}

export function effectiveAttack(def: TowerDef, branch: number): AttackKind {
  return (branch >= 0 ? def.branches[branch].attack : undefined) ?? def.attack;
}
export function effectiveDamageType(def: TowerDef, branch: number): DamageType {
  return (branch >= 0 ? def.branches[branch].damageType : undefined) ?? def.damageType;
}
export function effectiveTargetsAir(def: TowerDef, branch: number): boolean {
  return (branch >= 0 ? def.branches[branch].targetsAir : undefined) ?? def.targetsAir;
}

/** All upgrade steps that apply to a tower at a given tier/branch, in order. */
export function appliedSteps(def: TowerDef, cfg: TowerConfig): UpgradeStep[] {
  const steps: UpgradeStep[] = [];
  if (cfg.tier >= 2) steps.push(def.tiers[0]);
  if (cfg.tier >= 3) steps.push(def.tiers[1]);
  if (cfg.branch >= 0) {
    const b = def.branches[cfg.branch];
    if (cfg.tier >= 4) steps.push(b.steps[0]);
    if (cfg.tier >= 5) steps.push(b.steps[1]);
  }
  return steps;
}

/** Stats from data only (no modifiers). */
export function rawTowerStats(def: TowerDef, cfg: TowerConfig): TowerStats {
  const s: TowerStats = { ...STAT_DEFAULTS, ...def.base };
  for (const step of appliedSteps(def, cfg)) {
    if (step.add) for (const k in step.add) s[k as StatKey] += step.add[k as StatKey]!;
    if (step.mul) for (const k in step.mul) s[k as StatKey] *= step.mul[k as StatKey]!;
  }
  return s;
}

/**
 * A bag of modifiers (talents + augments) with ranks. Computes final tower and
 * global stats. Kept free of game state so it is trivially testable.
 */
export class ModifierSet {
  private mods: { mod: ModifierDef; times: number }[] = [];
  private version = 0;

  add(mods: readonly ModifierDef[], times = 1): void {
    if (times <= 0) return;
    for (const mod of mods) this.mods.push({ mod, times });
    this.version++;
  }

  /** Changes whenever modifiers are added; used to invalidate cached tower stats. */
  get revision(): number {
    return this.version;
  }

  global(): GlobalStats {
    const g: GlobalStats = { ...GLOBAL_DEFAULTS };
    for (const { mod, times } of this.mods) {
      if (mod.target === 'global') g[mod.stat as GlobalKey] += mod.add * times;
    }
    return g;
  }

  unlockedSpells(): Set<SpellId> {
    const out = new Set<SpellId>();
    for (const { mod } of this.mods) if (mod.target === 'unlockSpell') out.add(mod.spell);
    return out;
  }

  /** Multiplier on build/upgrade cost for a tower (global + tower-specific). */
  costMultiplier(tower: TowerId, kind: 'build' | 'upgrade'): number {
    const g = this.global();
    let m = 1 + (kind === 'build' ? g.buildCost : g.upgradeCost);
    for (const { mod, times } of this.mods) {
      if (mod.target === 'towerCost' && mod.tower === tower) m += mod.pct * times;
    }
    return Math.max(0.3, m);
  }

  towerStats(id: TowerId, cfg: TowerConfig): TowerStats {
    const def = TOWERS[id];
    const s = rawTowerStats(def, cfg);
    const dmgType = effectiveDamageType(def, cfg.branch);
    const add: Partial<Record<StatKey, number>> = {};
    const pct: Partial<Record<StatKey, number>> = {};
    for (const { mod, times } of this.mods) {
      if (mod.target !== 'tower') continue;
      const sc = mod.scope;
      let ok = false;
      switch (sc.kind) {
        case 'all':
          ok = true;
          break;
        case 'tower':
          ok = sc.tower === id && (sc.branch === undefined || sc.branch === cfg.branch);
          break;
        case 'damageType':
          ok = sc.type === dmgType;
          break;
        case 'tag':
          ok = def.tags.includes(sc.tag);
          break;
      }
      if (!ok) continue;
      if (mod.add) add[mod.stat] = (add[mod.stat] ?? 0) + mod.add * times;
      if (mod.pct) pct[mod.stat] = (pct[mod.stat] ?? 0) + mod.pct * times;
    }
    for (const k of Object.keys(s) as StatKey[]) {
      // Additive modifiers only make sense for mechanics the tower already has,
      // except for universally meaningful stats.
      const a = add[k] ?? 0;
      if (a !== 0 && (s[k] !== 0 || UNIVERSAL_ADD.has(k) || applicableAdd(k, s))) s[k] += a;
      const p = pct[k] ?? 0;
      if (p !== 0) s[k] *= 1 + p;
      const cap = CAPS[k];
      if (cap !== undefined && s[k] > cap) s[k] = cap;
    }
    return s;
  }
}

/** Stats a global "+X" modifier may introduce on a tower that has 0 of it. */
const UNIVERSAL_ADD = new Set<StatKey>([
  'critChance', 'execute', 'bossDamage', 'airDamage', 'shieldDamage', 'armorDamage',
]);

/**
 * Some additive stats only apply when the tower already uses the mechanic:
 * e.g. "+1 chain" should not turn an archer into a chain tower, and "+0.5 s slow"
 * only affects towers that slow.
 */
function applicableAdd(k: StatKey, s: TowerStats): boolean {
  switch (k) {
    case 'slowDuration':
      return s.slow > 0;
    case 'chains':
      return false;
    case 'pierce':
    case 'multishot':
      return s.projectileSpeed > 0 && s.splash === 0 && s.coneAngle === 0;
    default:
      return false;
  }
}
