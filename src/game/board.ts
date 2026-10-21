import type { MapDef } from '../data/types';

/** 'void': open sky (sky maps) — nothing to stand on. */
export type TileKind = 'grass' | 'flowers' | 'path' | 'spawn' | 'castle' | 'tree' | 'rock' | 'water' | 'lava' | 'void';

export interface Tile {
  kind: TileKind;
  x: number;
  y: number;
  /** Deterministic per-tile variation (0..1) for decoration. */
  seed: number;
  /** Touches open water (palms grow at oases). */
  nearWater?: boolean;
}

const CHAR_TO_KIND: Record<string, TileKind> = {
  '.': 'grass',
  F: 'flowers',
  '#': 'path',
  S: 'spawn',
  C: 'castle',
  T: 'tree',
  R: 'rock',
  W: 'water',
  L: 'lava',
  V: 'void',
};

/** One way from a spawn to the castle (maps with several entrances or forks have several). */
export interface Route {
  path: PathPoint[];
  length: number;
  spawn: { x: number; y: number };
}

export interface PathPoint {
  x: number;
  y: number;
  /** Cumulative distance from the spawn. */
  d: number;
}

/**
 * Parsed map: tile grid plus the enemy path as a polyline through tile centers.
 * Coordinates are in tiles; tile (x, y) spans [x, x+1] × [y, y+1].
 */
export class Board {
  readonly width: number;
  readonly height: number;
  readonly tiles: Tile[][];
  /** Every route enemies can take; the first one is the main road. */
  readonly routes: Route[];
  /** Main route (shortcuts for maps with a single road). */
  readonly path: PathPoint[];
  readonly length: number;
  readonly spawn: { x: number; y: number };
  readonly spawns: { x: number; y: number }[];
  /** Route indices starting at each spawn. */
  readonly spawnRoutes: number[][];
  readonly castle: { x: number; y: number };
  /** Land where ordinary towers stand (an all-water map has none). */
  readonly hasLand: boolean;

  constructor(readonly def: MapDef) {
    this.height = def.tiles.length;
    this.width = Math.max(...def.tiles.map((r) => r.length));
    this.tiles = def.tiles.map((row, y) =>
      Array.from({ length: this.width }, (_, x) => {
        const kind = CHAR_TO_KIND[row[x] ?? '.'];
        if (!kind) throw new Error(`Map ${def.id}: unknown tile '${row[x]}' at ${x},${y}`);
        return { kind, x, y, seed: hash(x, y, def.id.length) };
      }),
    );
    for (const row of this.tiles)
      for (const t of row) t.nearWater = [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => this.tiles[t.y + dy]?.[t.x + dx]?.kind === 'water'));
    const find = (k: TileKind) => {
      for (const row of this.tiles) for (const t of row) if (t.kind === k) return { x: t.x, y: t.y };
      throw new Error(`Map ${def.id}: missing ${k}`);
    };
    this.castle = find('castle');
    this.hasLand = this.tiles.some((row) => row.some((t) => t.kind === 'grass' || t.kind === 'flowers'));
    const lists = def.routes?.length ? def.routes : [tracePath(this, find('spawn'), this.castle)];
    this.routes = lists.map((cells) => {
      const path = simplify(cells);
      return { path, length: path[path.length - 1].d, spawn: { x: cells[0].x, y: cells[0].y } };
    });
    this.path = this.routes[0].path;
    this.length = this.routes[0].length;
    this.spawn = this.routes[0].spawn;
    this.spawns = [];
    this.spawnRoutes = [];
    this.routes.forEach((r, i) => {
      let k = this.spawns.findIndex((s) => s.x === r.spawn.x && s.y === r.spawn.y);
      if (k < 0) {
        k = this.spawns.push(r.spawn) - 1;
        this.spawnRoutes.push([]);
      }
      this.spawnRoutes[k].push(i);
    });
  }

  routeLength(route: number): number {
    return (this.routes[route] ?? this.routes[0]).length;
  }

  tile(x: number, y: number): Tile | undefined {
    return this.tiles[y]?.[x];
  }

  isWalkable(x: number, y: number): boolean {
    const k = this.tile(x, y)?.kind;
    return k === 'path' || k === 'spawn' || k === 'castle';
  }

  /** Open water where naval towers can be built. */
  isWater(x: number, y: number): boolean {
    return this.tile(x, y)?.kind === 'water';
  }

  isBuildable(x: number, y: number): boolean {
    const k = this.tile(x, y)?.kind;
    return k === 'grass' || k === 'flowers';
  }

  /** Position along a route at distance d (clamped). */
  pointAt(d: number, route = 0, out = { x: 0, y: 0, angle: 0 }): { x: number; y: number; angle: number } {
    const p = (this.routes[route] ?? this.routes[0]).path;
    if (d <= 0) {
      out.x = p[0].x;
      out.y = p[0].y;
      out.angle = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
      return out;
    }
    // Binary search the segment.
    let lo = 0;
    let hi = p.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (p[mid].d <= d) lo = mid;
      else hi = mid;
    }
    const a = p[lo];
    const b = p[hi];
    const t = Math.min(1, (d - a.d) / (b.d - a.d || 1));
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.angle = Math.atan2(b.y - a.y, b.x - a.x);
    return out;
  }
}

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Walks the corridor of path tiles from spawn to castle. Throws on dead ends or forks. */
function tracePath(board: Board, from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] {
  const out = [from];
  const seen = new Set([`${from.x},${from.y}`]);
  let cur = from;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (cur.x !== to.x || cur.y !== to.y) {
    const next = dirs.map(([dx, dy]) => ({ x: cur.x + dx, y: cur.y + dy })).filter((p) => board.isWalkable(p.x, p.y) && !seen.has(`${p.x},${p.y}`));
    if (next.length === 0) throw new Error(`Map ${board.def.id}: path dead end at ${cur.x},${cur.y}`);
    if (next.length > 1) throw new Error(`Map ${board.def.id}: path fork at ${cur.x},${cur.y}`);
    cur = next[0];
    seen.add(`${cur.x},${cur.y}`);
    out.push(cur);
  }
  return out;
}

/** Converts tile cells into a polyline through the corners only. */
function simplify(cells: { x: number; y: number }[]): PathPoint[] {
  const centers = cells.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }));
  // Enemies start just outside the spawn tile edge for a nicer entrance.
  const first = centers[0];
  const second = centers[1];
  const start = { x: first.x - (second.x - first.x) * 0.6, y: first.y - (second.y - first.y) * 0.6 };
  const pts = [start];
  for (let i = 0; i < centers.length; i++) {
    const prev = i === 0 ? start : centers[i - 1];
    const next = centers[i + 1];
    if (!next) {
      pts.push(centers[i]);
      break;
    }
    const d1x = Math.sign(centers[i].x - prev.x);
    const d1y = Math.sign(centers[i].y - prev.y);
    const d2x = Math.sign(next.x - centers[i].x);
    const d2y = Math.sign(next.y - centers[i].y);
    if (d1x !== d2x || d1y !== d2y) pts.push(centers[i]);
  }
  let d = 0;
  return pts.map((p, i) => {
    if (i > 0) d += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    return { x: p.x, y: p.y, d };
  });
}
