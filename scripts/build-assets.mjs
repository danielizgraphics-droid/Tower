// Imports third-party CC0 3D models into public/models as compact, self-contained GLBs.
// Sources (downloaded separately, see README): Kenney kits and KayKit packs.
//   node scripts/build-assets.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, resample } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const SRC = process.env.ASSET_SRC ?? '/home/user/assets-src';
const KAY = process.env.KAYKIT_SRC ?? '/home/user/kaykit-game-assets';
const OUT = 'public/models';
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

/** Removes an animation together with its samplers' keyframe data. */
function dropAnim(a) {
  // Keyframe accessors may be shared between clips; prune() drops the orphans.
  for (const s of a.listSamplers()) s.dispose();
  for (const c of a.listChannels()) c.dispose();
  a.dispose();
}

async function convert(file, out, { keepAnims } = {}) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  if (keepAnims) for (const a of root.listAnimations()) if (!keepAnims.includes(a.getName())) dropAnim(a);
  await doc.transform(
    resample({ tolerance: 0.002 }),
    dedup(),
    prune({ keepLeaves: false }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  mkdirSync(join(out, '..'), { recursive: true });
  await io.write(out, doc);
}

async function copyKit(dir, outDir, filter = () => true) {
  if (!existsSync(dir)) return console.warn('missing', dir);
  mkdirSync(outDir, { recursive: true });
  const files = readdirSync(dir).filter((f) => /\.(glb|gltf)$/.test(f) && filter(f.replace(/\.(glb|gltf)$/, '')));
  for (const f of files) await convert(join(dir, f), join(outDir, f.replace(/\.gltf$/, '.glb')));
  console.log(outDir, files.length);
}

await copyKit(`${SRC}/kenney_tower-defense-kit/Models/GLB format`, `${OUT}/td`, (n) => !n.includes('ufo'));
await copyKit(`${SRC}/kenney_castle-kit/Models/GLB format`, `${OUT}/castle`);
await copyKit(`${SRC}/kenney_fantasy-town-kit_2.0/Models/GLB format`, `${OUT}/town`, (n) =>
  /^(banner|cart|fence|lantern|rock|stall|tree|watermill|wheel|windmill|hedge|pillar|fountain-round|chimney)/.test(n),
);
await copyKit(`${SRC}/kenney_nature-kit/Models/GLTF format`, `${OUT}/nature`, (n) =>
  /^(tree_|plant_|flower_|grass|rock_|stone_|mushroom|cactus|lily|log|stump|campfire|crystal|bush|pot_|hanging_moss|path_|fence_)/.test(n),
);

// KayKit Medieval Hexagon: buildings (blue/red/neutral), nature and props.
const HEX = `${KAY}/KayKit-Medieval-Hexagon-Pack-1.0/addons/kaykit_medieval_hexagon_pack/Assets/gltf`;
await copyKit(`${HEX}/buildings/blue`, `${OUT}/hex/blue`);
await copyKit(`${HEX}/buildings/red`, `${OUT}/hex/red`);
await copyKit(`${HEX}/buildings/green`, `${OUT}/hex/green`);
await copyKit(`${HEX}/buildings/yellow`, `${OUT}/hex/yellow`);
await copyKit(`${HEX}/buildings/neutral`, `${OUT}/hex/neutral`);
await copyKit(`${HEX}/decoration/nature`, `${OUT}/hex/nature`);
await copyKit(`${HEX}/decoration/props`, `${OUT}/hex/props`);

const ANIMS = ['Idle', 'Walking_A', 'Running_A', 'Death_A', 'Hit_A'];
for (const [dir, names] of [
  [`${KAY}/kaykit-character-pack-adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf`, null],
  [`${KAY}/KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons/Characters/gltf`, null],
]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.glb') && (!names || names.includes(f)))) {
    // Meshes only: every KayKit character shares the same rig, so clips live in one file.
    await convert(join(dir, f), `${OUT}/chars/${basename(f)}`, { keepAnims: [] });
    console.log('char', f);
  }
}

// Shared animation clips (KayKit "Rig_Medium").
const animSrc = `${KAY}/kaykit-character-pack-adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb`;
if (existsSync(animSrc)) {
  const doc = await io.read(animSrc);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (!ANIMS.includes(a.getName())) dropAnim(a);
  for (const n of root.listNodes()) if (n.getMesh()) n.setMesh(null);
  await doc.transform(
    resample({ tolerance: 0.002 }),
    dedup(),
    prune({ propertyTypes: ['Accessor', 'Node', 'Skin', 'Mesh', 'Material', 'Texture'] }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  await io.write(`${OUT}/chars/anims.glb`, doc);
  console.log('anims');
}
