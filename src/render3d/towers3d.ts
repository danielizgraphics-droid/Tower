// Towers built from KayKit's medieval buildings (CC0). The tier sets the size
// and the props around the building; the branch picks the roof colour and,
// for some towers, a different building. Weapons from Kenney's kit turn
// towards the target and magic towers carry a floating focus.

import * as THREE from 'three';
import type { TowerId } from '../data/types';
import { instance, loadModel, ownMaterials } from './assets';

export interface TowerParts {
  root: THREE.Group;
  /** Rotates to face the target. */
  turret: THREE.Object3D | null;
  /** Floating magic focus. */
  orb: THREE.Object3D | null;
  orbY: number;
  orbMats: THREE.MeshStandardMaterial[];
  /** Muzzle flash shown for an instant after each shot. */
  flash: THREE.Object3D | null;
  /** Height where a crossbowman stands (null = no unit). */
  unitY: number | null;
}

type Color = 'blue' | 'red' | 'green' | 'yellow';
/** Base colour, then one per branch. */
const BRANCH_COLORS: Color[] = ['red', 'yellow', 'green'];

const B = (name: string, c: Color) => `hex/${c}/building_${name}_${c}.glb`;
const PROP = (n: string) => `hex/props/${n}.glb`;
const TD = (n: string) => `td/${n}.glb`;

interface Prop {
  m: string;
  /** Offset in tiles from the tile centre (x, z) and size multiplier. */
  x: number;
  z: number;
  s?: number;
  rot?: number;
}

interface Plan {
  base: string;
  /** Footprint of the building in tiles. */
  fit: number;
  turret?: string;
  /** Height (fraction of the building) where the turret sits. */
  turretAt?: number;
  orb?: string;
  props?: Prop[];
  /** Tinted crystals on top (Kenney). */
  crystals?: string;
  /** A crossbowman stands on top (height fraction). */
  unitAt?: number;
  /** Muzzle flash colour for the turret. */
  flash?: string;
}

function plan(id: TowerId, tier: number, branch: number): Plan {
  const c: Color = branch >= 0 ? BRANCH_COLORS[branch] : 'blue';
  const size = 0.62 + Math.min(tier, 3) * 0.07 + (tier >= 4 ? 0.06 : 0) + (tier >= 5 ? 0.04 : 0);
  const extras: Prop[] = [];
  if (tier >= 2) extras.push({ m: PROP('crate_A_small'), x: 0.34, z: 0.3, s: 0.5 });
  if (tier >= 3) extras.push({ m: PROP('barrel'), x: -0.33, z: 0.32, s: 0.45 });
  if (tier >= 4) extras.push({ m: PROP(`flag_${c}`), x: 0.3, z: -0.3, s: 0.7 });
  switch (id) {
    case 'archer':
      if (tier >= 4) return { base: B('archeryrange', c), fit: size + 0.08, props: extras };
      return {
        base: B('tower_base', c),
        fit: size * 0.72,
        unitAt: 0.97,
        props: [...extras, ...(tier >= 2 ? [{ m: PROP('bucket_arrows'), x: -0.3, z: -0.25, s: 0.5 }] : [])],
      };
    case 'ballista':
      return { base: B('tower_base', c), fit: size * 0.82, turret: TD('weapon-ballista'), turretAt: 0.86, props: extras };
    case 'cannon':
      if (tier >= 4 && branch === 0) return { base: B('tower_catapult', c), fit: size * 0.82, props: extras };
      return {
        base: B('tower_base', c),
        fit: size * 0.82,
        turret: TD('weapon-cannon'),
        turretAt: 0.86,
        flash: '#ffc04a',
        props: [...extras, ...(tier >= 2 ? [{ m: 'hex/neutral/projectile_catapult.glb', x: -0.3, z: 0.05, s: 0.4 }] : [])],
      };
    case 'alchemist':
      return { base: B('blacksmith', c), fit: size + 0.05, orb: '#9be15d', props: extras };
    case 'arcane':
      return { base: B('tower_B', c), fit: size * 0.75, orb: branch === 1 ? '#5a2aa0' : branch === 2 ? '#5fe0c0' : '#b48cff', props: extras };
    case 'pyre':
      return {
        base: B('tower_base', c),
        fit: size * 0.8,
        orb: branch === 2 ? '#ff4a1a' : '#ff9a2b',
        props: [...extras, { m: PROP('resource_stone'), x: -0.3, z: -0.3, s: 0.45 }],
      };
    case 'frost':
      return { base: B('tower_A', c), fit: size * 0.72, orb: '#bfe8ff', crystals: '#bfe8ff', props: extras };
    case 'storm':
      return { base: B('tower_B', c), fit: size * 0.72, orb: '#ffe066', crystals: '#fff3a0', props: extras };
    case 'sanctum':
      return { base: B('church', c), fit: size + 0.08, orb: '#fff2b0', props: extras };
    case 'obelisk':
      return { base: B('mine', c), fit: size + 0.05, orb: branch === 2 ? '#6b4fd9' : '#a68cff', props: extras };
    case 'harbor':
      if (branch === 1) return { base: B('tower_catapult', c), fit: size * 0.8, props: extras };
      if (branch === 2) return { base: B('tower_B', c), fit: size * 0.75, orb: '#fff2b0' };
      return { base: B('watermill', c), fit: size + 0.05, turret: TD('weapon-cannon'), turretAt: 0.45, flash: '#ffc04a' };
    case 'tide':
      return { base: B('well', c), fit: size + 0.05, orb: branch === 2 ? '#c48cff' : '#5fe0ff', crystals: branch === 0 ? '#9fe8ff' : undefined };
  }
}

const CRYSTALS = TD('tower-round-crystals');

/** Every model a tower may use (for preloading). */
export function towerModels(id: TowerId): string[] {
  const out = new Set<string>();
  for (const tier of [1, 2, 3, 4, 5])
    for (const br of tier >= 4 ? [0, 1, 2] : [-1]) {
      const p = plan(id, tier, br);
      out.add(p.base);
      if (p.turret) out.add(p.turret);
      if (p.crystals) out.add(CRYSTALS);
      for (const x of p.props ?? []) out.add(x.m);
    }
  return [...out];
}

/** Builds the tower, or returns null (and starts loading) while its pieces are not ready. */
export function towerParts(id: TowerId, tier: number, branch: number): TowerParts | null {
  const p = plan(id, tier, branch);
  const need = [p.base, ...(p.turret ? [p.turret] : []), ...(p.crystals ? [CRYSTALS] : []), ...(p.props ?? []).map((x) => x.m)];
  const objs = need.map((m) => instance(m));
  if (objs.some((o) => !o)) {
    for (const m of need) void loadModel(m).catch(() => undefined);
    return null;
  }
  const root = new THREE.Group();
  const base = objs[0]!;
  const box = new THREE.Box3().setFromObject(base);
  const sz = box.getSize(new THREE.Vector3());
  const k = p.fit / Math.max(sz.x, sz.z);
  base.scale.setScalar(k);
  base.position.set(-(box.min.x + sz.x / 2) * k, -box.min.y * k, -(box.min.z + sz.z / 2) * k);
  root.add(base);
  const height = sz.y * k;
  let i = 1;
  let turret: THREE.Object3D | null = null;
  let flash: THREE.Object3D | null = null;
  if (p.turret) {
    const w = objs[i++]!;
    const pivot = new THREE.Group();
    pivot.position.y = height * (p.turretAt ?? 0.9);
    w.scale.setScalar(0.75);
    // The recoil moves this holder; the weapon keeps its own transform.
    const holder = new THREE.Group();
    holder.add(w);
    pivot.add(holder);
    root.add(pivot);
    turret = pivot;
    if (p.flash) {
      const f = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.09, 1),
        new THREE.MeshBasicMaterial({ color: p.flash, transparent: true, opacity: 0.9, depthWrite: false }),
      );
      f.position.set(0, 0.28, 0.42);
      f.visible = false;
      holder.add(f);
      flash = f;
    }
  }
  if (p.crystals) {
    const cr = objs[i++]!;
    for (const m of ownMaterials(cr)) m.color.lerp(new THREE.Color(p.crystals), 0.5);
    cr.scale.setScalar(0.45);
    cr.position.y = height * 0.98;
    root.add(cr);
  }
  for (const pr of p.props ?? []) {
    const o = objs[i++]!;
    const pb = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
    const s = ((pr.s ?? 1) * 0.3) / Math.max(0.01, Math.max(pb.x, pb.z));
    o.scale.setScalar(s);
    o.position.set(pr.x, 0, pr.z);
    o.rotation.y = pr.rot ?? (pr.x + pr.z) * 2;
    root.add(o);
  }
  let orb: THREE.Object3D | null = null;
  const orbMats: THREE.MeshStandardMaterial[] = [];
  const orbY = height + 0.28;
  if (p.orb) {
    const mat = new THREE.MeshStandardMaterial({ color: p.orb, emissive: p.orb, emissiveIntensity: 0.55, roughness: 0.25 });
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), mat);
    core.castShadow = true;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.018, 8, 32),
      new THREE.MeshStandardMaterial({ color: p.orb, emissive: p.orb, emissiveIntensity: 0.4, transparent: true, opacity: 0.75 }),
    );
    halo.rotation.x = Math.PI / 2;
    orbMats.push(mat, halo.material as THREE.MeshStandardMaterial);
    g.add(core, halo);
    g.position.y = orbY;
    root.add(g);
    orb = g;
  }
  return { root, turret, orb, orbY, orbMats, flash, unitY: p.unitAt !== undefined ? height * p.unitAt : null };
}
