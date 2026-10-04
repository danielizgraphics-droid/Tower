import type { EnemyDef } from '../../data/types';
import { rgba, shade } from '../color';
import type { Painter } from '../painter';

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

const SKIN = '#f1c9a5';

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
    case 'giant':
      return 0.85 * s;
    default:
      return 0.62 * s;
  }
}

export function drawEnemyModel(p: Painter, e: EnemyLook): void {
  const d = e.def;
  const s = d.size * 0.5;
  const flash = e.hitFlash < 0.08;
  const body = flash ? '#ffffff' : e.frozen ? '#bfe8ff' : d.color;
  const accent = flash ? '#ffffff' : e.frozen ? '#9fd4f5' : d.accent;
  const a = e.angle;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const step = e.frozen || e.stunned ? 0 : Math.sin(e.walk * 9);
  const bob = Math.abs(step) * 0.03;
  const x = e.x;
  const y = e.y;

  switch (d.shape) {
    case 'humanoid': {
      p.shadow(x, y, 0.001, 0.22 * d.size, 0.25);
      const lw = 0.07 * s * 2;
      // Legs (perpendicular offset)
      const px = -sa * 0.07 * d.size;
      const py = ca * 0.07 * d.size;
      p.rbox(x + px + ca * step * 0.05, y + py + sa * step * 0.05, 0, lw, lw, 0.2 * d.size, a, shade(accent, -0.2));
      p.rbox(x - px - ca * step * 0.05, y - py - sa * step * 0.05, 0, lw, lw, 0.2 * d.size, a, shade(accent, -0.2));
      const bz = 0.2 * d.size + bob;
      p.rbox(x, y, bz, 0.22 * d.size, 0.26 * d.size, 0.3 * d.size, a, body);
      // Head
      const hz = bz + 0.3 * d.size;
      if (d.id === 'knight' || d.id === 'runeguard') {
        p.rbox(x, y, hz, 0.18 * d.size, 0.18 * d.size, 0.18 * d.size, a, shade(body, 0.1));
        p.rbox(x + ca * 0.02, y + sa * 0.02, hz + 0.18 * d.size, 0.04, 0.12 * d.size, 0.08, a, accent);
      } else if (d.id === 'skeleton') {
        p.sphere(x, y, hz + 0.1 * d.size, 0.1 * d.size, '#f4efe0');
      } else {
        p.sphere(x, y, hz + 0.1 * d.size, 0.1 * d.size, d.id === 'goblin' ? shade(d.color, 0.1) : SKIN);
        if (d.id === 'goblin') {
          p.line([x - sa * 0.1, y + ca * 0.1, hz + 0.12], [x - sa * 0.18, y + ca * 0.18, hz + 0.16], shade(d.color, 0.1), 0.03);
          p.line([x + sa * 0.1, y - ca * 0.1, hz + 0.12], [x + sa * 0.18, y - ca * 0.18, hz + 0.16], shade(d.color, 0.1), 0.03);
        } else if (d.id === 'bandit') {
          p.rbox(x, y, hz + 0.12 * d.size, 0.2 * d.size, 0.2 * d.size, 0.05, a, accent);
        }
      }
      // Weapons / props
      if (d.id === 'shaman') {
        const sx = x - sa * 0.16;
        const sy = y + ca * 0.16;
        p.line([sx, sy, 0.05], [sx, sy, hz + 0.3], '#7a5a3a', 0.03);
        p.sphere(sx, sy, hz + 0.33, 0.05, accent, 0.6);
      } else if (d.id === 'knight') {
        p.rbox(x - sa * 0.15 + ca * 0.05, y + ca * 0.15 + sa * 0.05, bz, 0.04, 0.2, 0.24, a, accent);
      } else if (d.id !== 'skeleton') {
        p.line([x + sa * 0.15, y - ca * 0.15, bz + 0.1], [x + sa * 0.15 + ca * 0.18, y - ca * 0.15 + sa * 0.18, bz + 0.22], '#c9ccd6', 0.025);
      }
      break;
    }
    case 'beast': {
      p.shadow(x, y, 0.001, 0.25 * d.size, 0.25);
      const lz = 0.14 * d.size;
      for (const [fx, side] of [[0.12, 1], [0.12, -1], [-0.12, 1], [-0.12, -1]] as const) {
        const ph = side * (fx > 0 ? 1 : -1) * step * 0.05;
        p.rbox(x + ca * (fx + ph) - sa * side * 0.07, y + sa * (fx + ph) + ca * side * 0.07, 0, 0.05, 0.05, lz, a, shade(body, -0.25));
      }
      p.rbox(x, y, lz + bob, 0.42 * d.size, 0.18 * d.size, 0.16 * d.size, a, body);
      p.rbox(x + ca * 0.24 * d.size, y + sa * 0.24 * d.size, lz + 0.06 + bob, 0.16 * d.size, 0.13 * d.size, 0.13 * d.size, a, shade(body, 0.08));
      // Ears
      p.cone(x + ca * 0.22 * d.size - sa * 0.04, y + sa * 0.22 * d.size + ca * 0.04, lz + 0.18 + bob, 0.03, 0.07, body);
      // Tail
      p.line([x - ca * 0.2, y - sa * 0.2, lz + 0.12], [x - ca * 0.34, y - sa * 0.34, lz + 0.2 + step * 0.03], body, 0.04);
      break;
    }
    case 'blob': {
      p.shadow(x, y, 0.001, 0.3 * d.size, 0.25);
      const squash = 1 + Math.sin(e.age * 8) * 0.08;
      const r = 0.26 * d.size;
      const ctx = p.ctx;
      const sx = p.cam.px(x, y);
      const sy = p.cam.py(y, r * squash * 0.9);
      const R = r * p.cam.scale;
      const g = ctx.createRadialGradient(sx - R * 0.3, sy - R * 0.4, R * 0.1, sx, sy, R * 1.1);
      g.addColorStop(0, shade(body, 0.5));
      g.addColorStop(0.6, rgba(body, 0.95));
      g.addColorStop(1, rgba(shade(body, -0.3), 0.95));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(sx, sy, R * (2 - squash) * 1.05, R * squash * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#1d2a33';
      ctx.beginPath();
      ctx.arc(sx - R * 0.25, sy - R * 0.15, R * 0.1, 0, Math.PI * 2);
      ctx.arc(sx + R * 0.25, sy - R * 0.15, R * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'flyer': {
      const hz = enemyHeight(d) + Math.sin(e.age * 6) * 0.05;
      p.shadow(x, y, 0.001, 0.2 * d.size, 0.18);
      const flap = Math.sin(e.age * 16) * 0.5 + 0.5;
      const wing = 0.32 * d.size;
      const nx = -sa;
      const ny = ca;
      p.face([[x, y, hz], [x + nx * wing, y + ny * wing, hz + 0.15 * flap], [x + nx * wing * 0.6 - ca * 0.1, y + ny * wing * 0.6 - sa * 0.1, hz - 0.05]], shade(accent, -0.1), [0, 0, 1], false);
      p.sphere(x, y, hz, 0.12 * d.size, body);
      p.face([[x, y, hz], [x - nx * wing, y - ny * wing, hz + 0.15 * flap], [x - nx * wing * 0.6 - ca * 0.1, y - ny * wing * 0.6 - sa * 0.1, hz - 0.05]], shade(accent, -0.1), [0, 0, 1], false);
      if (d.id === 'wyvern') p.sphere(x + ca * 0.14, y + sa * 0.14, hz + 0.06, 0.07, shade(body, 0.1));
      break;
    }
    case 'giant': {
      p.shadow(x, y, 0.001, 0.3 * d.size, 0.28);
      const g = d.size;
      const px = -sa * 0.1 * g;
      const py = ca * 0.1 * g;
      p.rbox(x + px + ca * step * 0.05, y + py + sa * step * 0.05, 0, 0.11 * g, 0.11 * g, 0.22 * g, a, shade(body, -0.2));
      p.rbox(x - px - ca * step * 0.05, y - py - sa * step * 0.05, 0, 0.11 * g, 0.11 * g, 0.22 * g, a, shade(body, -0.2));
      const bz = 0.22 * g + bob;
      p.rbox(x, y, bz, 0.3 * g, 0.4 * g, 0.36 * g, a, body);
      // Arms
      p.rbox(x + sa * 0.25 * g, y - ca * 0.25 * g, bz + 0.02, 0.1 * g, 0.1 * g, 0.3 * g, a, shade(body, -0.08));
      p.rbox(x - sa * 0.25 * g, y + ca * 0.25 * g, bz + 0.02, 0.1 * g, 0.1 * g, 0.3 * g, a, shade(body, -0.08));
      p.rbox(x + ca * 0.03, y + sa * 0.03, bz + 0.36 * g, 0.18 * g, 0.18 * g, 0.16 * g, a, shade(body, 0.08));
      if (d.id === 'golem') p.sphere(x + ca * 0.12 * g, y + sa * 0.12 * g, bz + 0.2 * g, 0.05 * g, accent, 0.5);
      if (d.id === 'warlord') {
        p.rbox(x + ca * 0.03, y + sa * 0.03, bz + 0.52 * g, 0.2 * g, 0.2 * g, 0.04, a, accent);
        p.cone(x - sa * 0.08, y + ca * 0.08, bz + 0.52 * g, 0.03, 0.12, '#efe3c8');
        p.cone(x + sa * 0.08, y - ca * 0.08, bz + 0.52 * g, 0.03, 0.12, '#efe3c8');
      }
      break;
    }
    case 'ghost': {
      const hz = 0.15 + Math.sin(e.age * 3) * 0.05;
      p.shadow(x, y, 0.001, 0.2 * d.size, 0.15);
      const ctx = p.ctx;
      ctx.globalAlpha = 0.88;
      p.cone(x, y, hz + 0.75 * d.size, 0.2 * d.size, -0.7 * d.size, body);
      p.sphere(x, y, hz + 0.78 * d.size, 0.16 * d.size, shade(body, 0.1));
      ctx.globalAlpha = 1;
      const ex = p.cam.px(x, y);
      const ey = p.cam.py(y, hz + 0.8 * d.size);
      const R = p.cam.scale * 0.04 * d.size;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(ex - R * 1.6, ey, R, 0, Math.PI * 2);
      ctx.arc(ex + R * 1.6, ey, R, 0, Math.PI * 2);
      ctx.fill();
      if (d.id === 'lich') {
        p.rbox(x, y, hz + 0.92 * d.size, 0.22 * d.size, 0.22 * d.size, 0.06, a, '#e8c25a');
        p.line([x - sa * 0.3, y + ca * 0.3, 0.1], [x - sa * 0.3, y + ca * 0.3, hz + 1.1 * d.size], '#3a2a4a', 0.04);
        p.sphere(x - sa * 0.3, y + ca * 0.3, hz + 1.15 * d.size, 0.08, accent, 0.8);
      }
      break;
    }
    case 'dragon': {
      const hz = enemyHeight(d) + Math.sin(e.age * 2.5) * 0.08;
      const g = d.size;
      p.shadow(x, y, 0.001, 0.45 * g, 0.22);
      const flap = Math.sin(e.age * 5) * 0.5 + 0.5;
      const wing = 0.55 * g;
      const nx = -sa;
      const ny = ca;
      p.face([[x - ca * 0.1, y - sa * 0.1, hz], [x + nx * wing, y + ny * wing, hz + 0.35 * flap], [x + nx * wing * 0.7 - ca * 0.35, y + ny * wing * 0.7 - sa * 0.35, hz]], shade(accent, -0.25), [0, 0, 1], false);
      p.rbox(x, y, hz - 0.12, 0.6 * g * 0.6, 0.3 * g * 0.6, 0.24 * g * 0.6, a, body);
      p.line([x - ca * 0.2 * g, y - sa * 0.2 * g, hz], [x - ca * 0.55 * g, y - sa * 0.55 * g, hz - 0.1], body, 0.06 * g);
      p.line([x + ca * 0.15 * g, y + sa * 0.15 * g, hz], [x + ca * 0.32 * g, y + sa * 0.32 * g, hz + 0.2], body, 0.07 * g);
      p.rbox(x + ca * 0.38 * g, y + sa * 0.38 * g, hz + 0.16, 0.2 * g, 0.13 * g, 0.12 * g, a, shade(body, 0.08));
      p.face([[x - ca * 0.1, y - sa * 0.1, hz], [x - nx * wing, y - ny * wing, hz + 0.35 * flap], [x - nx * wing * 0.7 - ca * 0.35, y - ny * wing * 0.7 - sa * 0.35, hz]], shade(accent, -0.1), [0, 0, 1], false);
      break;
    }
  }

  // Status overlays
  const cz = enemyHeight(d);
  if (e.shield > 0) {
    const ctx = p.ctx;
    const sx = p.cam.px(x, y);
    const sy = p.cam.py(y, cz);
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
