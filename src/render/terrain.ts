import type { Board, Tile } from '../game/board';
import { mix, rgba, shade } from './color';
import { Painter } from './painter';
import { Camera, CIRCLE_RX, CIRCLE_RY } from './projection';
import { ball, curve, ellipsoid, limb, poly, type V3 } from './models/kit';
import { makeSprite, outlineCanvas, type Sprite } from './sprites';
import type { Theme } from './theme';

export const GRASS_H = 0.18;
export const SLAB = 0.9;
const WATER_Z = -0.1;

const RAISED = new Set(['grass', 'flowers', 'tree', 'rock']);
const isRaised = (t: Tile | undefined) => !!t && RAISED.has(t.kind);
const isWater = (t: Tile | undefined) => !!t && (t.kind === 'water' || t.kind === 'lava');

/** Deterministic pseudo random per tile. */
const rnd = (seed: number, i: number) => {
  const v = Math.sin(seed * 9301 + i * 49297) * 233280;
  return v - Math.floor(v);
};

type P2 = [number, number];
const quad = (x: number, y: number, w = 1, d = 1): P2[] => [
  [x, y],
  [x + w, y],
  [x + w, y + d],
  [x, y + d],
];

/** Draws every static ground tile of the board, back to front. */
export function drawGround(p: Painter, board: Board, theme: Theme): void {
  const W = board.width;
  const H = board.height;
  drawSlab(p, board, theme);
  for (let d = 0; d <= W + H - 2; d++) {
    for (let x = Math.max(0, d - H + 1); x <= Math.min(W - 1, d); x++) {
      const t = board.tiles[d - x][x];
      if (isRaised(t)) drawGrassTile(p, board, theme, t);
      else if (isWater(t)) drawWaterTile(p, board, theme, t);
      else drawPathTile(p, board, theme, t);
    }
  }
}

/** The island: earth and rock strata under the board, visible on the two front faces. */
function drawSlab(p: Painter, board: Board, theme: Theme): void {
  const W = board.width;
  const H = board.height;
  const ctx = p.ctx;
  const bands: [number, number, string][] = [
    [0, -0.22, theme.dirt],
    [-0.22, -0.5, theme.dirtDark],
    [-0.5, -SLAB, theme.stone],
  ];
  for (const [z0, z1, color] of bands) {
    p.face(
      [
        [0, H, z1],
        [W, H, z1],
        [W, H, z0],
        [0, H, z0],
      ],
      color,
      [0, 1, 0],
    );
    p.face(
      [
        [W, 0, z1],
        [W, H, z1],
        [W, H, z0],
        [W, 0, z0],
      ],
      color,
      [1, 0, 0],
    );
  }
  // Strata texture: irregular stones on the lower bands.
  for (let i = 0; i < (W + H) * 3; i++) {
    const onFront = i % 2 === 0;
    const t = rnd(i, 3) * ((onFront ? W : H) - 0.4);
    const z = -0.32 - rnd(i, 4) * (SLAB - 0.42);
    const w = 0.18 + rnd(i, 5) * 0.35;
    const h = 0.04 + rnd(i, 6) * 0.06;
    const base = z < -0.5 ? theme.stone : theme.dirtDark;
    const col = rnd(i, 7) > 0.5 ? shade(base, 0.12) : shade(base, -0.16);
    p.face(
      onFront
        ? [
            [t, H, z],
            [t + w, H, z],
            [t + w, H, z + h],
            [t, H, z + h],
          ]
        : [
            [W, t, z],
            [W, t + w, z],
            [W, t + w, z + h],
            [W, t, z + h],
          ],
      col,
      onFront ? [0, 1, 0] : [1, 0, 0],
    );
  }
  // Grass lip hanging over the top edge.
  ctx.beginPath();
  const lip = (x0: number, y0: number, x1: number, y1: number) => {
    ctx.moveTo(p.cam.sx(x0, y0), p.cam.sy(x0, y0, -0.03));
    ctx.lineTo(p.cam.sx(x1, y1), p.cam.sy(x1, y1, -0.03));
  };
  lip(0, H, W, H);
  lip(W, 0, W, H);
  ctx.strokeStyle = rgba(theme.grassDark, 0.7);
  ctx.lineWidth = Math.max(1, p.cam.scale * 0.06);
  ctx.lineCap = 'round';
  ctx.stroke();
}

function grassColor(theme: Theme, t: Tile): string {
  // Low-frequency variation so the lawn reads as natural, not as a checkerboard.
  const n = Math.sin(t.x * 0.7 + t.y * 0.4) * 0.5 + Math.sin(t.x * 0.23 - t.y * 0.61) * 0.5;
  return mix(theme.grass, n > 0 ? theme.grassLight : theme.grassDark, Math.abs(n) * 0.3 + rnd(t.seed, 1) * 0.06);
}

function drawGrassTile(p: Painter, board: Board, theme: Theme, t: Tile): void {
  const { x, y } = t;
  const col = grassColor(theme, t);
  const front = board.tile(x, y + 1);
  const right = board.tile(x + 1, y);
  // Exposed earth walls towards lower neighbours, with a grass lip on top.
  const wall = (pts: [number, number, number][], n: [number, number, number]) => {
    p.face(pts, theme.dirt, n);
    const ctx = p.ctx;
    ctx.beginPath();
    ctx.moveTo(p.cam.sx(pts[3][0], pts[3][1]), p.cam.sy(pts[3][0], pts[3][1], GRASS_H - 0.025));
    ctx.lineTo(p.cam.sx(pts[2][0], pts[2][1]), p.cam.sy(pts[2][0], pts[2][1], GRASS_H - 0.025));
    ctx.strokeStyle = shade(col, -0.2);
    ctx.lineWidth = Math.max(1, p.cam.scale * 0.05);
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  if (front && !isRaised(front)) {
    const lower = isWater(front) ? WATER_Z : 0;
    wall(
      [
        [x, y + 1, lower],
        [x + 1, y + 1, lower],
        [x + 1, y + 1, GRASS_H],
        [x, y + 1, GRASS_H],
      ],
      [0, 1, 0],
    );
  }
  if (right && !isRaised(right)) {
    const lower = isWater(right) ? WATER_Z : 0;
    wall(
      [
        [x + 1, y + 1, lower],
        [x + 1, y, lower],
        [x + 1, y, GRASS_H],
        [x + 1, y + 1, GRASS_H],
      ],
      [1, 0, 0],
    );
  }
  p.flat(quad(x, y), GRASS_H, col);
  decorateGrass(p, theme, t, col);
}

function decorateGrass(p: Painter, theme: Theme, t: Tile, col: string): void {
  const ctx = p.ctx;
  const S = p.cam.scale;
  // Soft mottling
  for (let i = 0; i < 3; i++) {
    const gx = t.x + 0.18 + rnd(t.seed, i + 10) * 0.64;
    const gy = t.y + 0.18 + rnd(t.seed, i + 20) * 0.64;
    const r = 0.1 + rnd(t.seed, i + 30) * 0.14;
    ctx.beginPath();
    ctx.ellipse(p.cam.sx(gx, gy), p.cam.sy(gx, gy, GRASS_H), r * S * CIRCLE_RX, r * S * CIRCLE_RY, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(rnd(t.seed, i + 40) > 0.5 ? theme.grassLight : theme.grassDark, 0.2);
    ctx.fill();
  }
  if (theme.ground === 'sand') {
    // Wind ripples
    ctx.strokeStyle = rgba(theme.grassDark, 0.45);
    ctx.lineWidth = Math.max(0.6, S * 0.014);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const gx = t.x + 0.15 + rnd(t.seed, i + 51) * 0.5;
      const gy = t.y + 0.15 + rnd(t.seed, i + 52) * 0.6;
      const sx = p.cam.sx(gx, gy);
      const sy = p.cam.sy(gx, gy, GRASS_H);
      const w = S * (0.12 + rnd(t.seed, i + 53) * 0.12);
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + w * 0.5, sy - S * 0.03, sx + w, sy + S * 0.01);
    }
    ctx.stroke();
  } else if (theme.ground === 'ash') {
    // Cracks glowing with heat
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      if (rnd(t.seed, i + 51) > 0.55) continue;
      let gx = t.x + 0.2 + rnd(t.seed, i + 52) * 0.6;
      let gy = t.y + 0.2 + rnd(t.seed, i + 53) * 0.6;
      ctx.beginPath();
      ctx.moveTo(p.cam.sx(gx, gy), p.cam.sy(gx, gy, GRASS_H));
      for (let k = 0; k < 3; k++) {
        gx += (rnd(t.seed, i * 9 + k) - 0.5) * 0.3;
        gy += (rnd(t.seed, i * 9 + k + 4) - 0.5) * 0.3;
        ctx.lineTo(p.cam.sx(gx, gy), p.cam.sy(gx, gy, GRASS_H));
      }
      ctx.strokeStyle = 'rgba(255,120,40,0.35)';
      ctx.lineWidth = Math.max(1.5, S * 0.035);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,200,90,0.85)';
      ctx.lineWidth = Math.max(0.6, S * 0.012);
      ctx.stroke();
    }
  } else {
    // Grass blades
    const blades = theme.snow ? 2 : 5;
    ctx.strokeStyle = shade(col, theme.snow ? -0.1 : -0.22);
    ctx.lineWidth = Math.max(0.7, S * 0.016);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < blades; i++) {
      if (rnd(t.seed, i + 50) > 0.7) continue;
      const gx = t.x + 0.12 + rnd(t.seed, i + 51) * 0.76;
      const gy = t.y + 0.12 + rnd(t.seed, i + 52) * 0.76;
      const sx = p.cam.sx(gx, gy);
      const sy = p.cam.sy(gx, gy, GRASS_H);
      const h = S * (0.05 + rnd(t.seed, i + 53) * 0.05) * (theme.ground === 'bog' ? 1.8 : 1);
      ctx.moveTo(sx - S * 0.03, sy);
      ctx.lineTo(sx - S * 0.045, sy - h);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + S * 0.005, sy - h * 1.2);
      ctx.moveTo(sx + S * 0.03, sy);
      ctx.lineTo(sx + S * 0.05, sy - h * 0.9);
    }
    ctx.stroke();
    if (theme.ground === 'bog' && rnd(t.seed, 70) > 0.6) {
      // Muddy puddle
      const gx = t.x + 0.3 + rnd(t.seed, 71) * 0.4;
      const gy = t.y + 0.3 + rnd(t.seed, 72) * 0.4;
      ctx.beginPath();
      ctx.ellipse(p.cam.sx(gx, gy), p.cam.sy(gx, gy, GRASS_H), S * 0.16, S * 0.07, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(theme.waterDeep, 0.55);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(p.cam.sx(gx, gy) - S * 0.03, p.cam.sy(gx, gy, GRASS_H) - S * 0.015, S * 0.06, S * 0.02, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();
    }
  }
  if (t.kind === 'flowers') {
    for (let i = 0; i < 9; i++) {
      const fx = t.x + 0.12 + rnd(t.seed, i) * 0.76;
      const fy = t.y + 0.12 + rnd(t.seed, i + 60) * 0.76;
      const sx = p.cam.sx(fx, fy);
      const sy = p.cam.sy(fx, fy, GRASS_H) - S * 0.04;
      ctx.fillStyle = shade(col, -0.3);
      ctx.fillRect(sx - 0.5, sy, 1, S * 0.04);
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1.2, S * 0.032), 0, Math.PI * 2);
      ctx.fillStyle = theme.flowers[i % theme.flowers.length];
      ctx.fill();
    }
  }
}

function drawPathTile(p: Painter, board: Board, theme: Theme, t: Tile): void {
  const { x, y } = t;
  const ctx = p.ctx;
  // Worn centre: lighter where feet and wheels pass.
  const cx = p.cam.sx(x + 0.5, y + 0.5);
  const cy = p.cam.sy(x + 0.5, y + 0.5, 0);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, p.cam.scale * 0.95);
  g.addColorStop(0, theme.pathLight);
  g.addColorStop(0.6, theme.path);
  g.addColorStop(1, theme.pathDark);
  p.flat(quad(x, y), 0, g);
  // Shadows cast by the raised lawn (sun from −x/+y).
  const shadowStrip = (pts: P2[], from: P2, to: P2) => {
    const sg = ctx.createLinearGradient(p.cam.sx(from[0], from[1]), p.cam.sy(from[0], from[1], 0), p.cam.sx(to[0], to[1]), p.cam.sy(to[0], to[1], 0));
    sg.addColorStop(0, 'rgba(40,28,40,0.28)');
    sg.addColorStop(1, 'rgba(40,28,40,0)');
    p.flat(pts, 0.001, sg);
  };
  if (isRaised(board.tile(x - 1, y))) shadowStrip(quad(x, y, 0.34, 1), [x, y + 0.5], [x + 0.34, y + 0.5]);
  if (isRaised(board.tile(x, y - 1))) shadowStrip(quad(x, y, 1, 0.16), [x + 0.5, y], [x + 0.5, y + 0.16]);
  if (isRaised(board.tile(x, y + 1))) shadowStrip(quad(x, y + 0.86, 1, 0.14), [x + 0.5, y + 1], [x + 0.5, y + 0.86]);
  // Pebbles
  for (let i = 0; i < 4; i++) {
    if (rnd(t.seed, i) > 0.6) continue;
    const px = x + 0.12 + rnd(t.seed, i + 3) * 0.76;
    const py = y + 0.12 + rnd(t.seed, i + 6) * 0.76;
    const r = 0.025 + rnd(t.seed, i + 9) * 0.035;
    p.cap(px, py, 0.002, r, theme.pathDark, false);
    p.cap(px - 0.008, py + 0.008, 0.004, r * 0.6, shade(theme.pathLight, 0.2), false);
  }
}

function drawWaterTile(p: Painter, board: Board, theme: Theme, t: Tile): void {
  if (t.kind === 'lava') {
    drawLavaTile(p, board, theme, t);
    return;
  }
  const { x, y } = t;
  const ctx = p.ctx;
  const g = ctx.createLinearGradient(p.cam.sx(x, y), p.cam.sy(x, y, WATER_Z), p.cam.sx(x + 1, y + 1), p.cam.sy(x + 1, y + 1, WATER_Z));
  g.addColorStop(0, theme.waterDeep);
  g.addColorStop(1, theme.water);
  p.flat(quad(x, y), WATER_Z, g);
  // Depth: tiles far from any shore read darker (open sea / deep lagoon).
  let open = 0;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    if (isWater(board.tile(x + dx, y + dy))) open++;
  if (open === 4) p.flat(quad(x + 0.1, y + 0.1, 0.8, 0.8), WATER_Z + 0.001, rgba(theme.waterDeep, 0.25));
  if (theme.ground === 'bog') {
    // Lily pads and duckweed
    for (let i = 0; i < 3; i++) {
      if (rnd(t.seed, i + 90) > 0.65) continue;
      const lx = x + 0.2 + rnd(t.seed, i + 91) * 0.6;
      const ly = y + 0.2 + rnd(t.seed, i + 92) * 0.6;
      const r = 0.07 + rnd(t.seed, i + 93) * 0.06;
      const sx = p.cam.sx(lx, ly);
      const sy = p.cam.sy(lx, ly, WATER_Z);
      const a0 = rnd(t.seed, i + 94) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.ellipse(sx, sy, r * p.cam.scale * CIRCLE_RX, r * p.cam.scale * CIRCLE_RY, 0, a0 + 0.5, a0 + Math.PI * 2 - 0.1);
      ctx.closePath();
      ctx.fillStyle = i === 0 ? '#7fae4a' : '#6a9a3e';
      ctx.fill();
      if (rnd(t.seed, i + 95) > 0.7) {
        ctx.beginPath();
        ctx.arc(sx, sy - 1, Math.max(1.2, p.cam.scale * 0.03), 0, Math.PI * 2);
        ctx.fillStyle = '#ffd1f0';
        ctx.fill();
      }
    }
  }
  const foam = (a: P2, b: P2) => {
    ctx.beginPath();
    ctx.moveTo(p.cam.sx(a[0], a[1]), p.cam.sy(a[0], a[1], WATER_Z));
    ctx.lineTo(p.cam.sx(b[0], b[1]), p.cam.sy(b[0], b[1], WATER_Z));
    ctx.strokeStyle = rgba(theme.foam, 0.75);
    ctx.lineWidth = Math.max(1, p.cam.scale * 0.045);
    ctx.stroke();
  };
  if (!isWater(board.tile(x - 1, y))) foam([x + 0.03, y], [x + 0.03, y + 1]);
  if (!isWater(board.tile(x, y - 1))) foam([x, y + 0.03], [x + 1, y + 0.03]);
  for (let i = 0; i < 2; i++) {
    const gx = x + 0.2 + rnd(t.seed, i + 70) * 0.6;
    const gy = y + 0.2 + rnd(t.seed, i + 71) * 0.6;
    ctx.beginPath();
    ctx.ellipse(p.cam.sx(gx, gy), p.cam.sy(gx, gy, WATER_Z), p.cam.scale * 0.1, p.cam.scale * 0.025, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
  }
}

function drawLavaTile(p: Painter, board: Board, theme: Theme, t: Tile): void {
  const { x, y } = t;
  const ctx = p.ctx;
  const cx = p.cam.sx(x + 0.5, y + 0.5);
  const cy = p.cam.sy(x + 0.5, y + 0.5, WATER_Z);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, p.cam.scale * 1.1);
  g.addColorStop(0, '#ffd04a');
  g.addColorStop(0.45, theme.lava);
  g.addColorStop(1, theme.lavaDeep);
  p.flat(quad(x, y), WATER_Z, g);
  // Cooling crust plates
  for (let i = 0; i < 3; i++) {
    if (rnd(t.seed, i + 100) > 0.7) continue;
    const px = x + 0.18 + rnd(t.seed, i + 101) * 0.64;
    const py = y + 0.18 + rnd(t.seed, i + 102) * 0.64;
    const r = 0.08 + rnd(t.seed, i + 103) * 0.1;
    const pts: P2[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rnd(t.seed, i * 7 + k);
      const rr = r * (0.7 + rnd(t.seed, i * 11 + k) * 0.5);
      pts.push([px + Math.cos(a) * rr, py + Math.sin(a) * rr]);
    }
    p.flat(pts, WATER_Z + 0.002, rgba('#3a2420', 0.75));
  }
  // Glowing rim where lava meets rock
  const rim = (a: P2, b: P2) => {
    ctx.beginPath();
    ctx.moveTo(p.cam.sx(a[0], a[1]), p.cam.sy(a[0], a[1], WATER_Z));
    ctx.lineTo(p.cam.sx(b[0], b[1]), p.cam.sy(b[0], b[1], WATER_Z));
    ctx.strokeStyle = 'rgba(255,220,120,0.8)';
    ctx.lineWidth = Math.max(1, p.cam.scale * 0.04);
    ctx.stroke();
  };
  if (!isWater(board.tile(x - 1, y))) rim([x + 0.03, y], [x + 0.03, y + 1]);
  if (!isWater(board.tile(x, y - 1))) rim([x, y + 0.03], [x + 1, y + 0.03]);
}

/** Tall decoration of a tile (trees, rocks), drawn as a depth-sorted sprite. */
export function drawDecor(p: Painter, theme: Theme, t: Tile): void {
  if (t.kind === 'tree') drawTrees(p, theme, t);
  else if (t.kind === 'rock') drawRocks(p, theme, t);
}

export const hasDecor = (t: Tile): boolean => t.kind === 'tree' || t.kind === 'rock';

/** Leafy canopy built from overlapping lit/shaded blobs. */
export function canopy(p: Painter, cx: number, cy: number, z: number, r: number, leaf: string, seed: number): void {
  const blobs: [number, number, number, number][] = [
    [0.35, -0.35, 0.0, 0.7],
    [-0.3, -0.25, 0.08, 0.68],
    [0.3, 0.25, -0.08, 0.72],
    [-0.25, 0.3, -0.04, 0.7],
    [0, 0, 0.3, 0.78],
    [-0.08, 0.08, 0.6, 0.55],
  ];
  blobs.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) + (a[2] - b[2]) * 0.5);
  for (const [dx, dy, dz, rr] of blobs) {
    const j = rnd(seed, dx * 10 + dy * 7) * 0.12;
    p.sphere(cx + dx * r, cy + dy * r, z + dz * r * 1.3, r * (rr + j), shade(leaf, dz * 0.3 + (dy - dx) * 0.08 - 0.04));
  }
  const ctx = p.ctx;
  ctx.fillStyle = rgba(shade(leaf, 0.5), 0.5);
  for (let i = 0; i < 7; i++) {
    const a = rnd(seed, i + 80) * Math.PI * 2;
    const d = rnd(seed, i + 81) * r * 0.75;
    const wx = cx - 0.15 * r + Math.cos(a) * d;
    const wy = cy + 0.15 * r + Math.sin(a) * d;
    ctx.beginPath();
    ctx.arc(p.cam.sx(wx, wy), p.cam.sy(wx, wy, z + r * 0.75), Math.max(1, p.cam.scale * r * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrees(p: Painter, theme: Theme, t: Tile): void {
  const count = rnd(t.seed, 1) > 0.55 ? 2 : 1;
  const spots =
    count === 1
      ? [[0.5, 0.5]]
      : [
          [0.3, 0.32],
          [0.68, 0.68],
        ];
  for (let i = 0; i < count; i++) {
    const cx = t.x + spots[i][0] + (rnd(t.seed, i + 2) - 0.5) * 0.12;
    const cy = t.y + spots[i][1] + (rnd(t.seed, i + 4) - 0.5) * 0.12;
    const size = (count === 1 ? 1.05 : 0.82) * (0.85 + rnd(t.seed, i + 6) * 0.3);
    const leaf = theme.leaves[Math.floor(rnd(t.seed, i + 8) * theme.leaves.length)];
    p.shadow(cx, cy, GRASS_H, 0.36 * size, 0.32);
    if (theme.tree === 'palm' || (theme.tree === 'desert' && t.nearWater)) {
      drawPalm(p, cx, cy, size, leaf, theme, t.seed + i);
      continue;
    }
    if (theme.tree === 'desert') {
      drawCactus(p, cx, cy, size, t.seed + i);
      continue;
    }
    if (theme.tree === 'dead' || (theme.tree === 'swamp' && rnd(t.seed, i + 30) < 0.25)) {
      drawDeadTree(p, cx, cy, size, theme, t.seed + i);
      continue;
    }
    if (theme.tree === 'swamp' && rnd(t.seed, i + 30) < 0.5) {
      drawMushrooms(p, cx, cy, size, t.seed + i);
      continue;
    }
    if (theme.tree === 'swamp') {
      drawWillow(p, cx, cy, size, leaf, theme, t.seed + i);
      continue;
    }
    if (theme.tree === 'pine') {
      p.cylinder(cx, cy, GRASS_H, 0.05 * size, 0.2 * size, theme.trunk);
      for (let k = 0; k < 3; k++) {
        const z = GRASS_H + (0.14 + k * 0.26) * size;
        const r = (0.34 - k * 0.08) * size;
        p.cone(cx, cy, z, r, 0.42 * size, leaf);
        if (theme.snow) p.cone(cx, cy, z + 0.22 * size, r * 0.55, 0.2 * size, '#f6f9ff');
      }
    } else {
      p.cylinder(cx, cy, GRASS_H, 0.055 * size, 0.34 * size, theme.trunk, null, 0.04 * size);
      canopy(p, cx, cy, GRASS_H + 0.58 * size, 0.3 * size, leaf, t.seed + i);
    }
  }
}

function drawPalm(p: Painter, cx: number, cy: number, size: number, leaf: string, theme: Theme, seed: number): void {
  const lean = (rnd(seed, 3) - 0.5) * 0.5;
  const lx = Math.cos(seed * 7) * lean;
  const ly = Math.sin(seed * 7) * lean;
  const h = 0.95 * size;
  // Ringed, slightly curved trunk
  const n = 6;
  let prev: V3 = [cx, cy, GRASS_H];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const q: V3 = [cx + lx * t * t, cy + ly * t * t, GRASS_H + h * t];
    limb(p, prev, q, 0.055 * size * (1.15 - t * 0.35), 0.05 * size * (1.15 - t * 0.35), i % 2 ? theme.trunk : shade(theme.trunk, 0.12));
    prev = q;
  }
  const top = prev;
  // Coconuts
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + seed;
    ball(p, [top[0] + Math.cos(a) * 0.05 * size, top[1] + Math.sin(a) * 0.05 * size, top[2] - 0.04 * size], 0.035 * size, '#6a4a2a');
  }
  // Fronds, back ones first
  const fronds = 7;
  const list = Array.from({ length: fronds }, (_, i) => (i / fronds) * Math.PI * 2 + rnd(seed, 9) * 2).sort(
    (a, b) => Math.cos(a) + Math.sin(a) - (Math.cos(b) + Math.sin(b)),
  );
  for (const a of list) {
    const len = (0.42 + rnd(seed, a * 3) * 0.12) * size;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const mid: V3 = [top[0] + dx * len * 0.5, top[1] + dy * len * 0.5, top[2] + 0.06 * size];
    const tip: V3 = [top[0] + dx * len, top[1] + dy * len, top[2] - 0.16 * size];
    const w = 0.07 * size;
    const nx = -dy * w;
    const ny = dx * w;
    poly(p, [top, [mid[0] + nx, mid[1] + ny, mid[2]], tip, [mid[0] - nx, mid[1] - ny, mid[2]]], leaf, {
      smooth: true,
      grad: [shade(leaf, 0.18), shade(leaf, -0.2)],
      line: true,
    });
    curve(p, [top, mid, tip], shade(leaf, -0.3), 0.012 * size, 0.8);
  }
}

function drawCactus(p: Painter, cx: number, cy: number, size: number, seed: number): void {
  const green = rnd(seed, 2) > 0.5 ? '#5f9a4a' : '#6aa653';
  const h = (0.55 + rnd(seed, 4) * 0.25) * size;
  const r = 0.085 * size;
  limb(p, [cx, cy, GRASS_H], [cx, cy, GRASS_H + h], r, r * 0.92, green);
  ball(p, [cx, cy, GRASS_H + h], r * 0.92, green, { line: true });
  // Arms
  for (const side of [1, -1]) {
    if (rnd(seed, side + 6) < 0.3) continue;
    const z0 = GRASS_H + h * (0.35 + rnd(seed, side + 8) * 0.25);
    const ox = side * 0.17 * size * 0.7;
    const oy = -side * 0.17 * size * 0.7;
    const elbow: V3 = [cx + ox, cy + oy, z0];
    limb(p, [cx, cy, z0 - 0.02], elbow, r * 0.62, r * 0.6, green);
    limb(p, elbow, [elbow[0], elbow[1], z0 + h * 0.3], r * 0.6, r * 0.55, green);
    ball(p, [elbow[0], elbow[1], z0 + h * 0.3], r * 0.55, green, { line: true });
  }
  // Ribs and a flower
  curve(
    p,
    [
      [cx + r * 0.3, cy + r * 0.3, GRASS_H + 0.02],
      [cx + r * 0.3, cy + r * 0.3, GRASS_H + h],
    ],
    shade(green, -0.25),
    0.008 * size,
    0.7,
  );
  if (rnd(seed, 12) > 0.5) ball(p, [cx, cy, GRASS_H + h + r * 0.8], 0.035 * size, '#ff7aa8', { line: false });
}

function drawDeadTree(p: Painter, cx: number, cy: number, size: number, theme: Theme, seed: number): void {
  const bark = theme.ground === 'ash' ? '#2e2422' : '#5a4636';
  const h = 0.62 * size;
  limb(p, [cx, cy, GRASS_H], [cx + 0.02, cy - 0.02, GRASS_H + h], 0.06 * size, 0.03 * size, bark);
  const branches = 4;
  for (let i = 0; i < branches; i++) {
    const a = rnd(seed, i) * Math.PI * 2;
    const z = GRASS_H + h * (0.45 + i * 0.13);
    const len = (0.22 + rnd(seed, i + 5) * 0.12) * size * (1 - i * 0.12);
    const end: V3 = [cx + Math.cos(a) * len, cy + Math.sin(a) * len, z + 0.14 * size];
    limb(p, [cx + 0.01, cy - 0.01, z], end, 0.025 * size, 0.008 * size, bark);
    limb(
      p,
      end,
      [end[0] + Math.cos(a + 0.8) * len * 0.4, end[1] + Math.sin(a + 0.8) * len * 0.4, end[2] + 0.08 * size],
      0.01 * size,
      0.004 * size,
      bark,
    );
    if (theme.ground === 'ash' && rnd(seed, i + 9) > 0.5) ball(p, end, 0.02 * size, '#ff7a2b', { glow: 1, line: false });
  }
  if (theme.ground === 'bog') {
    // Hanging moss
    for (let i = 0; i < 3; i++) {
      const a = rnd(seed, i + 20) * Math.PI * 2;
      const r = 0.12 * size;
      const z = GRASS_H + h * 0.85;
      curve(
        p,
        [
          [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z],
          [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z - 0.2 * size],
        ],
        '#8aa65a',
        0.02 * size,
        0.85,
      );
    }
  }
}

function drawWillow(p: Painter, cx: number, cy: number, size: number, leaf: string, theme: Theme, seed: number): void {
  p.cylinder(cx, cy, GRASS_H, 0.06 * size, 0.42 * size, theme.trunk, null, 0.045 * size);
  canopy(p, cx, cy, GRASS_H + 0.62 * size, 0.3 * size, leaf, seed);
  // Drooping strands curtain
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (Math.cos(a) + Math.sin(a) < -0.6) continue;
    const r = 0.3 * size * (0.9 + rnd(seed, i) * 0.2);
    const sx = cx + Math.cos(a) * r;
    const sy = cy + Math.sin(a) * r;
    const z0 = GRASS_H + 0.68 * size;
    curve(
      p,
      [
        [sx, sy, z0],
        [sx + Math.cos(a) * 0.05, sy + Math.sin(a) * 0.05, z0 - 0.2 * size],
        [sx + Math.cos(a) * 0.06, sy + Math.sin(a) * 0.06, z0 - (0.38 + rnd(seed, i + 3) * 0.12) * size],
      ],
      shade(leaf, i % 2 ? -0.1 : 0.06),
      0.035 * size,
      0.95,
    );
  }
}

function drawMushrooms(p: Painter, cx: number, cy: number, size: number, seed: number): void {
  const caps = rnd(seed, 2) > 0.5 ? ['#d94a4a', '#e86a5a'] : ['#7a5ad6', '#9a7ae6'];
  const items: [number, number, number][] = [
    [0, 0, 1],
    [0.16, 0.1, 0.6],
    [-0.12, 0.14, 0.45],
  ];
  items.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [dx, dy, k] of items) {
    const x = cx + dx * size;
    const y = cy + dy * size;
    const h = 0.32 * size * k;
    limb(p, [x, y, GRASS_H], [x, y, GRASS_H + h], 0.045 * size * k, 0.035 * size * k, '#efe6cf');
    const cap = caps[k === 1 ? 0 : 1];
    ellipsoid(p, [x, y, GRASS_H + h], [0.17 * size * k, 0, 0], [0, 0.17 * size * k, 0], [0, 0, 0.1 * size * k], cap, { shine: 0.5 });
    for (let i = 0; i < 4; i++) {
      const a = rnd(seed, i + k * 10) * Math.PI * 2;
      const d = 0.09 * size * k;
      ball(p, [x + Math.cos(a) * d * 0.7, y + Math.sin(a) * d * 0.7, GRASS_H + h + 0.06 * size * k], 0.022 * size * k, '#fff4e6', { line: false });
    }
  }
}

function drawRocks(p: Painter, theme: Theme, t: Tile): void {
  const n = 1 + Math.floor(rnd(t.seed, 3) * 2.4);
  const rocks = Array.from({ length: n }, (_, i) => ({
    cx: t.x + 0.28 + rnd(t.seed, i + 10) * 0.44,
    cy: t.y + 0.28 + rnd(t.seed, i + 12) * 0.44,
    s: (i === 0 ? 0.34 : 0.2) * (0.8 + rnd(t.seed, i + 14) * 0.4),
    i,
  })).sort((a, b) => a.cx + a.cy - (b.cx + b.cy));
  for (const { cx, cy, s, i } of rocks) {
    p.shadow(cx, cy, GRASS_H, s * 1.05, 0.3);
    // Boulder: three stacked irregular facets that narrow and lean back, like weathered stone.
    const k = 7;
    const base: P2[] = [];
    for (let j = 0; j < k; j++) {
      const a = (j / k) * Math.PI * 2 + rnd(t.seed, i + 16);
      const r = s * (0.72 + rnd(t.seed, j + i * 7 + 20) * 0.38);
      base.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    const layers = [
      { k: 1, h: 0.5 },
      { k: 0.8, h: 0.26 },
    ];
    let z = GRASS_H;
    let ox = 0;
    let oy = 0;
    for (const [li, L] of layers.entries()) {
      const foot = base.map(([fx, fy]) => [cx + ox + (fx - cx) * L.k, cy + oy + (fy - cy) * L.k] as P2);
      p.prism(foot, z, s * L.h, shade(theme.rock, li * 0.05));
      z += s * L.h;
      ox -= s * 0.06;
      oy -= s * 0.05;
    }
    const crown = base.map(([fx, fy]) => [cx + ox + (fx - cx) * 0.55, cy + oy + (fy - cy) * 0.55] as P2);
    p.flat(crown, z + 0.001, theme.snow ? '#f4f8ff' : rgba(theme.moss, theme.ground === 'ash' ? 0.85 : 0.55));
    if (theme.ground === 'ash') ball(p, [cx + ox, cy + oy, z + 0.01], s * 0.18, '#ff7a2b', { glow: 1.2, line: false });
  }
}

/** Max backing-store size for the ground bitmap (keeps memory sane when zoomed in). */
const MAX_GROUND_PX = 4096;

/**
 * Pre-rendered ground: one bitmap with every tile, wall and the island slab,
 * plus one sprite per decorated tile (trees, rocks) that the renderer
 * depth-sorts together with towers and enemies.
 */
export class GroundCache {
  canvas: HTMLCanvasElement | null = null;
  /** Offset of the bitmap's top-left from the world origin, at `scale` (CSS px). */
  ox = 0;
  oy = 0;
  w = 0;
  h = 0;
  scale = 0;
  decor: { x: number; y: number; sprite: Sprite }[] = [];

  constructor(
    private board: Board,
    private theme: Theme,
  ) {}

  build(scale: number, dpr: number): void {
    this.scale = scale;
    const board = this.board;
    const cam = new Camera();
    cam.scale = scale;
    const b = Camera.boardBounds(board.width, board.height);
    const left = (b.left - 1.5) * scale;
    const right = (b.right + 1.5) * scale;
    const top = (b.top - 1) * scale;
    const bottom = (b.bottom + SLAB + 2.4) * scale;
    this.w = right - left;
    this.h = bottom - top;
    this.ox = left;
    this.oy = top;
    const res = Math.min(dpr, MAX_GROUND_PX / this.w, MAX_GROUND_PX / this.h);
    const canvas = this.canvas ?? document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(this.w * res));
    canvas.height = Math.max(1, Math.ceil(this.h * res));
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(res, 0, 0, res, -left * res, -top * res);
    ctx.clearRect(left, top, this.w, this.h);
    const p = new Painter(cam);
    p.ctx = ctx;
    p.outline = 'rgba(38,28,40,0.1)';
    drawIslandShadow(ctx, cam, board);
    drawGround(p, board, this.theme);
    this.canvas = canvas;

    this.decor = [];
    for (const row of board.tiles)
      for (const t of row) {
        if (!hasDecor(t)) continue;
        const sprite = makeSprite(scale, dpr, 2.6, 3, 0.5, 0.78, { x: t.x + 0.5, y: t.y + 0.5, z: GRASS_H }, (sp) => drawDecor(sp, this.theme, t));
        outlineCanvas(sprite.canvas, Math.max(1, scale * dpr * 0.014), 'rgba(40,28,44,0.45)');
        this.decor.push({ x: t.x + 0.5, y: t.y + 0.5, sprite });
      }
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    if (!this.canvas) return;
    const k = cam.scale / this.scale;
    ctx.drawImage(this.canvas, cam.ox + this.ox * k, cam.oy + this.oy * k, this.w * k, this.h * k);
  }
}

function drawIslandShadow(ctx: CanvasRenderingContext2D, cam: Camera, b: Board): void {
  const c = cam.project(b.width / 2 + 0.8, b.height / 2 + 0.8, -SLAB - 0.8);
  const w = (b.width + b.height) * cam.scale * 0.55;
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, w);
  g.addColorStop(0, 'rgba(30,25,70,0.34)');
  g.addColorStop(0.6, 'rgba(30,25,70,0.12)');
  g.addColorStop(1, 'rgba(30,25,70,0)');
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(1, 0.4);
  ctx.translate(-c.x, -c.y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c.x, c.y, w, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Height of the walkable surface at a world point. */
export const groundZ = (board: Board, x: number, y: number): number => (isRaised(board.tile(Math.floor(x), Math.floor(y))) ? GRASS_H : 0);
