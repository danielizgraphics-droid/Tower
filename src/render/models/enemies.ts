import type { EnemyDef } from '../../data/types';
import type { Painter } from '../painter';
import { drawCreature } from './creatures';

export interface EnemyLook {
  def: EnemyDef;
  x: number;
  y: number;
  angle: number;
  walk: number;
  age: number;
  hitFlash: number;
  shield: number;
  frozen: boolean;
  slowed: boolean;
  stunned: boolean;
  burning: boolean;
  poisoned: boolean;
  vulnerable: boolean;
  time: number;
}

/** Height (z) at which the enemy's body centre sits — used for health bars and hit effects. */
export function enemyHeight(def: EnemyDef): number {
  const s = def.size;
  switch (def.shape) {
    case 'flyer':
    case 'dragon':
      return 0.9 + 0.25 * s;
    case 'ghost':
      return 0.35 + 0.55 * s;
    case 'blob':
      return 0.4 * s;
    case 'siege':
      return 0.45 * s;
    case 'giant':
      return 0.85 * s;
    default:
      return 0.62 * s;
  }
}

/** Animation cycle (0..1) for an enemy: walk cycle, wing flaps or wobble. */
export function animPhase(e: Pick<EnemyLook, 'def' | 'walk' | 'age' | 'frozen' | 'stunned'>): number {
  if (e.frozen || e.stunned) return 0;
  const d = e.def;
  let v: number;
  switch (d.shape) {
    case 'flyer':
      v = (e.age * (d.id === 'harpy' ? 1.6 : 2.4)) % 1;
      break;
    case 'dragon':
      v = (e.age * 0.8) % 1;
      break;
    case 'ghost':
      v = (e.age * 0.5) % 1;
      break;
    case 'blob':
      v = (e.age * 1.3) % 1;
      break;
    default:
      // One full stride every ~0.7 tiles (scaled with body size).
      v = (e.walk / (0.7 * Math.max(0.8, d.size))) % 1;
  }
  return v < 0 ? v + 1 : v;
}

/** Hover bob added on top of the sprite for flying and spectral enemies (world z). */
export function hoverBob(def: EnemyDef, age: number): number {
  if (def.shape === 'flyer') return Math.sin(age * 6) * 0.05;
  if (def.shape === 'dragon') return Math.sin(age * 2.5) * 0.08;
  return 0;
}

/** Full model including status overlays (portraits / direct drawing). */
export function drawEnemyModel(p: Painter, e: EnemyLook): void {
  drawCreature(p, e.def, { x: e.x, y: e.y, angle: e.angle, t: animPhase(e) });
  drawEnemyStatus(p, e);
}

/** Status overlays drawn over the (cached) creature sprite. */
export function drawEnemyStatus(p: Painter, e: EnemyLook): void {
  const d = e.def;
  const x = e.x;
  const y = e.y;
  const cz = enemyHeight(d);
  if (e.shield > 0) {
    const ctx = p.ctx;
    const sx = p.cam.sx(x, y);
    const sy = p.cam.sy(x, y, cz);
    const R = p.cam.scale * 0.36 * Math.max(0.8, d.size);
    const g = ctx.createRadialGradient(sx, sy, R * 0.5, sx, sy, R);
    g.addColorStop(0, 'rgba(120,190,255,0)');
    g.addColorStop(0.85, 'rgba(120,190,255,0.22)');
    g.addColorStop(1, 'rgba(170,220,255,0.55)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, R, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.frozen) {
    p.ctx.globalAlpha = 0.55;
    p.cbox(x, y, 0, 0.42 * d.size, 0.42 * d.size, Math.min(1.4, cz * 1.6), '#cdefff', '#e8f8ff');
    p.ctx.globalAlpha = 1;
  }
  if (e.stunned) {
    for (let i = 0; i < 3; i++) {
      const ang = e.time * 5 + (i / 3) * Math.PI * 2;
      p.sphere(x + Math.cos(ang) * 0.16, y + Math.sin(ang) * 0.16, cz * 1.7 + 0.1, 0.03, '#ffe066');
    }
  }
  if (e.vulnerable) {
    p.ring(x, y, 0.01, 0.28 * Math.max(0.8, d.size), 'rgba(200,110,255,0.75)', Math.max(1, p.cam.scale * 0.025));
  }
  if (e.slowed && !e.frozen) {
    p.ring(x, y, 0.01, 0.22 * Math.max(0.8, d.size), 'rgba(140,210,255,0.8)', Math.max(1, p.cam.scale * 0.02));
  }
}
