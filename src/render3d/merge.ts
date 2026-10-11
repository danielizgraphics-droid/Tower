// Characters arrive split into many pieces (body parts, weapons held in a hand
// bone): each one is a separate draw call, twice with shadows. With a hundred
// enemies on the field that is thousands of calls per frame, which keeps a
// phone's CPU busy (and hot). Here the visible pieces sharing a skeleton and a
// material are merged into one skinned mesh; rigid gear becomes skinned to the
// bone that carried it, so it still moves with the hand.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toFloatGeometry } from './assets';

function visibleInTree(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) if (!p.visible) return false;
  return true;
}

type Attr = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
/** One component of a vertex (getX..getW handle interleaving and normalization). */
function comp(a: Attr, i: number, k: number): number {
  return k === 0 ? a.getX(i) : k === 1 ? a.getY(i) : k === 2 ? a.getZ(i) : a.getW(i);
}

/** Plain float/uint16 copy with the attributes merging needs (so pieces from different exporters fit together). */
function skinnedGeometry(g: THREE.BufferGeometry, bone: number | null, transform: THREE.Matrix4 | null): THREE.BufferGeometry | null {
  const pos = g.getAttribute('position');
  if (!pos) return null;
  const n = pos.count;
  const out = new THREE.BufferGeometry();
  const copy = (name: string, size: number, fill: (i: number, k: number) => number) => {
    const a = g.getAttribute(name);
    const arr = new Float32Array(n * size);
    for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) arr[i * size + k] = a ? comp(a, i, k) : fill(i, k);
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  };
  copy('position', 3, () => 0);
  copy('normal', 3, (_, k) => (k === 1 ? 1 : 0));
  copy('uv', 2, () => 0);
  const si = g.getAttribute('skinIndex');
  const sw = g.getAttribute('skinWeight');
  const idx = new Uint16Array(n * 4);
  const wts = new Float32Array(n * 4);
  for (let i = 0; i < n; i++)
    for (let k = 0; k < 4; k++) {
      if (bone !== null) {
        idx[i * 4 + k] = bone;
        wts[i * 4 + k] = k === 0 ? 1 : 0;
      } else {
        idx[i * 4 + k] = si ? comp(si, i, k) : 0;
        wts[i * 4 + k] = sw ? comp(sw, i, k) : k === 0 ? 1 : 0;
      }
    }
  out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  out.setAttribute('skinWeight', new THREE.BufferAttribute(wts, 4));
  if (!g.getAttribute('normal')) out.computeVertexNormals();
  out.setIndex(g.index ? Array.from(g.index.array as ArrayLike<number>) : Array.from({ length: n }, (_, i) => i));
  if (transform) out.applyMatrix4(transform);
  return out;
}

/**
 * Merges the visible meshes of a rigged model in place (per material).
 * Hidden pieces are removed. Models that don't fit the pattern are left as they are.
 */
export function mergeRig(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const skinned: THREE.SkinnedMesh[] = [];
  const rigid: THREE.Mesh[] = [];
  const hidden: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (!visibleInTree(m, root)) hidden.push(m);
    else if ((m as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(m as THREE.SkinnedMesh);
    else rigid.push(m);
  });
  for (const m of hidden) m.removeFromParent();
  if (skinned.length === 0) return;
  const base = skinned[0];
  const skel = base.skeleton;
  const sameRig = (m: THREE.SkinnedMesh) =>
    m.skeleton.bones.length === skel.bones.length && m.skeleton.bones.every((b, i) => b === skel.bones[i]) && m.bindMatrix.equals(base.bindMatrix);
  const bindInv = base.bindMatrix.clone().invert();
  const byMat = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; parts: THREE.Mesh[] }>();
  const push = (m: THREE.Mesh, g: THREE.BufferGeometry | null) => {
    const mat = m.material as THREE.Material;
    if (!g || Array.isArray(m.material)) return;
    let e = byMat.get(mat);
    if (!e) byMat.set(mat, (e = { geos: [], parts: [] }));
    e.geos.push(g);
    e.parts.push(m);
  };
  // Pieces may have their own inverse bind matrices (compressed models fold each
  // piece's dequantization scale into them): re-express them in the base's bind
  // space when that difference is the same for every bone.
  const bind = base.bindMatrix;
  const toBase = (m: THREE.SkinnedMesh): THREE.Matrix4 | null => {
    const t = skel.boneInverses[0].clone().invert().multiply(m.skeleton.boneInverses[0]);
    const tmp = new THREE.Matrix4();
    for (let j = 0; j < skel.bones.length; j++) {
      tmp.multiplyMatrices(skel.boneInverses[j], t);
      const a = tmp.elements;
      const b = m.skeleton.boneInverses[j].elements;
      for (let k = 0; k < 16; k++) if (Math.abs(a[k] - b[k]) > 1e-3 * (1 + Math.abs(b[k]))) return null;
    }
    return bindInv.clone().multiply(t).multiply(bind);
  };
  for (const m of skinned) {
    if (!sameRig(m) || m.morphTargetInfluences) continue;
    const t = toBase(m);
    if (t) push(m, skinnedGeometry(m.geometry, null, t));
  }
  // Gear held by a bone: bake its offset from the bone, expressed in the bind pose.
  for (const m of rigid) {
    let bone: THREE.Object3D | null = m.parent;
    while (bone && !skel.bones.includes(bone as THREE.Bone)) bone = bone.parent;
    if (!bone) continue;
    const i = skel.bones.indexOf(bone as THREE.Bone);
    const local = bone.matrixWorld.clone().invert().multiply(m.matrixWorld);
    const t = bindInv.clone().multiply(skel.boneInverses[i].clone().invert()).multiply(local);
    push(m, skinnedGeometry(m.geometry, i, t));
  }
  for (const [mat, { geos, parts }] of byMat) {
    if (parts.length < 2) continue;
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.SkinnedMesh(merged, mat);
    mesh.name = 'merged';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    base.parent!.add(mesh);
    mesh.position.copy(base.position);
    mesh.quaternion.copy(base.quaternion);
    mesh.scale.copy(base.scale);
    mesh.updateMatrixWorld(true);
    mesh.bind(skel, base.bindMatrix);
    for (const p of parts) p.removeFromParent();
  }
}

const staticCache = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material }[] | null>();

/**
 * Replaces the given (non-animated) parts of `root` by one mesh per material.
 * The result is cached by `key` and shared by every object built the same way.
 */
export function mergeStatic(root: THREE.Object3D, parts: THREE.Object3D[], key: string): void {
  let merged = staticCache.get(key);
  if (merged === undefined) {
    merged = buildStatic(root, parts);
    staticCache.set(key, merged);
  }
  if (!merged) return;
  for (const p of parts) p.removeFromParent();
  for (const { geo, mat } of merged) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}

function buildStatic(root: THREE.Object3D, parts: THREE.Object3D[]): { geo: THREE.BufferGeometry; mat: THREE.Material }[] | null {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const bySig = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  let ok = true;
  for (const p of parts)
    p.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !visibleInTree(m, p)) return;
      const mat = m.material as THREE.Material & { vertexColors?: boolean };
      if ((m as THREE.SkinnedMesh).isSkinnedMesh || Array.isArray(m.material) || mat.vertexColors || m.morphTargetInfluences) {
        ok = false;
        return;
      }
      const g = toFloatGeometry(m.geometry);
      g.applyMatrix4(inv.clone().multiply(m.matrixWorld));
      // Materials cloned for tinting are equal in all but identity: group by look.
      const sm = mat as THREE.MeshStandardMaterial;
      const sig = `${mat.type}|${sm.map?.source.uuid ?? ''}|${sm.color?.getHexString()}|${sm.emissive?.getHexString()}|${sm.emissiveIntensity}|${mat.opacity}|${mat.transparent}`;
      let entry = bySig.get(sig);
      if (!entry) bySig.set(sig, (entry = { mat, geos: [] }));
      entry.geos.push(g);
    });
  if (!ok) return null;
  const out: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  for (const { mat, geos } of bySig.values()) {
    const geo = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!geo) return null;
    out.push({ geo, mat });
  }
  return out;
}
