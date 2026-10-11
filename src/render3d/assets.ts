// Loading and caching of glTF models (CC0 packs from Kenney and KayKit, see README).

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const BASE = `${import.meta.env.BASE_URL ?? './'}models/`;

const pending = new Map<string, Promise<GLTF>>();
const ready = new Map<string, GLTF>();

/** Starts (or reuses) loading of a model, e.g. 'td/tile.glb'. */
export function loadModel(path: string): Promise<GLTF> {
  let p = pending.get(path);
  if (!p) {
    // Packaged builds may embed models as base64 (window.__MODELS) instead of serving .glb files.
    const bank = (globalThis as { __MODELS?: Record<string, string> }).__MODELS;
    const packed = bank?.[path];
    // Parsed models stay cached here, so the packed text can be freed (saves memory on phones).
    if (packed) delete bank![path];
    const source = packed ? loader.parseAsync(base64ToBuffer(packed), BASE) : loader.loadAsync(BASE + path);
    p = source.then((g) => {
      prepare(g.scene);
      ready.set(path, g);
      return g;
    });
    pending.set(path, p);
  }
  return p;
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** The model if it has finished loading (starts loading otherwise). */
export function model(path: string): GLTF | null {
  const g = ready.get(path);
  if (!g) void loadModel(path).catch((e) => console.warn('model', path, e));
  return g ?? null;
}

export const isLoaded = (path: string) => ready.has(path);

// Every model file embeds its own copy of the pack's texture atlas: share one
// texture (and one material) per look, so the GPU holds each atlas once and
// pieces from different files can be merged into a single draw call.
const textures = new Map<string, THREE.Texture>();
const materials = new Map<string, THREE.Material>();
let probe: CanvasRenderingContext2D | null | undefined;

function shareTexture(t: THREE.Texture): THREE.Texture {
  const img = t.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!img?.width) return t;
  let key: string;
  try {
    probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!probe) return t;
    probe.canvas.width = probe.canvas.height = 16;
    probe.drawImage(img, 0, 0, 16, 16);
    // A thumbnail tells different atlases with the same name apart.
    key = `${t.name}|${img.width}x${img.height}|${t.flipY}|${t.wrapS}|${t.wrapT}|${probe.getImageData(0, 0, 16, 16).data.join()}`;
  } catch {
    return t;
  }
  const hit = textures.get(key);
  if (hit) {
    t.dispose();
    return hit;
  }
  textures.set(key, t);
  return t;
}

function shareMaterial(mat: THREE.Material): THREE.Material {
  const s = mat as THREE.MeshStandardMaterial;
  if (!s.isMeshStandardMaterial || s.normalMap || s.emissiveMap || s.roughnessMap || s.aoMap || s.alphaMap) return mat;
  const key = [
    s.name,
    s.map?.uuid ?? '',
    s.color.getHexString(),
    s.emissive.getHexString(),
    s.emissiveIntensity,
    s.roughness,
    s.metalness,
    s.transparent,
    s.opacity,
    s.alphaTest,
    s.side,
    s.vertexColors,
    s.flatShading,
  ].join('|');
  const hit = materials.get(key);
  if (hit) return hit;
  materials.set(key, mat);
  return mat;
}

/** Shadows on, crisp low-poly shading. */
function prepare(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const s = mat as THREE.MeshStandardMaterial;
      if (s.isMeshStandardMaterial) {
        s.metalness = 0;
        s.roughness = Math.max(0.75, s.roughness);
        if (s.map) {
          s.map.colorSpace = THREE.SRGBColorSpace;
          s.map.anisotropy = 4;
          s.map = shareTexture(s.map);
        }
      }
    }
    if (Array.isArray(m.material)) m.material = m.material.map(shareMaterial);
    else m.material = shareMaterial(m.material);
  });
}

/** Deep clone that also works for skinned characters. */
export function instance(path: string): THREE.Object3D | null {
  const g = model(path);
  if (!g) return null;
  return cloneSkinned(g.scene);
}

/** Clones materials of an object so they can be tinted independently. Returns them. */
export function ownMaterials(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (Array.isArray(m.material)) m.material = m.material.map((x) => x.clone());
    else m.material = m.material.clone();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const x of mats) out.push(x as THREE.MeshStandardMaterial);
  });
  return out;
}

/** Converts every attribute of a geometry to plain float arrays (needed before merging quantized meshes). */
export function toFloatGeometry(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!a) continue;
    const arr = new Float32Array(a.count * a.itemSize);
    const get = [a.getX, a.getY, a.getZ, a.getW];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = get[k].call(a, i);
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  // Uniform layout so any set of these can be merged.
  const n = out.getAttribute('position').count;
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  if (!out.getAttribute('uv')) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  out.setIndex(g.index ? Array.from(g.index.array as ArrayLike<number>) : Array.from({ length: n }, (_, i) => i));
  return out;
}
