import { TOWERS } from '../../data/towers';
import type { TowerId, TowerVisual } from '../../data/types';
import { rgba, shade } from '../color';
import type { Painter } from '../painter';

export interface TowerLook {
  id: TowerId;
  tier: number;
  branch: number;
  /** Aim angle on the ground plane. */
  angle: number;
  /** Seconds since last shot. */
  fireAnim: number;
  /** Global time for idle animations. */
  time: number;
  /** Attack is "on" (beams, flames). */
  active?: boolean;
  /**
   * 'static' draws only parts that never move (cached as a sprite), 'dynamic'
   * only the animated parts, 'all' everything.
   */
  layer?: 'static' | 'dynamic' | 'all';
}

const WOOD = '#9a6a45';
const DARKWOOD = '#6e4a33';
const METAL = '#6f7480';
const GOLD = '#e8c25a';

type ModelFn = (p: Painter, l: TowerLook, v: TowerVisual, cx: number, cy: number, z: number) => void;

/** Crenellations around a circle. */
function crenels(p: Painter, cx: number, cy: number, z: number, r: number, n: number, color: string, size = 0.07): void {
  // Draw back ones first (smaller y first).
  const items: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    items.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  items.sort((a, b) => a.y + a.x * 0.6 - (b.y + b.x * 0.6));
  for (const it of items) p.cbox(it.x, it.y, z, size, size, size * 1.1, color);
}

/** Stone base. Its trim shows the tier: none, silver, gold, then the branch colour. */
let currentTier = 1;
let currentTrim = '#c0c6d4';
function plinth(p: Painter, cx: number, cy: number, z: number, color: string, w = 0.78): number {
  p.shadow(cx, cy, z, 0.46, 0.18);
  p.cbox(cx, cy, z, w, w, 0.08, shade(color, -0.12));
  if (currentTier >= 2) {
    const trim = currentTier >= 4 ? currentTrim : currentTier === 3 ? '#e8c25a' : '#c9d0dc';
    // Coloured band around the edge, stone in the middle.
    p.cbox(cx, cy, z + 0.08, w - 0.02, w - 0.02, 0.025, trim);
    p.cbox(cx, cy, z + 0.081, w - 0.16, w - 0.16, 0.025, shade(color, -0.05));
    if (currentTier >= 3) {
      // Corner studs
      for (const [dx, dy] of [
        [-1, 1],
        [1, 1],
        [1, -1],
      ])
        p.cbox(cx + dx * (w / 2 - 0.06), cy + dy * (w / 2 - 0.06), z + 0.105, 0.06, 0.06, 0.04, trim);
    }
    return z + 0.105;
  }
  return z + 0.08;
}

let layerMode: NonNullable<TowerLook['layer']> = 'all';

/** Marks animated parts of a model. */
function dyn(p: Painter, fn: () => void): void {
  const prev = p.enabled;
  if (layerMode !== 'all') p.enabled = layerMode === 'dynamic';
  fn();
  p.enabled = prev;
}

function glowOrb(p: Painter, cx: number, cy: number, z: number, r: number, color: string, time: number): void {
  dyn(p, () => {
    const bob = Math.sin(time * 2.4) * 0.04;
    p.sphere(cx, cy, z + bob, r, color, 0.6);
  });
}

function flag(p: Painter, x: number, y: number, z: number, w: number, h: number, color: string, wave: number): void {
  dyn(p, () => p.flag(x, y, z, w, h, color, wave));
}

const MODELS: Record<TowerId, ModelFn> = {
  // ---------------------------------------------------------------- Archer
  archer(p, l, v, cx, cy, z) {
    const stone = v.body;
    z = plinth(p, cx, cy, z, stone);
    const h = 0.5 + l.tier * 0.07 + (l.branch === 0 ? 0.18 : 0);
    const r = l.branch === 1 ? 0.3 : 0.26;
    p.cylinder(cx, cy, z, r + 0.03, 0.08, shade(stone, -0.06));
    p.cylinder(cx, cy, z + 0.08, r, h, stone);
    // Arrow slit
    p.box(cx - 0.03, cy + r * 0.92, z + h * 0.5, 0.06, 0.02, 0.14, shade(stone, -0.45), null, false);
    const top = z + 0.08 + h;
    p.cylinder(cx, cy, top, r + 0.07, 0.07, WOOD);
    if (l.tier >= 2) crenels(p, cx, cy, top + 0.07, r + 0.03, 7, shade(stone, 0.04));
    // Archer: tiny figure aiming
    dyn(p, () => {
      const ax = cx + Math.cos(l.angle) * 0.06;
      const ay = cy + Math.sin(l.angle) * 0.06;
      p.cbox(ax, ay, top + 0.07, 0.09, 0.09, 0.12, v.accent);
      p.sphere(ax, ay, top + 0.24, 0.05, '#f1c9a5');
      const recoil = Math.max(0, 1 - l.fireAnim * 6);
      p.line(
        [ax, ay, top + 0.17],
        [ax + Math.cos(l.angle) * (0.16 - recoil * 0.04), ay + Math.sin(l.angle) * (0.16 - recoil * 0.04), top + 0.17],
        DARKWOOD,
        0.025,
      );
    });
    if (l.branch === 0) {
      // Longbow: tall pointed roof on poles + banner
      p.cylinder(cx + 0.2, cy - 0.2, top + 0.07, 0.015, 0.45, DARKWOOD);
      flag(p, cx + 0.2, cy - 0.2, top + 0.5, 0.2, 0.13, v.accent, l.time * 3);
    } else if (l.branch === 1) {
      // Volley: extra arrow racks
      p.cbox(cx - 0.18, cy + 0.1, top + 0.07, 0.08, 0.14, 0.1, DARKWOOD);
      p.cbox(cx + 0.18, cy - 0.12, top + 0.07, 0.08, 0.14, 0.1, DARKWOOD);
      if (l.tier >= 5) flag(p, cx - 0.22, cy - 0.22, top + 0.45, 0.18, 0.12, v.accent, l.time * 3);
      if (l.tier >= 5) p.cylinder(cx - 0.22, cy - 0.22, top + 0.07, 0.015, 0.38, DARKWOOD);
    } else if (l.branch === 2) {
      glowOrb(p, cx, cy, top + 0.55, 0.07, v.fx, l.time);
      dyn(p, () => p.capRing(cx, cy, top + 0.4 + Math.sin(l.time * 2) * 0.03, 0.18, rgba(v.fx, 0.7), Math.max(1, p.cam.scale * 0.02)));
    }
    if (l.tier >= 3 && l.branch !== 2) {
      // Roof (dynamic so it stays above the archer figure)
      dyn(p, () => {
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ])
          p.cylinder(cx + dx * (r - 0.02), cy + dy * (r - 0.02), top + 0.07, 0.012, 0.23, DARKWOOD);
        p.cone(cx, cy, top + 0.3, r + 0.1, l.branch === 0 ? 0.42 : 0.3, v.accent);
      });
    }
  },

  // ---------------------------------------------------------------- Ballista
  ballista(p, l, v, cx, cy, z) {
    const stone = v.body;
    z = plinth(p, cx, cy, z, stone);
    const h = 0.22 + l.tier * 0.04;
    p.cbox(cx, cy, z, 0.66, 0.66, h, stone);
    if (l.tier >= 2) {
      for (const [dx, dy] of [
        [-0.28, -0.28],
        [0.28, -0.28],
        [0.28, 0.28],
        [-0.28, 0.28],
      ])
        p.cbox(cx + dx, cy + dy, z + h, 0.1, 0.1, 0.08, shade(stone, 0.05));
    }
    const top = z + h;
    p.cylinder(cx, cy, top, 0.18, 0.06, DARKWOOD);
    const a = l.angle;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const recoil = Math.max(0, 1 - l.fireAnim * 5) * 0.08;
    const len = l.branch === 0 ? 0.7 : 0.56;
    const sx = cx - ca * recoil;
    const sy = cy - sa * recoil;
    const z2 = top + 0.08;
    const stocks = l.branch === 1 ? [-0.07, 0.07] : [0];
    dyn(p, () => {
      for (const off of stocks) {
        const ox = -sa * off;
        const oy = ca * off;
        p.rbox(sx + ox, sy + oy, z2, len, 0.08, 0.06, a, WOOD);
        // Bow arms
        const fx = sx + ox + ca * len * 0.32;
        const fy = sy + oy + sa * len * 0.32;
        const bw = l.branch === 0 ? 0.32 : 0.24;
        p.line([fx - sa * bw, fy + ca * bw, z2 + 0.06], [fx + ca * 0.05, fy + sa * 0.05, z2 + 0.08], DARKWOOD, 0.03);
        p.line([fx + sa * bw, fy - ca * bw, z2 + 0.06], [fx + ca * 0.05, fy + sa * 0.05, z2 + 0.08], DARKWOOD, 0.03);
        // Loaded bolt
        if (l.fireAnim > 0.25)
          p.line([fx - ca * 0.3, fy - sa * 0.3, z2 + 0.09], [fx + ca * 0.12, fy + sa * 0.12, z2 + 0.09], l.branch === 2 ? v.accent : METAL, 0.022);
      }
    });
    if (l.branch === 0) p.cbox(cx - 0.24, cy + 0.2, top, 0.12, 0.12, 0.12, METAL);
    if (l.branch === 2) {
      // Chain spool
      p.cylinder(cx - 0.22, cy + 0.2, top, 0.08, 0.1, METAL);
      p.capRing(cx - 0.22, cy + 0.2, top + 0.1, 0.05, shade(METAL, -0.3), 1.5);
    }
    if (l.tier >= 5) flag(p, cx + 0.28, cy - 0.28, top + 0.45, 0.18, 0.12, v.accent, l.time * 3);
    if (l.tier >= 5) p.cylinder(cx + 0.28, cy - 0.28, top + 0.08, 0.012, 0.38, DARKWOOD);
  },

  // ---------------------------------------------------------------- Cannon
  cannon(p, l, v, cx, cy, z) {
    const stone = v.body;
    z = plinth(p, cx, cy, z, stone);
    const h = 0.26 + l.tier * 0.05;
    p.cylinder(cx, cy, z, 0.36, h, stone);
    if (l.tier >= 2) crenels(p, cx, cy, z + h, 0.32, 8, shade(stone, 0.04), 0.08);
    const top = z + h;
    p.cylinder(cx, cy, top, 0.2, 0.05, DARKWOOD);
    const a = l.angle;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const recoil = Math.max(0, 1 - l.fireAnim * 4) * 0.1;
    if (l.branch === 0) {
      // Mortar: fat tube pointing up
      p.cylinder(cx, cy, top + 0.05, 0.17, 0.2, METAL, '#2b2b33', 0.2);
      p.cylinder(cx, cy, top + 0.05, 0.19, 0.04, shade(METAL, -0.1));
    } else {
      dyn(p, () => {
        const bl = l.branch === 1 ? 0.36 : 0.44;
        const bx = cx + ca * (0.08 - recoil);
        const by = cy + sa * (0.08 - recoil);
        p.sphere(cx - ca * 0.05, cy - sa * 0.05, top + 0.14, 0.12, shade(METAL, -0.05));
        p.rbox(bx + ca * bl * 0.3, by + sa * bl * 0.3, top + 0.08, bl, l.branch === 1 ? 0.2 : 0.13, 0.12, a, METAL);
        if (l.branch === 1) p.rbox(bx + ca * bl * 0.75, by + sa * bl * 0.75, top + 0.06, 0.08, 0.28, 0.16, a, shade(METAL, -0.1));
      });
    }
    if (l.branch === 2) {
      for (const [dx, dy] of [
        [-0.24, 0.18],
        [-0.16, 0.25],
        [-0.22, 0.26],
      ])
        p.sphere(cx + dx, cy + dy, top + 0.1, 0.06, '#3a3a44');
    }
    if (l.tier >= 3 && l.branch !== 0) p.cbox(cx + 0.24, cy - 0.2, top, 0.12, 0.12, 0.1, WOOD);
    if (l.tier >= 5) {
      p.cylinder(cx - 0.25, cy - 0.22, top, 0.012, 0.4, DARKWOOD);
      flag(p, cx - 0.25, cy - 0.22, top + 0.4, 0.18, 0.12, v.accent, l.time * 3);
    }
  },

  // ---------------------------------------------------------------- Arcane
  arcane(p, l, v, cx, cy, z) {
    const stone = v.body;
    z = plinth(p, cx, cy, z, stone);
    const h = 0.55 + l.tier * 0.08;
    p.cylinder(cx, cy, z, 0.25, 0.1, shade(stone, -0.05));
    p.cylinder(cx, cy, z + 0.1, 0.2, h, stone, null, 0.17);
    // Window glow
    p.box(cx - 0.03, cy + 0.18, z + 0.1 + h * 0.55, 0.06, 0.02, 0.12, v.fx, null, false);
    const top = z + 0.1 + h;
    p.cylinder(cx, cy, top, 0.24, 0.05, shade(v.accent, -0.1));
    p.cone(cx, cy, top + 0.05, 0.24, 0.32 + l.tier * 0.03, v.accent);
    const oz = top + 0.55;
    dyn(p, () => {
      if (l.branch === 1) {
        glowOrb(p, cx, cy, oz + 0.05, 0.12, v.fx, l.time);
        p.sphere(cx, cy, oz + 0.05 + Math.sin(l.time * 2.4) * 0.04, 0.07, '#1a1030');
        p.capRing(cx, cy, oz, 0.22, rgba(v.fx, 0.8), Math.max(1, p.cam.scale * 0.025));
      } else {
        glowOrb(p, cx, cy, oz, l.branch === 0 ? 0.1 : 0.08, v.fx, l.time);
      }
      if (l.branch === 0 || l.tier >= 3) {
        const n = l.branch === 0 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const a = l.time * 1.6 + (i / n) * Math.PI * 2;
          p.sphere(cx + Math.cos(a) * 0.26, cy + Math.sin(a) * 0.26, oz - 0.05, 0.035, v.fx, 0.3);
        }
      }
      if (l.branch === 2) {
        for (let i = 0; i < 3; i++) {
          const a = -l.time * 1.2 + (i / 3) * Math.PI * 2;
          p.rbox(cx + Math.cos(a) * 0.3, cy + Math.sin(a) * 0.3, top - 0.2 + Math.sin(l.time * 2 + i) * 0.04, 0.09, 0.09, 0.015, a, v.fx);
        }
      }
    });
  },

  // ---------------------------------------------------------------- Pyre
  pyre(p, l, v, cx, cy, z) {
    const stone = v.body;
    z = plinth(p, cx, cy, z, stone);
    if (l.branch === 0) {
      // Inferno: obelisk with a burning crystal
      const h = 0.75 + l.tier * 0.06;
      p.frustum(cx, cy, z, 0.36, 0.2, h, stone);
      p.frustum(cx, cy, z + h, 0.2, 0.0, 0.12, shade(stone, -0.1));
      glowOrb(p, cx, cy, z + h + 0.32, 0.09, v.fx, l.time * 2);
      return;
    }
    if (l.branch === 2) {
      // Meteor: standing stones + floating molten rock
      for (const [dx, dy] of [
        [-0.26, -0.22],
        [0.26, -0.22],
        [0.26, 0.22],
        [-0.26, 0.22],
      ])
        p.cbox(cx + dx, cy + dy, z, 0.1, 0.1, 0.3 + l.tier * 0.04, stone);
      p.cap(cx, cy, z + 0.01, 0.2, rgba(v.fx, 0.35), false);
      dyn(p, () => {
        const bob = Math.sin(l.time * 1.8) * 0.06;
        p.sphere(cx, cy, z + 0.75 + bob, 0.16, '#5a2a2a', 0);
        p.sphere(cx + 0.03, cy, z + 0.78 + bob, 0.1, v.fx, 0.8);
      });
      return;
    }
    const h = 0.25 + l.tier * 0.05;
    p.cylinder(cx, cy, z, 0.16, h, stone);
    const bowlR = l.branch === 1 ? 0.36 : 0.3;
    p.cylinder(cx, cy, z + h, 0.18, 0.14, shade(stone, -0.1), '#3a2a28', bowlR);
    const fz = z + h + 0.14;
    const big = l.active ? 1.25 : 1;
    dyn(p, () => p.flame(cx, cy, fz - 0.02, bowlR * 0.72, 0.5 * big, l.time, l.branch === 1 ? '#ff9a2b' : '#ff6a2b', '#ffd25a'));
    if (l.branch === 1) {
      // Dragon horns
      p.cone(cx - 0.3, cy - 0.05, z + h + 0.08, 0.05, 0.3, '#efe3c8');
      p.cone(cx + 0.3, cy - 0.05, z + h + 0.08, 0.05, 0.3, '#efe3c8');
    }
  },

  // ---------------------------------------------------------------- Frost
  frost(p, l, v, cx, cy, z) {
    const ice = v.body;
    z = plinth(p, cx, cy, z, '#b8c4d4');
    const h = 0.35 + l.tier * 0.06;
    p.frustum(cx, cy, z, 0.42, 0.3, h, ice);
    const top = z + h;
    const cr = v.accent;
    if (l.branch === 0) {
      p.cone(cx - 0.1, cy, top, 0.12, 0.45, shade(cr, 0.25));
      p.cone(cx + 0.1, cy - 0.06, top, 0.1, 0.35, shade(cr, 0.35));
      p.cone(cx, cy + 0.08, top, 0.14, 0.6, shade(cr, 0.15));
    } else if (l.branch === 1) {
      p.cone(cx, cy, top, 0.15, 0.38, shade(cr, 0.3));
      dyn(p, () => {
        for (let i = 0; i < 6; i++) {
          const a = l.time * 2.2 + (i / 6) * Math.PI * 2;
          p.sphere(cx + Math.cos(a) * 0.32, cy + Math.sin(a) * 0.32, top + 0.15 + Math.sin(a * 2) * 0.05, 0.03, '#ffffff', 0.4);
        }
      });
    } else if (l.branch === 2) {
      p.cone(cx, cy, top, 0.1, 0.75, shade(cr, 0.3));
      const a = l.angle;
      dyn(p, () => p.rbox(cx + Math.cos(a) * 0.15, cy + Math.sin(a) * 0.15, top + 0.05, 0.36, 0.05, 0.05, a, shade(cr, 0.4)));
    } else {
      p.cone(cx, cy, top, 0.15, 0.32 + l.tier * 0.05, shade(cr, 0.3));
      if (l.tier >= 2) p.cone(cx + 0.14, cy + 0.04, top - 0.05, 0.07, 0.2, shade(cr, 0.45));
      if (l.tier >= 3) p.cone(cx - 0.13, cy - 0.04, top - 0.05, 0.07, 0.24, shade(cr, 0.4));
    }
    glowOrb(p, cx, cy, top + 0.1, 0.04, v.fx, l.time);
  },

  // ---------------------------------------------------------------- Storm
  storm(p, l, v, cx, cy, z) {
    const stone = v.body;
    z = plinth(p, cx, cy, z, stone);
    const h = 0.4 + l.tier * 0.06;
    p.cylinder(cx, cy, z, 0.26, h, stone);
    if (l.tier >= 2) p.cylinder(cx, cy, z + h * 0.45, 0.275, 0.05, METAL);
    if (l.tier >= 3) p.cylinder(cx, cy, z + h * 0.8, 0.275, 0.04, '#c98a4a');
    const top = z + h;
    if (l.branch === 2) {
      // Static: dome
      p.cylinder(cx, cy, top, 0.28, 0.05, METAL);
      p.sphere(cx, cy, top + 0.12, 0.22, v.accent, 0.4);
      return;
    }
    const coils = l.branch === 0 ? 4 : 3;
    for (let i = 0; i < coils; i++) p.cylinder(cx, cy, top + i * 0.09, 0.2 - i * 0.03, 0.05, i % 2 ? '#c98a4a' : '#b0723a');
    const rodTop = top + coils * 0.09;
    p.cylinder(cx, cy, rodTop, 0.025, 0.25, METAL);
    if (l.branch === 1) {
      // Thunder: little storm cloud
      dyn(p, () => {
        const bob = Math.sin(l.time * 1.5) * 0.04;
        p.sphere(cx - 0.12, cy, rodTop + 0.5 + bob, 0.13, '#9aa0b3');
        p.sphere(cx + 0.1, cy, rodTop + 0.52 + bob, 0.15, '#aab0c2');
        p.sphere(cx, cy, rodTop + 0.6 + bob, 0.14, '#c3c8d6');
      });
    } else {
      glowOrb(p, cx, cy, rodTop + 0.3, 0.08, v.fx, l.time * 3);
    }
  },

  // ---------------------------------------------------------------- Alchemist
  alchemist(p, l, v, cx, cy, z) {
    const wall = v.body;
    z = plinth(p, cx, cy, z, '#a89f8a');
    const h = 0.3 + l.tier * 0.04;
    p.box(cx - 0.3, cy - 0.28, z, 0.48, 0.42, h, wall);
    p.gable(cx - 0.34, cy - 0.32, z + h, 0.56, 0.5, 0.26, v.accent);
    // Chimney
    p.box(cx + 0.03, cy - 0.22, z + h + 0.05, 0.08, 0.08, 0.3, '#8a7f72');
    // Door
    p.box(cx - 0.12, cy + 0.14, z, 0.1, 0.005, 0.16, DARKWOOD, null, false);
    if (l.tier >= 2) {
      // Potion rack by the door
      p.box(cx - 0.33, cy + 0.12, z, 0.06, 0.2, 0.2, DARKWOOD);
      p.sphere(cx - 0.3, cy + 0.17, z + 0.24, 0.035, '#e05a8a');
      if (l.tier >= 3) p.sphere(cx - 0.3, cy + 0.26, z + 0.24, 0.035, '#5ab0e0');
    }
    // Cauldron
    const kx = cx + 0.24;
    const ky = cy + 0.2;
    p.cylinder(kx, ky, z, 0.14, 0.14, '#3b3640', null, 0.16);
    p.cap(kx, ky, z + 0.14, 0.13, v.fx, false);
    const bub = (l.time * 1.5) % 1;
    dyn(p, () => p.sphere(kx + 0.03, ky, z + 0.16 + bub * 0.2, 0.03 * (1 - bub), v.fx));
    if (l.branch === 1) {
      p.cylinder(cx - 0.3, cy + 0.24, z, 0.07, 0.3, '#c9c9a0', v.fx);
    } else if (l.branch === 2) {
      p.sphere(cx - 0.05, cy - 0.05, z + h + 0.5, 0.08, GOLD, 0.5);
    } else if (l.branch === 0) {
      dyn(p, () => {
        if (!p.enabled) return;
        p.ctx.globalAlpha = 0.8 * (1 - bub);
        p.sphere(cx + 0.07, cy - 0.18, z + h + 0.45 + bub * 0.2, 0.06, v.fx);
        p.ctx.globalAlpha = 1;
      });
    }
  },

  // ---------------------------------------------------------------- Sanctum
  sanctum(p, l, v, cx, cy, z) {
    const marble = v.body;
    z = plinth(p, cx, cy, z, '#cfc8b8', 0.82);
    p.cbox(cx, cy, z, 0.66, 0.66, 0.08, marble);
    const ch = 0.32 + l.tier * 0.05;
    const cols = [
      [-0.24, -0.24],
      [0.24, -0.24],
      [-0.24, 0.24],
      [0.24, 0.24],
    ];
    p.cylinder(cx, cy, z + 0.08, 0.14, ch * 0.6, shade(marble, -0.05));
    for (const [dx, dy] of cols) p.cylinder(cx + dx, cy + dy, z + 0.08, 0.045, ch, marble);
    const top = z + 0.08 + ch;
    p.cbox(cx, cy, top, 0.66, 0.66, 0.06, marble);
    if (l.branch === 0) {
      p.pyramid(cx - 0.33, cy - 0.33, top + 0.06, 0.66, 0.66, 0.22, v.accent);
      p.cylinder(cx, cy, top + 0.2, 0.08, 0.3, marble);
      p.cone(cx, cy, top + 0.5, 0.1, 0.3, v.accent);
    } else {
      p.pyramid(cx - 0.33, cy - 0.33, top + 0.06, 0.66, 0.66, 0.2, v.accent);
    }
    const hz = top + 0.55 + Math.sin(l.time * 2) * 0.03;
    dyn(p, () => {
      if (l.branch === 1) {
        p.sphere(cx, cy, hz + 0.1, 0.12, '#fff2b0', 1.2);
      } else if (l.branch === 2) {
        p.sphere(cx, cy, hz, 0.09, v.fx, 0.8);
        p.sphere(cx, cy + 0.02, hz, 0.04, '#24456b');
      }
      p.capRing(cx, cy, hz - 0.08, 0.2, rgba(GOLD, 0.9), Math.max(1.2, p.cam.scale * 0.03));
    });
  },

  // ---------------------------------------------------------------- Obelisk
  obelisk(p, l, v, cx, cy, z) {
    const stone = v.body;
    z = plinth(p, cx, cy, z, '#6d6680');
    const h = 0.75 + l.tier * 0.09;
    p.frustum(cx, cy, z, 0.34, 0.22, h, stone);
    p.frustum(cx, cy, z + h, 0.22, 0.0, 0.18, shade(stone, 0.05));
    dyn(p, () => {
      if (l.tier >= 2) {
        const n = l.tier >= 3 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const a = l.time * 0.8 + (i / n) * Math.PI * 2;
          p.rbox(cx + Math.cos(a) * 0.32, cy + Math.sin(a) * 0.32, z + 0.25 + Math.sin(l.time * 2 + i) * 0.05, 0.08, 0.08, 0.1, a, shade(stone, 0.1));
        }
      }
      // Rune glow on the front face
      const glow = 0.55 + Math.sin(l.time * 3) * 0.25;
      p.box(cx - 0.03, cy + 0.155, z + h * 0.3, 0.06, 0.005, h * 0.45, rgba(v.fx, glow), null, false);
      const oz = z + h + 0.45;
      if (l.branch === 0) {
        for (let i = 0; i < 3; i++) {
          const a = l.time * 2 + (i / 3) * Math.PI * 2;
          p.sphere(cx + Math.cos(a) * 0.3, cy + Math.sin(a) * 0.3, oz - 0.3 + Math.sin(a * 2) * 0.05, 0.045, v.fx, 0.6);
        }
      } else if (l.branch === 2) {
        p.capRing(cx, cy, oz - 0.1, 0.22, rgba(v.fx, 0.9), Math.max(1.5, p.cam.scale * 0.04));
        p.sphere(cx, cy, oz - 0.1, 0.08, '#160c2b', 0.2);
      } else {
        glowOrb(p, cx, cy, oz - 0.15, l.branch === 1 ? 0.09 : 0.06, v.fx, l.time);
      }
    });
  },
};

/** Draws a tower model with its base at (cx, cy, z). */
export function drawTowerModel(p: Painter, l: TowerLook, cx: number, cy: number, z: number): void {
  const def = TOWERS[l.id];
  const v = l.branch >= 0 ? def.branches[l.branch].visual : def.visual;
  currentTier = l.tier;
  currentTrim = v.accent;
  layerMode = l.layer ?? 'all';
  const prev = p.enabled;
  p.enabled = layerMode !== 'dynamic';
  MODELS[l.id](p, l, v, cx, cy, z);
  p.enabled = prev;
  layerMode = 'all';
}
