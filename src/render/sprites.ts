import { Painter } from './painter';
import { Camera, DX, DY, HEIGHT_SCALE } from './projection';

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
 * Renders `draw` into an offscreen canvas so that the world point (wx, wy, wz)
 * lands on the sprite anchor. `wTiles`/`hTiles` give the sprite size in tiles and
 * `fx`/`fy` the anchor position as a fraction of that size.
 */
export function makeSprite(
  scale: number,
  dpr: number,
  rows: number,
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
  cam.rows = rows;
  cam.ox = ax - (world.x + (rows - world.y) * DX) * scale;
  cam.oy = ay - (world.y * DY - world.z * HEIGHT_SCALE) * scale;
  const p = new Painter(cam);
  p.ctx = ctx;
  draw(p);
  return { canvas, ax, ay, w, h };
}

/** Draws a sprite with its anchor at screen point (sx, sy), scaled by k. */
export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, sx: number, sy: number, k = 1): void {
  ctx.drawImage(s.canvas, sx - s.ax * k, sy - s.ay * k, s.w * k, s.h * k);
}
