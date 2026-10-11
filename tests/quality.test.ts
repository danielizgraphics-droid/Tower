import { describe, expect, it } from 'vitest';
import { AutoQuality } from '../src/render/quality';

const run = (q: AutoQuality, ms: number, seconds: number, target = 1000 / 60) => {
  let changed = 0;
  for (let t = 0; t < seconds * 1000; t += ms) if (q.sample(ms, target)) changed++;
  return changed;
};

describe('automatic graphics level', () => {
  it('drops a level when frames keep arriving late, one step at a time', () => {
    const q = new AutoQuality('auto', 2);
    run(q, 16.7, 5);
    expect(q.level).toBe(2);
    run(q, 33, 4);
    expect(q.level).toBe(1);
    run(q, 33, 4);
    expect(q.level).toBe(0);
  });

  it('climbs back after a long smooth stretch, but gives up after flip-flopping', () => {
    const q = new AutoQuality('auto', 2);
    run(q, 33, 4);
    expect(q.level).toBe(1);
    run(q, 16.7, 25);
    expect(q.level).toBe(2);
    run(q, 33, 4);
    expect(q.level).toBe(1);
    run(q, 16.7, 60);
    expect(q.level).toBe(1);
  });

  it('fixed settings never change and saver caps the frame rate', () => {
    const hi = new AutoQuality('high');
    run(hi, 50, 10);
    expect(hi.level).toBe(2);
    const saver = new AutoQuality('saver');
    expect(saver.level).toBe(0);
    expect(saver.fpsCap(true)).toBe(30);
    expect(hi.fpsCap(true)).toBe(0);
  });

  it('ignores pauses such as switching apps', () => {
    const q = new AutoQuality('auto', 2);
    for (let i = 0; i < 50; i++) q.sample(2000, 16.7);
    expect(q.level).toBe(2);
  });
});
