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
  /** Amount of ponds and lagoons (replaces the biome's; missions use it for flooded maps). */
  water?: number;
  /** Expert layouts: extra entrances that join the road, and stretches where it splits in two. */
  lanes?: { spawns: number; forks: number };
  /** Largest floating island in tiles (sky maps). */
  islandMax?: number;
  /** How many floating islands (sky maps). */
  islands?: number;
  /** Nothing but open water around the road: only naval towers can be built. */
  allWater?: boolean;
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

  const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
  const tileOf = (n: { i: number; j: number }) => ({ x: 1 + 2 * n.i, y: 1 + 2 * n.j });
  /** Spawn tile on the map's border next to an edge node. */
  const edgeTile = (n: Node) => {
    const t = tileOf(n);
    return n.i === 0 ? { x: 0, y: t.y } : n.j === 0 ? { x: t.x, y: 0 } : n.i === cw - 1 ? { x: W - 1, y: t.y } : { x: t.x, y: H - 1 };
  };
  const lanes = opts.lanes && (opts.lanes.spawns > 1 || opts.lanes.forks > 0) ? opts.lanes : null;
  const net = lanes ? buildNetwork(rng, cw, ch, lanes) : null;
  const main = net ? net.main : findCoarsePath(rng, cw, ch);
  const links: [Node, Node][] = net ? net.links : main.slice(1).map((n, k) => [main[k], n]);
  for (const [na, nb] of links) {
    const a = tileOf(na);
    const b = tileOf(nb);
    grid[a.y][a.x] = grid[b.y][b.x] = '#';
    grid[(a.y + b.y) / 2][(a.x + b.x) / 2] = '#';
  }
  // Spawns on the border next to the first nodes, castle on the last node.
  for (const n of net ? net.spawns : [main[0]]) {
    const sp = edgeTile(n);
    grid[sp.y][sp.x] = 'S';
  }
  const last = tileOf(main[main.length - 1]);
  grid[last.y][last.x] = 'C';
  // Several ways to the castle: list each one tile by tile.
  const routes = net?.routes.map((nodes) => {
    const cells = [edgeTile(nodes[0])];
    nodes.forEach((n, k) => {
      const t = tileOf(n);
      if (k > 0) {
        const b = tileOf(nodes[k - 1]);
        cells.push({ x: (t.x + b.x) / 2, y: (t.y + b.y) / 2 });
      }
      cells.push(t);
    });
    return cells;
  });

  if (biome.sky) skyIslands(grid, rng, opts.islandMax ?? 5, opts.islands);
  else if (opts.allWater) {
    for (const row of grid) for (let x = 0; x < W; x++) if (row[x] === '.') row[x] = 'W';
  } else decorate(grid, rng, opts.water === undefined ? biome : { ...biome, water: opts.water });

  const name = `${rng.pick(biome.prefixes)} ${rng.pick(biome.places)}`;
  return {
    id: `${biome.id}-${seedCode(opts.seed)}`,
    name,
    description: biome.description,
    theme: biome.id,
    waves: opts.waves ?? 30,
    hpScale: biome.hpScale,
    tiles: grid.map((r) => r.join('')),
    routes,
  };
}

type Node = { i: number; j: number };

/**
 * Randomised self-avoiding walk on the coarse grid from a back edge (i=0 or
 * j=0) to a front edge (i=cw-1 or j=ch-1). Keeps the longest of many tries
 * within a target length so maps are winding but not maze-like.
 */
function findCoarsePath(rng: Rng, cw: number, ch: number, fill = 0.55): Node[] {
  const target = Math.round(cw * ch * fill);
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

const nkey = (n: Node) => `${n.i},${n.j}`;
const manhattan = (a: Node, b: Node) => Math.abs(a.i - b.i) + Math.abs(a.j - b.j);

interface Network {
  /** Main road from the first spawn to the castle (its last node). */
  main: Node[];
  spawns: Node[];
  /** Directed links (towards the castle). */
  links: [Node, Node][];
  /** Every way from a spawn to the castle, spawn by spawn. */
  routes: Node[][];
}

/**
 * Road network for expert maps, on the same coarse grid as single roads (so
 * corridors stay one tile wide): a main road, extra entrances whose roads join
 * it (or each other) far from their start, and forks where it splits in two
 * and comes back together.
 */
function buildNetwork(rng: Rng, cw: number, ch: number, lanes: { spawns: number; forks: number }): Network {
  let best: Network | null = null;
  let bestScore = -1;
  for (let attempt = 0; attempt < 30; attempt++) {
    const net = tryNetwork(rng, cw, ch, lanes);
    const score = net.spawns.length * 10 + (net.routes.length - net.spawns.length) * 4;
    if (score > bestScore) {
      best = net;
      bestScore = score;
    }
    if (net.spawns.length === lanes.spawns && net.routes.length >= lanes.spawns + lanes.forks) break;
  }
  return best!;
}

function tryNetwork(rng: Rng, cw: number, ch: number, lanes: { spawns: number; forks: number }): Network {
  const main = findCoarsePath(rng, cw, ch, lanes.spawns > 1 ? 0.16 : 0.22);
  const castle = main[main.length - 1];
  /** Road nodes: `rest` = nodes left to the castle; others may join where `mergeable`. */
  const used = new Map<string, { rest: number; mergeable: boolean }>();
  // Entrances join late, so each road needs its own defenders for most of the way.
  main.forEach((n, k) => used.set(nkey(n), { rest: main.length - 1 - k, mergeable: k >= main.length * 0.6 }));
  // No entrance may be much shorter than the main road (it would leave no time to react).
  const minRoute = main.length * 0.6;
  const links: [Node, Node][] = main.slice(1).map((n, k) => [main[k], n]);
  const spawns = [main[0]];
  const inBounds = (n: Node) => n.i >= 0 && n.j >= 0 && n.i < cw && n.j < ch;
  const around = (n: Node) => DIRS.map(([di, dj]) => ({ i: n.i + di, j: n.j + dj })).filter(inBounds);
  const spread = (cw + ch) / 3;

  // Extra entrances.
  for (let s = 1; s < lanes.spawns; s++) {
    for (let tries = 0; tries < 300; tries++) {
      const side = rng.int(0, 3);
      const start: Node =
        side === 0
          ? { i: 0, j: rng.int(0, ch - 1) }
          : side === 1
            ? { i: rng.int(0, cw - 1), j: 0 }
            : side === 2
              ? { i: cw - 1, j: rng.int(0, ch - 1) }
              : { i: rng.int(0, cw - 1), j: ch - 1 };
      if (used.has(nkey(start)) || around(start).some((n) => used.has(nkey(n)))) continue;
      if (spawns.some((sp) => manhattan(sp, start) < spread) || manhattan(start, castle) < spread) continue;
      const walk = [start];
      const seen = new Set([nkey(start)]);
      const minLen = Math.round((cw + ch) * 0.2);
      let join: Node | null = null;
      while (walk.length < cw * ch) {
        const cur = walk[walk.length - 1];
        const nbrs = around(cur);
        if (walk.length >= minLen) {
          const joins = nbrs.filter((n) => {
            const u = used.get(nkey(n));
            return !!u?.mergeable && walk.length + 1 + u.rest >= minRoute;
          });
          if (joins.length) {
            join = rng.pick(joins);
            break;
          }
        }
        const free = nbrs.filter((n) => !used.has(nkey(n)) && !seen.has(nkey(n)));
        if (!free.length) break;
        const weights = free.map((n) => {
          const room = around(n).filter((m) => !used.has(nkey(m)) && !seen.has(nkey(m))).length;
          // Head for the castle, but not in a straight line.
          return (1 + room * 0.6) * (manhattan(n, castle) < manhattan(cur, castle) ? 1.7 : 1);
        });
        const next = free[rng.weighted(weights)];
        walk.push(next);
        seen.add(nkey(next));
      }
      if (!join) continue;
      const rest = used.get(nkey(join))!.rest + 1;
      walk.forEach((n, k) => used.set(nkey(n), { rest: rest + walk.length - 1 - k, mergeable: k >= 3 }));
      for (let k = 1; k < walk.length; k++) links.push([walk[k - 1], walk[k]]);
      links.push([walk[walk.length - 1], join]);
      spawns.push(start);
      break;
    }
  }

  // Forks: a detour leaves the main road and rejoins it further on.
  for (let f = 0; f < lanes.forks; f++) {
    for (let tries = 0; tries < 200; tries++) {
      const a = rng.int(Math.round(main.length * 0.1), Math.round(main.length * 0.7));
      const gap = rng.int(3, 7);
      const b = a + gap;
      if (b > main.length - 2) continue;
      const from = main[a];
      const to = main[b];
      const goal = new Set(around(to).map(nkey));
      const maxLen = gap * 2 + 2;
      let found: Node[] | null = null;
      let budget = 3000;
      const seen = new Set<string>();
      const dfs = (path: Node[]): boolean => {
        if (--budget < 0) return false;
        const cur = path[path.length - 1];
        if (path.length >= 2 && goal.has(nkey(cur))) {
          found = [...path];
          return true;
        }
        if (path.length >= maxLen) return false;
        const opts = around(cur).filter((n) => !used.has(nkey(n)) && !seen.has(nkey(n)));
        for (let k = opts.length - 1; k > 0; k--) {
          const r = rng.int(0, k);
          [opts[k], opts[r]] = [opts[r], opts[k]];
        }
        for (const n of opts) {
          seen.add(nkey(n));
          path.push(n);
          if (dfs(path)) return true;
          path.pop();
          seen.delete(nkey(n));
        }
        return false;
      };
      for (const n0 of around(from).filter((n) => !used.has(nkey(n)))) {
        seen.add(nkey(n0));
        if (dfs([n0])) break;
        seen.delete(nkey(n0));
      }
      const detour = found as Node[] | null;
      if (!detour) continue;
      for (const n of detour) used.set(nkey(n), { rest: 0, mergeable: false });
      links.push([from, detour[0]]);
      for (let k = 1; k < detour.length; k++) links.push([detour[k - 1], detour[k]]);
      links.push([detour[detour.length - 1], to]);
      break;
    }
  }

  // Every way to the castle, following the links forward.
  const out = new Map<string, Node[]>();
  for (const [x, y] of links) {
    const list = out.get(nkey(x)) ?? [];
    list.push(y);
    out.set(nkey(x), list);
  }
  const routes: Node[][] = [];
  for (const sp of spawns) {
    const mine: Node[][] = [];
    const walk = (path: Node[]) => {
      if (mine.length >= 6) return;
      const cur = path[path.length - 1];
      if (cur.i === castle.i && cur.j === castle.j) {
        mine.push([...path]);
        return;
      }
      for (const n of out.get(nkey(cur)) ?? []) {
        path.push(n);
        walk(path);
        path.pop();
      }
    };
    walk([sp]);
    routes.push(...mine);
  }
  return { main, spawns, links, routes };
}

/**
 * Sky maps: everything is open air ('V') except small floating islands
 * scattered along the flyers' route, where towers can stand.
 */
function skyIslands(grid: string[][], rng: Rng, maxSize: number, islands?: number): void {
  const H = grid.length;
  const W = grid[0].length;
  const isPath = (x: number, y: number) => ['#', 'S', 'C'].includes(grid[y]?.[x] ?? '');
  const distToPath = (x: number, y: number) => {
    for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (isPath(x + dx, y + dy)) return r;
    return 4;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === '.') grid[y][x] = 'V';
  const island = new Map<string, number>();
  const key = (x: number, y: number) => `${x},${y}`;
  /** A cell can join island `id` if no other island touches it (keeps a gap of sky between them). */
  const free = (x: number, y: number, id: number) => {
    if (grid[y]?.[x] !== 'V') return false;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ]) {
      const o = island.get(key(x + dx, y + dy));
      if (o !== undefined && o !== id) return false;
    }
    return true;
  };
  let id = 0;
  // Smaller islands come in greater numbers.
  const count = islands ?? (maxSize <= 2 ? 30 : 18);
  for (let tries = 0; tries < 1500 && id < count; tries++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(0, H - 1);
    const d = distToPath(x, y);
    if (d < 1 || d > 2 || !free(x, y, id)) continue;
    const cells = [{ x, y }];
    const size = rng.int(Math.min(2, maxSize) - (maxSize <= 2 ? 1 : 0), maxSize);
    grid[y][x] = '.';
    island.set(key(x, y), id);
    for (let k = 0; k < 20 && cells.length < size; k++) {
      const c = rng.pick(cells);
      const [dx, dy] = rng.pick(DIRS);
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !free(nx, ny, id) || distToPath(nx, ny) < 1) continue;
      grid[ny][nx] = '.';
      island.set(key(nx, ny), id);
      cells.push({ x: nx, y: ny });
    }
    for (const c of cells) if (rng.chance(0.12)) grid[c.y][c.x] = 'F';
    id++;
  }
}

function decorate(grid: string[][], rng: Rng, biome: BiomeDef): void {
  const H = grid.length;
  const W = grid[0].length;
  const isPath = (x: number, y: number) => ['#', 'S', 'C'].includes(grid[y]?.[x] ?? '');
  const nearPath = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (isPath(x + dx, y + dy)) return true;
    return false;
  };
  const distToPath = (x: number, y: number, max: number) => {
    for (let r = 0; r <= max; r++) if (nearPath(x, y, r)) return r;
    return max + 1;
  };
  /** Grows an irregular blob of `ch` tiles. Water may touch the road (naval towers need it close). */
  const blob = (ch: string, minSize: number, maxSize: number, nearRoad: boolean, avoid: number) => {
    for (let tries = 0; tries < 60; tries++) {
      const x = rng.int(1, W - 2);
      const y = rng.int(1, H - 2);
      if (grid[y][x] !== '.') continue;
      const dp = distToPath(x, y, 3);
      if (dp < Math.max(1, avoid)) continue;
      if (nearRoad && dp > 2 && tries < 45) continue;
      const size = rng.int(minSize, maxSize);
      const cells = [{ x, y }];
      grid[y][x] = ch;
      for (let k = 0; k < size * 4 && cells.length < size; k++) {
        const c = rng.pick(cells);
        const [dx, dy] = rng.pick(DIRS);
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1 || grid[ny][nx] !== '.' || nearPath(nx, ny, avoid)) continue;
        grid[ny][nx] = ch;
        cells.push({ x: nx, y: ny });
      }
      return;
    }
  };
  // Ponds and lagoons: most hug the road so naval towers have somewhere to stand.
  const ponds = biome.water > 0 ? Math.max(1, Math.round(rng.range(0.6, 1.6) * biome.water)) : 0;
  for (let i = 0; i < ponds; i++) blob('W', 2, biome.water > 1.5 ? 6 : 5, i < Math.max(1, ponds - 1), 0);
  // Guarantee: water-bearing regions always have a pool beside the road.
  const waterNearRoad = () => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y][x] === 'W' && distToPath(x, y, 2) <= 2) return true;
    return false;
  };
  if (ponds > 0 && !waterNearRoad()) {
    const cands: { x: number; y: number }[] = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (grid[y][x] === '.' && distToPath(x, y, 1) === 1) cands.push({ x, y });
    if (cands.length) {
      const c = rng.pick(cands);
      grid[c.y][c.x] = 'W';
      for (const [dx, dy] of DIRS)
        if (grid[c.y + dy]?.[c.x + dx] === '.' && !nearPath(c.x + dx, c.y + dy, 0) && rng.chance(0.5)) grid[c.y + dy][c.x + dx] = 'W';
    }
  }
  // Lava pools (kept one tile from the road).
  const pools = Math.round(rng.range(0.8, 1.4) * (biome.lava ?? 0));
  for (let i = 0; i < pools; i++) blob('L', 2, 6, false, 1);
  // Sea along the front shores.
  if (biome.sea) {
    let depth = rng.int(1, 3);
    for (let t = 0; t < W; t++) {
      if (rng.chance(0.35)) depth = Math.max(1, Math.min(3, depth + rng.pick([-1, 1])));
      for (let k = 0; k < depth; k++) {
        for (const [x, y] of [
          [t, H - 1 - k],
          [W - 1 - k, t],
        ]) {
          if (grid[y]?.[x] === '.' && !nearPath(x, y, 0)) grid[y][x] = 'W';
        }
      }
    }
  }
  // Trees cluster on the borders and away from the path; rocks scattered; flowers on grass.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (grid[y][x] !== '.') continue;
      const shore = ['W', 'L'].some((c) => grid[y - 1]?.[x] === c || grid[y + 1]?.[x] === c || grid[y]?.[x - 1] === c || grid[y]?.[x + 1] === c);
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      const close = nearPath(x, y, 1);
      let tree = biome.trees * (edge ? 3.2 : close ? 0.25 : 1) * (shore && biome.id === 'desert' ? 4 : 1);
      // Clustering: neighbours that are trees raise the chance.
      if (grid[y - 1]?.[x] === 'T' || grid[y]?.[x - 1] === 'T') tree *= 2.2;
      const r = rng.next();
      if (r < tree) grid[y][x] = 'T';
      else if (r < tree + biome.rocks * (close ? 0.3 : 1)) grid[y][x] = 'R';
      else if (r < tree + biome.rocks + biome.flowers) grid[y][x] = 'F';
    }
}
