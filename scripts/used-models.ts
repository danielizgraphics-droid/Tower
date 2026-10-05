// Prints every model path the 3D renderer can request (for publishing only what is needed).
import { TOWER_LIST } from '../src/data/towers';
import { ENEMY_LOOKS } from '../src/render3d/looks';
import { PROJECTILE_MODELS, TILE_MODELS } from '../src/render3d/scene3d';
import { towerModels } from '../src/render3d/towers3d';
const set = new Set<string>([...TILE_MODELS, 'chars/anims.glb', 'hex/blue/building_castle_blue.glb']);
for (const t of TOWER_LIST) for (const m of towerModels(t.id)) set.add(m);
for (const l of Object.values(ENEMY_LOOKS)) set.add(l!.model);
for (const p of Object.values(PROJECTILE_MODELS)) set.add(p.model);
set.add('chars/Rogue_Hooded.glb');
console.log([...set].sort().join('\n'));
