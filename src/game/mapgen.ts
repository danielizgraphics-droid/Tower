import { BIOME_BY_ID, type Biome, type BiomeDef } from '../data/biomes';
import type { MapDef } from '../data/types';
import { Rng } from '../engine/rng';

export interface MapGenOptions {
  biome: Biome;
  seed: number;
  /** Board size in tiles (square). */
  size?: number;
  /** Number of waves; Infinity for endless mode. */
  waves?: number;
}

/** Short shareable code for a seed. */
export const seedCode = (seed: number): string => (seed >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6);

const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;

/**
 * Generates a random map. The path runs on a coarse grid (every second tile)
 * so it is always a single one-tile corridor with grass between its turns —
 * it can never fork or touch itself.
 */
export function generateMap(opts: MapGenOptions): MapDef {
  const biome = BIOME_BY_ID[opts.biome] ?? BIOME_BY_ID.meadow;
  const rng = new Rng(opts.seed ^ 0x5bd1e995);
  const size = opts.size ?? 17;
  const W = size % 2 === 0 ? size + 1 : size;
  const H = W;
  const cw = (W - 1) / 2; // coarse columns
  const ch = (H - 1) / 2;

  const path = findCoarsePath(rng, cw, ch);
  const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
  const tileOf = (n: { i: number; j: number }) => ({ x: 1 + 2 * n.i, y: 1 + 2 * n.j });
  for (let k = 0; k < path.length; k++) {
    const a = tileOf(path[k]);
    grid[a.y][a.x] = '#';
    if (k > 0) {
      const b = tileOf(path[k - 1]);
      grid[(a.y + b.y) / 2][(a.x + b.x) / 2] = '#';
    }
  }
  // Spawn on the back edge next to the first node, castle on the last node.
  const first = tileOf(path[0]);
  const spawn = path[0].i === 0 ? { x: 0, y: first.y } : { x: first.x, y: 0 };
  grid[spawn.y][spawn.x] = 'S';
  const last = tileOf(path[path.length - 1]);
  grid[last.y][last.x] = 'C';

  decorate(grid, rng, biome);

  const name = `${rng.pick(biome.prefixes)} ${rng.pick(biome.places)}`;
  return {
    id: `${biome.id}-${seedCode(opts.seed)}`,
    name,
    description: biome.description,
    theme: biome.id,
    waves: opts.waves ?? 30,
    hpScale: biome.hpScale,
    tiles: grid.map((r) => r.join('')),
  };
}

type Node = { i: number; j: number };

/**
 * Randomised self-avoiding walk on the coarse grid from a back edge (i=0 or
 * j=0) to a front edge (i=cw-1 or j=ch-1). Keeps the longest of many tries
 * within a target length so maps are winding but not maze-like.
 */
function findCoarsePath(rng: Rng, cw: number, ch: number): Node[] {
  const target = Math.round(cw * ch * 0.55);
  let best: Node[] | null = null;
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < 400; attempt++) {
    const start: Node = rng.chance(0.5) ? { i: 0, j: rng.int(0, ch - 1) } : { i: rng.int(0, cw - 1), j: 0 };
    const walk = [start];
    const seen = new Set([`${start.i},${start.j}`]);
    let dir = start.i === 0 ? 0 : 1;
    let straight = 0;
    while (walk.length < cw * ch) {
      const cur = walk[walk.length - 1];
      const options = DIRS.map((d, k) => ({ k, i: cur.i + d[0], j: cur.j + d[1] })).filter(
        (n) => n.i >= 0 && n.j >= 0 && n.i < cw && n.j < ch && !seen.has(`${n.i},${n.j}`),
      );
      if (!options.length) break;
      // Prefer continuing straight a little, but force turns on long runs; avoid dead ends.
      const weights = options.map((o) => {
        const free = DIRS.filter(([dx, dy]) => {
          const ni = o.i + dx;
          const nj = o.j + dy;
          return ni >= 0 && nj >= 0 && ni < cw && nj < ch && !seen.has(`${ni},${nj}`);
        }).length;
        let w = 1 + free * 0.6;
        if (o.k === dir) w *= straight >= 2 ? 0.25 : 1.6;
        // Gentle pull towards the front (bigger i+j) once the path is long.
        if (walk.length > target * 0.6 && (o.k === 0 || o.k === 1)) w *= 1.8;
        return w;
      });
      const pick = options[rng.weighted(weights)];
      straight = pick.k === dir ? straight + 1 : 0;
      dir = pick.k;
      walk.push({ i: pick.i, j: pick.j });
      seen.add(`${pick.i},${pick.j}`);
      // End on a front edge once long enough.
      if (walk.length >= target && (pick.i === cw - 1 || pick.j === ch - 1) && rng.chance(0.5)) break;
    }
    const end = walk[walk.length - 1];
    if (end.i !== cw - 1 && end.j !== ch - 1) continue;
    if (walk.length < target * 0.7) continue;
    let turns = 0;
    for (let k = 2; k < walk.length; k++) {
      const d1 = `${walk[k - 1].i - walk[k - 2].i},${walk[k - 1].j - walk[k - 2].j}`;
      const d2 = `${walk[k].i - walk[k - 1].i},${walk[k].j - walk[k - 1].j}`;
      if (d1 !== d2) turns++;
    }
    const score = -Math.abs(walk.length - target) * 2 + Math.min(turns, walk.length * 0.6);
    if (score > bestScore) {
      bestScore = score;
      best = walk;
    }
  }
  if (!best) {
    // Fallback: simple serpentine (always valid).
    best = [];
    for (let j = 0; j < ch; j++) for (let k = 0; k < cw; k++) best.push({ i: j % 2 === 0 ? k : cw - 1 - k, j });
  }
  return best;
}

function decorate(grid: string[][], rng: Rng, biome: BiomeDef): void {
  const H = grid.length;
  const W = grid[0].length;
  const isPath = (x: number, y: number) => ['#', 'S', 'C'].includes(grid[y]?.[x] ?? '');
  const nearPath = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (isPath(x + dx, y + dy)) return true;
    return false;
  };
  // Ponds: grow small blobs away from the path.
  const ponds = Math.round(rng.range(0.5, 2.2) * biome.water);
  for (let p = 0; p < ponds; p++) {
    for (let tries = 0; tries < 30; tries++) {
      const x = rng.int(1, W - 2);
      const y = rng.int(1, H - 2);
      if (grid[y][x] !== '.' || nearPath(x, y, 1)) continue;
      const size = rng.int(2, 5);
      const cells = [{ x, y }];
      grid[y][x] = 'W';
      for (let k = 0; k < size * 3 && cells.length < size; k++) {
        const c = rng.pick(cells);
        const [dx, dy] = rng.pick(DIRS);
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1 || grid[ny][nx] !== '.' || nearPath(nx, ny, 1)) continue;
        grid[ny][nx] = 'W';
        cells.push({ x: nx, y: ny });
      }
      break;
    }
  }
  // Trees cluster on the borders and away from the path; rocks scattered; flowers on grass.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (grid[y][x] !== '.') continue;
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      const close = nearPath(x, y, 1);
      let tree = biome.trees * (edge ? 3.2 : close ? 0.25 : 1);
      // Clustering: neighbours that are trees raise the chance.
      if (grid[y - 1]?.[x] === 'T' || grid[y]?.[x - 1] === 'T') tree *= 2.2;
      const r = rng.next();
      if (r < tree) grid[y][x] = 'T';
      else if (r < tree + biome.rocks * (close ? 0.3 : 1)) grid[y][x] = 'R';
      else if (r < tree + biome.rocks + biome.flowers) grid[y][x] = 'F';
    }
}
