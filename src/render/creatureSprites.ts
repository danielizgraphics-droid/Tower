import type { EnemyDef } from '../data/types';
import { drawCreature } from './models/creatures';
import { makeSprite, outlineCanvas, tintSprite, type Sprite } from './sprites';

/** Animation frames per cycle and facing directions cached per creature. */
export const FRAMES = 8;
export const DIRS = 8;

export type Variant = 0 | 1 | 2; // normal, hit flash, frozen

export function creatureBounds(def: EnemyDef): { w: number; top: number } {
  const s = def.size;
  switch (def.shape) {
    case 'dragon':
      return { w: 2.2 * s, top: 0.9 + 0.25 * s + 0.75 * s };
    case 'flyer':
      return { w: 0.9 + 1.2 * s, top: 0.9 + 0.25 * s + 0.6 * s };
    case 'ghost':
      return { w: 0.8 + 0.8 * s, top: 0.3 + 1.05 * s };
    case 'siege':
      return { w: 0.6 + 1.1 * s, top: 0.25 + 0.65 * s };
    default:
      return { w: 0.7 + 1.1 * s, top: 0.25 + 1.12 * s };
  }
}

/**
 * Lazily rendered creature sprites. Each (creature, direction, frame) is drawn
 * once at the current zoom with a crisp outline, so the detailed vector art
 * costs one drawImage per enemy per frame.
 */
export class CreatureSprites {
  private cache = new Map<string, Sprite>();
  private scale = 0;
  private dpr = 1;
  /** New sprites that may still be rendered this frame (spreads the cost after a zoom). */
  budget = 6;

  setScale(scale: number, dpr: number): void {
    if (scale === this.scale && dpr === this.dpr) return;
    this.scale = scale;
    this.dpr = dpr;
    this.cache.clear();
  }

  /** Cached sprite, or null when this frame's render budget is spent (caller falls back). */
  peek(def: EnemyDef, dir: number, frame: number, variant: Variant): Sprite | null {
    const hit = this.cache.get(`${def.id}|${dir}|${frame}|${variant}`);
    if (hit || this.budget > 0) return this.get(def, dir, frame, variant);
    // Any already-rendered frame of the same facing keeps the creature on screen.
    for (let f = 0; f < FRAMES; f++) {
      const alt = this.cache.get(`${def.id}|${dir}|${f}|0`);
      if (alt) return alt;
    }
    return null;
  }

  get(def: EnemyDef, dir: number, frame: number, variant: Variant): Sprite {
    const key = `${def.id}|${dir}|${frame}|${variant}`;
    let s = this.cache.get(key);
    if (s) return s;
    this.budget--;
    if (variant !== 0) {
      const base = this.get(def, dir, frame, 0);
      s = variant === 1 ? tintSprite(base, '#ffffff', 0.85) : tintSprite(base, '#bfe8ff', 0.5);
    } else {
      const b = creatureBounds(def);
      const below = 0.32 * b.w;
      const h = b.top + below;
      s = makeSprite(this.scale, this.dpr, b.w, h, 0.5, b.top / h, { x: 0, y: 0, z: 0 }, (p) => {
        p.detail = true;
        drawCreature(p, def, { x: 0, y: 0, angle: (dir / DIRS) * Math.PI * 2, t: frame / FRAMES });
      });
      outlineCanvas(s.canvas, Math.max(1, this.scale * this.dpr * 0.022));
    }
    this.cache.set(key, s);
    return s;
  }
}
