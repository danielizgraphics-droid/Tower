import { Painter } from './painter';
import { Camera } from './projection';

/** A pre-rendered bitmap anchored at a world point. Sizes are in CSS pixels. */
export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Anchor offset inside the sprite (CSS px). */
  ax: number;
  ay: number;
  w: number;
  h: number;
}

/**
 * Renders `draw` into an offscreen canvas so that the world point `world`
 * lands on the sprite anchor. `wTiles`/`hTiles` give the sprite size in world
 * units and `fx`/`fy` the anchor position as a fraction of that size.
 */
export function makeSprite(
  scale: number,
  dpr: number,
  wTiles: number,
  hTiles: number,
  fx: number,
  fy: number,
  world: { x: number; y: number; z: number },
  draw: (p: Painter) => void,
): Sprite {
  const w = Math.max(1, Math.ceil(wTiles * scale));
  const h = Math.max(1, Math.ceil(hTiles * scale));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ax = w * fx;
  const ay = h * fy;
  const cam = new Camera();
  cam.scale = scale;
  const at = cam.project(world.x, world.y, world.z);
  cam.ox = ax - at.x;
  cam.oy = ay - at.y;
  const p = new Painter(cam);
  p.ctx = ctx;
  draw(p);
  return { canvas, ax, ay, w, h };
}

/** Draws a sprite with its anchor at screen point (sx, sy), scaled by k. */
export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, sx: number, sy: number, k = 1): void {
  ctx.drawImage(s.canvas, sx - s.ax * k, sy - s.ay * k, s.w * k, s.h * k);
}

/**
 * Adds a solid outer contour around everything drawn on `canvas` (illustrated
 * look). `width` is in device pixels.
 */
export function outlineCanvas(canvas: HTMLCanvasElement, width: number, color = 'rgba(30,21,36,0.92)'): void {
  const w = canvas.width;
  const h = canvas.height;
  // Mask of the solid parts only, so soft glows and shadows get no contour.
  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = h;
  const m = mask.getContext('2d', { willReadFrequently: true })!;
  m.drawImage(canvas, 0, 0);
  const img = m.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 150 ? 255 : 0;
  m.putImageData(img, 0, 0);
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const t = tmp.getContext('2d')!;
  const steps = width > 1.6 ? 12 : 8;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    t.drawImage(mask, Math.cos(a) * width, Math.sin(a) * width);
  }
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = color;
  t.fillRect(0, 0, w, h);
  t.globalCompositeOperation = 'source-over';
  t.drawImage(canvas, 0, 0);
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}

/** Copy of a sprite with a color washed over its opaque pixels (hit flash, frost). */
export function tintSprite(s: Sprite, color: string, alpha: number): Sprite {
  const c = document.createElement('canvas');
  c.width = s.canvas.width;
  c.height = s.canvas.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(s.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return { ...s, canvas: c };
}
