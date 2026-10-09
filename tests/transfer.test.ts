import { describe, expect, it } from 'vitest';
import { defaultProfile, exportProfileCode, importProfileCode } from '../src/meta/profile';

describe('progress transfer code', () => {
  it('round-trips the whole profile, accents included', () => {
    const p = defaultProfile();
    p.stars = 123;
    p.towers.archer.xp = 456;
    p.general.treasury = 2;
    p.maps.meadow = { bestWave: 30, cleared: { normal: true }, bestEndless: 41 };
    const code = exportProfileCode(p);
    expect(code.startsWith('BASTION1.')).toBe(true);
    const back = importProfileCode(`  ${code.slice(0, 20)}\n${code.slice(20)}  `);
    expect(back?.stars).toBe(123);
    expect(back?.towers.archer.xp).toBe(456);
    expect(back?.maps.meadow.bestEndless).toBe(41);
  });

  it('rejects anything else', () => {
    expect(importProfileCode('hola')).toBeNull();
    expect(importProfileCode('BASTION1.@@@')).toBeNull();
    expect(importProfileCode('BASTION1.' + btoa('{"a":1}'))).toBeNull();
  });
});
