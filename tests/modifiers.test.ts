import { describe, expect, it } from 'vitest';
import { TOWERS, TOWER_LIST } from '../src/data/towers';
import { ModifierSet, rawTowerStats } from '../src/game/modifiers';

describe('tower stats', () => {
  it('applies tiers then branch steps in order', () => {
    const t1 = rawTowerStats(TOWERS.archer, { tier: 1, branch: -1 });
    const t3 = rawTowerStats(TOWERS.archer, { tier: 3, branch: -1 });
    const t5 = rawTowerStats(TOWERS.archer, { tier: 5, branch: 0 });
    expect(t1.damage).toBe(9);
    expect(t3.damage).toBe(18);
    expect(t5.damage).toBe(18 + 18 + 30);
    expect(t5.critChance).toBeCloseTo(0.35);
  });

  it('every tower has 3 distinct branches with 2 steps and sane base stats', () => {
    expect(TOWER_LIST).toHaveLength(12);
    for (const t of TOWER_LIST) {
      expect(new Set(t.branches.map((b) => b.id)).size).toBe(3);
      for (let b = 0; b < 3; b++) {
        const s = rawTowerStats(t, { tier: 5, branch: b });
        expect(s.range, `${t.id}/${b} range`).toBeGreaterThan(1);
        expect(Number.isFinite(s.damage)).toBe(true);
        expect(t.branches[b].steps).toHaveLength(2);
      }
    }
  });

  it('percentage and flat modifiers stack additively and respect scope', () => {
    const m = new ModifierSet();
    m.add([{ target: 'tower', scope: { kind: 'all' }, stat: 'damage', pct: 0.1 }], 2);
    m.add([{ target: 'tower', scope: { kind: 'tower', tower: 'archer' }, stat: 'damage', add: 1 }]);
    const archer = m.towerStats('archer', { tier: 1, branch: -1 });
    const cannon = m.towerStats('cannon', { tier: 1, branch: -1 });
    expect(archer.damage).toBeCloseTo((9 + 1) * 1.2);
    expect(cannon.damage).toBeCloseTo(22 * 1.2);
  });

  it('branch-scoped modifiers only affect that branch', () => {
    const m = new ModifierSet();
    m.add([{ target: 'tower', scope: { kind: 'tower', tower: 'archer', branch: 1 }, stat: 'rate', pct: 0.5 }]);
    const volley = m.towerStats('archer', { tier: 4, branch: 1 });
    const longbow = m.towerStats('archer', { tier: 4, branch: 0 });
    expect(volley.rate).toBeCloseTo((1.25 + 0.15 + 0.3) * 1.5);
    expect(longbow.rate).toBeCloseTo(1.25 + 0.15);
  });

  it('damage-type scope follows the branch damage type', () => {
    const m = new ModifierSet();
    m.add([{ target: 'tower', scope: { kind: 'damageType', type: 'arcane' }, stat: 'damage', pct: 1 }]);
    const runic = m.towerStats('archer', { tier: 4, branch: 2 });
    const plain = rawTowerStats(TOWERS.archer, { tier: 4, branch: 2 });
    expect(runic.damage).toBeCloseTo(plain.damage * 2);
  });

  it('does not grant mechanics a tower lacks (chains on archers) and caps slows', () => {
    const m = new ModifierSet();
    m.add([{ target: 'tower', scope: { kind: 'all' }, stat: 'chains', add: 3 }]);
    m.add([{ target: 'tower', scope: { kind: 'all' }, stat: 'slow', add: 5 }]);
    expect(m.towerStats('archer', { tier: 1, branch: -1 }).chains).toBe(0);
    expect(m.towerStats('storm', { tier: 1, branch: -1 }).chains).toBe(5);
    expect(m.towerStats('frost', { tier: 1, branch: -1 }).slow).toBeLessThanOrEqual(0.8);
  });

  it('global modifiers and cost multipliers', () => {
    const m = new ModifierSet();
    m.add([{ target: 'global', stat: 'buildCost', add: -0.1 }]);
    m.add([{ target: 'towerCost', tower: 'archer', pct: -0.06 }], 2);
    expect(m.costMultiplier('archer', 'build')).toBeCloseTo(0.78);
    expect(m.costMultiplier('cannon', 'build')).toBeCloseTo(0.9);
    expect(m.costMultiplier('cannon', 'upgrade')).toBeCloseTo(1);
    expect(m.global().startGold).toBe(240);
  });
});
