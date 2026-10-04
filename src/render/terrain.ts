import type { Board, Tile } from '../game/board';
import { shade } from './color';
import { Painter } from './painter';
import { Camera, DX, DY, HEIGHT_SCALE } from './projection';
import { makeSprite, type Sprite } from './sprites';
import type { Theme } from './theme';

export const GRASS_H = 0.22;
export const SLAB = 0.75;

const RAISED = new Set(['grass', 'flowers', 'tree', 'rock']);
const isRaised = (t: Tile | undefined) => !!t && RAISED.has(t.kind);

/** Pseudo random from a tile seed. */
const rnd = (seed: number, i: number) => {
  const v = Math.sin(seed * 9301 + i * 49297) * 233280;
  return v - Math.floor(v);
};

/** Draws the flat/static ground of one board row (no tall decorations). */
export function drawGroundRow(p: Painter, board: Board, theme: Theme, row: number): void {
  const W = board.width;
  const H = board.height;
  for (let x = 0; x < W; x++) {
    const t = board.tiles[row][x];
    const raised = isRaised(t);
    const top = raised ? GRASS_H : 0;
    const front = board.tile(x, row + 1);
    const right = board.tile(x + 1, row);

    // Board slab (outer edges only).
    if (row === H - 1) {
      drawSlabFront(p, theme, x, row);
    }
    if (x === W - 1) drawSlabRight(p, theme, x, row);

    if (raised) {
      const col = (x + row) % 2 === 0 ? theme.grass : theme.grassAlt;
      // Front wall when the tile in front is lower.
      if (!isRaised(front)) {
        p.face(
          [
            [x, row + 1, 0],
            [x + 1, row + 1, 0],
            [x + 1, row + 1, top],
            [x, row + 1, top],
          ],
          shade(col, -0.05),
          [0, 1, 0],
        );
      }
      if (!isRaised(right)) {
        p.face(
          [
            [x + 1, row + 1, 0],
            [x + 1, row, 0],
            [x + 1, row, top],
            [x + 1, row + 1, top],
          ],
          shade(col, -0.02),
          [1, 0, 0],
        );
      }
      p.flat(
        [
          [x, row],
          [x + 1, row],
          [x + 1, row + 1],
          [x, row + 1],
        ],
        top,
        shade(col, 0.04),
      );
      decorateGround(p, theme, t, top);
    } else if (t.kind === 'water') {
      p.flat(
        [
          [x, row],
          [x + 1, row],
          [x + 1, row + 1],
          [x, row + 1],
        ],
        -0.02,
        theme.water,
      );
    } else {
      // Path
      p.flat(
        [
          [x, row],
          [x + 1, row],
          [x + 1, row + 1],
          [x, row + 1],
        ],
        0,
        theme.path,
      );
      // Pebbles
      for (let i = 0; i < 3; i++) {
        if (rnd(t.seed, i) > 0.55) continue;
        const px = x + 0.15 + rnd(t.seed, i + 3) * 0.7;
        const py = row + 0.15 + rnd(t.seed, i + 6) * 0.7;
        p.disc(px, py, 0.001, 0.035 + rnd(t.seed, i + 9) * 0.03, theme.pathEdge, false);
      }
    }
  }
}

/** Tall decoration of a tile (trees, rocks), drawn as a depth-sorted sprite. */
export function drawDecor(p: Painter, theme: Theme, t: Tile): void {
  if (t.kind === 'tree') drawTrees(p, theme, t);
  else if (t.kind === 'rock') drawRocks(p, theme, t);
}

export const hasDecor = (t: Tile): boolean => t.kind === 'tree' || t.kind === 'rock';

function drawSlabFront(p: Painter, theme: Theme, x: number, row: number): void {
  // Two bands: soil on top, stone below.
  p.face(
    [
      [x, row + 1, -0.28],
      [x + 1, row + 1, -0.28],
      [x + 1, row + 1, 0],
      [x, row + 1, 0],
    ],
    theme.dirt,
    [0, 1, 0],
  );
  p.face(
    [
      [x, row + 1, -SLAB],
      [x + 1, row + 1, -SLAB],
      [x + 1, row + 1, -0.28],
      [x, row + 1, -0.28],
    ],
    theme.stone,
    [0, 1, 0],
  );
}

function drawSlabRight(p: Painter, theme: Theme, x: number, row: number): void {
  p.face(
    [
      [x + 1, row + 1, -0.28],
      [x + 1, row, -0.28],
      [x + 1, row, 0],
      [x + 1, row + 1, 0],
    ],
    theme.dirt,
    [1, 0, 0],
  );
  p.face(
    [
      [x + 1, row + 1, -SLAB],
      [x + 1, row, -SLAB],
      [x + 1, row, -0.28],
      [x + 1, row + 1, -0.28],
    ],
    theme.stone,
    [1, 0, 0],
  );
}

function decorateGround(p: Painter, theme: Theme, t: Tile, z: number): void {
  const ctx = p.ctx;
  if (t.kind === 'flowers') {
    for (let i = 0; i < 7; i++) {
      const fx = t.x + 0.12 + rnd(t.seed, i) * 0.76;
      const fy = t.y + 0.12 + rnd(t.seed, i + 20) * 0.76;
      p.disc(fx, fy, z + 0.001, 0.045, theme.flowers[i % theme.flowers.length], false);
    }
  }
  // Small grass tufts for texture.
  const tufts = theme.snow ? 1 : 2;
  for (let i = 0; i < tufts; i++) {
    if (rnd(t.seed, i + 40) > 0.5) continue;
    const gx = t.x + 0.15 + rnd(t.seed, i + 41) * 0.7;
    const gy = t.y + 0.15 + rnd(t.seed, i + 42) * 0.7;
    const sx = p.cam.px(gx, gy);
    const sy = p.cam.py(gy, z);
    const s = p.cam.scale;
    ctx.beginPath();
    ctx.moveTo(sx - 0.05 * s, sy);
    ctx.lineTo(sx - 0.02 * s, sy - 0.09 * s);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx + 0.03 * s, sy - 0.07 * s);
    ctx.lineTo(sx + 0.05 * s, sy);
    ctx.closePath();
    ctx.fillStyle = shade(theme.grass, theme.snow ? -0.08 : -0.16);
    ctx.fill();
  }
}

function drawTrees(p: Painter, theme: Theme, t: Tile): void {
  const count = rnd(t.seed, 1) > 0.5 ? 2 : 1;
  const spots =
    count === 1
      ? [[0.5, 0.5]]
      : [
          [0.3, 0.35],
          [0.68, 0.68],
        ];
  for (let i = 0; i < count; i++) {
    const cx = t.x + spots[i][0] + (rnd(t.seed, i + 2) - 0.5) * 0.12;
    const cy = t.y + spots[i][1] + (rnd(t.seed, i + 4) - 0.5) * 0.12;
    const size = (count === 1 ? 1 : 0.8) * (0.85 + rnd(t.seed, i + 6) * 0.3);
    const leaf = theme.leaves[Math.floor(rnd(t.seed, i + 8) * theme.leaves.length)];
    p.shadow(cx, cy, GRASS_H, 0.26 * size);
    p.cylinder(cx, cy, GRASS_H, 0.06 * size, 0.25 * size, theme.trunk);
    if (theme.snow) {
      // Pine: stacked cones with snow tips.
      p.cone(cx, cy, GRASS_H + 0.18 * size, 0.32 * size, 0.5 * size, leaf);
      p.cone(cx, cy, GRASS_H + 0.45 * size, 0.24 * size, 0.45 * size, leaf);
      p.cone(cx, cy, GRASS_H + 0.72 * size, 0.12 * size, 0.24 * size, '#f4f8ff');
    } else {
      p.sphere(cx, cy, GRASS_H + 0.48 * size, 0.3 * size, leaf);
      p.sphere(cx - 0.07 * size, cy - 0.05 * size, GRASS_H + 0.68 * size, 0.2 * size, shade(leaf, 0.08));
    }
  }
}

function drawRocks(p: Painter, theme: Theme, t: Tile): void {
  const n = 1 + Math.floor(rnd(t.seed, 3) * 2);
  for (let i = 0; i < n; i++) {
    const cx = t.x + 0.3 + rnd(t.seed, i + 10) * 0.4;
    const cy = t.y + 0.3 + rnd(t.seed, i + 12) * 0.4;
    const s = (i === 0 ? 0.42 : 0.26) * (0.8 + rnd(t.seed, i + 14) * 0.4);
    p.shadow(cx, cy, GRASS_H, s * 0.7);
    p.rbox(cx, cy, GRASS_H, s, s * 0.85, s * 0.6, rnd(t.seed, i + 16) * 1.5, theme.rock);
    if (theme.snow) p.rbox(cx, cy, GRASS_H + s * 0.6, s * 0.8, s * 0.65, 0.04, rnd(t.seed, i + 16) * 1.5, '#f4f8ff');
  }
}

/** Max backing-store size for the ground bitmap (keeps memory sane when zoomed in). */
const MAX_GROUND_PX = 4096;

/**
 * Pre-rendered ground: a single bitmap with every tile, wall and the island
 * slab, plus one sprite per decorated tile (trees, rocks) that the renderer
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
    cam.rows = board.height;
    const W = board.width;
    const H = board.height;
    const left = cam.px(0, H) - scale * 1.2;
    const right = cam.px(W, 0) + scale * 1.2;
    const top = cam.py(0, 0.6);
    const bottom = cam.py(H, -SLAB) + scale * 1.6;
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
    drawIslandShadow(ctx, cam, board);
    for (let r = 0; r < H; r++) drawGroundRow(p, board, this.theme, r);
    this.canvas = canvas;

    this.decor = [];
    for (const row of board.tiles)
      for (const t of row) {
        if (!hasDecor(t)) continue;
        const sprite = makeSprite(scale, dpr, H, 1.8, 2.3, 0.45, 0.75, { x: t.x + 0.5, y: t.y + 0.5, z: GRASS_H }, (sp) =>
          drawDecor(sp, this.theme, t),
        );
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
  const c = cam.project(b.width / 2 + 0.4, b.height / 2 + 0.6, -SLAB - 0.6);
  const w = (b.width + b.height * DX) * cam.scale * 0.55;
  const h = b.height * DY * cam.scale * 0.7;
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, w);
  g.addColorStop(0, 'rgba(30,25,70,0.28)');
  g.addColorStop(1, 'rgba(30,25,70,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + h * 0.3, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Height of the walkable surface at a world point. */
export const groundZ = (board: Board, x: number, y: number): number => (isRaised(board.tile(Math.floor(x), Math.floor(y))) ? GRASS_H : 0);

export { DY, HEIGHT_SCALE };
