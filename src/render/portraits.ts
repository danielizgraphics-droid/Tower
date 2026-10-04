import { ENEMIES } from '../data/enemies';
import type { EnemyId, TowerId } from '../data/types';
import { drawEnemyModel, enemyHeight } from './models/enemies';
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
  const { canvas, ctx } = canvasFor(size);
  const cam = new Camera();
  cam.rows = 0;
  cam.scale = size / 2.25;
  // Place the tower base near the bottom centre.
  const base = cam.project(0.5, 0.5, 0);
  cam.ox = size * 0.5 - (base.x - cam.ox);
  cam.oy = size * 0.86 - (base.y - cam.oy);
  const p = new Painter(cam);
  p.ctx = ctx;
  drawTowerModel(p, { id, tier, branch, angle: Math.PI * 0.25, fireAnim: 1, time: 0.6 }, 0.5, 0.5, 0);
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

export function enemyPortrait(id: EnemyId, size = 48): string {
  const key = `e:${id}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = ENEMIES[id];
  const { canvas, ctx } = canvasFor(size);
  const cam = new Camera();
  cam.rows = 0;
  const flying = def.shape === 'flyer' || def.shape === 'dragon';
  const top = flying ? 0.45 * def.size : enemyHeight(def) + 0.45 * def.size;
  const shapeZoom = def.shape === 'beast' ? 1.35 : flying ? 1.25 : 1;
  cam.scale = (size / Math.max(0.95, top * 1.12, def.size * 0.9)) * shapeZoom;
  // Flyers are framed on their body, walkers on their feet.
  const anchorZ = flying ? enemyHeight(def) : 0;
  const base = cam.project(0.5, 0.5, anchorZ);
  cam.ox = size * 0.5 - (base.x - cam.ox);
  cam.oy = size * (flying ? 0.55 : 0.88) - (base.y - cam.oy);
  const p = new Painter(cam);
  p.ctx = ctx;
  drawEnemyModel(p, {
    def,
    x: 0.5,
    y: 0.5,
    angle: def.shape === 'beast' || flying ? 0.15 : Math.PI * 0.3,
    walk: 0.2,
    age: 0.4,
    hitFlash: 1,
    shield: 0,
    frozen: false,
    slowed: false,
    stunned: false,
    burning: false,
    poisoned: false,
    vulnerable: false,
    time: 0,
  });
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
