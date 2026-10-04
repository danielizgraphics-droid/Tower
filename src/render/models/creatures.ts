// Creature art. Every enemy is assembled from rounded, shaded parts on a Rig
// (see kit.ts) so silhouettes read clearly at small sizes. Models are drawn
// into cached sprites (one per direction and animation frame), which is why
// they can afford a lot of detail.

import type { EnemyDef } from '../../data/types';
import { shade } from '../color';
import type { Painter } from '../painter';
import { ellipsoid as ellipsoidRef, Rig, type V3 } from './kit';

export interface Pose {
  x: number;
  y: number;
  angle: number;
  /** Animation cycle 0..1 (walk, flap or wobble depending on the creature). */
  t: number;
}

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- palettes

const STEEL = '#b9c2cf';
const STEEL_DARK = '#7d8796';
const IRON = '#5e6573';
const WOOD = '#8a5a34';
const WOOD_DARK = '#5e3b22';
const BONE = '#efe6cf';
const GOLD = '#f0c043';
const SKIN = '#f0c6a0';

// ---------------------------------------------------------------- humanoids

interface HumanSpec {
  skin: string;
  torso: string;
  legs: string;
  boots: string;
  /** Head radius. */
  head?: number;
  torsoW?: number;
  torsoH?: number;
  legLen?: number;
  armR?: number;
  legR?: number;
  /** Forward lean of the upper body (0..0.3). */
  hunch?: number;
  eyes?: { color: string; white?: boolean; glow?: number; size?: number } | null;
  belt?: string;
  /** Extra details on/around the head (helmets, ears, hoods...). */
  headDeco?: (r: Rig, hu: number, hr: number, hf: number) => void;
  /** Item held in the right hand (s < 0). */
  right?: (r: Rig, hand: V3, swing: number) => void;
  /** Item held in / strapped to the left arm. */
  left?: (r: Rig, hand: V3, swing: number) => void;
  /** Extra body details (capes, plates, robes). */
  body?: (r: Rig, h: HumanFrame) => void;
  /** Skirt / robe instead of visible legs. */
  robe?: string;
  /** Arms color (defaults to torso). */
  sleeves?: string;
}

interface HumanFrame {
  hip: number;
  torsoU: number;
  shoulder: number;
  headU: number;
  tw: number;
  th: number;
  hr: number;
  lean: number;
  step: number;
}

function humanoid(p: Painter, pose: Pose, k: number, s: HumanSpec): void {
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const hr = s.head ?? 0.15;
  const tw = s.torsoW ?? 0.2;
  const th = s.torsoH ?? 0.22;
  const legLen = s.legLen ?? 0.2;
  const armR = s.armR ?? 0.042;
  const legR = s.legR ?? 0.046;
  const lean = s.hunch ?? 0.05;
  const step = Math.sin(pose.t * TAU);
  const bob = Math.abs(Math.cos(pose.t * TAU)) * 0.018;
  const hip = legLen + bob;
  const torsoU = hip + th * 0.5;
  const shoulder = hip + th * 0.86;
  const headU = hip + th + hr * 0.82;
  const sw = 0.075 * step;
  const frame: HumanFrame = { hip, torsoU, shoulder, headU, tw, th, hr, lean, step };

  // Legs
  if (!s.robe) {
    for (const side of [1, -1]) {
      const fs = side * sw;
      const lift = Math.max(0, side * step) * 0.035;
      const foot: V3 = [fs + 0.02, side * tw * 0.26, 0.035 + lift];
      r.limb([0, side * tw * 0.26, hip], foot, legR, legR * 0.85, s.legs);
      r.blob(foot[0] + 0.03, foot[1], foot[2] - 0.005, 0.065, 0.045, 0.035, s.boots, {}, 0.01);
    }
  } else {
    // Robe: a flared cone of cloth with swaying hem.
    const hem = 0.02;
    r.add(0, 0, hip * 0.5, () => {
      const pts: V3[] = [];
      const n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const rr = tw * 0.62 + Math.sin(a * 3 + pose.t * TAU) * 0.012;
        pts.push(r.at(Math.cos(a) * rr * 0.85 + sw * 0.15, Math.sin(a) * rr, hem));
      }
      // Project the hem ellipse and join it with the waist.
      const ctx = p.ctx;
      const waist = r.at(0, 0, hip + 0.02);
      const wx = p.cam.sx(waist[0], waist[1]);
      const wy = p.cam.sy(waist[0], waist[1], waist[2]);
      const sp = pts.map((q) => [p.cam.sx(q[0], q[1]), p.cam.sy(q[0], q[1], q[2])]);
      let minX = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [x, y] of sp) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      const half = tw * 0.38 * p.cam.scale * k;
      ctx.beginPath();
      ctx.moveTo(wx - half, wy);
      ctx.quadraticCurveTo(minX + (wx - half - minX) * 0.3, (wy + maxY) / 2, minX, maxY - 2);
      ctx.quadraticCurveTo((minX + maxX) / 2, maxY + (maxX - minX) * 0.12, maxX, maxY - 2);
      ctx.quadraticCurveTo(maxX - (maxX - wx - half) * 0.3, (wy + maxY) / 2, wx + half, wy);
      ctx.closePath();
      const g = ctx.createLinearGradient(minX, 0, maxX, 0);
      g.addColorStop(0, shade(s.robe!, 0.12));
      g.addColorStop(0.45, s.robe!);
      g.addColorStop(1, shade(s.robe!, -0.3));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(34,24,38,0.4)';
      ctx.lineWidth = Math.max(0.6, p.cam.scale * 0.011);
      ctx.stroke();
      // Fold lines
      ctx.strokeStyle = `rgba(30,20,40,0.18)`;
      ctx.beginPath();
      for (const f of [0.35, 0.65]) {
        const x0 = wx - half + 2 * half * f;
        ctx.moveTo(x0, wy + 2);
        ctx.lineTo(minX + (maxX - minX) * f, maxY - 2);
      }
      ctx.stroke();
    });
  }

  // Torso
  r.tilted(lean * 0.3, 0, torsoU, tw * 0.42, tw * 0.5, th * 0.56, -lean, s.torso);
  if (s.belt) r.blob(lean * 0.12, 0, hip + 0.015, tw * 0.44, tw * 0.52, 0.03, s.belt, {}, 0.02);
  s.body?.(r, frame);

  // Arms (counter-swing)
  const sleeves = s.sleeves ?? s.torso;
  const hands: Record<number, V3> = {};
  for (const side of [1, -1]) {
    const as = -side * sw * 0.9;
    const sh: V3 = [lean * 0.6, side * (tw * 0.5 + armR * 0.6), shoulder];
    const hand: V3 = [as + 0.05 + lean * 0.5, side * (tw * 0.5 + armR * 1.2), hip + 0.03];
    r.limb(sh, hand, armR, armR * 0.85, sleeves);
    r.blob(hand[0], hand[1], hand[2], armR * 0.95, armR * 0.95, armR * 0.95, s.skin, {}, 0.01);
    hands[side] = hand;
  }
  s.right?.(r, hands[-1], step);
  s.left?.(r, hands[1], step);

  // Head
  const hf = lean * 0.9 + 0.01;
  r.blob(hf, 0, headU, hr * 0.98, hr, hr * 0.95, s.skin);
  if (s.eyes !== null) {
    const e = s.eyes ?? { color: '#2a1d24', white: true };
    r.eyes(hf, 0, headU, hr, 0.42, e.color, { white: e.white, glow: e.glow, size: e.size });
  }
  s.headDeco?.(r, headU, hr, hf);
  r.flush();
}

// Props ----------------------------------------------------------------------

function sword(r: Rig, hand: V3, swing: number, len = 0.3, blade = STEEL): void {
  const tip: V3 = [hand[0] + 0.1 + swing * 0.02, hand[1] - 0.04, hand[2] + len];
  r.stick(hand, [hand[0] + 0.01, hand[1], hand[2] + 0.05], 0.018, WOOD_DARK, 0.02);
  r.stick([hand[0] - 0.02, hand[1] - 0.05, hand[2] + 0.05], [hand[0] + 0.03, hand[1] + 0.05, hand[2] + 0.05], 0.014, GOLD, 0.03);
  r.limb([hand[0] + 0.01, hand[1], hand[2] + 0.06], tip, 0.022, 0.006, blade, { shine: 1 }, 0.02);
}

function dagger(r: Rig, hand: V3): void {
  r.limb([hand[0] + 0.02, hand[1], hand[2] + 0.02], [hand[0] + 0.14, hand[1] - 0.02, hand[2] + 0.1], 0.016, 0.004, STEEL, { shine: 1 }, 0.02);
}

function axe(r: Rig, hand: V3, size = 1, head = STEEL): void {
  const top: V3 = [hand[0] + 0.06 * size, hand[1], hand[2] + 0.36 * size];
  r.stick([hand[0] - 0.02, hand[1], hand[2] - 0.08 * size], top, 0.018 * size, WOOD, 0.02);
  r.poly(
    [
      [top[0] - 0.01, top[1], top[2] - 0.02],
      [top[0] + 0.12 * size, top[1] - 0.02, top[2] + 0.06 * size],
      [top[0] + 0.15 * size, top[1] - 0.02, top[2] - 0.08 * size],
      [top[0] + 0.01, top[1], top[2] - 0.1 * size],
    ],
    head,
    { smooth: false, grad: [shade(head, 0.3), shade(head, -0.2)] },
    0.05,
  );
}

function staff(r: Rig, hand: V3, orb: string, top = 0.5, cap: 'orb' | 'skull' | 'crook' = 'orb'): void {
  const head: V3 = [hand[0] + 0.02, hand[1], hand[2] + top];
  r.stick([hand[0], hand[1], 0.02], head, 0.018, WOOD_DARK, 0.02);
  if (cap === 'skull') {
    r.blob(head[0], head[1], head[2] + 0.05, 0.055, 0.05, 0.05, BONE, {}, 0.05);
    r.dot(head[0] + 0.05, head[1], head[2] + 0.05, 0.012, orb, 1.2, 0.08);
  } else if (cap === 'crook') {
    r.curve(
      [head, [head[0] + 0.02, head[1], head[2] + 0.08], [head[0] + 0.08, head[1], head[2] + 0.1], [head[0] + 0.1, head[1], head[2] + 0.04]],
      WOOD_DARK,
      0.03,
    );
    r.dot(head[0] + 0.05, head[1], head[2] + 0.06, 0.03, orb, 1.5, 0.08);
  } else {
    r.blob(head[0], head[1], head[2] + 0.04, 0.045, 0.045, 0.045, orb, { glow: 0.8 }, 0.06);
  }
}

/** Round shield on the left forearm, facing outwards-forward. */
function roundShield(r: Rig, hand: V3, color: string, rim = IRON, rad = 0.13, boss = STEEL): void {
  const c: V3 = [hand[0] + 0.02, hand[1] + 0.05, hand[2] + 0.1];
  const n = r.dir(0.35, 1, 0);
  const nl = Math.hypot(n[0], n[1], n[2]);
  // Two in-plane axes: up and the horizontal tangent.
  const tan = r.dir(1, -0.35, 0);
  const tl = Math.hypot(tan[0], tan[1], tan[2]);
  r.add(c[0], c[1] + 0.05, c[2], () => {
    const C = r.at(...c);
    const t1: V3 = [(tan[0] / tl) * rad * r.k, (tan[1] / tl) * rad * r.k, 0];
    const t2: V3 = [0, 0, rad * r.k];
    const nn: V3 = [(n[0] / nl) * 0.012 * r.k, (n[1] / nl) * 0.012 * r.k, 0];
    ellipsoidRef(r.p, C, t1, t2, nn, rim);
    const s = 0.8;
    ellipsoidRef(r.p, [C[0] + nn[0] * 0.6, C[1] + nn[1] * 0.6, C[2]], [t1[0] * s, t1[1] * s, 0], [0, 0, t2[2] * s], nn, color);
    ellipsoidRef(r.p, [C[0] + nn[0] * 1.2, C[1] + nn[1] * 1.2, C[2]], [t1[0] * 0.25, t1[1] * 0.25, 0], [0, 0, t2[2] * 0.25], nn, boss, { shine: 1 });
  });
}

/** Tall rectangular (kite/tower) shield. */
function towerShield(r: Rig, hand: V3, color: string, trim: string, emblem?: string, glow = false): void {
  const f = hand[0] + 0.05;
  const s = hand[1] + 0.06;
  const u0 = hand[2] - 0.08;
  const h = 0.32;
  const w = 0.11;
  const pts: V3[] = [
    [f + w, s - w * 0.35, u0 + h],
    [f - w, s + w * 0.35, u0 + h],
    [f - w, s + w * 0.35, u0 + 0.08],
    [f, s, u0 - 0.03],
    [f + w, s - w * 0.35, u0 + 0.08],
  ];
  r.poly(pts, trim, { grad: [shade(trim, 0.2), shade(trim, -0.25)] }, 0.06);
  const inner = pts.map(([a, b, c]) => [f + (a - f) * 0.78, s + (b - s) * 0.78, u0 + 0.13 + (c - u0 - 0.13) * 0.8] as V3);
  r.poly(inner, color, { grad: [shade(color, 0.18), shade(color, -0.22)] }, 0.07);
  if (emblem) r.dot(f, s + 0.01, u0 + 0.16, 0.035, emblem, glow ? 1.5 : 0, 0.09);
}

// ---------------------------------------------------------------- humanoid roster

function goblin(p: Painter, pose: Pose, d: EnemyDef): void {
  humanoid(p, pose, d.size, {
    skin: '#86c25a',
    torso: '#7a5638',
    legs: '#5c4630',
    boots: '#3e2d20',
    head: 0.17,
    torsoW: 0.18,
    torsoH: 0.17,
    legLen: 0.15,
    hunch: 0.16,
    belt: '#3e2d20',
    eyes: { color: '#ffd23f', glow: 0, size: 0.24 },
    headDeco: (r, hu, hr, hf) => {
      // Long pointed ears and a nose.
      for (const side of [1, -1])
        r.poly(
          [
            [hf, side * hr * 0.7, hu + hr * 0.25],
            [hf - 0.05, side * (hr + 0.16), hu + hr * 0.5],
            [hf - 0.04, side * hr * 0.75, hu],
          ],
          '#7ab650',
          {},
          0.01,
        );
      r.blob(hf + hr * 0.95, 0, hu - hr * 0.1, 0.035, 0.03, 0.03, '#76b04c', {}, 0.3);
      // Little leather cap
      r.blob(hf - 0.01, 0, hu + hr * 0.55, hr * 0.8, hr * 0.85, hr * 0.42, '#6a4428', {}, 0.1);
    },
    right: (r, hand) => dagger(r, hand),
  });
}

function bandit(p: Painter, pose: Pose, d: EnemyDef): void {
  humanoid(p, pose, d.size, {
    skin: SKIN,
    torso: '#6b4a34',
    legs: '#3e3a44',
    boots: '#2c2228',
    sleeves: '#b04b3a',
    belt: '#2c2228',
    eyes: { color: '#1d1418', white: true },
    body: (r, h) => {
      // Red cloak over the back.
      r.poly(
        [
          [-0.02, h.tw * 0.55, h.shoulder + 0.02],
          [-0.02, -h.tw * 0.55, h.shoulder + 0.02],
          [-0.12 - h.step * 0.02, -h.tw * 0.65, h.hip - 0.08],
          [-0.14, 0, h.hip - 0.1],
          [-0.12 + h.step * 0.02, h.tw * 0.65, h.hip - 0.08],
        ],
        '#b04b3a',
        { smooth: true, grad: ['#c55a46', '#7e3127'] },
        -0.12,
      );
    },
    headDeco: (r, hu, hr, hf) => {
      // Hood and a face mask.
      // Hood: a larger shell behind/above the head with a pointed tip, then a face mask.
      r.blob(hf - 0.045, 0, hu + 0.035, hr * 1.15, hr * 1.2, hr * 1.12, '#b04b3a', {}, -0.08);
      r.poly(
        [
          [hf - 0.06, hr * 0.6, hu + hr * 0.7],
          [hf - 0.2, 0, hu + hr * 0.5],
          [hf - 0.06, -hr * 0.6, hu + hr * 0.7],
        ],
        '#9a3f30',
        {},
        -0.09,
      );
      r.blob(hf + 0.01, 0, hu + hr * 0.62, hr * 0.92, hr * 1.02, hr * 0.42, '#b04b3a', {}, 0.15);
      r.blob(hf + hr * 0.55, 0, hu - hr * 0.38, hr * 0.5, hr * 0.85, hr * 0.32, '#3e3a44', {}, 0.2);
    },
    right: (r, hand, sw) => sword(r, hand, sw, 0.24),
  });
}

function knight(p: Painter, pose: Pose, d: EnemyDef, rune = false): void {
  const plate = rune ? '#4d5f8f' : STEEL;
  const trim = rune ? '#2e3a5c' : STEEL_DARK;
  humanoid(p, pose, d.size, {
    skin: plate,
    torso: plate,
    legs: trim,
    boots: rune ? '#2a3350' : IRON,
    torsoW: 0.24,
    torsoH: 0.24,
    head: 0.145,
    armR: 0.05,
    legR: 0.05,
    hunch: 0.02,
    belt: rune ? '#7cf2ff' : '#6a4a2e',
    eyes: null,
    body: (r, h) => {
      // Pauldrons and a tabard.
      for (const side of [1, -1]) r.blob(0.01, side * (h.tw * 0.52), h.shoulder + 0.01, 0.07, 0.07, 0.05, shade(plate, 0.05), { shine: 0.8 }, 0.05);
      r.poly(
        [
          [h.tw * 0.44, h.tw * 0.28, h.shoulder - 0.02],
          [h.tw * 0.44, -h.tw * 0.28, h.shoulder - 0.02],
          [h.tw * 0.4, -h.tw * 0.24, h.hip - 0.09],
          [h.tw * 0.4, h.tw * 0.24, h.hip - 0.09],
        ],
        rune ? '#26304d' : '#2f5fb3',
        { grad: rune ? ['#33406a', '#1b2238'] : ['#3d74cf', '#24488a'] },
        0.12,
      );
      if (rune) {
        r.curve(
          [
            [h.tw * 0.47, 0, h.shoulder - 0.04],
            [h.tw * 0.47, 0.03, h.torsoU],
            [h.tw * 0.47, -0.03, h.hip],
          ],
          '#7cf2ff',
          0.018,
          1,
          0.14,
        );
      } else r.dot(h.tw * 0.47, 0, h.torsoU + 0.02, 0.03, GOLD, 0, 0.14);
    },
    headDeco: (r, hu, hr, hf) => {
      // Great helm: visor slit, crest.
      r.blob(hf, 0, hu, hr * 1.05, hr * 1.02, hr * 1.08, plate, { shine: 1 }, 0.02);
      if (r.facing(1, 0, 0))
        r.stick([hf + hr * 0.98, hr * 0.5, hu + 0.005], [hf + hr * 0.98, -hr * 0.5, hu + 0.005], 0.012, rune ? '#7cf2ff' : '#1c1a22', 0.3);
      if (rune) r.dot(hf + hr, 0, hu + 0.005, 0.02, '#7cf2ff', 1.5, 0.35);
      else
        r.poly(
          [
            [hf + 0.03, 0, hu + hr * 0.9],
            [hf - 0.16, 0, hu + hr * 1.15],
            [hf - 0.2, 0, hu + hr * 0.4],
            [hf - 0.06, 0, hu + hr * 0.75],
          ],
          '#2f5fb3',
          { smooth: true, grad: ['#4a86e8', '#22427f'] },
          0.05,
        );
    },
    right: (r, hand, sw) => sword(r, hand, sw, 0.32, rune ? '#a8f6ff' : STEEL),
    left: (r, hand) => (rune ? towerShield(r, hand, '#2e3a5c', '#4d5f8f', '#7cf2ff', true) : towerShield(r, hand, '#2f5fb3', STEEL, GOLD)),
  });
}

function shaman(p: Painter, pose: Pose, d: EnemyDef): void {
  humanoid(p, pose, d.size, {
    skin: '#8cb86a',
    torso: '#6a3f8f',
    legs: '#4a2c63',
    boots: '#3a2a20',
    robe: '#6a3f8f',
    head: 0.15,
    hunch: 0.1,
    belt: '#d9a441',
    eyes: { color: '#ffe26a', size: 0.22 },
    body: (r, h) => {
      // Bone necklace
      for (let i = -2; i <= 2; i++) r.dot(h.tw * 0.42, i * 0.03, h.shoulder - 0.02 - Math.abs(i) * 0.012, 0.014, BONE, 0, 0.15);
    },
    headDeco: (r, hu, hr, hf) => {
      // Feathered headdress
      const cols = ['#e24b4b', '#f0c043', '#3fb8a5', '#f0c043', '#e24b4b'];
      cols.forEach((c, i) => {
        const a = (i - 2) * 0.35;
        r.limb(
          [hf - 0.02, Math.sin(a) * hr * 0.6, hu + hr * 0.6],
          [hf - 0.08, Math.sin(a) * hr * 1.3, hu + hr * 1.6 - Math.abs(i - 2) * 0.05],
          0.022,
          0.008,
          c,
          {},
          -0.1,
        );
      });
      r.blob(hf, 0, hu + hr * 0.5, hr * 0.9, hr * 0.95, hr * 0.3, '#d9a441', {}, 0.05);
      for (const side of [1, -1])
        r.poly(
          [
            [hf, side * hr * 0.75, hu + hr * 0.2],
            [hf - 0.03, side * (hr + 0.1), hu + hr * 0.35],
            [hf - 0.03, side * hr * 0.8, hu - 0.02],
          ],
          '#7fae5e',
          {},
          0.01,
        );
    },
    right: (r, hand) => staff(r, hand, '#b07bff', 0.5, 'skull'),
  });
}

function skeleton(p: Painter, pose: Pose, d: EnemyDef): void {
  humanoid(p, pose, d.size, {
    skin: BONE,
    torso: '#d9cfb6',
    legs: BONE,
    boots: '#cfc5aa',
    sleeves: BONE,
    armR: 0.022,
    legR: 0.024,
    torsoW: 0.17,
    head: 0.15,
    hunch: 0.08,
    eyes: { color: '#ff6a3d', glow: 1.2, size: 0.2 },
    body: (r, h) => {
      // Ribs
      for (let i = 0; i < 3; i++)
        r.curve(
          [
            [h.tw * 0.25, h.tw * 0.45, h.shoulder - 0.04 - i * 0.045],
            [h.tw * 0.46, 0, h.shoulder - 0.05 - i * 0.045],
            [h.tw * 0.25, -h.tw * 0.45, h.shoulder - 0.04 - i * 0.045],
          ],
          '#8c826c',
          0.012,
          0.9,
          0.15,
        );
      r.stick([0.02, 0, h.hip], [0.02, 0, h.shoulder], 0.02, '#cfc5aa', -0.05);
    },
    headDeco: (r, hu, hr, hf) => {
      // Jaw and a rusty helmet
      r.blob(hf + hr * 0.45, 0, hu - hr * 0.62, hr * 0.5, hr * 0.62, hr * 0.28, '#e2d8bf', {}, 0.1);
      r.blob(hf - 0.01, 0, hu + hr * 0.45, hr * 0.95, hr * 1.0, hr * 0.5, '#8a6a4a', {}, 0.12);
    },
    right: (r, hand, sw) => sword(r, hand, sw, 0.26, '#a89a86'),
    left: (r, hand) => roundShield(r, hand, '#7a5a3a', '#5a4630', 0.11, '#a89a86'),
  });
}

function orc(p: Painter, pose: Pose, d: EnemyDef): void {
  humanoid(p, pose, d.size, {
    skin: '#6f9a4c',
    torso: '#6f9a4c',
    legs: '#5a3d2b',
    boots: '#3a2a1f',
    torsoW: 0.27,
    torsoH: 0.24,
    head: 0.15,
    armR: 0.058,
    legR: 0.055,
    hunch: 0.12,
    belt: '#8a2f2a',
    eyes: { color: '#ff3b2f', glow: 0.6, size: 0.2 },
    body: (r, h) => {
      // War paint stripe and shoulder strap
      r.curve(
        [
          [h.tw * 0.44, h.tw * 0.4, h.shoulder],
          [h.tw * 0.47, 0, h.torsoU],
          [h.tw * 0.42, -h.tw * 0.42, h.hip + 0.02],
        ],
        '#5a3d2b',
        0.03,
        1,
        0.12,
      );
      r.blob(0.01, h.tw * 0.52, h.shoulder + 0.01, 0.07, 0.07, 0.05, IRON, { shine: 0.6 }, 0.05);
      r.dot(0.03, h.tw * 0.52, h.shoulder + 0.06, 0.012, BONE, 0, 0.1);
    },
    headDeco: (r, hu, hr, hf) => {
      // Tusks, topknot, red paint
      for (const side of [1, -1])
        r.limb([hf + hr * 0.8, side * hr * 0.35, hu - hr * 0.45], [hf + hr * 1.05, side * hr * 0.42, hu - hr * 0.05], 0.018, 0.006, BONE, {}, 0.35);
      r.curve(
        [
          [hf + hr * 0.7, hr * 0.5, hu + hr * 0.35],
          [hf + hr * 0.9, 0, hu + hr * 0.4],
          [hf + hr * 0.7, -hr * 0.5, hu + hr * 0.35],
        ],
        '#c92a2a',
        0.025,
        1,
        0.3,
      );
      r.blob(hf - 0.04, 0, hu + hr * 0.9, 0.04, 0.04, 0.06, '#2a1d18', {}, 0.0);
      r.limb([hf - 0.05, 0, hu + hr * 1.0], [hf - 0.14, 0, hu + hr * 0.6], 0.025, 0.012, '#2a1d18', {}, -0.05);
    },
    right: (r, hand) => axe(r, hand, 0.9),
    left: (r, hand) => axe(r, hand, 0.75),
  });
}

function necromancer(p: Painter, pose: Pose, d: EnemyDef): void {
  humanoid(p, pose, d.size, {
    skin: '#c9c1d6',
    torso: '#2c2438',
    legs: '#2c2438',
    boots: '#1c1624',
    robe: '#2c2438',
    head: 0.14,
    hunch: 0.08,
    belt: '#7cf2a0',
    eyes: { color: '#7cf2a0', glow: 1.4, size: 0.22 },
    body: (r, h) => {
      r.poly(
        [
          [-0.02, h.tw * 0.6, h.shoulder + 0.04],
          [-0.02, -h.tw * 0.6, h.shoulder + 0.04],
          [-0.1, -h.tw * 0.7, 0.03],
          [-0.12, h.tw * 0.7, 0.03],
        ],
        '#1c1624',
        { grad: ['#3a2e4c', '#120e18'] },
        -0.15,
      );
      r.dot(h.tw * 0.44, 0, h.shoulder - 0.03, 0.025, '#7cf2a0', 1.2, 0.2);
    },
    headDeco: (r, hu, hr, hf) => {
      // Deep pointed hood
      r.blob(hf - 0.03, 0, hu + 0.02, hr * 1.18, hr * 1.12, hr * 1.12, '#2c2438', {}, -0.04);
      r.poly(
        [
          [hf - 0.06, hr * 0.6, hu + hr * 0.6],
          [hf - 0.12, 0, hu + hr * 1.8],
          [hf - 0.06, -hr * 0.6, hu + hr * 0.6],
        ],
        '#2c2438',
        { smooth: false },
        -0.03,
      );
    },
    right: (r, hand) => staff(r, hand, '#7cf2a0', 0.58, 'skull'),
  });
}

function mummy(p: Painter, pose: Pose, d: EnemyDef): void {
  const wrap = '#d8cba6';
  humanoid(p, pose, d.size, {
    skin: wrap,
    torso: wrap,
    legs: '#cbbd96',
    boots: '#b8a982',
    sleeves: '#cbbd96',
    head: 0.15,
    hunch: 0.14,
    eyes: { color: '#7cf2c8', glow: 1.2, size: 0.18 },
    body: (r, h) => {
      for (let i = 0; i < 4; i++)
        r.curve(
          [
            [h.tw * 0.3, h.tw * 0.5, h.hip + 0.03 + i * 0.05],
            [h.tw * 0.47, 0, h.hip + 0.05 + i * 0.05 + (i % 2) * 0.02],
            [h.tw * 0.3, -h.tw * 0.5, h.hip + 0.06 + i * 0.05],
          ],
          '#9c8e6c',
          0.01,
          0.9,
          0.14,
        );
      // Trailing loose bandage
      r.curve(
        [
          [-0.06, -h.tw * 0.4, h.torsoU],
          [-0.14, -h.tw * 0.5, h.hip],
          [-0.2 - h.step * 0.02, -h.tw * 0.3, h.hip - 0.12],
        ],
        wrap,
        0.025,
        1,
        -0.2,
      );
    },
    headDeco: (r, hu, hr, hf) => {
      for (let i = 0; i < 3; i++)
        r.curve(
          [
            [hf + hr * 0.6, hr * 0.7, hu - hr * 0.5 + i * hr * 0.45],
            [hf + hr * 0.98, 0, hu - hr * 0.4 + i * hr * 0.45],
            [hf + hr * 0.6, -hr * 0.7, hu - hr * 0.3 + i * hr * 0.45],
          ],
          '#9c8e6c',
          0.01,
          0.9,
          0.32,
        );
    },
  });
}

function triton(p: Painter, pose: Pose, d: EnemyDef): void {
  humanoid(p, pose, d.size, {
    skin: '#4fb3a8',
    torso: '#3a8f9c',
    legs: '#2f7480',
    boots: '#2a5f6a',
    head: 0.15,
    hunch: 0.08,
    belt: '#d9a441',
    eyes: { color: '#ffe26a', size: 0.26 },
    body: (r, h) => {
      // Scaled belly and a dorsal fin
      r.blob(h.tw * 0.22, 0, h.torsoU, h.tw * 0.25, h.tw * 0.32, h.th * 0.4, '#a6e3cf', {}, 0.08);
      r.poly(
        [
          [-0.06, 0, h.shoulder + 0.06],
          [-0.18, 0, h.shoulder - 0.02],
          [-0.12, 0, h.hip],
          [-0.06, 0, h.hip + 0.05],
        ],
        '#e0735a',
        { smooth: true, grad: ['#f08c6c', '#b04a3a'], alpha: 0.95 },
        -0.15,
      );
    },
    headDeco: (r, hu, hr, hf) => {
      for (const side of [1, -1])
        r.poly(
          [
            [hf, side * hr * 0.8, hu + hr * 0.1],
            [hf - 0.12, side * (hr + 0.1), hu + hr * 0.5],
            [hf - 0.1, side * (hr + 0.06), hu - hr * 0.3],
          ],
          '#e0735a',
          { grad: ['#f08c6c', '#b04a3a'] },
          0.02,
        );
      r.blob(hf + hr * 0.5, 0, hu - hr * 0.45, hr * 0.55, hr * 0.7, hr * 0.3, '#3a8f9c', {}, 0.2);
    },
    right: (r, hand) => {
      const top: V3 = [hand[0] + 0.04, hand[1], hand[2] + 0.5];
      r.stick([hand[0] - 0.02, hand[1], 0.03], top, 0.016, '#c9a14a', 0.02);
      for (const o of [-0.035, 0, 0.035])
        r.limb([top[0], top[1] + o, top[2] - 0.02], [top[0], top[1] + o * 1.4, top[2] + 0.1], 0.012, 0.003, '#e8d27a', { shine: 1 }, 0.03);
      r.stick([top[0], top[1] - 0.045, top[2] - 0.02], [top[0], top[1] + 0.045, top[2] - 0.02], 0.012, '#c9a14a', 0.03);
    },
  });
}

function witch(p: Painter, pose: Pose, d: EnemyDef): void {
  humanoid(p, pose, d.size, {
    skin: '#9cc27a',
    torso: '#3f5a3a',
    legs: '#2c3a28',
    boots: '#1f261c',
    robe: '#3f5a3a',
    head: 0.15,
    hunch: 0.14,
    belt: '#8a5ad6',
    eyes: { color: '#e9ff6a', glow: 0.8, size: 0.22 },
    body: (r, h) => {
      r.dot(h.tw * 0.44, 0, h.shoulder - 0.02, 0.022, '#8a5ad6', 1, 0.2);
    },
    headDeco: (r, hu, hr, hf) => {
      // Messy hair and a crooked pointy hat
      r.blob(hf - 0.04, 0, hu - 0.01, hr * 0.9, hr * 1.12, hr * 0.9, '#3a2c3f', {}, -0.04);
      r.blob(hf + hr * 0.95, 0, hu - hr * 0.15, 0.04, 0.03, 0.03, '#8ab36a', {}, 0.35);
      r.blob(hf - 0.01, 0, hu + hr * 0.62, hr * 1.55, hr * 1.55, hr * 0.12, '#2a2a3a', {}, 0.1);
      r.add(
        hf,
        0,
        hu + hr,
        () => {
          const pp = r.p;
          const base1 = r.at(hf - 0.01, hr * 0.85, hu + hr * 0.65);
          const base2 = r.at(hf - 0.01, -hr * 0.85, hu + hr * 0.65);
          const tip = r.at(hf - 0.14, -0.05, hu + hr * 2.6);
          const bend = r.at(hf - 0.02, 0, hu + hr * 1.9);
          const s = (v: V3) => [pp.cam.sx(v[0], v[1]), pp.cam.sy(v[0], v[1], v[2])];
          const [ax, ay] = s(base1);
          const [bx, by] = s(base2);
          const [tx, ty] = s(tip);
          const [mx, my] = s(bend);
          const ctx = pp.ctx;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.quadraticCurveTo(mx + (ax - bx) * 0.15, my, tx, ty);
          ctx.quadraticCurveTo(mx - (ax - bx) * 0.15, my, bx, by);
          ctx.closePath();
          const g = ctx.createLinearGradient(Math.min(ax, bx), 0, Math.max(ax, bx), 0);
          g.addColorStop(0, '#45455e');
          g.addColorStop(1, '#1d1d2a');
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = 'rgba(34,24,38,0.45)';
          ctx.lineWidth = Math.max(0.6, pp.cam.scale * 0.011);
          ctx.stroke();
          // Hat band
          ctx.beginPath();
          ctx.moveTo(ax + (mx - ax) * 0.18, ay + (my - ay) * 0.18);
          ctx.lineTo(bx + (mx - bx) * 0.18, by + (my - by) * 0.18);
          ctx.strokeStyle = '#8a5ad6';
          ctx.lineWidth = Math.max(1, pp.cam.scale * 0.03 * r.k);
          ctx.stroke();
        },
        0.2,
      );
    },
    right: (r, hand) => staff(r, hand, '#b98bff', 0.5, 'crook'),
  });
}

function warlord(p: Painter, pose: Pose, d: EnemyDef): void {
  humanoid(p, pose, d.size * 0.92, {
    skin: '#6a8f48',
    torso: '#8a2f2a',
    legs: '#4a3428',
    boots: '#2a1f1a',
    sleeves: '#6a8f48',
    torsoW: 0.3,
    torsoH: 0.26,
    head: 0.15,
    armR: 0.062,
    legR: 0.06,
    hunch: 0.08,
    belt: GOLD,
    eyes: { color: '#ff3b2f', glow: 1.2, size: 0.2 },
    body: (r, h) => {
      // Spiked pauldrons and a flowing cape
      r.poly(
        [
          [-0.03, h.tw * 0.6, h.shoulder + 0.03],
          [-0.03, -h.tw * 0.6, h.shoulder + 0.03],
          [-0.2 - h.step * 0.02, -h.tw * 0.8, 0.04],
          [-0.24, 0, 0.02],
          [-0.2 + h.step * 0.02, h.tw * 0.8, 0.04],
        ],
        '#5c1414',
        { smooth: true, grad: ['#8f2020', '#3a0c0c'] },
        -0.2,
      );
      for (const side of [1, -1]) {
        r.blob(0.0, side * h.tw * 0.55, h.shoulder + 0.02, 0.09, 0.08, 0.06, '#3a3a44', { shine: 0.7 }, 0.06);
        r.limb([0, side * h.tw * 0.6, h.shoulder + 0.06], [-0.02, side * h.tw * 0.7, h.shoulder + 0.16], 0.025, 0.004, BONE, {}, 0.07);
      }
      r.dot(h.tw * 0.45, 0, h.torsoU + 0.02, 0.04, GOLD, 0.5, 0.12);
    },
    headDeco: (r, hu, hr, hf) => {
      r.blob(hf - 0.005, 0, hu + hr * 0.35, hr * 1.02, hr * 1.04, hr * 0.75, '#3a3a44', { shine: 0.8 }, 0.05);
      for (const side of [1, -1])
        r.curve(
          [
            [hf, side * hr * 0.8, hu + hr * 0.6],
            [hf + 0.02, side * (hr + 0.1), hu + hr * 1.1],
            [hf + 0.08, side * (hr + 0.05), hu + hr * 1.6],
          ],
          BONE,
          0.04,
          1,
          0.1,
        );
      for (const side of [1, -1])
        r.limb([hf + hr * 0.8, side * hr * 0.35, hu - hr * 0.45], [hf + hr * 1.05, side * hr * 0.42, hu - hr * 0.05], 0.02, 0.006, BONE, {}, 0.35);
    },
    right: (r, hand) => {
      // Huge double axe
      const top: V3 = [hand[0] + 0.05, hand[1], hand[2] + 0.5];
      r.stick([hand[0] - 0.02, hand[1], hand[2] - 0.12], top, 0.022, WOOD_DARK, 0.02);
      for (const dir of [1, -1])
        r.poly(
          [
            [top[0], top[1], top[2] - 0.02],
            [top[0] + dir * 0.18, top[1], top[2] + 0.1],
            [top[0] + dir * 0.2, top[1], top[2] - 0.12],
            [top[0], top[1], top[2] - 0.12],
          ],
          STEEL,
          { smooth: true, grad: ['#e6ecf3', '#7d8796'] },
          0.05,
        );
    },
  });
}

// ---------------------------------------------------------------- beasts

function wolf(p: Painter, pose: Pose, d: EnemyDef): void {
  const k = d.size;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const fur = '#8d93a0';
  const belly = '#cfd3db';
  const dark = '#5d616b';
  const ph = pose.t * TAU;
  const gallop = Math.sin(ph);
  const bob = Math.abs(Math.cos(ph)) * 0.03;
  const bodyU = 0.24 + bob;
  // Legs (diagonal pairs)
  const legs: [number, number, number][] = [
    [0.15, 1, 0],
    [0.15, -1, Math.PI],
    [-0.14, 1, Math.PI],
    [-0.14, -1, 0],
  ];
  for (const [lf, side, off] of legs) {
    const sw = Math.sin(ph + off) * 0.08;
    const lift = Math.max(0, Math.cos(ph + off)) * 0.04;
    const knee: V3 = [lf + sw * 0.5, side * 0.07, 0.13 + lift];
    r.limb([lf, side * 0.07, bodyU - 0.02], knee, 0.04, 0.03, side > 0 ? fur : shade(fur, -0.1));
    r.limb(knee, [lf + sw, side * 0.07, 0.025 + lift], 0.03, 0.025, side > 0 ? fur : shade(fur, -0.1));
    r.blob(lf + sw + 0.02, side * 0.07, 0.02 + lift, 0.035, 0.028, 0.02, dark, {}, 0.01);
  }
  // Body
  r.tilted(0, 0, bodyU, 0.24, 0.11, 0.11, 0.08 + gallop * 0.04, fur);
  r.blob(0.02, 0, bodyU - 0.06, 0.16, 0.08, 0.04, belly, { line: false }, 0.01);
  r.tilted(0.14, 0, bodyU + 0.03, 0.1, 0.11, 0.11, 0.3, shade(fur, 0.05), {}, 0.02); // chest ruff
  // Tail
  r.curve(
    [
      [-0.2, 0, bodyU + 0.03],
      [-0.3, 0, bodyU + 0.08 + gallop * 0.03],
      [-0.38, 0, bodyU + 0.03 + gallop * 0.05],
    ],
    fur,
    0.06,
  );
  r.dot(-0.39, 0, bodyU + 0.03 + gallop * 0.05, 0.025, belly);
  // Head: skull, snout, ears
  const hu = bodyU + 0.1 + gallop * 0.015;
  r.blob(0.28, 0, hu, 0.09, 0.08, 0.08, fur);
  r.tilted(0.39, 0, hu - 0.03, 0.08, 0.045, 0.04, -0.2, shade(fur, 0.08), {}, 0.05);
  r.dot(0.46, 0, hu - 0.03, 0.017, '#1d1a20', 0, 0.1);
  for (const side of [1, -1])
    r.poly(
      [
        [0.27, side * 0.045, hu + 0.05],
        [0.25, side * 0.06, hu + 0.15],
        [0.3, side * 0.03, hu + 0.07],
      ],
      dark,
      {},
      0.03,
    );
  r.eyes(0.29, 0, hu + 0.015, 0.085, 0.5, '#ffcf3a', { size: 0.2, glow: 0.4 });
  r.flush();
}

function spider(p: Painter, pose: Pose, d: EnemyDef): void {
  const k = d.size;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const body = '#3a2d48';
  const leg = '#2a2034';
  const ph = pose.t * TAU;
  const bodyU = 0.16 + Math.abs(Math.sin(ph * 2)) * 0.01;
  for (let i = 0; i < 4; i++) {
    for (const side of [1, -1]) {
      const off = i * 0.9 + (side > 0 ? 0 : Math.PI);
      const sw = Math.sin(ph + off) * 0.06;
      const lift = Math.max(0, Math.cos(ph + off)) * 0.04;
      const base: V3 = [0.08 - i * 0.05, side * 0.05, bodyU];
      const knee: V3 = [0.16 - i * 0.12 + sw, side * 0.2, bodyU + 0.12 + lift];
      const foot: V3 = [0.22 - i * 0.16 + sw, side * 0.3, 0.01 + lift];
      r.limb(base, knee, 0.022, 0.018, leg);
      r.limb(knee, foot, 0.018, 0.008, leg);
    }
  }
  r.blob(-0.15, 0, bodyU + 0.05, 0.17, 0.15, 0.13, body, { shine: 0.5 });
  // Red hourglass mark on the abdomen
  r.dot(-0.2, 0, bodyU + 0.17, 0.035, '#e0313b', 0.4, 0.2);
  r.blob(0.06, 0, bodyU, 0.09, 0.09, 0.07, shade(body, 0.08));
  // Many eyes + fangs
  if (r.facing(1, 0, 0.2)) {
    for (const [s, u] of [
      [0.03, 0.035],
      [-0.03, 0.035],
      [0.055, 0.015],
      [-0.055, 0.015],
    ])
      r.dot(0.135, s, bodyU + u, 0.014, '#ff4a4a', 0.6, 0.2);
  }
  for (const side of [1, -1]) r.limb([0.13, side * 0.025, bodyU - 0.03], [0.17, side * 0.02, bodyU - 0.09], 0.015, 0.004, '#c9b37a', {}, 0.1);
  r.flush();
}

function scorpion(p: Painter, pose: Pose, d: EnemyDef): void {
  const k = d.size;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const shell = d.color;
  const dark = d.accent;
  const ph = pose.t * TAU;
  const bodyU = 0.13;
  for (let i = 0; i < 3; i++)
    for (const side of [1, -1]) {
      const off = i * 1.2 + (side > 0 ? 0 : Math.PI);
      const sw = Math.sin(ph + off) * 0.05;
      const lift = Math.max(0, Math.cos(ph + off)) * 0.03;
      const base: V3 = [0.02 - i * 0.08, side * 0.08, bodyU];
      const knee: V3 = [0.02 - i * 0.1 + sw, side * 0.2, bodyU + 0.07 + lift];
      r.limb(base, knee, 0.02, 0.016, dark);
      r.limb(knee, [0.02 - i * 0.12 + sw, side * 0.26, 0.01 + lift], 0.016, 0.008, dark);
    }
  // Segmented body
  for (let i = 0; i < 4; i++)
    r.blob(0.06 - i * 0.07, 0, bodyU, 0.07, 0.11 - i * 0.008, 0.055, i % 2 ? shell : shade(shell, 0.06), { shine: 0.35 }, 0.001 * i);
  // Pincers
  for (const side of [1, -1]) {
    const arm1: V3 = [0.14, side * 0.1, bodyU + 0.02];
    const arm2: V3 = [0.26, side * 0.14, bodyU + 0.04 + Math.sin(ph + side) * 0.01];
    r.limb([0.08, side * 0.06, bodyU], arm1, 0.025, 0.022, shell);
    r.limb(arm1, arm2, 0.022, 0.02, shell);
    r.blob(arm2[0] + 0.05, arm2[1], arm2[2], 0.07, 0.04, 0.035, shade(shell, 0.05), { shine: 0.5 }, 0.02);
    r.limb([arm2[0] + 0.08, arm2[1] - side * 0.02, arm2[2]], [arm2[0] + 0.15, arm2[1] - side * 0.035, arm2[2] + 0.01], 0.02, 0.004, dark, {}, 0.03);
    r.limb([arm2[0] + 0.08, arm2[1] + side * 0.015, arm2[2]], [arm2[0] + 0.14, arm2[1] + side * 0.005, arm2[2] - 0.01], 0.016, 0.004, dark, {}, 0.03);
  }
  // Curled tail over the back
  const sway = Math.sin(ph * 0.5) * 0.02;
  const tail: V3[] = [
    [-0.24, 0, bodyU + 0.02],
    [-0.32, sway, bodyU + 0.12],
    [-0.3, sway, bodyU + 0.26],
    [-0.2, sway, bodyU + 0.34],
    [-0.1, sway, bodyU + 0.3],
  ];
  for (let i = 0; i < tail.length - 1; i++)
    r.limb(tail[i], tail[i + 1], 0.045 - i * 0.006, 0.04 - i * 0.006, i % 2 ? shell : shade(shell, 0.06), { shine: 0.3 }, -0.2 + i * 0.01);
  r.limb(tail[4], [-0.04, sway, bodyU + 0.22], 0.025, 0.004, '#3a2414', {}, 0.0);
  r.eyes(0.08, 0, bodyU + 0.03, 0.06, 0.35, d.boss ? '#ff3b2f' : '#1d140c', { size: 0.25, glow: d.boss ? 1 : 0 });
  if (d.boss) {
    // Golden crown and jewelled carapace
    for (let i = 0; i < 5; i++)
      r.limb([0.06, (i - 2) * 0.03, bodyU + 0.05], [0.06, (i - 2) * 0.035, bodyU + 0.11 + (i % 2) * 0.02], 0.014, 0.004, GOLD, { shine: 1 }, 0.05);
    for (let i = 0; i < 3; i++) r.dot(-0.01 - i * 0.07, 0, bodyU + 0.055, 0.02, ['#4ad9ff', '#e0313b', '#7cf2a0'][i], 0.6, 0.1);
  }
  r.flush();
}

function salamander(p: Painter, pose: Pose, d: EnemyDef): void {
  const k = d.size;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const skin = '#e0662e';
  const spot = '#ffd04a';
  const ph = pose.t * TAU;
  const wig = Math.sin(ph);
  const bodyU = 0.1;
  for (const [lf, side, off] of [
    [0.1, 1, 0],
    [0.1, -1, Math.PI],
    [-0.1, 1, Math.PI],
    [-0.1, -1, 0],
  ] as const) {
    const sw = Math.sin(ph + off) * 0.06;
    r.limb([lf, side * 0.06, bodyU], [lf + sw + 0.03, side * 0.17, 0.02], 0.03, 0.022, shade(skin, -0.1));
    r.blob(lf + sw + 0.05, side * 0.18, 0.015, 0.03, 0.03, 0.015, shade(skin, -0.15), {}, 0.01);
  }
  const seg: V3[] = [];
  for (let i = 0; i < 6; i++) seg.push([0.22 - i * 0.1, Math.sin(ph + i * 0.9) * 0.03 * (i / 3), bodyU + 0.01 - (i > 3 ? (i - 3) * 0.02 : 0)]);
  for (let i = 0; i < seg.length - 1; i++) r.limb(seg[i], seg[i + 1], 0.09 - i * 0.014, 0.085 - i * 0.016, skin, { shine: 0.3 }, -i * 0.002);
  r.blob(0.3, wig * 0.01, bodyU + 0.03, 0.1, 0.075, 0.06, skin, { shine: 0.4 }, 0.02);
  for (let i = 0; i < 5; i++) r.dot(0.2 - i * 0.09, seg[i][1], bodyU + 0.08 - i * 0.008, 0.02, spot, 0.8, 0.2);
  r.eyes(0.33, wig * 0.01, bodyU + 0.05, 0.065, 0.7, '#2a0c04', { white: true, size: 0.3 });
  r.flush();
}

// ---------------------------------------------------------------- blobs

function slime(p: Painter, pose: Pose, d: EnemyDef, color = '#69d18f'): void {
  const k = d.size;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const sq = Math.sin(pose.t * TAU);
  const h = 0.22 * (1 + sq * 0.12);
  const w = 0.27 * (1 - sq * 0.08);
  r.blob(0, 0, h * 0.95, w, w, h, color, { shine: 1, alpha: 0.92 });
  // Inner core and bubbles
  r.blob(-0.02, 0.02, h * 0.8, w * 0.35, w * 0.35, h * 0.35, shade(color, -0.3), { line: false, alpha: 0.45 }, 0.2);
  r.dot(0.05, -0.08, h * 1.2, 0.025, shade(color, 0.5), 0, 0.25);
  r.dot(-0.08, 0.06, h * 0.6, 0.018, shade(color, 0.5), 0, 0.25);
  r.eyes(0.02, 0, h * 1.05, w * 0.95, 0.45, '#16232b', { white: true, size: 0.17 });
  r.flush();
}

// ---------------------------------------------------------------- flyers

interface WingSpec {
  /** Wing span (one side). */
  span: number;
  membrane: string;
  bone: string;
  feathers?: boolean;
}

function wings(r: Rig, root: V3, flap: number, w: WingSpec, bias = 0): void {
  for (const side of [1, -1]) {
    const up = 0.18 * flap - 0.06;
    const tip: V3 = [root[0] - 0.08, root[1] + side * w.span, root[2] + up * w.span * 2.2];
    const mid: V3 = [root[0] + 0.02, root[1] + side * w.span * 0.5, root[2] + up * w.span * 1.4 + 0.04];
    const back: V3 = [root[0] - 0.2, root[1] + side * w.span * 0.45, root[2] + up * w.span * 0.8 - 0.06];
    const b = side > 0 ? bias - 0.3 : bias + 0.3;
    if (w.feathers) {
      r.poly(
        [root, mid, tip, [tip[0] - 0.1, tip[1] - side * 0.05, tip[2] - 0.06], back, [root[0] - 0.12, root[1], root[2] - 0.02]],
        w.membrane,
        { smooth: true, grad: [shade(w.membrane, 0.2), shade(w.membrane, -0.25)] },
        b,
      );
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        r.curve(
          [
            [root[0] - 0.02, root[1] + side * w.span * t * 0.4, root[2]],
            [tip[0] - 0.08 * t, root[1] + side * w.span * (0.4 + t * 0.5), root[2] + up * w.span * 2 * (0.4 + t * 0.5) - 0.05 * t],
          ],
          shade(w.membrane, -0.3),
          0.008,
          0.7,
          b + 0.01,
        );
      }
    } else {
      // Bat-like membrane with scalloped trailing edge
      const s1: V3 = [root[0] - 0.12, root[1] + side * w.span * 0.75, root[2] + up * w.span * 1.6 - 0.06];
      r.poly(
        [root, mid, tip, s1, back, [root[0] - 0.14, root[1], root[2] - 0.03]],
        w.membrane,
        { grad: [shade(w.membrane, 0.12), shade(w.membrane, -0.28)] },
        b,
      );
      r.curve([root, mid, tip], w.bone, 0.022, 1, b + 0.01);
      r.curve([mid, s1], w.bone, 0.012, 0.9, b + 0.01);
      r.curve([mid, back], w.bone, 0.012, 0.9, b + 0.01);
    }
  }
}

function bat(p: Painter, pose: Pose, d: EnemyDef): void {
  const k = d.size;
  const hover = 0.9 + 0.25 * k;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const flap = Math.sin(pose.t * TAU) * 0.5 + 0.5;
  const fur = '#5b4a7a';
  const u = hover / k;
  wings(r, [0, 0, u + 0.02], flap, { span: 0.36, membrane: '#7a4f86', bone: '#3a2b4f' });
  r.blob(0, 0, u, 0.11, 0.1, 0.12, fur);
  r.blob(0.06, 0, u + 0.12, 0.085, 0.08, 0.075, shade(fur, 0.08), {}, 0.02);
  for (const side of [1, -1])
    r.poly(
      [
        [0.05, side * 0.03, u + 0.17],
        [0.03, side * 0.08, u + 0.3],
        [0.08, side * 0.055, u + 0.19],
      ],
      fur,
      {},
      0.03,
    );
  r.eyes(0.06, 0, u + 0.13, 0.08, 0.45, '#ff4a6a', { glow: 0.8, size: 0.22 });
  for (const side of [1, -1]) r.limb([0.13, side * 0.015, u + 0.09], [0.135, side * 0.015, u + 0.06], 0.008, 0.002, '#fff', {}, 0.4);
  r.flush();
}

function imp(p: Painter, pose: Pose, d: EnemyDef): void {
  const k = d.size;
  const hover = 0.9 + 0.25 * k;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const flap = Math.sin(pose.t * TAU) * 0.5 + 0.5;
  const skin = '#d9442e';
  const u = hover / k - 0.12;
  wings(r, [-0.03, 0, u + 0.2], flap, { span: 0.26, membrane: '#7a2a2a', bone: '#3a1414' });
  // Tail with arrow tip
  r.curve(
    [
      [-0.06, 0, u + 0.02],
      [-0.18, 0, u - 0.04],
      [-0.24, 0, u + 0.06 + flap * 0.04],
    ],
    skin,
    0.022,
  );
  r.poly(
    [
      [-0.26, 0, u + 0.06 + flap * 0.04],
      [-0.22, 0.03, u + 0.11 + flap * 0.04],
      [-0.3, 0, u + 0.14 + flap * 0.04],
      [-0.22, -0.03, u + 0.11 + flap * 0.04],
    ],
    '#3a1414',
    {},
    -0.1,
  );
  for (const side of [1, -1]) r.limb([0, side * 0.05, u + 0.04], [0.05, side * 0.06, u - 0.1 + flap * 0.03], 0.03, 0.022, shade(skin, -0.1));
  r.blob(0, 0, u + 0.1, 0.09, 0.09, 0.11, skin);
  for (const side of [1, -1]) r.limb([0.02, side * 0.09, u + 0.15], [0.1, side * 0.1, u + 0.06], 0.025, 0.02, skin);
  r.blob(0.03, 0, u + 0.27, 0.1, 0.1, 0.09, shade(skin, 0.06), {}, 0.02);
  for (const side of [1, -1]) r.limb([0.02, side * 0.06, u + 0.33], [-0.03, side * 0.1, u + 0.43], 0.022, 0.004, '#3a1414', {}, 0.03);
  r.eyes(0.03, 0, u + 0.28, 0.095, 0.42, '#ffe066', { glow: 1, size: 0.22 });
  r.dot(0.07, 0.07, u + 0.08, 0.035, '#ffb03a', 1.5, 0.3);
  r.flush();
}

function harpy(p: Painter, pose: Pose, d: EnemyDef): void {
  const k = d.size;
  const hover = 0.9 + 0.25 * k;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const flap = Math.sin(pose.t * TAU) * 0.5 + 0.5;
  const u = hover / k - 0.1;
  wings(r, [-0.02, 0, u + 0.18], flap, { span: 0.42, membrane: '#9a6a44', bone: '#5a3a24', feathers: true });
  // Feathered body, talons
  r.blob(0, 0, u + 0.08, 0.1, 0.1, 0.14, '#b38457');
  r.poly(
    [
      [-0.05, 0, u + 0.02],
      [-0.22, 0.05, u - 0.03],
      [-0.24, -0.05, u - 0.02],
    ],
    '#7a5232',
    {},
    -0.1,
  );
  for (const side of [1, -1]) {
    r.limb([0.02, side * 0.05, u - 0.02], [0.06, side * 0.05, u - 0.12], 0.02, 0.015, '#e0b84a');
    r.limb([0.06, side * 0.05, u - 0.12], [0.1, side * 0.05, u - 0.15], 0.012, 0.004, '#3a2a1a', {}, 0.01);
  }
  r.blob(0.04, 0, u + 0.3, 0.085, 0.085, 0.085, '#e8b98f', {}, 0.02);
  // Wild teal hair
  r.blob(-0.0, 0, u + 0.34, 0.1, 0.1, 0.075, '#2f8f86', {}, 0.0);
  r.curve(
    [
      [-0.02, 0, u + 0.36],
      [-0.12, 0, u + 0.3],
      [-0.2, 0.02, u + 0.24 + flap * 0.03],
    ],
    '#2f8f86',
    0.05,
    1,
    -0.05,
  );
  r.eyes(0.04, 0, u + 0.3, 0.085, 0.42, '#c92a2a', { white: true, size: 0.2 });
  r.limb([0.12, 0, u + 0.29], [0.15, 0, u + 0.27], 0.016, 0.004, '#e0b84a', {}, 0.3);
  r.flush();
}

function wyvern(p: Painter, pose: Pose, d: EnemyDef): void {
  const k = d.size;
  const hover = 0.9 + 0.25 * k;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const flap = Math.sin(pose.t * TAU) * 0.5 + 0.5;
  const scale = '#3f8f6b';
  const belly = '#c9d98a';
  const u = hover / k;
  wings(r, [0.02, 0, u + 0.05], flap, { span: 0.5, membrane: '#5aa37e', bone: '#24543f' });
  const tail: V3[] = [
    [-0.1, 0, u],
    [-0.25, 0, u - 0.03],
    [-0.38, Math.sin(pose.t * TAU) * 0.03, u + 0.01],
    [-0.48, Math.sin(pose.t * TAU + 1) * 0.05, u + 0.05],
  ];
  for (let i = 0; i < 3; i++) r.limb(tail[i], tail[i + 1], 0.06 - i * 0.017, 0.045 - i * 0.017, scale, {}, -0.1);
  r.poly(
    [
      [-0.48, 0, u + 0.05],
      [-0.56, 0.04, u + 0.08],
      [-0.58, -0.04, u + 0.02],
    ],
    '#24543f',
    {},
    -0.12,
  );
  r.tilted(0, 0, u, 0.16, 0.1, 0.09, 0.1, scale);
  r.blob(0.03, 0, u - 0.04, 0.11, 0.07, 0.04, belly, { line: false }, 0.01);
  r.limb([0.1, 0, u + 0.04], [0.2, 0, u + 0.12], 0.055, 0.045, scale);
  r.tilted(0.27, 0, u + 0.14, 0.09, 0.06, 0.055, -0.15, shade(scale, 0.06), {}, 0.02);
  for (const side of [1, -1]) r.limb([0.24, side * 0.03, u + 0.18], [0.17, side * 0.05, u + 0.25], 0.016, 0.004, BONE, {}, 0.03);
  r.eyes(0.27, 0, u + 0.16, 0.06, 0.6, '#ffd23f', { glow: 0.5, size: 0.25 });
  r.flush();
}

// ---------------------------------------------------------------- giants

interface GiantSpec {
  body: string;
  limbs: string;
  head: string;
  belly?: string;
  eyes: string;
  eyeGlow?: number;
  /** Rock-like: segmented, faceted parts. */
  rocky?: boolean;
  deco?: (r: Rig, f: { bodyU: number; headU: number; step: number }) => void;
  right?: (r: Rig, hand: V3) => void;
}

function giant(p: Painter, pose: Pose, d: EnemyDef, s: GiantSpec): void {
  const k = d.size;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const ph = pose.t * TAU;
  const step = Math.sin(ph);
  const bob = Math.abs(Math.cos(ph)) * 0.02;
  const hip = 0.2 + bob;
  for (const side of [1, -1]) {
    const sw = side * step * 0.06;
    const lift = Math.max(0, side * step) * 0.03;
    r.limb([0, side * 0.1, hip], [sw + 0.02, side * 0.11, 0.05 + lift], 0.075, 0.07, s.limbs);
    r.blob(sw + 0.05, side * 0.11, 0.035 + lift, 0.09, 0.075, 0.045, shade(s.limbs, -0.12), {}, 0.01);
  }
  const bodyU = hip + 0.17;
  r.tilted(0.04, 0, bodyU, 0.18, 0.22, 0.2, -0.2, s.body, s.rocky ? { shine: 0.2 } : {});
  if (s.belly) r.tilted(0.13, 0, bodyU - 0.02, 0.09, 0.15, 0.14, -0.2, s.belly, { line: false }, 0.03);
  const headU = bodyU + 0.2;
  for (const side of [1, -1]) {
    const sw = -side * step * 0.06;
    const sh: V3 = [0.04, side * 0.24, bodyU + 0.1];
    const elbow: V3 = [0.08 + sw, side * 0.28, bodyU - 0.06];
    const hand: V3 = [0.12 + sw * 1.4, side * 0.27, hip - 0.04];
    r.limb(sh, elbow, 0.075, 0.065, s.limbs);
    r.limb(elbow, hand, 0.065, 0.06, s.limbs);
    r.blob(hand[0], hand[1], hand[2], 0.075, 0.07, 0.07, shade(s.limbs, -0.06), {}, 0.01);
    if (side < 0) s.right?.(r, hand);
  }
  r.blob(0.12, 0, headU, 0.1, 0.11, 0.1, s.head);
  r.eyes(0.12, 0, headU + 0.01, 0.1, 0.45, s.eyes, { glow: s.eyeGlow ?? 0, size: 0.18 });
  s.deco?.(r, { bodyU, headU, step });
  r.flush();
}

function troll(p: Painter, pose: Pose, d: EnemyDef): void {
  giant(p, pose, d, {
    body: '#6f8f6a',
    limbs: '#668561',
    head: '#78996f',
    belly: '#9cb78c',
    eyes: '#2a1f2f',
    deco: (r, f) => {
      r.blob(0.05, 0, f.bodyU - 0.15, 0.15, 0.2, 0.06, '#7a5a3a', {}, 0.05);
      r.blob(0.2, 0, f.headU - 0.03, 0.06, 0.05, 0.05, '#86a67c', {}, 0.1);
      for (const side of [1, -1]) r.limb([0.18, side * 0.05, f.headU - 0.06], [0.22, side * 0.06, f.headU + 0.02], 0.018, 0.005, BONE, {}, 0.2);
      for (const side of [1, -1])
        r.poly(
          [
            [0.1, side * 0.09, f.headU + 0.02],
            [0.07, side * 0.2, f.headU + 0.06],
            [0.08, side * 0.09, f.headU - 0.03],
          ],
          '#668561',
          {},
          0.01,
        );
      r.curve(
        [
          [0.06, 0.05, f.headU + 0.1],
          [0.1, 0, f.headU + 0.13],
          [0.06, -0.05, f.headU + 0.11],
        ],
        '#3a3020',
        0.02,
        1,
        0.05,
      );
    },
    right: (r, hand) => {
      r.limb([hand[0] - 0.02, hand[1], hand[2] + 0.02], [hand[0] + 0.24, hand[1] - 0.02, hand[2] + 0.34], 0.03, 0.075, WOOD, {}, 0.05);
      for (const [a, b] of [
        [0.15, 0.24],
        [0.2, 0.3],
      ])
        r.limb([hand[0] + a, hand[1] - 0.06, hand[2] + b], [hand[0] + a + 0.02, hand[1] - 0.1, hand[2] + b + 0.03], 0.012, 0.003, IRON, {}, 0.06);
    },
  });
}

function golem(p: Painter, pose: Pose, d: EnemyDef): void {
  giant(p, pose, d, {
    body: '#9a948a',
    limbs: '#8a847a',
    head: '#a39d92',
    eyes: '#ffcf6a',
    eyeGlow: 1.3,
    rocky: true,
    deco: (r, f) => {
      r.dot(0.2, 0, f.bodyU + 0.03, 0.05, '#ffcf6a', 2, 0.1);
      r.curve(
        [
          [0.19, 0.08, f.bodyU + 0.12],
          [0.21, 0.02, f.bodyU + 0.06],
          [0.2, -0.06, f.bodyU + 0.1],
        ],
        '#ffcf6a',
        0.012,
        0.8,
        0.1,
      );
      // Moss patches
      r.blob(-0.02, 0.1, f.bodyU + 0.17, 0.08, 0.08, 0.03, '#6f9a4c', { line: false }, 0.06);
      r.blob(0.08, -0.12, f.headU + 0.08, 0.06, 0.05, 0.02, '#6f9a4c', { line: false }, 0.1);
      for (const side of [1, -1]) r.blob(0.04, side * 0.24, f.bodyU + 0.13, 0.08, 0.08, 0.06, '#7d776d', {}, 0.02);
    },
  });
}

function yeti(p: Painter, pose: Pose, d: EnemyDef): void {
  giant(p, pose, d, {
    body: '#eef2f7',
    limbs: '#e2e8f0',
    head: '#f3f6fa',
    belly: '#c9d7e8',
    eyes: '#1d3a5c',
    deco: (r, f) => {
      // Blue face, horns
      r.blob(0.2, 0, f.headU - 0.01, 0.04, 0.07, 0.06, '#7aa7d6', {}, 0.1);
      for (const side of [1, -1])
        r.curve(
          [
            [0.08, side * 0.08, f.headU + 0.06],
            [0.04, side * 0.16, f.headU + 0.14],
            [0.1, side * 0.18, f.headU + 0.2],
          ],
          '#9a8f7a',
          0.035,
          1,
          0.05,
        );
      r.curve(
        [
          [0.21, 0.04, f.headU - 0.05],
          [0.22, 0, f.headU - 0.06],
          [0.21, -0.04, f.headU - 0.05],
        ],
        '#1d3a5c',
        0.012,
        1,
        0.15,
      );
    },
  });
}

function colossus(p: Painter, pose: Pose, d: EnemyDef): void {
  giant(p, pose, d, {
    body: '#3d3236',
    limbs: '#352b2f',
    head: '#463a3e',
    eyes: '#ffb43a',
    eyeGlow: 2,
    rocky: true,
    deco: (r, f) => {
      // Lava cracks and a molten core
      r.dot(0.2, 0, f.bodyU + 0.02, 0.06, '#ff7a2b', 2.2, 0.1);
      for (const [a, b] of [
        [0.1, 0.12],
        [-0.12, 0.05],
      ])
        r.curve(
          [
            [0.18, a, f.bodyU + b],
            [0.2, a * 0.5, f.bodyU + b - 0.06],
            [0.19, a * 0.2, f.bodyU - 0.1],
          ],
          '#ffb43a',
          0.016,
          1,
          0.12,
        );
      for (const side of [1, -1]) {
        r.blob(0.02, side * 0.24, f.bodyU + 0.13, 0.09, 0.09, 0.07, '#2b2326', {}, 0.02);
        r.dot(0.05, side * 0.27, f.bodyU + 0.17, 0.02, '#ff7a2b', 1, 0.05);
      }
      r.dot(0.0, 0, f.headU + 0.12, 0.05, '#ff9a3a', 2.5, 0.1);
    },
  });
}

// ---------------------------------------------------------------- spectral

function wraith(p: Painter, pose: Pose, d: EnemyDef, lich = false): void {
  const k = d.size;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const ph = pose.t * TAU;
  const hover = 0.12 + Math.sin(ph) * 0.03;
  const robe = lich ? '#4b3a6b' : '#8fa8c8';
  const dark = lich ? '#231a33' : '#4e6280';
  const glow = lich ? '#7cf2c8' : '#bfe9ff';
  const a = lich ? 1 : 0.86;
  // Tattered robe: a teardrop body with ragged hem
  r.add(0, 0, hover + 0.35, () => {
    const ctx = p.ctx;
    const top = r.at(0, 0, hover + 0.62);
    const n = 9;
    const hem: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const ang = Math.PI * (0.1 + t * 0.8);
      const rr = 0.2;
      const q = r.at(
        Math.cos(ang + Math.PI / 2) * rr * 0.3 - 0.04,
        Math.cos(ang) * -rr,
        hover + (i % 2 ? 0.02 : -0.05) + Math.sin(ph * 2 + i) * 0.02,
      );
      hem.push([p.cam.sx(q[0], q[1]), p.cam.sy(q[0], q[1], q[2])]);
    }
    const tx = p.cam.sx(top[0], top[1]);
    const ty = p.cam.sy(top[0], top[1], top[2]);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    const L = hem[0];
    const R = hem[hem.length - 1];
    ctx.quadraticCurveTo(L[0] - (tx - L[0]) * 0.25, (ty + L[1]) / 2, L[0], L[1]);
    for (let i = 1; i < hem.length; i++) ctx.lineTo(hem[i][0], hem[i][1]);
    ctx.quadraticCurveTo(R[0] + (R[0] - tx) * 0.25, (ty + R[1]) / 2, tx, ty);
    ctx.closePath();
    const g = ctx.createLinearGradient(L[0], 0, R[0], 0);
    g.addColorStop(0, shade(robe, 0.2));
    g.addColorStop(0.5, robe);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fill();
    const g2 = ctx.createLinearGradient(0, ty, 0, Math.max(L[1], R[1]));
    g2.addColorStop(0.5, 'rgba(255,255,255,0)');
    g2.addColorStop(1, lich ? 'rgba(124,242,200,0.25)' : 'rgba(220,240,255,0.45)');
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.strokeStyle = 'rgba(34,24,38,0.35)';
    ctx.lineWidth = Math.max(0.6, p.cam.scale * 0.011);
    ctx.stroke();
    ctx.restore();
  });
  // Hood + void face
  const hu = hover + 0.62;
  r.blob(0, 0, hu, 0.15, 0.15, 0.15, robe, { alpha: a }, 0.05);
  if (r.facing(1, 0, 0)) r.blob(0.08, 0, hu - 0.01, 0.06, 0.1, 0.1, '#140f1c', { line: false }, 0.15);
  r.eyes(0.02, 0, hu, 0.13, 0.32, glow, { glow: 1.6, size: 0.16 });
  // Claws reaching forward
  for (const side of [1, -1]) {
    const reach = Math.sin(ph + side) * 0.03;
    r.limb([0.04, side * 0.13, hover + 0.45], [0.2 + reach, side * 0.15, hover + 0.32], 0.035, 0.02, robe, { alpha: a });
    r.curve(
      [
        [0.2 + reach, side * 0.15, hover + 0.32],
        [0.26 + reach, side * 0.16, hover + 0.27],
      ],
      lich ? BONE : '#dbe7f5',
      0.012,
      1,
      0.02,
    );
  }
  if (lich) {
    // Crown and a soul staff
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * TAU;
      r.limb(
        [Math.cos(ang) * 0.1, Math.sin(ang) * 0.1, hu + 0.1],
        [Math.cos(ang) * 0.11, Math.sin(ang) * 0.11, hu + 0.2],
        0.02,
        0.006,
        GOLD,
        { shine: 1 },
        0.06,
      );
    }
    r.blob(0, 0, hu + 0.1, 0.12, 0.12, 0.03, GOLD, { shine: 1 }, 0.05);
    r.dot(0.1, 0, hu + 0.12, 0.02, '#7cf2c8', 1.2, 0.2);
    const sf: V3 = [0.12, -0.24, 0.05];
    r.stick(sf, [0.14, -0.24, hu + 0.25], 0.02, '#3a2a4a', 0.0);
    r.blob(0.14, -0.24, hu + 0.3, 0.05, 0.05, 0.065, '#7cf2c8', { glow: 1.2 }, 0.05);
  }
  r.flush();
}

// ---------------------------------------------------------------- dragons & bosses

function dragon(p: Painter, pose: Pose, d: EnemyDef): void {
  const k = d.size * 0.55;
  const hover = 0.9 + 0.25 * d.size;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const flap = Math.sin(pose.t * TAU) * 0.5 + 0.5;
  const scale = '#6b3fa0';
  const belly = '#ffcf4a';
  const u = hover / k;
  wings(r, [0.05, 0, u + 0.12], flap, { span: 0.75, membrane: '#8c5bc4', bone: '#3a2060' });
  const sway = Math.sin(pose.t * TAU) * 0.05;
  const tail: V3[] = [
    [-0.15, 0, u],
    [-0.35, sway * 0.3, u - 0.05],
    [-0.55, sway, u - 0.02],
    [-0.72, sway * 1.6, u + 0.06],
  ];
  for (let i = 0; i < 3; i++) r.limb(tail[i], tail[i + 1], 0.1 - i * 0.028, 0.075 - i * 0.025, scale, {}, -0.2);
  r.poly(
    [
      [-0.72, sway * 1.6, u + 0.06],
      [-0.84, sway * 1.6 + 0.07, u + 0.12],
      [-0.86, sway * 1.6 - 0.07, u + 0.02],
    ],
    '#3a2060',
    {},
    -0.25,
  );
  // Body + belly plates
  r.tilted(0, 0, u, 0.26, 0.15, 0.14, 0.12, scale, { shine: 0.3 });
  r.tilted(0.05, 0, u - 0.06, 0.18, 0.1, 0.06, 0.12, belly, { line: false }, 0.02);
  // Back spines
  for (let i = 0; i < 4; i++)
    r.poly(
      [
        [0.1 - i * 0.1, 0, u + 0.12],
        [0.06 - i * 0.1, 0, u + 0.21],
        [0.02 - i * 0.1, 0, u + 0.12],
      ],
      '#3a2060',
      {},
      0.03,
    );
  // Legs tucked
  for (const side of [1, -1]) {
    r.limb([0.08, side * 0.1, u - 0.05], [0.12, side * 0.11, u - 0.17], 0.045, 0.035, scale);
    r.limb([-0.12, side * 0.1, u - 0.05], [-0.08, side * 0.11, u - 0.17], 0.05, 0.035, scale);
  }
  // Neck and head
  r.limb([0.18, 0, u + 0.06], [0.34, 0, u + 0.24], 0.085, 0.065, scale);
  r.tilted(0.42, 0, u + 0.27, 0.12, 0.085, 0.075, -0.2, shade(scale, 0.06), { shine: 0.3 }, 0.02);
  r.tilted(0.53, 0, u + 0.23, 0.07, 0.055, 0.04, -0.3, shade(scale, 0.02), {}, 0.03);
  for (const side of [1, -1]) {
    r.curve(
      [
        [0.38, side * 0.05, u + 0.33],
        [0.3, side * 0.08, u + 0.42],
        [0.24, side * 0.07, u + 0.45],
      ],
      BONE,
      0.03,
      1,
      0.03,
    );
  }
  r.eyes(0.43, 0, u + 0.29, 0.08, 0.55, '#ffcf4a', { glow: 1, size: 0.22 });
  r.dot(0.59, 0, u + 0.22, 0.025, '#ff9a3a', 1.6, 0.2);
  r.flush();
}

function hydra(p: Painter, pose: Pose, d: EnemyDef): void {
  const k = d.size * 0.78;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const ph = pose.t * TAU;
  const scale = '#4f8f4a';
  const belly = '#d9d27a';
  // Stubby legs
  for (const [lf, side, off] of [
    [0.15, 1, 0],
    [0.15, -1, Math.PI],
    [-0.15, 1, Math.PI],
    [-0.15, -1, 0],
  ] as const) {
    const sw = Math.sin(ph + off) * 0.05;
    r.limb([lf, side * 0.14, 0.2], [lf + sw, side * 0.16, 0.04], 0.07, 0.06, shade(scale, -0.1));
    r.blob(lf + sw + 0.03, side * 0.16, 0.03, 0.07, 0.06, 0.03, shade(scale, -0.25), {}, 0.01);
  }
  r.blob(0, 0, 0.3, 0.3, 0.22, 0.18, scale, { shine: 0.3 });
  r.blob(0.06, 0, 0.22, 0.22, 0.16, 0.08, belly, { line: false }, 0.02);
  r.curve(
    [
      [-0.28, 0, 0.3],
      [-0.45, Math.sin(ph) * 0.05, 0.22],
      [-0.58, Math.sin(ph + 1) * 0.08, 0.15],
    ],
    scale,
    0.09,
    1,
    -0.2,
  );
  for (let i = 0; i < 3; i++) {
    const side = i - 1;
    const sw = Math.sin(ph + i * 2.1) * 0.04;
    const base: V3 = [0.2, side * 0.1, 0.38];
    const mid: V3 = [0.3 + sw, side * 0.22, 0.7 - Math.abs(side) * 0.1];
    const head: V3 = [0.42 + sw, side * 0.27, 0.92 - Math.abs(side) * 0.14 + Math.sin(ph * 2 + i) * 0.02];
    r.limb(base, mid, 0.085, 0.07, scale, {}, 0.05 * i);
    r.limb(mid, head, 0.07, 0.06, scale, {}, 0.05 * i + 0.01);
    r.tilted(head[0] + 0.05, head[1], head[2] + 0.01, 0.13, 0.085, 0.075, -0.15, shade(scale, 0.08), { shine: 0.3 }, 0.05 * i + 0.02);
    r.tilted(head[0] + 0.15, head[1], head[2] - 0.02, 0.06, 0.055, 0.035, -0.3, belly, { line: true }, 0.05 * i + 0.025);
    r.eyes(head[0] + 0.05, head[1], head[2] + 0.04, 0.085, 0.55, '#ff5a3a', { glow: 0.8, size: 0.22 });
    for (const s of [1, -1])
      r.limb(
        [head[0] - 0.01, head[1] + s * 0.04, head[2] + 0.06],
        [head[0] - 0.09, head[1] + s * 0.06, head[2] + 0.14],
        0.02,
        0.004,
        '#2f5f2c',
        {},
        0.05 * i + 0.03,
      );
  }
  r.flush();
}

function ram(p: Painter, pose: Pose, d: EnemyDef): void {
  const k = d.size * 0.85;
  const r = new Rig(p, pose.x, pose.y, 0, pose.angle, k);
  const roll = pose.t * TAU;
  // Wheels
  for (const [wf, side] of [
    [0.2, 1],
    [0.2, -1],
    [-0.2, 1],
    [-0.2, -1],
  ] as const) {
    r.add(
      wf,
      side * 0.24,
      0.1,
      () => {
        const C = r.at(wf, side * 0.24, 0.1);
        const ax = r.dir(0.1, 0, 0);
        const up: V3 = [0, 0, 0.1 * r.k];
        const n = r.dir(0, 0.02 * side, 0);
        ellipsoidRef(p, C, ax, up, n, WOOD_DARK);
        ellipsoidRef(p, [C[0] + n[0], C[1] + n[1], C[2]], [ax[0] * 0.75, ax[1] * 0.75, 0], [0, 0, up[2] * 0.75], n, WOOD);
        // Spokes
        for (let i = 0; i < 4; i++) {
          const a = roll + (i * Math.PI) / 4;
          const cs = Math.cos(a);
          const sn = Math.sin(a);
          const e1: V3 = [C[0] + n[0] * 1.5 + ax[0] * cs * 0.7, C[1] + n[1] * 1.5 + ax[1] * cs * 0.7, C[2] + up[2] * sn * 0.7];
          const e2: V3 = [C[0] + n[0] * 1.5 - ax[0] * cs * 0.7, C[1] + n[1] * 1.5 - ax[1] * cs * 0.7, C[2] - up[2] * sn * 0.7];
          const ctx = p.ctx;
          ctx.beginPath();
          ctx.moveTo(p.cam.sx(e1[0], e1[1]), p.cam.sy(e1[0], e1[1], e1[2]));
          ctx.lineTo(p.cam.sx(e2[0], e2[1]), p.cam.sy(e2[0], e2[1], e2[2]));
          ctx.strokeStyle = WOOD_DARK;
          ctx.lineWidth = Math.max(0.8, p.cam.scale * 0.015 * r.k);
          ctx.stroke();
        }
        ellipsoidRef(p, [C[0] + n[0] * 2, C[1] + n[1] * 2, C[2]], [ax[0] * 0.2, ax[1] * 0.2, 0], [0, 0, up[2] * 0.2], n, IRON, { shine: 1 });
      },
      side > 0 ? 0.4 : -0.4,
    );
  }
  // Chassis
  r.add(0, 0, 0.2, () => {
    p.rbox(r.at(0, 0, 0)[0], r.at(0, 0, 0)[1], 0.14 * r.k, 0.6 * r.k, 0.42 * r.k, 0.08 * r.k, r.angle, WOOD);
  });
  // A-frame roof of hides
  r.add(
    0,
    0,
    0.4,
    () => {
      const L = (f: number, s: number, u: number) => r.at(f, s, u);
      const pts = (s: number): V3[] => [L(-0.28, s * 0.22, 0.22), L(0.24, s * 0.22, 0.22), L(0.24, 0, 0.52), L(-0.28, 0, 0.52)];
      for (const s of [1, -1]) {
        const q = pts(s);
        const n = r.dir(0, s, 0.7);
        p.face(q, s > 0 ? '#8f6a4a' : '#7a5a3e', n);
      }
      p.face([L(0.24, 0.22, 0.22), L(0.24, -0.22, 0.22), L(0.24, 0, 0.52)], '#6a4a30', r.dir(1, 0, 0));
      p.face([L(-0.28, 0.22, 0.22), L(-0.28, -0.22, 0.22), L(-0.28, 0, 0.52)], '#6a4a30', r.dir(-1, 0, 0));
    },
    0.05,
  );
  // The ram log and iron head (swings)
  const swing = Math.sin(roll * 2) * 0.03;
  r.limb([-0.2, 0, 0.34], [0.36 + swing, 0, 0.32], 0.06, 0.06, WOOD, {}, 0.3);
  r.blob(0.42 + swing, 0, 0.32, 0.08, 0.08, 0.075, IRON, { shine: 0.8 }, 0.32);
  for (const side of [1, -1])
    r.curve(
      [
        [0.4 + swing, side * 0.05, 0.36],
        [0.44 + swing, side * 0.12, 0.4],
        [0.48 + swing, side * 0.1, 0.33],
      ],
      '#d9cfb6',
      0.03,
      1,
      0.33,
    );
  r.flush();
}

// ---------------------------------------------------------------- registry

type Draw = (p: Painter, pose: Pose, d: EnemyDef) => void;

export const CREATURES: Record<string, Draw> = {
  goblin,
  bandit,
  wolf,
  bat,
  knight: (p, pose, d) => knight(p, pose, d, false),
  runeguard: (p, pose, d) => knight(p, pose, d, true),
  slime: (p, pose, d) => slime(p, pose, d),
  slimeling: (p, pose, d) => slime(p, pose, d, '#8fe6a8'),
  shaman,
  troll,
  skeleton,
  golem,
  wraith: (p, pose, d) => wraith(p, pose, d, false),
  wyvern,
  warlord,
  lich: (p, pose, d) => wraith(p, pose, d, true),
  dragon,
  spider,
  orc,
  necromancer,
  harpy,
  ram,
  imp,
  scorpion,
  mummy,
  triton,
  yeti,
  salamander,
  witch,
  hydra,
  colossus,
  scorpionKing: scorpion,
};

export function drawCreature(p: Painter, d: EnemyDef, pose: Pose): void {
  const fn = CREATURES[d.id] ?? goblin;
  fn(p, pose, d);
}
