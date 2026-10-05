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
import { ENEMY_LOOKS, type EnemyLook3D } from './looks';
import { towerModels, towerParts, type TowerParts } from './towers3d';

/** Pixels per world unit of the 2D camera scale (isometric axis foreshortening). */
const K = Math.SQRT2 * Math.cos(Math.PI / 6);
/** The ground group sits so the path surface (Kenney y = 0.1) is at game z = 0. */
const GROUND_Y = -0.1;
const GRASS_TOP = 0.1;

export const TILE_MODELS = [
  'td/tile.glb',
  'td/tile-straight.glb',
  'td/tile-corner-round.glb',
  'td/tile-end-round.glb',
  'td/tile-spawn-end-round.glb',
  'td/tile-tree.glb',
  'td/tile-tree-double.glb',
  'td/tile-tree-quad.glb',
  'td/tile-rock.glb',
  'td/tile-crystal.glb',
  'td/tile-hill.glb',
  'td/detail-dirt.glb',
  'td/detail-rocks.glb',
  'nature/flower_redA.glb',
  'nature/flower_yellowA.glb',
  'nature/flower_purpleA.glb',
  'nature/grass_large.glb',
];

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

    const hemi = new THREE.HemisphereLight('#dfe9ff', '#6b5a48', 1.6);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#fff4dc', 2.6);
    this.sun.castShadow = true;
    const b = game.board;
    const half = Math.max(b.width, b.height) * 0.8;
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

    void Promise.all([...TILE_MODELS.map(loadModel), loadModel('chars/anims.glb')]).then(() => {
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
    const add = (path: string, x: number, z: number, rot = 0, scale = 1, y = 0) => {
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
        const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
        const key = `${mat.name}|${mat.map?.source.uuid ?? ''}|${mat.color?.getHexString()}`;
        let grp = groups.get(key);
        if (!grp) groups.set(key, (grp = { mat, geos: [] }));
        const geo = toFloatGeometry(mesh.geometry);
        geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld));
        grp.geos.push(geo);
      });
    };
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
            add('td/tile.glb', x, z);
            if (t.kind === 'flowers') {
              const f = ['nature/flower_redA.glb', 'nature/flower_yellowA.glb', 'nature/flower_purpleA.glb'];
              for (let i = 0; i < 3; i++)
                add(f[Math.floor(rnd(t, i) * 3)], x - 0.3 + rnd(t, i + 3) * 0.6, z - 0.3 + rnd(t, i + 6) * 0.6, rnd(t, i + 9) * 6, 0.45, 0.2);
            } else if (rnd(t, 1) > 0.8)
              add('nature/grass_large.glb', x - 0.25 + rnd(t, 2) * 0.5, z - 0.25 + rnd(t, 3) * 0.5, rnd(t, 4) * 6, 0.5, 0.2);
            break;
          }
          case 'tree': {
            const r = rnd(t, 1);
            add(
              r < 0.4 ? 'td/tile-tree.glb' : r < 0.75 ? 'td/tile-tree-double.glb' : 'td/tile-tree-quad.glb',
              x,
              z,
              Math.floor(rnd(t, 2) * 4) * (Math.PI / 2),
            );
            break;
          }
          case 'rock':
            add(rnd(t, 1) < 0.7 ? 'td/tile-rock.glb' : 'td/tile-crystal.glb', x, z, Math.floor(rnd(t, 2) * 4) * (Math.PI / 2));
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
            const end = t.kind === 'spawn' ? 'td/tile-spawn-end-round.glb' : 'td/tile-end-round.glb';
            if (count <= 1) {
              // Open side: +z (s) θ=0, +x (e) π/2, -z (n) π, -x (w) -π/2
              const rot = s ? 0 : e ? Math.PI / 2 : n ? Math.PI : -Math.PI / 2;
              add(end, x, z, rot);
            } else if ((n && s) || (e && w)) add('td/tile-straight.glb', x, z, n && s ? 0 : Math.PI / 2);
            else {
              // Corner pieces open +x/+z at θ=0.
              const rot = e && s ? 0 : e && n ? Math.PI / 2 : w && n ? Math.PI : -Math.PI / 2;
              add('td/tile-corner-round.glb', x, z, rot);
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
    const theme = this.game.board.def.theme;
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
        color: lava ? '#ff7a2b' : theme === 'swamp' ? '#3f7a5a' : '#2f9fd0',
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

    // Island base: earth and rock strata under the board.
    const W = b.width;
    const H = b.height;
    const earth = new THREE.Mesh(new THREE.BoxGeometry(W, 0.35, H), new THREE.MeshStandardMaterial({ color: '#9a6b44', roughness: 1 }));
    earth.position.set(W / 2, -0.175, H / 2);
    const rock = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.55, H - 0.2), new THREE.MeshStandardMaterial({ color: '#8a8597', roughness: 1 }));
    rock.position.set(W / 2, -0.62, H / 2);
    earth.receiveShadow = rock.receiveShadow = true;
    group.add(earth, rock);

    this.scene.add(group);
    this.ground = group;
    this.buildCastle();
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
function hideGear(body: THREE.Object3D, show: string[], hide?: string[]): void {
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
