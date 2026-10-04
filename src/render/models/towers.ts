import { TOWERS } from '../../data/towers';
import type { TowerId, TowerVisual } from '../../data/types';
import { rgba, shade } from '../color';
import type { Painter } from '../painter';
import { ball, curve, limb as kitLimb, poly, type V3 } from './kit';

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
  items.sort((a, b) => a.y + a.x - (b.y + b.x));
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

// ---------------------------------------------------------------- naval helpers

/** Water surface relative to a naval tower's nominal base z. */
const SINK = 0.28;

/** Wooden pilings and a planked deck standing in the water. Returns the deck top z. */
function pier(p: Painter, cx: number, cy: number, z: number, w = 0.82): number {
  const WATER_Z = z - SINK;
  const deck = z - 0.04;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    p.cylinder(cx + dx * (w / 2 - 0.06), cy + dy * (w / 2 - 0.06), WATER_Z, 0.045, deck - WATER_Z, DARKWOOD);
  p.cbox(cx, cy, deck, w, w, 0.06, WOOD, shade(WOOD, 0.12));
  // Plank seams
  const ctx = p.ctx;
  if (p.enabled && p.detail) {
    ctx.strokeStyle = rgba(shade(WOOD, -0.45), 0.4);
    ctx.lineWidth = Math.max(0.5, p.cam.scale * 0.01);
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      const t = -w / 2 + (i / 6) * w;
      ctx.moveTo(p.cam.sx(cx + t, cy - w / 2), p.cam.sy(cx + t, cy - w / 2, deck + 0.06));
      ctx.lineTo(p.cam.sx(cx + t, cy + w / 2), p.cam.sy(cx + t, cy + w / 2, deck + 0.06));
    }
    ctx.stroke();
  }
  if (currentTier >= 2) {
    const trim = currentTier >= 4 ? currentTrim : currentTier === 3 ? GOLD : '#c9d0dc';
    p.cbox(cx, cy + w / 2 - 0.02, deck + 0.06, w, 0.03, 0.03, trim);
    p.cbox(cx + w / 2 - 0.02, cy, deck + 0.06, 0.03, w, 0.03, trim);
  }
  return deck + 0.06;
}

/** Animated ripples where something meets the water. */
function waterRing(p: Painter, cx: number, cy: number, r: number, time: number, WATER_Z: number): void {
  dyn(p, () => {
    for (let i = 0; i < 2; i++) {
      const ph = (time * 0.5 + i * 0.5) % 1;
      p.ring(cx, cy, WATER_Z + 0.005, r + ph * 0.25, `rgba(255,255,255,${0.55 * (1 - ph)})`, Math.max(1, p.cam.scale * 0.02));
    }
  });
}

/** Small deck cannon aimed along `angle`. */
function deckCannon(p: Painter, x: number, y: number, z: number, angle: number, fire: number, scale = 1): void {
  const recoil = Math.max(0, 1 - fire * 5) * 0.05;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  p.cbox(x, y, z, 0.16 * scale, 0.16 * scale, 0.06 * scale, DARKWOOD);
  const bx = x - c * recoil;
  const by = y - s * recoil;
  kitLimb(
    p,
    [bx - c * 0.06 * scale, by - s * 0.06 * scale, z + 0.1 * scale],
    [bx + c * 0.2 * scale, by + s * 0.2 * scale, z + 0.13 * scale],
    0.05 * scale,
    0.04 * scale,
    '#3c3f47',
    { shine: 0.6 },
  );
  ball(p, [bx - c * 0.07 * scale, by - s * 0.07 * scale, z + 0.1 * scale], 0.045 * scale, '#3c3f47');
}

/** Ship hull running across the screen; returns deck z. */
function hull(p: Painter, cx: number, cy: number, z: number, L: number, B: number, color: string, trim: string, WATER_Z: number): number {
  const ux = Math.SQRT1_2;
  const uy = -Math.SQRT1_2;
  const vx = Math.SQRT1_2;
  const vy = Math.SQRT1_2;
  const at = (a: number, b: number, zz: number): V3 => [cx + ux * a + vx * b, cy + uy * a + vy * b, zz];
  const deck = z + 0.02;
  const keelZ = WATER_Z + 0.02;
  const outline: [number, number][] = [
    [-L / 2, -B / 2],
    [L * 0.18, -B / 2],
    [L / 2, 0],
    [L * 0.18, B / 2],
    [-L / 2, B / 2],
  ];
  const keel = outline.map(([a, b]) => [a * 0.82 + (a > L * 0.3 ? 0.04 : 0), b * 0.5] as [number, number]);
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const [a0, b0] = outline[i];
    const [a1, b1] = outline[j];
    // Outward normal of the segment in local space → world.
    const na = b1 - b0;
    const nb = -(a1 - a0);
    const sgn = -1;
    const nx = (ux * na + vx * nb) * sgn;
    const ny = (uy * na + vy * nb) * sgn;
    p.face([at(a0, b0, deck), at(a1, b1, deck), at(keel[j][0], keel[j][1], keelZ), at(keel[i][0], keel[i][1], keelZ)], color, [nx, ny, -0.3]);
  }
  p.flat(
    outline.map(([a, b]) => {
      const q = at(a, b, deck);
      return [q[0], q[1]] as [number, number];
    }),
    deck,
    shade(WOOD, 0.15),
  );
  // Gunwale trim and portholes on the visible side
  curve(p, [at(-L / 2, B / 2, deck + 0.005), at(L * 0.18, B / 2, deck + 0.005), at(L / 2, 0, deck + 0.005)], trim, 0.03);
  for (let i = 0; i < 3; i++) ball(p, at(-L * 0.3 + i * L * 0.2, B / 2 - 0.02, deck - 0.08), 0.022, '#2a2024', { line: false });
  return deck;
}

function sail(p: Painter, x: number, y: number, z: number, w: number, h: number, color: string, stripe: string, billow: number): void {
  const ux = Math.SQRT1_2;
  const uy = -Math.SQRT1_2;
  const vx = Math.SQRT1_2 * billow;
  const vy = Math.SQRT1_2 * billow;
  const pts: V3[] = [
    [x - ux * w, y - uy * w, z + h],
    [x + ux * w, y + uy * w, z + h],
    [x + ux * w * 0.92 + vx, y + uy * w * 0.92 + vy, z + h * 0.45],
    [x + ux * w, y + uy * w, z],
    [x - ux * w, y - uy * w, z],
    [x - ux * w * 0.92 + vx, y - uy * w * 0.92 + vy, z + h * 0.45],
  ];
  poly(p, pts, color, { smooth: false, grad: [shade(color, 0.08), shade(color, -0.18)] });
  poly(
    p,
    [
      [x - ux * w * 0.96 + vx * 0.7, y - uy * w * 0.96 + vy * 0.7, z + h * 0.62],
      [x + ux * w * 0.96 + vx * 0.7, y + uy * w * 0.96 + vy * 0.7, z + h * 0.62],
      [x + ux * w * 0.96 + vx * 0.7, y + uy * w * 0.96 + vy * 0.7, z + h * 0.45],
      [x - ux * w * 0.96 + vx * 0.7, y - uy * w * 0.96 + vy * 0.7, z + h * 0.45],
    ],
    stripe,
    { line: false },
  );
}

// ---------------------------------------------------------------- architectural details

const WARM = '#ffcf6a';

/** Arched opening (door / window) on a round wall facing angle `a` (π/4 looks at the camera). */
function archOnCylinder(
  p: Painter,
  cx: number,
  cy: number,
  r: number,
  a: number,
  z: number,
  w: number,
  h: number,
  fill: string,
  frame = shade('#8a7f72', -0.1),
): void {
  if (!p.enabled) return;
  const tx = -Math.sin(a);
  const ty = Math.cos(a);
  const ox = cx + Math.cos(a) * (r + 0.004);
  const oy = cy + Math.sin(a) * (r + 0.004);
  const shape = (k: number, lift: number): V3[] => {
    const hw = (w / 2) * k;
    const pts: V3[] = [
      [ox - tx * hw, oy - ty * hw, z - lift],
      [ox + tx * hw, oy + ty * hw, z - lift],
    ];
    const top = z + h * k - hw;
    for (let i = 0; i <= 6; i++) {
      const t = (i / 6) * Math.PI;
      pts.push([ox + tx * Math.cos(t) * hw, oy + ty * Math.cos(t) * hw, top + Math.sin(t) * hw]);
    }
    return pts;
  };
  poly(p, shape(1.3, 0.012), frame, { line: false });
  poly(p, shape(1, 0), fill, { line: false, grad: [shade(fill, 0.15), shade(fill, -0.2)] });
}

/** Wooden door with iron studs on a round wall. */
function doorOnCylinder(p: Painter, cx: number, cy: number, r: number, z: number, w = 0.13, h = 0.2): void {
  archOnCylinder(p, cx, cy, r, Math.PI / 4, z, w, h, DARKWOOD);
  if (!p.enabled) return;
  const a = Math.PI / 4;
  const ox = cx + Math.cos(a) * (r + 0.008);
  const oy = cy + Math.sin(a) * (r + 0.008);
  ball(p, [ox + 0.02, oy - 0.02, z + h * 0.45], 0.012, GOLD, { line: false });
  curve(
    p,
    [
      [ox - Math.sin(a) * w * 0.4, oy + Math.cos(a) * w * 0.4, z + h * 0.3],
      [ox + Math.sin(a) * w * 0.4, oy - Math.cos(a) * w * 0.4, z + h * 0.3],
    ],
    '#3a3a44',
    0.012,
  );
}

/** Lit window on a round wall. */
function windowOnCylinder(p: Painter, cx: number, cy: number, r: number, a: number, z: number, glow = WARM, w = 0.07, h = 0.12): void {
  archOnCylinder(p, cx, cy, r, a, z, w, h, glow);
}

/** Opening on the +y (left-front, along x) or +x (right-front, along y) face of a box. */
function archOnFace(p: Painter, x: number, y: number, z: number, faceX: boolean, w: number, h: number, fill: string, frame = '#7a7064'): void {
  if (!p.enabled) return;
  const shape = (k: number, lift: number): V3[] => {
    const hw = (w / 2) * k;
    const at = (t: number, zz: number): V3 => (faceX ? [x + 0.004, y + t, zz] : [x + t, y + 0.004, zz]);
    const pts: V3[] = [at(-hw, z - lift), at(hw, z - lift)];
    const top = z + h * k - hw;
    for (let i = 0; i <= 6; i++) {
      const t = (i / 6) * Math.PI;
      pts.push(at(Math.cos(t) * hw, top + Math.sin(t) * hw));
    }
    return pts;
  };
  poly(p, shape(1.3, 0.012), frame, { line: false });
  poly(p, shape(1, 0), fill, { line: false, grad: [shade(fill, 0.15), shade(fill, -0.2)] });
}

/** Swallow-tailed banner hanging flat against a wall; `faceX` = on the +x face. */
function banner(p: Painter, x: number, y: number, z: number, faceX: boolean, w: number, h: number, color: string, emblem: string): void {
  if (!p.enabled) return;
  const at = (t: number, zz: number): V3 => (faceX ? [x + 0.006, y + t, zz] : [x + t, y + 0.006, zz]);
  const hw = w / 2;
  poly(p, [at(-hw, z), at(hw, z), at(hw, z - h), at(0, z - h * 0.78), at(-hw, z - h)], color, { grad: [shade(color, 0.12), shade(color, -0.25)] });
  curve(p, [at(-hw - 0.02, z + 0.005), at(hw + 0.02, z + 0.005)], DARKWOOD, 0.02);
  ball(p, at(0, z - h * 0.4), w * 0.22, emblem, { line: false });
}

function barrel(p: Painter, x: number, y: number, z: number, r = 0.06, h = 0.12): void {
  p.cylinder(x, y, z, r * 0.9, h * 0.5, WOOD, null, r);
  p.cylinder(x, y, z + h * 0.5, r, h * 0.5, WOOD, shade(WOOD, 0.12), r * 0.9);
  p.capRing(x, y, z + h * 0.2, r * 0.97, '#4a4a52', Math.max(0.8, p.cam.scale * 0.012));
  p.capRing(x, y, z + h * 0.8, r * 0.97, '#4a4a52', Math.max(0.8, p.cam.scale * 0.012));
}

function crate(p: Painter, x: number, y: number, z: number, s = 0.12): void {
  p.cbox(x, y, z, s, s, s, WOOD, shade(WOOD, 0.15));
  if (!p.enabled) return;
  curve(
    p,
    [
      [x - s / 2, y + s / 2 + 0.003, z],
      [x + s / 2, y + s / 2 + 0.003, z + s],
    ],
    DARKWOOD,
    0.012,
  );
  curve(
    p,
    [
      [x + s / 2 + 0.003, y + s / 2, z],
      [x + s / 2 + 0.003, y - s / 2, z + s],
    ],
    DARKWOOD,
    0.012,
  );
}

/** Pyramid of cannonballs. */
function shotPile(p: Painter, x: number, y: number, z: number): void {
  const r = 0.035;
  for (const [dx, dy, dz] of [
    [-r, -r, 0],
    [r, -r, 0],
    [-r, r, 0],
    [r, r, 0],
    [0, 0, r * 1.4],
  ])
    ball(p, [x + dx, y + dy, z + r + dz], r, '#3c3f47', { shine: 0.5 });
}

/** Small tufts of grass and pebbles hugging the plinth (static). */
function groundClutter(p: Painter, cx: number, cy: number, z: number, seed: number): void {
  if (!p.enabled || !p.detail) return;
  const pts = [
    [0.38, 0.22],
    [0.2, 0.4],
    [-0.36, 0.36],
    [0.4, -0.32],
  ];
  pts.forEach(([dx, dy], i) => {
    if ((seed * 7 + i * 13) % 5 > 2) return;
    ball(p, [cx + dx, cy + dy, z + 0.02], 0.028, i % 2 ? '#8f8a98' : '#a9a3b2');
    curve(
      p,
      [
        [cx + dx + 0.03, cy + dy + 0.02, z],
        [cx + dx + 0.04, cy + dy + 0.03, z + 0.07],
      ],
      '#5f9e43',
      0.012,
    );
    curve(
      p,
      [
        [cx + dx + 0.05, cy + dy, z],
        [cx + dx + 0.08, cy + dy - 0.01, z + 0.06],
      ],
      '#6cb85a',
      0.012,
    );
  });
}

/** Jagged electric arc between two points (dynamic). */
function arc(p: Painter, a: V3, b: V3, color: string, t: number): void {
  const pts: V3[] = [a];
  for (let i = 1; i < 5; i++) {
    const k = i / 5;
    const j = Math.sin(t * 37 + i * 12.7) * 0.05;
    pts.push([a[0] + (b[0] - a[0]) * k + j, a[1] + (b[1] - a[1]) * k - j, a[2] + (b[2] - a[2]) * k + Math.cos(t * 29 + i * 5.3) * 0.05]);
  }
  pts.push(b);
  const ctx = p.ctx;
  ctx.beginPath();
  pts.forEach(([x, y, zz], i) => (i === 0 ? ctx.moveTo(p.cam.sx(x, y), p.cam.sy(x, y, zz)) : ctx.lineTo(p.cam.sx(x, y), p.cam.sy(x, y, zz))));
  ctx.strokeStyle = rgba(color, 0.45);
  ctx.lineWidth = Math.max(2, p.cam.scale * 0.05);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1, p.cam.scale * 0.015);
  ctx.stroke();
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
    p.cylinderBricks(cx, cy, z + 0.08, r, h, stone, 0.1, 7);
    groundClutter(p, cx, cy, z - 0.08, 1);
    doorOnCylinder(p, cx, cy, r, z + 0.08, 0.12, 0.19);
    windowOnCylinder(p, cx, cy, r, Math.PI / 4, z + 0.08 + h * 0.62, l.tier >= 2 ? WARM : '#3a2f2a', 0.06, 0.11);
    if (l.tier >= 3) {
      windowOnCylinder(p, cx, cy, r, 0.12, z + 0.08 + h * 0.4, '#3a2f2a', 0.04, 0.12);
      windowOnCylinder(p, cx, cy, r, Math.PI / 2 - 0.12, z + 0.08 + h * 0.4, '#3a2f2a', 0.04, 0.12);
    }
    const top = z + 0.08 + h;
    if (l.tier >= 2) {
      // Hanging banner below the parapet
      const a = Math.PI / 4 + 0.75;
      banner(p, cx + Math.cos(a) * r * 0.95 - 0.06, cy + Math.sin(a) * r, top - 0.03, false, 0.11, 0.22, v.accent, GOLD);
    }
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
        p.roofCone(cx, cy, top + 0.3, r + 0.1, l.branch === 0 ? 0.46 : 0.34, v.accent, 4);
      });
    }
  },

  // ---------------------------------------------------------------- Ballista
  ballista(p, l, v, cx, cy, z) {
    const stone = v.body;
    z = plinth(p, cx, cy, z, stone);
    const h = 0.22 + l.tier * 0.04;
    p.cbox(cx, cy, z, 0.66, 0.66, h, stone);
    p.boxBricks(cx - 0.33, cy - 0.33, z, 0.66, 0.66, h, stone, 0.09, 0.17);
    groundClutter(p, cx, cy, z - 0.08, 2);
    archOnFace(p, cx - 0.1, cy + 0.33, z, false, 0.13, Math.min(0.2, h - 0.03), DARKWOOD);
    archOnFace(p, cx + 0.33, cy - 0.12, z + h * 0.35, true, 0.035, Math.min(0.12, h * 0.5), '#2a2420');
    archOnFace(p, cx + 0.33, cy + 0.12, z + h * 0.35, true, 0.035, Math.min(0.12, h * 0.5), '#2a2420');
    if (l.tier >= 3) banner(p, cx + 0.33, cy, z + h - 0.02, true, 0.12, Math.min(0.24, h * 0.75), v.accent, GOLD);
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
    if (l.tier >= 2 && l.branch !== 2) {
      // Bolt rack
      crate(p, cx + 0.22, cy + 0.22, top, 0.11);
      for (let i = 0; i < 3; i++)
        kitLimb(p, [cx + 0.19 + i * 0.03, cy + 0.2, top + 0.1], [cx + 0.17 + i * 0.03, cy + 0.26, top + 0.24], 0.008, 0.008, METAL);
    }
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
    p.cylinderBricks(cx, cy, z, 0.36, h, stone, 0.1, 9);
    groundClutter(p, cx, cy, z - 0.08, 3);
    doorOnCylinder(p, cx, cy, 0.36, z, 0.13, Math.min(0.2, h - 0.04));
    archOnCylinder(p, cx, cy, 0.36, 0.05, z + h * 0.45, 0.07, 0.07, '#22201f');
    archOnCylinder(p, cx, cy, 0.36, Math.PI / 2 - 0.05, z + h * 0.45, 0.07, 0.07, '#22201f');
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
    if (l.tier >= 3 && l.branch !== 0) barrel(p, cx + 0.24, cy - 0.2, top, 0.06, 0.12);
    if (l.tier >= 2 && l.branch !== 2) shotPile(p, cx - 0.2, cy + 0.2, top);
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
    p.cylinderBricks(cx, cy, z + 0.1, 0.185, h, stone, 0.12, 6);
    groundClutter(p, cx, cy, z - 0.08, 4);
    doorOnCylinder(p, cx, cy, 0.2, z + 0.1, 0.1, 0.16);
    windowOnCylinder(p, cx, cy, 0.18, Math.PI / 4, z + 0.1 + h * 0.58, v.fx, 0.06, 0.13);
    if (l.tier >= 2) {
      windowOnCylinder(p, cx, cy, 0.185, 0.15, z + 0.1 + h * 0.32, v.fx, 0.045, 0.1);
      windowOnCylinder(p, cx, cy, 0.185, Math.PI / 2 - 0.15, z + 0.1 + h * 0.32, v.fx, 0.045, 0.1);
    }
    // Glowing rune band
    dyn(p, () => p.capRing(cx, cy, z + 0.1 + h * 0.82, 0.185, rgba(v.fx, 0.55 + Math.sin(l.time * 3) * 0.25), Math.max(1, p.cam.scale * 0.025)));
    const top = z + 0.1 + h;
    p.cylinder(cx, cy, top, 0.24, 0.05, shade(v.accent, -0.1));
    p.roofCone(cx, cy, top + 0.05, 0.24, 0.34 + l.tier * 0.03, v.accent, 3);
    // Gold stars on the roof
    if (l.tier >= 2) for (const a of [0.2, 1.3]) ball(p, [cx + Math.cos(a) * 0.12, cy + Math.sin(a) * 0.12, top + 0.15], 0.02, GOLD, { line: false });
    ball(p, [cx, cy, top + 0.05 + 0.34 + l.tier * 0.03], 0.025, GOLD);
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
    groundClutter(p, cx, cy, z - 0.08, 5);
    p.cylinder(cx, cy, z, 0.22, 0.06, shade(stone, -0.1));
    p.cylinder(cx, cy, z, 0.16, h, stone);
    // Ember runes carved in the pillar
    dyn(p, () => {
      const g = 0.5 + Math.sin(l.time * 4) * 0.3;
      archOnCylinder(p, cx, cy, 0.16, Math.PI / 4, z + h * 0.3, 0.05, h * 0.45, rgba('#ff8a3d', g), 'rgba(0,0,0,0)');
    });
    // Coal heap and chains
    for (let i = 0; i < 4; i++) ball(p, [cx + 0.22 + (i % 2) * 0.05, cy + 0.18 + i * 0.025, z + 0.025 + (i > 1 ? 0.03 : 0)], 0.035, '#2e2826');
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
    // Ice shards breaking out of the ground
    for (const [dx, dy, s2] of [
      [-0.32, 0.3, 0.16],
      [0.3, 0.32, 0.12],
      [0.34, -0.26, 0.18],
    ])
      p.cone(cx + dx, cy + dy, z, 0.05, s2 + l.tier * 0.02, shade(v.accent, 0.35));
    p.frustum(cx, cy, z, 0.42, 0.3, h, ice);
    // Frosted edge and a carved snowflake
    p.capRing(cx, cy, z + h + 0.002, 0.19, rgba('#ffffff', 0.7), Math.max(1, p.cam.scale * 0.02));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      curve(
        p,
        [
          [cx + 0.211, cy + 0.06 + Math.cos(a) * 0.06, z + h * 0.5 + Math.sin(a) * 0.06],
          [cx + 0.211, cy + 0.06 - Math.cos(a) * 0.06, z + h * 0.5 - Math.sin(a) * 0.06],
        ],
        '#ffffff',
        0.012,
        0.8,
      );
    }
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
    p.cylinderBricks(cx, cy, z, 0.26, h, stone, 0.1, 7);
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
    doorOnCylinder(p, cx, cy, 0.26, z, 0.12, 0.18);
    windowOnCylinder(p, cx, cy, 0.26, Math.PI / 4, z + h * 0.62, '#bfe9ff', 0.05, 0.1);
    // Copper lightning rods around the crown
    for (const a of [0.2, 1.4, 2.6, 3.8, 5]) p.cylinder(cx + Math.cos(a) * 0.22, cy + Math.sin(a) * 0.22, top, 0.012, 0.16, '#c98a4a');
    dyn(p, () => {
      const t = Math.floor(l.time * 12);
      if (t % 3 === 0) {
        const a = (t * 2.3) % (Math.PI * 2);
        arc(p, [cx + Math.cos(a) * 0.22, cy + Math.sin(a) * 0.22, top + 0.16], [cx, cy, rodTop + 0.22], v.fx, l.time);
      }
    });
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
    // Timber framing
    p.line([cx - 0.3, cy + 0.14, z + h * 0.55], [cx + 0.18, cy + 0.14, z + h * 0.55], DARKWOOD, 0.018);
    p.line([cx + 0.18, cy + 0.14, z + h * 0.55], [cx + 0.18, cy - 0.28, z + h * 0.55], DARKWOOD, 0.018);
    p.line([cx + 0.18, cy + 0.14, z], [cx + 0.18, cy + 0.14, z + h], DARKWOOD, 0.02);
    p.gable(cx - 0.34, cy - 0.32, z + h, 0.56, 0.5, 0.26, v.accent);
    // Chimney
    p.box(cx + 0.03, cy - 0.22, z + h + 0.05, 0.08, 0.08, 0.3, '#8a7f72');
    // Door and a lit window
    archOnFace(p, cx - 0.08, cy + 0.14, z, false, 0.1, 0.18, DARKWOOD);
    archOnFace(p, cx + 0.18, cy - 0.05, z + h * 0.45, true, 0.09, 0.1, WARM);
    groundClutter(p, cx, cy, z - 0.08, 6);
    barrel(p, cx - 0.36, cy - 0.12, z, 0.05, 0.1);
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
    p.capRing(kx, ky, z + 0.13, 0.155, '#5a5462', Math.max(1, p.cam.scale * 0.02));
    dyn(p, () => {
      for (let i = 0; i < 3; i++) {
        const b = (bub + i / 3) % 1;
        p.sphere(kx + Math.cos(i * 2.1) * 0.05, ky + Math.sin(i * 2.1) * 0.05, z + 0.15 + b * 0.22, 0.028 * (1 - b), shade(v.fx, 0.2));
      }
      // Chimney smoke
      if (p.enabled) {
        const sm = (l.time * 0.4) % 1;
        p.ctx.globalAlpha = 0.45 * (1 - sm);
        p.sphere(cx + 0.07 - sm * 0.1, cy - 0.18, z + h + 0.4 + sm * 0.35, 0.05 + sm * 0.06, '#d8d4dc');
        p.ctx.globalAlpha = 1;
      }
    });
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
    // Front steps
    p.cbox(cx, cy + 0.36, z - 0.04, 0.3, 0.08, 0.04, shade(marble, -0.04));
    groundClutter(p, cx, cy, z - 0.08, 7);
    if (l.tier >= 3) {
      for (const [dx, dy] of [
        [0.36, 0.36],
        [-0.36, 0.36],
      ]) {
        p.cylinder(cx + dx * 0.95, cy + dy * 0.95, z - 0.08, 0.035, 0.22, shade(marble, -0.08));
        p.cylinder(cx + dx * 0.95, cy + dy * 0.95, z + 0.14, 0.05, 0.03, GOLD);
        dyn(p, () => p.flame(cx + dx * 0.95, cy + dy * 0.95, z + 0.17, 0.035, 0.1, l.time + dx * 3, '#ffcf6a', '#fff6c8'));
      }
    }
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
    groundClutter(p, cx, cy, z - 0.08, 8);
    dyn(p, () => {
      p.ctx.setLineDash([3, 4]);
      p.ctx.lineDashOffset = -l.time * 10;
      p.capRing(cx, cy, z + 0.005, 0.33, rgba(v.fx, 0.65), Math.max(1, p.cam.scale * 0.02));
      p.ctx.setLineDash([]);
    });
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
  // ---------------------------------------------------------------- Harbor (naval)
  harbor(p, l, v, cx, cy, z) {
    const accent = v.accent;
    const WATER_Z = z - SINK;
    if (l.branch === 0) {
      // Galleon: a full warship moored on the spot.
      waterRing(p, cx, cy, 0.5, l.time, WATER_Z);
      p.shadow(cx, cy, WATER_Z, 0.55, 0.2);
      const deck = hull(p, cx, cy, z + 0.02, 1.2, 0.48, v.body, GOLD, WATER_Z);
      const ux = Math.SQRT1_2;
      const uy = -Math.SQRT1_2;
      // Stern castle
      p.cbox(cx - ux * 0.36, cy - uy * 0.36, deck, 0.22, 0.22, 0.14, shade(v.body, 0.05));
      const masts = l.tier >= 5 ? [-0.12, 0.2] : [0.05];
      for (const m of masts) {
        const mx = cx + ux * m;
        const my = cy + uy * m;
        p.cylinder(mx, my, deck, 0.025, 0.95, DARKWOOD);
        sail(p, mx, my, deck + 0.3, 0.2, 0.5, '#f4ecdc', accent, 0.06);
        flag(p, mx, my, deck + 1.0, 0.18, 0.1, accent, l.time * 3);
      }
      dyn(p, () => {
        deckCannon(p, cx + ux * 0.32, cy + uy * 0.32, deck, l.angle, l.fireAnim, 0.8);
        deckCannon(p, cx - ux * 0.14 + 0.08, cy - uy * 0.14 + 0.08, deck, l.angle, l.fireAnim + 0.1, 0.8);
      });
      return;
    }
    waterRing(p, cx, cy, 0.45, l.time, WATER_Z);
    const deck = pier(p, cx, cy, z);
    if (l.branch === 2) {
      // Lighthouse: striped tower with a lantern
      const h = 0.95 + (l.tier - 4) * 0.12;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const z0 = deck + (h / n) * i;
        const r0 = 0.24 - (0.08 * i) / n;
        const r1 = 0.24 - (0.08 * (i + 1)) / n;
        p.cylinder(cx, cy, z0, r0, h / n, i % 2 ? accent : v.body, null, r1);
      }
      const top = deck + h;
      p.cylinder(cx, cy, top, 0.2, 0.04, DARKWOOD);
      p.capRing(cx, cy, top + 0.08, 0.2, shade(DARKWOOD, -0.2), Math.max(1, p.cam.scale * 0.02));
      p.cylinder(cx, cy, top + 0.04, 0.12, 0.16, '#fff3c4');
      p.cone(cx, cy, top + 0.2, 0.15, 0.16, accent);
      ball(p, [cx, cy, top + 0.38], 0.03, GOLD);
      dyn(p, () => {
        const lz = top + 0.12;
        p.sphere(cx, cy, lz, 0.1, '#fff2b0', 1.6 + Math.sin(l.time * 3) * 0.2);
        // Beam swept towards the target
        const ctx = p.ctx;
        const c = Math.cos(l.angle);
        const s2 = Math.sin(l.angle);
        const L = 1.6;
        const sx = p.cam.sx(cx, cy);
        const sy = p.cam.sy(cx, cy, lz);
        const ex = p.cam.sx(cx + c * L, cy + s2 * L);
        const ey = p.cam.sy(cx + c * L, cy + s2 * L, lz - 0.15);
        const nx = -(ey - sy);
        const ny = ex - sx;
        const nl = Math.hypot(nx, ny) || 1;
        const w = p.cam.scale * 0.22;
        const g = ctx.createLinearGradient(sx, sy, ex, ey);
        g.addColorStop(0, 'rgba(255,245,190,0.55)');
        g.addColorStop(1, 'rgba(255,245,190,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex + (nx / nl) * w, ey + (ny / nl) * w);
        ctx.lineTo(ex - (nx / nl) * w, ey - (ny / nl) * w);
        ctx.closePath();
        ctx.fill();
      });
      return;
    }
    if (l.branch === 1) {
      // Whaler: timber lookout on braced stilts with a heavy harpoon gun
      const H = 0.34 + l.tier * 0.05;
      const ox = cx - 0.04;
      const oy = cy - 0.04;
      const legs: [number, number][] = [
        [-0.2, -0.2],
        [0.2, -0.2],
        [-0.2, 0.2],
        [0.2, 0.2],
      ];
      for (const [dx, dy] of legs) p.cylinder(ox + dx, oy + dy, deck, 0.035, H, DARKWOOD);
      // Cross braces on the two visible faces
      kitLimb(p, [ox - 0.2, oy + 0.2, deck + 0.04], [ox + 0.2, oy + 0.2, deck + H - 0.04], 0.018, 0.018, WOOD);
      kitLimb(p, [ox + 0.2, oy - 0.2, deck + 0.04], [ox + 0.2, oy + 0.2, deck + H - 0.04], 0.018, 0.018, WOOD);
      const top = deck + H;
      p.cbox(ox, oy, top, 0.56, 0.56, 0.06, WOOD, shade(WOOD, 0.14));
      // Railing posts
      for (const [dx, dy] of [
        [-0.26, 0.26],
        [0, 0.26],
        [0.26, 0.26],
        [0.26, 0],
        [0.26, -0.26],
      ])
        p.cylinder(ox + dx, oy + dy, top + 0.06, 0.012, 0.1, DARKWOOD);
      curve(
        p,
        [
          [ox - 0.26, oy + 0.26, top + 0.16],
          [ox + 0.26, oy + 0.26, top + 0.16],
          [ox + 0.26, oy - 0.26, top + 0.16],
        ],
        DARKWOOD,
        0.02,
      );
      p.capRing(cx + 0.25, cy + 0.25, deck + 0.04, 0.08, '#c9b07a', Math.max(1.5, p.cam.scale * 0.035));
      p.capRing(cx + 0.25, cy + 0.25, deck + 0.07, 0.06, '#c9b07a', Math.max(1.5, p.cam.scale * 0.035));
      p.cylinder(cx + 0.28, cy - 0.3, deck, 0.018, 0.6, DARKWOOD);
      flag(p, cx + 0.28, cy - 0.3, deck + 0.58, 0.18, 0.11, accent, l.time * 3);
      dyn(p, () => {
        const c = Math.cos(l.angle);
        const s2 = Math.sin(l.angle);
        const bx = cx - 0.05;
        const by = cy - 0.05;
        const recoil = Math.max(0, 1 - l.fireAnim * 4) * 0.06;
        p.cylinder(bx, by, top + 0.05, 0.08, 0.08, METAL);
        kitLimb(p, [bx - c * 0.18, by - s2 * 0.18, top + 0.17], [bx + c * 0.22, by + s2 * 0.22, top + 0.2], 0.035, 0.03, DARKWOOD);
        // Bow arms
        kitLimb(
          p,
          [bx + c * 0.12 - s2 * 0.2, by + s2 * 0.12 + c * 0.2, top + 0.18],
          [bx + c * 0.12 + s2 * 0.2, by + s2 * 0.12 - c * 0.2, top + 0.18],
          0.022,
          0.022,
          WOOD,
        );
        if (l.fireAnim > 0.25)
          kitLimb(
            p,
            [bx - c * (0.1 + recoil), by - s2 * (0.1 + recoil), top + 0.22],
            [bx + c * 0.34, by + s2 * 0.34, top + 0.22],
            0.014,
            0.004,
            '#d9e6f2',
            { shine: 1 },
          );
      });
      return;
    }
    // Base fort: squat stone bastion with a deck cannon.
    const h = 0.26 + l.tier * 0.05;
    p.cylinder(cx, cy, deck, 0.3, h, '#b8b0a2');
    p.cylinderBricks(cx, cy, deck, 0.3, h, '#b8b0a2', 0.09, 8);
    const top = deck + h;
    p.cylinder(cx, cy, top, 0.34, 0.05, shade('#b8b0a2', -0.08));
    if (l.tier >= 2) crenels(p, cx, cy, top + 0.05, 0.3, 8, '#c4bcae');
    if (l.tier >= 3) {
      p.cylinder(cx - 0.3, cy - 0.28, deck, 0.015, 0.75, DARKWOOD);
      flag(p, cx - 0.3, cy - 0.28, deck + 0.73, 0.2, 0.12, accent, l.time * 3);
    }
    dyn(p, () => deckCannon(p, cx, cy, top + 0.05, l.angle, l.fireAnim));
  },

  // ---------------------------------------------------------------- Tide shrine (naval)
  tide(p, l, v, cx, cy, z) {
    const marble = v.body;
    const accent = v.accent;
    waterRing(p, cx, cy, 0.44, l.time, z - SINK);
    // Rocky islet and marble platform
    const WATER_Z = z - SINK;
    p.cylinder(cx, cy, WATER_Z, 0.43, z - 0.05 - WATER_Z, '#8a9ea4', null, 0.4);
    p.cylinder(cx, cy, z - 0.05, 0.38, 0.07, marble);
    if (currentTier >= 2)
      p.capRing(cx, cy, z + 0.02, 0.36, currentTier >= 4 ? accent : currentTier === 3 ? GOLD : '#c9d0dc', Math.max(1.2, p.cam.scale * 0.03));
    const deck = z + 0.02;
    // Shells and coral on the rim
    for (let i = 0; i < 5; i++) {
      const a = 0.4 + i * 1.25;
      ball(p, [cx + Math.cos(a) * 0.4, cy + Math.sin(a) * 0.4, WATER_Z + 0.12], 0.04, i % 2 ? '#f0a3a0' : '#f6e3c4');
    }
    // Columns
    const ch = 0.38 + l.tier * 0.06;
    const cols: [number, number][] = [
      [-0.24, -0.24],
      [0.24, -0.24],
      [-0.24, 0.24],
      [0.24, 0.24],
    ];
    for (const [dx, dy] of cols) {
      p.cylinder(cx + dx, cy + dy, deck, 0.05, ch, marble);
      p.cylinder(cx + dx, cy + dy, deck + ch, 0.065, 0.04, shade(marble, -0.05));
    }
    // Basin
    p.cylinder(cx, cy, deck, 0.18, 0.12, shade(marble, -0.08));
    p.cap(cx, cy, deck + 0.12, 0.15, v.fx);
    const oz = deck + ch + 0.25;
    if (l.branch === 0) {
      // A frozen curling wave sculpture
      poly(
        p,
        [
          [cx - 0.3, cy + 0.05, deck + 0.05],
          [cx - 0.1, cy - 0.2, deck + 0.55],
          [cx + 0.12, cy - 0.26, deck + 0.85],
          [cx + 0.26, cy - 0.1, deck + 0.78],
          [cx + 0.14, cy - 0.12, deck + 0.62],
          [cx + 0.02, cy - 0.04, deck + 0.4],
          [cx + 0.1, cy + 0.15, deck + 0.05],
        ],
        accent,
        { smooth: true, grad: [shade(accent, 0.35), shade(accent, -0.2)] },
      );
      for (let i = 0; i < 5; i++) ball(p, [cx + 0.12 + i * 0.035, cy - 0.24 + i * 0.03, deck + 0.84 - i * 0.03], 0.03, '#ffffff', { line: false });
    } else if (l.branch === 2) {
      // Kraken: tentacles rising from the sea
      dyn(p, () => {
        const spots = [
          [-0.42, 0.1, 0],
          [0.1, 0.44, 2],
          [0.38, -0.3, 4],
        ];
        for (const [dx, dy, ph] of spots) {
          const sway = Math.sin(l.time * 1.6 + ph) * 0.06;
          const strike = Math.max(0, 1 - l.fireAnim * 2) * 0.15;
          const pts: V3[] = [];
          for (let k = 0; k <= 5; k++) {
            const t = k / 5;
            pts.push([
              cx + dx * (1 - t * 0.35) + sway * t * t,
              cy + dy * (1 - t * 0.35) - sway * t,
              WATER_Z + t * (0.85 - strike) + Math.sin(t * 3 + l.time) * 0.03,
            ]);
          }
          for (let k = 0; k < 5; k++) kitLimb(p, pts[k], pts[k + 1], 0.07 * (1 - k * 0.17), 0.07 * (1 - (k + 1) * 0.17), accent, { shine: 0.3 });
          for (let k = 1; k < 4; k++) ball(p, [pts[k][0] + 0.03, pts[k][1] + 0.03, pts[k][2]], 0.018, '#f2c6e8', { line: false });
        }
      });
    } else if (l.branch === 1) {
      // Maelstrom: a spinning vortex above the basin
      dyn(p, () => {
        for (let i = 0; i < 4; i++) {
          const r = 0.1 + i * 0.07;
          const zz = deck + 0.25 + i * 0.12;
          p.ctx.setLineDash([6, 5]);
          p.ctx.lineDashOffset = -l.time * 40 * (i % 2 ? 1 : -1);
          p.capRing(cx, cy, zz, r, rgba(v.fx, 0.85 - i * 0.12), Math.max(1.5, p.cam.scale * 0.035));
          p.ctx.setLineDash([]);
        }
        p.sphere(cx, cy, deck + 0.22, 0.08, '#0d4f5c', 0.4);
      });
    }
    // Floating water orb
    if (l.branch !== 1)
      dyn(p, () => {
        const bob = Math.sin(l.time * 2.2) * 0.04;
        p.sphere(cx, cy, oz + bob, 0.11, v.fx, 0.8);
        p.capRing(cx, cy, oz + bob, 0.18, rgba('#ffffff', 0.6), Math.max(1, p.cam.scale * 0.02));
      });
    if (l.tier >= 3 && l.branch !== 0) {
      // Trident finial
      p.cylinder(cx + 0.24, cy - 0.24, deck + ch + 0.04, 0.015, 0.35, GOLD);
      for (const o of [-0.05, 0, 0.05])
        kitLimb(
          p,
          [cx + 0.24 + o, cy - 0.24 - o, deck + ch + 0.36],
          [cx + 0.24 + o * 1.3, cy - 0.24 - o * 1.3, deck + ch + 0.5],
          0.014,
          0.004,
          GOLD,
          { shine: 1 },
        );
    }
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
