// Real-time 3D layer drawn under the 2D overlay (effects, health bars, UI hints).
// The 2D Camera is a true isometric projection, so an orthographic Three.js
// camera looking along (1,1,1) lines up with it pixel for pixel.
//
// World mapping: game (x, y, z) → three (X = x, Y = z, Z = y).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EnemyDef, TowerId } from '../data/types';
import type { Enemy, Tower } from '../game/entities';
import type { Game } from '../game/game';
import type { Tile } from '../game/board';
import type { Camera } from '../render/projection';
import { instance, isLoaded, loadModel, model, ownMaterials, toFloatGeometry } from './assets';
import { BIOMES_3D, biomeModels, tdTile, type Biome3D } from './biomes3d';
import { ENEMY_LOOKS, type EnemyLook3D } from './looks';
import { towerModels, towerParts, type TowerParts } from './towers3d';

/** Pixels per world unit of the 2D camera scale (isometric axis foreshortening). */
const K = Math.SQRT2 * Math.cos(Math.PI / 6);
/** The ground group sits so the path surface (Kenney y = 0.1) is at game z = 0. */
const GROUND_Y = -0.1;
const GRASS_TOP = 0.1;
/** Tiles of countryside drawn around the board. */
const SCENERY_MARGIN = 14;

/** Every terrain model any biome may use (for packaging). */
export const TILE_MODELS = [...new Set(Object.values(BIOMES_3D).flatMap(biomeModels))];

interface TowerObj {
  key: string;
  root: THREE.Group;
  parts: TowerParts;
  /** 1 right after a shot, decays to 0 (recoil, flash, orb pulse). */
  kick: number;
  unit: { pivot: THREE.Group; mixer: THREE.AnimationMixer; shoot: THREE.AnimationClip | null } | null;
}

interface EnemyObj {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  walk: THREE.AnimationAction | null;
  mats: THREE.MeshStandardMaterial[];
  look: EnemyLook3D;
  dying: number;
  clips: { walk: THREE.AnimationClip | null; death: THREE.AnimationClip | null; hit: THREE.AnimationClip | null; attack: THREE.AnimationClip | null };
  lastFlash: number;
  hitCd: number;
  dist: number;
  leaked: boolean;
}

export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  private sun: THREE.DirectionalLight;
  private readonly biome: Biome3D;
  /** Kenney palette materials repainted with the biome's colours. */
  private palette = new Map<THREE.Material, THREE.Material>();
  private ground: THREE.Group | null = null;
  private towers = new Map<number, TowerObj>();
  private enemies = new Map<number, EnemyObj>();
  private clips: THREE.AnimationClip[] | null = null;
  private time = 0;
  castle: THREE.Object3D | null = null;
  private water: THREE.MeshStandardMaterial[] = [];
  private projectiles = new Map<number, { obj: THREE.Object3D; lx: number; ly: number; lz: number }>();
  private castleHit = 0;
  private unsub: (() => void)[] = [];

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly game: Game,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.biome = BIOMES_3D[game.board.def.theme];
    const light = this.biome.light;
    const hemi = new THREE.HemisphereLight(light.sky, light.ground, light.hemi);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(light.sun, light.sunI);
    this.sun.castShadow = true;
    const b = game.board;
    const half = Math.max(b.width, b.height) * 0.8 + 4;
    const sc = this.sun.shadow.camera;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 1;
    sc.far = 80;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    const cx = b.width / 2;
    const cz = b.height / 2;
    this.sun.target.position.set(cx, 0, cz);
    // Sun from the upper left of the screen, like the 2D shading.
    this.sun.position.set(cx - 9, 22, cz + 14);

    void Promise.all([...biomeModels(this.biome).map(loadModel), loadModel('chars/anims.glb')]).then(() => {
      this.buildGround();
      this.clips = model('chars/anims.glb')!.animations;
    });
    // Warm up everything this battle can show so nothing pops in mid-fight.
    const towersNeeded = new Set<string>();
    for (const id of game.unlockedTowers) for (const m of towerModels(id)) towersNeeded.add(m);
    const charsNeeded = new Set(Object.values(ENEMY_LOOKS).map((l) => l!.model));
    for (const m of [...towersNeeded, ...charsNeeded, ...Object.values(PROJECTILE_MODELS).map((p) => p.model), 'chars/Rogue_Hooded.glb'])
      void loadModel(m).catch(() => undefined);
    this.unsub.push(game.events.on('fire', ({ tower }) => this.onFire(tower)));
  }

  destroy(): void {
    for (const u of this.unsub) u();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }

  /** Is this enemy drawn in 3D (otherwise the 2D layer keeps drawing it)? */
  handlesEnemy(def: EnemyDef): boolean {
    const look = ENEMY_LOOKS[def.id];
    if (!look || (!this.clips && look.model.startsWith('chars/'))) return false;
    if (!isLoaded(look.model)) {
      model(look.model);
      return false;
    }
    return true;
  }

  hasTower(uid: number): boolean {
    return this.towers.has(uid);
  }

  get groundReady(): boolean {
    return this.ground !== null;
  }

  // ------------------------------------------------------------ camera

  sync(cam: Camera, width: number, height: number, dpr: number): void {
    const r = this.renderer;
    if (r.getPixelRatio() !== dpr) r.setPixelRatio(dpr);
    const size = r.getSize(new THREE.Vector2());
    if (size.x !== width || size.y !== height) r.setSize(width, height, true);
    const k = cam.scale * K;
    const c = this.camera;
    c.left = -width / 2 / k;
    c.right = width / 2 / k;
    c.top = height / 2 / k;
    c.bottom = -height / 2 / k;
    c.updateProjectionMatrix();
    // World point on the z = 0 plane under the screen centre.
    const p = cam.unproject(width / 2, height / 2, 0);
    c.position.set(p.x + 60, 60, p.y + 60);
    c.lookAt(p.x, 0, p.y);
  }

  // ------------------------------------------------------------ frame

  private ghost: { key: string; obj: THREE.Object3D } | null = null;

  /** Translucent preview of the tower being placed. */
  setGhost(g: { id: TowerId; x: number; y: number; valid: boolean } | null): void {
    if (!g) {
      if (this.ghost) this.ghost.obj.visible = false;
      return;
    }
    const key = `${g.id}:${g.valid}`;
    if (!this.ghost || this.ghost.key !== key) {
      const parts = towerParts(g.id, 1, -1);
      if (!parts) return;
      if (this.ghost) this.scene.remove(this.ghost.obj);
      for (const m of ownMaterials(parts.root)) {
        m.transparent = true;
        m.opacity = 0.6;
        m.depthWrite = false;
        if (!g.valid) {
          m.color.lerp(new THREE.Color('#ff4a3a'), 0.6);
          m.emissive.set('#ff2a1a');
          m.emissiveIntensity = 0.3;
        }
      }
      parts.root.traverse((o) => (o.castShadow = false));
      this.ghost = { key, obj: parts.root };
      this.scene.add(parts.root);
    }
    const water = this.game.board.tile(g.x, g.y)?.kind === 'water';
    this.ghost.obj.visible = true;
    this.ghost.obj.position.set(g.x + 0.5, GRASS_TOP + (water ? -0.12 : 0), g.y + 0.5);
  }

  render(dt: number): void {
    this.time += dt;
    for (const m of this.water) m.emissiveIntensity = 0.08 + Math.sin(this.time * 1.5) * 0.04;
    this.syncTowers(dt);
    this.syncEnemies(dt);
    this.syncProjectiles();
    this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------ ground

  private buildGround(): void {
    const b = this.game.board;
    const group = new THREE.Group();
    group.position.y = GROUND_Y;
    // Geometry grouped by material so differently coloured kits merge correctly.
    const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
    const add = (path: string, x: number, z: number, rot = 0, scale = 1, y = 0, tint = 1) => {
      const g = model(path);
      if (!g) return;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot),
        new THREE.Vector3(scale, scale, scale),
      );
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = this.biomeMaterial((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial);
        const key = `${mat.name}|${mat.map?.source.uuid ?? ''}|${mat.color?.getHexString()}|${tint}`;
        let grp = groups.get(key);
        if (!grp) {
          let m2: THREE.Material = mat;
          if (tint !== 1) {
            const c = mat.clone();
            c.color.multiplyScalar(tint);
            m2 = c;
          }
          groups.set(key, (grp = { mat: m2, geos: [] }));
        }
        const geo = toFloatGeometry(mesh.geometry);
        geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld));
        grp.geos.push(geo);
      });
    };
    // Scale a model so its footprint spans `size` tiles, standing on the ground.
    const fitCache = new Map<string, { k: number; y: number }>();
    const addFit = (path: string, x: number, z: number, size: number, rot = 0, tint = 1) => {
      const g = model(path);
      if (!g) return;
      let f = fitCache.get(path);
      if (!f) {
        const box = new THREE.Box3().setFromObject(g.scene);
        const sz = box.getSize(new THREE.Vector3());
        f = { k: 1 / Math.max(0.01, sz.x, sz.z), y: -box.min.y };
        fitCache.set(path, f);
      }
      add(path, x, z, rot, size * f.k, 0.2 + f.y * size * f.k, tint);
    };
    // Scale a model so its largest dimension spans `h` tiles, standing on the ground.
    const hCache = new Map<string, { h: number; y: number }>();
    const addH = (path: string, x: number, z: number, h: number, rot = 0, tint = 1) => {
      const g = model(path);
      if (!g) return;
      let f = hCache.get(path);
      if (!f) {
        const box = new THREE.Box3().setFromObject(g.scene);
        const sz = box.getSize(new THREE.Vector3());
        f = { h: Math.max(0.01, sz.x, sz.y, sz.z), y: -box.min.y };
        hCache.set(path, f);
      }
      const k = h / f.h;
      add(path, x, z, rot, k, GRASS_TOP * 2 + f.y * k, tint);
    };
    const bio = this.biome;
    /** A few free-standing trees on one tile (biomes without Kenney tree tiles). */
    const grove = (x: number, z: number, r: (i: number) => number, count: number, tint = 1) => {
      for (let i = 0; i < count; i++) {
        const a = i * 2.4 + r(i) * 3;
        const d = count === 1 ? r(i + 7) * 0.15 : 0.18 + r(i + 7) * 0.12;
        const [h0, h1] = bio.treeH;
        addH(
          bio.trees[Math.floor(r(i + 3) * bio.trees.length)],
          x + Math.cos(a) * d,
          z + Math.sin(a) * d,
          h0 + (h1 - h0) * r(i + 5),
          r(i + 9) * 6,
          tint,
        );
      }
    };
    this.buildScenery(add, addFit, addH, grove);
    const isPath = (x: number, y: number) => b.isWalkable(x, y);
    const rnd = (t: Tile, i: number) => {
      const v = Math.sin(t.seed * 9301 + i * 49297) * 233280;
      return v - Math.floor(v);
    };
    const waterTiles: Tile[] = [];
    for (const row of b.tiles)
      for (const t of row) {
        const x = t.x + 0.5;
        const z = t.y + 0.5;
        switch (t.kind) {
          case 'grass':
          case 'flowers': {
            add(tdTile(bio, 'tile'), x, z);
            if (t.kind === 'flowers') {
              const f = bio.flowers;
              for (let i = 0; i < 3; i++)
                addH(
                  f[Math.floor(rnd(t, i) * f.length)],
                  x - 0.3 + rnd(t, i + 3) * 0.6,
                  z - 0.3 + rnd(t, i + 6) * 0.6,
                  0.12 + rnd(t, i + 12) * 0.08,
                  rnd(t, i + 9) * 6,
                );
            } else if (rnd(t, 1) > 0.8) {
              const p = bio.props[Math.floor(rnd(t, 5) * bio.props.length)];
              addH(p, x - 0.25 + rnd(t, 2) * 0.5, z - 0.25 + rnd(t, 3) * 0.5, 0.1 + rnd(t, 6) * 0.12, rnd(t, 4) * 6);
            }
            break;
          }
          case 'tree': {
            const r = rnd(t, 1);
            if (bio.trees.length) {
              add(tdTile(bio, 'tile'), x, z);
              grove(x, z, (i) => rnd(t, i + 20), r < 0.4 ? 1 : r < 0.75 ? 2 : 3);
            } else
              add(
                tdTile(bio, r < 0.4 ? 'tile-tree' : r < 0.75 ? 'tile-tree-double' : 'tile-tree-quad'),
                x,
                z,
                Math.floor(rnd(t, 2) * 4) * (Math.PI / 2),
              );
            break;
          }
          case 'rock':
            add(tdTile(bio, rnd(t, 1) < 0.7 ? 'tile-rock' : 'tile-crystal'), x, z, Math.floor(rnd(t, 2) * 4) * (Math.PI / 2));
            break;
          case 'water':
          case 'lava':
            waterTiles.push(t);
            break;
          default: {
            // Path piece chosen from its open sides.
            const n = isPath(t.x, t.y - 1);
            const s = isPath(t.x, t.y + 1);
            const e = isPath(t.x + 1, t.y);
            const w = isPath(t.x - 1, t.y);
            const count = +n + +s + +e + +w;
            const end = tdTile(bio, t.kind === 'spawn' ? 'tile-spawn-end-round' : 'tile-end-round');
            if (count <= 1) {
              // Open side: +z (s) θ=0, +x (e) π/2, -z (n) π, -x (w) -π/2
              const rot = s ? 0 : e ? Math.PI / 2 : n ? Math.PI : -Math.PI / 2;
              add(end, x, z, rot);
            } else if ((n && s) || (e && w)) add(tdTile(bio, 'tile-straight'), x, z, n && s ? 0 : Math.PI / 2);
            else {
              // Corner pieces open +x/+z at θ=0.
              const rot = e && s ? 0 : e && n ? Math.PI / 2 : w && n ? Math.PI : -Math.PI / 2;
              add(tdTile(bio, 'tile-corner-round'), x, z, rot);
            }
          }
        }
      }
    for (const { mat, geos } of groups.values()) {
      const merged = mergeGeometries(geos, false);
      if (merged) {
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      for (const g of geos) g.dispose();
    }

    // Water / lava basins: a sunken bed and a glossy surface.
    for (const t of waterTiles) {
      const lava = t.kind === 'lava';
      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.06, 1),
        new THREE.MeshStandardMaterial({ color: lava ? '#3a2420' : '#6b8a6a', roughness: 1 }),
      );
      bed.position.set(t.x + 0.5, 0.03, t.y + 0.5);
      bed.receiveShadow = true;
      group.add(bed);
      const mat = new THREE.MeshStandardMaterial({
        color: lava ? '#ff7a2b' : bio.water,
        emissive: lava ? '#ff5a1a' : '#4fb8ff',
        emissiveIntensity: lava ? 0.9 : 0.08,
        roughness: lava ? 0.6 : 0.15,
        metalness: 0.1,
        transparent: !lava,
        opacity: 0.88,
      });
      if (!lava) this.water.push(mat);
      const surf = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      surf.rotation.x = -Math.PI / 2;
      surf.position.set(t.x + 0.5, 0.07, t.y + 0.5);
      surf.receiveShadow = true;
      group.add(surf);
    }

    this.scene.add(group);
    this.ground = group;
    this.buildCastle();
  }

  /**
   * The countryside around the battlefield: open fields at the edge, then
   * woods, rocks and, far away, hills and mountains, so the view is filled
   * with landscape instead of a floating board. The road leads in from
   * beyond the horizon to the spawn portal. Coasts end in the sea; swamps
   * and volcanoes are dotted with ponds and lava pools.
   */
  private buildScenery(
    add: (path: string, x: number, z: number, rot?: number, scale?: number, y?: number, tint?: number) => void,
    addFit: (path: string, x: number, z: number, size: number, rot?: number, tint?: number) => void,
    addH: (path: string, x: number, z: number, h: number, rot?: number, tint?: number) => void,
    grove: (x: number, z: number, r: (i: number) => number, count: number, tint?: number) => void,
  ): void {
    const b = this.game.board;
    const bio = this.biome;
    const W = b.width;
    const H = b.height;
    const M = SCENERY_MARGIN;
    const noise = (x: number, y: number) => {
      const v = Math.sin(x * 12.9898 + y * 78.233 + b.def.id.length * 3.1) * 43758.5453;
      return v - Math.floor(v);
    };
    const smooth = (x: number, y: number) => (Math.sin(x * 0.45 + y * 0.2) + Math.sin(x * 0.17 - y * 0.38) + 2) / 4;
    // Road coming from outside towards the spawn portal.
    const road = new Set<string>();
    const sp = b.spawn;
    const dir = sp.x === 0 ? [-1, 0] : sp.y === 0 ? [0, -1] : sp.x === W - 1 ? [1, 0] : [0, 1];
    for (let i = 1; i <= M; i++) road.add(`${sp.x + dir[0] * i},${sp.y + dir[1] * i}`);
    const OUT = 0.9;
    // Sea beyond the bottom and right shores (the board's own sea lies along them).
    const isSea = (x: number, y: number) => !!bio.ocean && (x >= W || y >= H);
    const pond = (x: number, y: number, d: number) =>
      !!bio.pools && d >= 2 && (Math.sin(x * 0.61 + y * 0.37) + Math.sin(x * 0.23 - y * 0.52 + 1.3) + 2) / 4 > (bio.pools === 'lava' ? 0.86 : 0.8);
    const liquid: [number, number][] = [];
    for (let y = -M; y < H + M; y++)
      for (let x = -M; x < W + M; x++) {
        if (x >= 0 && y >= 0 && x < W && y < H) continue;
        const cx = x + 0.5;
        const cz = y + 0.5;
        if (road.has(`${x},${y}`)) {
          add(tdTile(bio, 'tile-straight'), cx, cz, dir[0] !== 0 ? Math.PI / 2 : 0, 1, 0, OUT);
          continue;
        }
        const d = Math.max(x < 0 ? -x : x >= W ? x - W + 1 : 0, y < 0 ? -y : y >= H ? y - H + 1 : 0);
        if (isSea(x, y) || pond(x, y, d)) {
          liquid.push([x, y]);
          continue;
        }
        const n = noise(x, y);
        const forest = smooth(x, y) * 0.9 + (d - 2) * 0.09 + (0.5 - bio.woods) * 0.6;
        if (d >= 2 && forest > 0.62 && n < 0.85 && noise(y * 1.3, x * 0.7) < (bio.sparse ?? 1)) {
          if (bio.trees.length) {
            add(tdTile(bio, 'tile'), cx, cz, 0, 1, 0, OUT);
            grove(cx, cz, (i) => noise(x + i * 7.1, y - i * 3.3), n < 0.35 ? 3 : n < 0.65 ? 2 : 1, OUT);
          } else
            add(
              tdTile(bio, n < 0.35 ? 'tile-tree-quad' : n < 0.65 ? 'tile-tree-double' : 'tile-tree'),
              cx,
              cz,
              Math.floor(n * 4) * (Math.PI / 2),
              1,
              0,
              OUT,
            );
          continue;
        }
        add(tdTile(bio, 'tile'), cx, cz, 0, 1, 0, OUT);
        if (d >= 2 && n > 0.93) add(tdTile(bio, 'detail-rocks'), cx, cz, n * 20, 1, 0.2, OUT);
        else if (n > 0.84) {
          const p = bio.props[Math.floor(noise(y, x) * bio.props.length)];
          addH(p, cx - 0.2, cz + 0.1, 0.12 + noise(x * 2, y) * 0.14, n * 30, OUT);
        } else if (n < 0.04) addH(bio.flowers[0], cx, cz, 0.14, n * 50, OUT);
      }
    // Far hills and mountains frame the horizon (placed on a coarse grid).
    for (let y = -M; y < H + M; y += 3)
      for (let x = -M; x < W + M; x += 3) {
        const d = Math.max(x < 0 ? -x : x >= W ? x - W : 0, y < 0 ? -y : y >= H ? y - H : 0);
        if (d < 6 || road.has(`${x},${y}`) || road.has(`${x + 1},${y + 1}`)) continue;
        if ([0, 1, 2].some((i) => isSea(x + i, y + i) || isSea(x + 2 - i, y + i) || pond(x + i, y + i, d))) continue;
        const n = noise(x * 3.7, y * 1.3);
        if (n > 0.55) continue;
        const kind = bio.far[Math.min(bio.far.length - 1, Math.floor((n / 0.55) * bio.far.length))];
        addFit(kind, x + 1.5, y + 1.5, 2.6 + n * 2, n * 10, bio.farTint ?? 1);
      }
    if (liquid.length) this.buildLiquid(liquid, bio.pools === 'lava');
  }

  /** Sea, ponds or lava pools in the countryside, as one merged surface over a dark bed. */
  private buildLiquid(cells: [number, number][], lava: boolean): void {
    const surf: THREE.BufferGeometry[] = [];
    for (const [x, y] of cells) {
      const g = new THREE.PlaneGeometry(1, 1);
      g.rotateX(-Math.PI / 2);
      g.translate(x + 0.5, 0, y + 0.5);
      surf.push(g);
    }
    const merged = mergeGeometries(surf, false)!;
    for (const g of surf) g.dispose();
    const bed = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: lava ? '#2a1a18' : '#5f8a7a', roughness: 1 }));
    bed.position.y = GROUND_Y + 0.03;
    bed.receiveShadow = true;
    const mat = new THREE.MeshStandardMaterial({
      color: lava ? '#ff7a2b' : this.biome.water,
      emissive: lava ? '#ff5a1a' : '#4fb8ff',
      emissiveIntensity: lava ? 0.9 : 0.08,
      roughness: lava ? 0.6 : 0.15,
      metalness: 0.1,
      transparent: !lava,
      opacity: 0.88,
    });
    if (!lava) this.water.push(mat);
    const top = new THREE.Mesh(merged.clone(), mat);
    top.position.y = GROUND_Y + 0.07;
    top.receiveShadow = true;
    this.scene.add(bed, top);
  }

  /**
   * Kenney's tiles share one palette texture; biomes repaint its grass and
   * road swatches (keeping the vertical shading) instead of tinting.
   */
  private biomeMaterial(mat: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    const b = this.biome;
    const hit = this.palette.get(mat);
    if (hit) return hit as THREE.MeshStandardMaterial;
    const swap = b.recolor?.[mat.name];
    if (swap) {
      const out = mat.clone();
      out.color.set(swap);
      this.palette.set(mat, out);
      return out;
    }
    const img = mat.map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
    if ((!b.ground && !b.path) || mat.name !== 'colormap' || !img) return mat;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const cw = c.width / 16;
    const rh = c.height / 4;
    const paint = (col: number, row: number, [top, bottom]: [string, string]) => {
      const g = ctx.createLinearGradient(0, row * rh, 0, (row + 1) * rh);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      ctx.fillStyle = g;
      ctx.fillRect(col * cw, row * rh, cw, rh);
    };
    if (b.ground) paint(9, 2, b.ground);
    if (b.path) paint(1, 2, b.path);
    const tex = mat.map!.clone();
    tex.image = c;
    tex.needsUpdate = true;
    const out = mat.clone();
    out.map = tex;
    this.palette.set(mat, out);
    return out;
  }

  private buildCastle(): void {
    const b = this.game.board;
    const path = 'hex/blue/building_castle_blue.glb';
    void loadModel(path).then(() => {
      const o = instance(path)!;
      const box = new THREE.Box3().setFromObject(o);
      const sz = box.getSize(new THREE.Vector3());
      const k = 1.25 / Math.max(sz.x, sz.z);
      o.scale.setScalar(k);
      o.position.set(-(box.min.x + sz.x / 2) * k, -box.min.y * k, -(box.min.z + sz.z / 2) * k);
      const g = new THREE.Group();
      g.add(o);
      g.position.set(b.castle.x + 0.5, 0, b.castle.y + 0.5);
      this.scene.add(g);
      this.castle = g;
    });
  }

  // ------------------------------------------------------------ towers

  private syncTowers(dt: number): void {
    const seen = new Set<number>();
    for (const t of this.game.towers) {
      seen.add(t.uid);
      const key = `${t.def.id}:${t.tier}:${t.branch}`;
      let obj = this.towers.get(t.uid);
      if (!obj || obj.key !== key) {
        const parts = towerParts(t.def.id as TowerId, t.tier, t.branch);
        if (!parts) continue;
        if (obj) this.scene.remove(obj.root);
        const root = new THREE.Group();
        root.add(parts.root);
        root.position.set(t.x, GRASS_TOP + (t.def.placement === 'water' ? -0.12 : 0), t.y);
        this.scene.add(root);
        obj = { key, root, parts, kick: 0, unit: null };
        if (parts.unitY !== null) obj.unit = this.makeUnit(parts);
        this.towers.set(t.uid, obj);
      }
      this.animateTower(t, obj, dt);
    }
    for (const [uid, obj] of this.towers)
      if (!seen.has(uid)) {
        this.scene.remove(obj.root);
        this.towers.delete(uid);
      }
  }

  /** A crossbowman standing on top of the tower. */
  private makeUnit(parts: TowerParts): TowerObj['unit'] {
    const body = instance('chars/Rogue_Hooded.glb');
    if (!body || !this.clips) return null;
    hideGear(body, ['2H_Crossbow']);
    const box = new THREE.Box3().setFromObject(body);
    body.scale.setScalar(0.42 / Math.max(0.01, box.max.y - box.min.y));
    const pivot = new THREE.Group();
    pivot.position.y = parts.unitY!;
    pivot.add(body);
    parts.root.add(pivot);
    const mixer = new THREE.AnimationMixer(body);
    const aim = this.clip(this.clips, ['2H_Ranged_Aiming', 'Idle']);
    if (aim) mixer.clipAction(aim).play();
    return { pivot, mixer, shoot: this.clip(this.clips, ['2H_Ranged_Shoot']) };
  }

  private onFire(t: Tower): void {
    const obj = this.towers.get(t.uid);
    if (!obj) return;
    obj.kick = 1;
    const u = obj.unit;
    if (u?.shoot) {
      const a = u.mixer.clipAction(u.shoot);
      a.reset().setLoop(THREE.LoopOnce, 1).setEffectiveTimeScale(1.8).setEffectiveWeight(1).play();
      a.clampWhenFinished = false;
    }
  }

  private animateTower(t: Tower, obj: TowerObj, dt: number): void {
    const p = obj.parts;
    const aim = Math.PI / 2 - t.angle;
    obj.kick = Math.max(0, obj.kick - dt * 5);
    const kick = obj.kick * obj.kick;
    if (p.turret) {
      p.turret.rotation.y = aim;
      // Recoil: the weapon jolts backwards along its barrel and settles.
      p.turret.children[0].position.z = -kick * 0.12;
    }
    if (p.flash) {
      p.flash.visible = obj.kick > 0.55;
      p.flash.scale.setScalar(0.6 + kick * 1.2);
    }
    if (p.orb) {
      p.orb.position.y = p.orbY + Math.sin(this.time * 2.4 + t.uid) * 0.05;
      p.orb.rotation.y = this.time * (1 + kick * 6);
      p.orb.scale.setScalar(1 + kick * 0.7);
      const mats = p.orbMats;
      for (const m of mats) m.emissiveIntensity = 0.55 + kick * 2.5;
    }
    if (obj.unit) {
      obj.unit.pivot.rotation.y = aim;
      obj.unit.mixer.update(dt);
    }
    // Pop when built / upgraded
    const k = Math.min(1, t.buildAnim / 0.35);
    const s = k < 1 ? 0.6 + 0.4 * (1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2)) : 1;
    obj.root.scale.setScalar(s);
  }

  // ------------------------------------------------------------ projectiles

  private syncProjectiles(): void {
    const seen = new Set<number>();
    for (const pr of this.game.projectiles) {
      if (!pr.alive) continue;
      const m = PROJECTILE_MODELS[pr.style];
      if (!m) continue;
      let o = this.projectiles.get(pr.uid);
      if (!o) {
        const made = instance(m.model);
        if (!made) continue;
        const g = new THREE.Group();
        made.scale.setScalar(m.scale);
        if (m.pitch) made.rotation.x = m.pitch;
        g.add(made);
        this.scene.add(g);
        o = { obj: g, lx: pr.x, ly: pr.y, lz: pr.z };
        this.projectiles.set(pr.uid, o);
      }
      seen.add(pr.uid);
      o.obj.position.set(pr.x, pr.z, pr.y);
      // Point along the flight direction (including the arc of lobs).
      const dx = pr.x - o.lx;
      const dy = pr.y - o.ly;
      const dz = pr.z - o.lz;
      if (dx * dx + dy * dy + dz * dz > 1e-6) o.obj.lookAt(pr.x + dx, pr.z + dz, pr.y + dy);
      if (m.spin) o.obj.rotateZ(this.time * 12);
      o.lx = pr.x;
      o.ly = pr.y;
      o.lz = pr.z;
    }
    for (const [uid, o] of this.projectiles)
      if (!seen.has(uid)) {
        this.scene.remove(o.obj);
        this.projectiles.delete(uid);
      }
  }

  /** Projectile styles drawn as 3D models (the rest stay as glowing 2D effects). */
  handlesProjectile(style: string): boolean {
    const m = PROJECTILE_MODELS[style];
    return !!m && isLoaded(m.model);
  }

  // ------------------------------------------------------------ enemies

  private clip(clips: THREE.AnimationClip[], names: string[]): THREE.AnimationClip | null {
    for (const n of names) {
      const c = clips.find((c) => c.name === n || c.name.endsWith('|' + n) || c.name.endsWith('_' + n));
      if (c) return c;
    }
    return null;
  }

  private clipsOf(look: EnemyLook3D): THREE.AnimationClip[] | null {
    if (look.rigid) return [];
    if (look.model.startsWith('chars/')) return this.clips;
    return model(look.model)?.animations ?? null;
  }

  private syncEnemies(dt: number): void {
    const seen = new Set<number>();
    for (const e of this.game.enemies) {
      if (!e.alive || !this.handlesEnemy(e.def)) continue;
      seen.add(e.uid);
      let obj = this.enemies.get(e.uid);
      if (!obj) {
        const made = this.makeEnemy(e);
        if (!made) continue;
        obj = made;
        this.enemies.set(e.uid, obj);
      }
      this.updateEnemy(e, obj, dt);
    }
    const end = this.game.board.length;
    for (const [uid, obj] of this.enemies) {
      if (seen.has(uid)) continue;
      if (obj.dying === 0) {
        obj.dying = 0.0001;
        obj.leaked = obj.dist >= end - 0.35;
        // Leaked enemies strike the castle; the fallen play their death.
        const clip = obj.leaked ? obj.clips.attack : obj.clips.death;
        if (clip) {
          obj.mixer.stopAllAction();
          const a = obj.mixer.clipAction(clip);
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = true;
          a.timeScale = obj.leaked ? 1.4 : 1.5;
          a.play();
        }
        if (obj.leaked) this.castleHit = 1;
      }
      obj.dying += dt;
      obj.mixer.update(dt);
      if (obj.look.rigid && !obj.leaked) obj.root.rotation.z = Math.min(0.5, obj.dying);
      const fadeStart = obj.leaked ? 0.45 : 0.9;
      if (obj.dying > fadeStart) {
        const f = Math.max(0, 1 - (obj.dying - fadeStart) / 0.45);
        for (const m of obj.mats) {
          m.transparent = true;
          m.opacity = f * (obj.look.ghost ? 0.7 : 1);
        }
        if (!obj.leaked) obj.root.position.y -= dt * 0.25;
      }
      if (obj.dying > fadeStart + 0.45) {
        this.scene.remove(obj.root);
        this.enemies.delete(uid);
      }
    }
    if (this.castle) {
      this.castleHit = Math.max(0, this.castleHit - dt * 3);
      const k = this.castleHit;
      this.castle.position.x = this.game.board.castle.x + 0.5 + Math.sin(this.time * 70) * 0.03 * k;
      this.castle.scale.setScalar(1 - k * 0.04);
    }
  }

  private makeEnemy(e: Enemy): EnemyObj | null {
    const look = ENEMY_LOOKS[e.def.id]!;
    const clips = this.clipsOf(look);
    const body = instance(look.model);
    if (!body || !clips) return null;
    hideGear(body, look.show ?? [], look.hide);
    const mats = ownMaterials(body);
    if (look.tint) for (const m of mats) m.color.lerp(new THREE.Color(look.tint), look.tintAmount ?? 0.5);
    // Fit to the requested height (models come in very different units).
    // Fit the model's largest dimension (bosses grow, but not without limit).
    const box = new THREE.Box3().setFromObject(body);
    const sz = box.getSize(new THREE.Vector3());
    const k = (look.height * Math.min(e.def.size, 1.45)) / Math.max(0.01, sz.x, sz.y, sz.z);
    body.scale.setScalar(k);
    body.position.y = -box.min.y * k;
    body.rotation.y = look.yaw ?? 0;
    const root = new THREE.Group();
    root.add(body);
    this.scene.add(root);
    const mixer = new THREE.AnimationMixer(body);
    const fast = e.def.speed > 1.3;
    const set = {
      walk: this.clip(
        clips,
        e.def.flying
          ? ['Flying', 'Bat_Flying', 'Dragon_Flying', 'Walk']
          : fast
            ? ['Running_A', 'Skeleton_Running', 'Walk', 'Walking', 'Slime_Walk']
            : ['Walking_A', 'Walk', 'Walking', 'Slime_Walk', 'Skeleton_Running', 'Flying', 'Idle'],
      ),
      death: this.clip(clips, ['Death_A', 'Death', 'Bat_Death', 'Dragon_Death', 'Slime_Death', 'Skeleton_Death']),
      hit: this.clip(clips, ['Hit_A', 'HitRecieve', 'Bat_Hit', 'Dragon_Hit']),
      attack: this.clip(clips, [
        '1H_Melee_Attack_Chop',
        'Bite_Front',
        'Bat_Attack',
        'Dragon_Attack',
        'Slime_Attack',
        'Skeleton_Attack',
        'Unarmed_Melee_Attack_Punch_A',
      ]),
    };
    const walk = set.walk ? mixer.clipAction(set.walk) : null;
    if (walk) {
      walk.play();
      walk.time = Math.random() * set.walk!.duration;
    }
    return { root, mixer, walk, mats, look, dying: 0, clips: set, lastFlash: 1, hitCd: 0, dist: e.dist, leaked: false };
  }

  private updateEnemy(e: Enemy, obj: EnemyObj, dt: number): void {
    const hover = e.def.flying ? 0.75 + Math.sin(e.age * 4) * 0.06 : 0;
    obj.dist = e.dist;
    obj.root.position.set(e.x, hover, e.y);
    // Smoothly turn to face the walking direction.
    const target = Math.PI / 2 - e.angle;
    let d = target - obj.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    obj.root.rotation.y += d * Math.min(1, dt * 12);
    const stopped = e.stunTime > 0 || e.freezeTime > 0;
    if (obj.walk)
      obj.walk.timeScale = stopped ? 0 : (e.currentSpeed / Math.max(0.3, e.def.speed)) * (e.def.speed > 1.3 ? 1.1 : 1.4) * (obj.look.stride ?? 1);
    if (obj.look.rigid) {
      // Siege engines rock gently as they roll.
      obj.root.rotation.z = stopped ? 0 : Math.sin(e.age * 6) * 0.03;
    }
    // Flinch when hit (at most every 0.6 s so the walk keeps reading).
    obj.hitCd -= dt;
    if (e.hitFlash < obj.lastFlash && obj.hitCd <= 0 && obj.clips.hit) {
      obj.hitCd = 0.6;
      const a = obj.mixer.clipAction(obj.clips.hit);
      a.reset().setLoop(THREE.LoopOnce, 1).setEffectiveTimeScale(1.6).setEffectiveWeight(0.8).play();
    }
    obj.lastFlash = e.hitFlash;
    obj.mixer.update(dt);
    const flash = e.hitFlash < 0.08;
    const frozen = e.freezeTime > 0;
    for (const m of obj.mats) {
      m.emissive.set(flash ? '#ffffff' : frozen ? '#6fc8ff' : (obj.look.glow ?? '#000000'));
      m.emissiveIntensity = flash ? 0.6 : frozen ? 0.5 : obj.look.glow ? 0.35 : 0;
    }
    const spawnFade = Math.min(1, e.age / 0.35);
    const base = obj.look.ghost ? 0.7 : 1;
    const want = spawnFade * base;
    const transparent = want < 1;
    for (const m of obj.mats) {
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = want;
    }
  }
}

/** Shows only the listed accessory meshes of a KayKit character. */
export function hideGear(body: THREE.Object3D, show: string[], hide?: string[]): void {
  body.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const n = o.name;
    if (/^(1H_|2H_|Knife|Throwable|Spellbook|Mug|Badge_Shield|Rectangle_Shield|Round_Shield|Spike_Shield|Barbarian_Round_Shield)/.test(n))
      o.visible = show.includes(n);
    if (hide?.some((h) => n.includes(h))) o.visible = false;
  });
}

export const PROJECTILE_MODELS: Record<string, { model: string; scale: number; pitch?: number; spin?: boolean }> = {
  arrow: { model: 'td/weapon-ammo-arrow.glb', scale: 0.7 },
  runeArrow: { model: 'td/weapon-ammo-arrow.glb', scale: 0.7 },
  bolt: { model: 'td/weapon-ammo-arrow.glb', scale: 1.1 },
  harpoon: { model: 'td/weapon-ammo-arrow.glb', scale: 1.5 },
  ball: { model: 'td/weapon-ammo-cannonball.glb', scale: 0.8 },
  bomb: { model: 'td/weapon-ammo-cannonball.glb', scale: 0.6 },
  flask: { model: 'td/weapon-ammo-boulder.glb', scale: 0.5, spin: true },
};
