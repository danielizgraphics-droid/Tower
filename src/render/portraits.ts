import { ENEMIES } from '../data/enemies';
import { TOWERS } from '../data/towers';
import type { EnemyId, TowerId } from '../data/types';
import { drawCreature } from './models/creatures';
import { creatureBounds } from './creatureSprites';
import { outlineCanvas } from './sprites';
import { drawTowerModel } from './models/towers';
import { Painter } from './painter';
import { Camera } from './projection';

const cache = new Map<string, string>();

function canvasFor(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; dpr: number } {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, ctx, dpr };
}

/** Renders a tower model into a data URL for use in the DOM UI (cached). */
export function towerPortrait(id: TowerId, tier = 1, branch = -1, size = 64): string {
  const key = `t:${id}:${tier}:${branch}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { canvas, ctx, dpr } = canvasFor(size);
  const cam = new Camera();
  cam.rows = 0;
  cam.scale = size / 2.25;
  // Place the tower base near the bottom centre.
  const base = cam.project(0.5, 0.5, 0);
  cam.ox = size * 0.5 - (base.x - cam.ox);
  cam.oy = size * 0.86 - (base.y - cam.oy);
  const p = new Painter(cam);
  p.ctx = ctx;
  const naval = TOWERS[id].placement === 'water';
  if (naval) {
    // A patch of water so naval towers read as such.
    p.disc(0.5, 0.5, 0, 0.62, 'rgba(70,170,220,0.55)', false);
    p.ring(0.5, 0.5, 0, 0.62, 'rgba(255,255,255,0.6)', Math.max(1, cam.scale * 0.02));
  }
  drawTowerModel(p, { id, tier, branch, angle: Math.PI * 0.25, fireAnim: 1, time: 0.6 }, 0.5, 0.5, naval ? 0.28 : 0);
  outlineCanvas(canvas, Math.max(1, size * dpr * 0.012), 'rgba(40,28,44,0.7)');
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

/** Copies the opaque area of `src` into a size×size canvas, centred and fitted with padding. */
function fitInto(src: HTMLCanvasElement, size: number, dpr: number, pad = 0.06, anchorBottom = 0.94): HTMLCanvasElement {
  const ctx = src.getContext('2d')!;
  const { width: w, height: h } = src;
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const out = document.createElement('canvas');
  out.width = out.height = Math.round(size * dpr);
  if (x1 < 0) return out;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const avail = out.width * (1 - pad * 2);
  const k = Math.min(avail / bw, avail / bh);
  const dw = bw * k;
  const dh = bh * k;
  const dx = (out.width - dw) / 2;
  const dy = Math.min(out.height * anchorBottom - dh, (out.height - dh) / 2 + out.height * 0.04);
  out.getContext('2d')!.drawImage(src, x0, y0, bw, bh, dx, Math.max(out.height * pad, dy), dw, dh);
  return out;
}

export function enemyPortrait(id: EnemyId, size = 48): string {
  const key = `e:${id}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = ENEMIES[id];
  // Draw large on a scratch canvas, then crop to the creature and fit it.
  const big = size * 2;
  const { canvas, ctx, dpr } = canvasFor(big * 1.6);
  const cam = new Camera();
  cam.rows = 0;
  const b = creatureBounds(def);
  cam.scale = big / Math.max(b.w, b.top);
  const base = cam.project(0.5, 0.5, 0);
  cam.ox = big * 0.8 - (base.x - cam.ox);
  cam.oy = big * 1.3 - (base.y - cam.oy);
  const p = new Painter(cam);
  p.ctx = ctx;
  const flying = def.shape === 'flyer' || def.shape === 'dragon';
  drawCreature(p, def, { x: 0.5, y: 0.5, angle: def.shape === 'beast' || flying || def.shape === 'siege' ? 0.35 : Math.PI * 0.3, t: 0.12 });
  outlineCanvas(canvas, Math.max(1, big * dpr * 0.016));
  const url = fitInto(canvas, size, dpr).toDataURL();
  cache.set(key, url);
  return url;
}
