// How each enemy is represented in 3D: which rigged model, its gear and tint.
// KayKit characters share one animation file; Quaternius monsters carry their own clips.

import type { EnemyId } from '../data/types';

export interface EnemyLook3D {
  model: string;
  /** Size of the model's largest dimension in tiles (multiplied by the enemy's size, capped for bosses). */
  height: number;
  /** Accessory meshes to show (KayKit weapons, shields...). */
  show?: string[];
  /** Parts to hide (hats, capes...). */
  hide?: string[];
  /** Blends the texture colours towards this colour by `tintAmount` (0..1). */
  tint?: string;
  tintAmount?: number;
  /** Semi-transparent (spectral). */
  ghost?: boolean;
  /** Walk-cycle speed factor. */
  stride?: number;
  /** Extra rotation if the model doesn't face +Z. */
  yaw?: number;
  /** Self-illumination (lava, magic). */
  glow?: string;
  /** Not rigged (siege engines): rolls along with a gentle sway. */
  rigid?: boolean;
}

const C = 'chars/';
const M = 'monsters/';

export const ENEMY_LOOKS: Partial<Record<EnemyId, EnemyLook3D>> = {
  // ---- humanoids (KayKit)
  goblin: { model: C + 'Rogue.glb', height: 0.7, show: ['Knife'], tint: '#7fd060', tintAmount: 0.5, stride: 1.1 },
  bandit: { model: C + 'Rogue_Hooded.glb', height: 0.7, show: ['Knife', 'Knife_Offhand'] },
  knight: { model: C + 'Knight.glb', height: 0.75, show: ['1H_Sword', 'Badge_Shield'], stride: 0.9 },
  runeguard: { model: C + 'Knight.glb', height: 0.75, show: ['1H_Sword', 'Rectangle_Shield'], tint: '#7f9cff', tintAmount: 0.45, stride: 0.9 },
  shaman: { model: C + 'Mage.glb', height: 0.72, show: ['2H_Staff'], tint: '#c79cff', tintAmount: 0.4, stride: 0.9 },
  witch: { model: C + 'Mage.glb', height: 0.72, show: ['1H_Wand', 'Spellbook_open'], tint: '#9ad070', tintAmount: 0.45, stride: 0.9 },
  orc: { model: C + 'Barbarian.glb', height: 0.8, show: ['1H_Axe', '1H_Axe_Offhand'], tint: '#8fd060', tintAmount: 0.45 },
  warlord: { model: C + 'Barbarian.glb', height: 0.85, show: ['2H_Axe'], tint: '#ff8a70', tintAmount: 0.35, stride: 0.8 },
  skeleton: { model: C + 'Skeleton_Minion.glb', height: 0.7 },
  necromancer: { model: C + 'Skeleton_Mage.glb', height: 0.75, tint: '#9fffc0', tintAmount: 0.3, stride: 0.9 },
  mummy: { model: C + 'Skeleton_Warrior.glb', height: 0.75, tint: '#ffe6b0', tintAmount: 0.5, stride: 0.8 },
  lich: { model: C + 'Skeleton_Mage.glb', height: 0.85, tint: '#c8a0ff', tintAmount: 0.5, glow: '#7a30ff', stride: 0.7 },
  // ---- monsters (Quaternius)
  wolf: { model: M + 'Wolf.glb', height: 0.5, tint: '#8d93a0', tintAmount: 0.6 },
  bat: { model: M + 'Bat.glb', height: 0.5 },
  slime: { model: M + 'Slime.glb', height: 0.5 },
  slimeling: { model: M + 'Slime.glb', height: 0.5, tint: '#c0ffc8', tintAmount: 0.3 },
  wyvern: { model: M + 'YellowDragon.glb', height: 0.7, tint: '#6fd09a', tintAmount: 0.55 },
  dragon: { model: M + 'Dragon.glb', height: 0.75 },
  harpy: { model: M + 'Eagle.glb', height: 0.8 },
  imp: { model: M + 'Cthulhu.glb', height: 0.55, tint: '#ff5a3a', tintAmount: 0.55, glow: '#ff3a00' },
  spider: { model: M + 'Crab.glb', height: 0.45, tint: '#4a3a66', tintAmount: 0.7 },
  scorpion: { model: M + 'Crab.glb', height: 0.5, tint: '#e0a050', tintAmount: 0.6 },
  scorpionKing: { model: M + 'Crab.glb', height: 0.6, tint: '#ffd040', tintAmount: 0.7, glow: '#aa7700' },
  troll: { model: M + 'Cyclops.glb', height: 0.6, tint: '#8fae7a', tintAmount: 0.4, stride: 0.8 },
  golem: { model: M + 'Yeti.glb', height: 0.6, tint: '#a8a29a', tintAmount: 0.85, stride: 0.7 },
  yeti: { model: M + 'Yeti.glb', height: 0.6, stride: 0.8 },
  wraith: { model: M + 'Ghost.glb', height: 0.75, tint: '#bfe0ff', tintAmount: 0.4, ghost: true, stride: 1.2 },
  salamander: { model: M + 'Demon.glb', height: 0.6, tint: '#ff8a3a', tintAmount: 0.4, glow: '#ff4a00' },
  triton: { model: M + 'Alien_Tall.glb', height: 0.7, tint: '#4fd0c0', tintAmount: 0.4 },
  hydra: { model: M + 'GreenDemon.glb', height: 0.65, tint: '#3f8a4a', tintAmount: 0.4, stride: 0.7 },
  colossus: { model: M + 'Tree.glb', height: 0.7, tint: '#3a2a2a', tintAmount: 0.6, glow: '#ff5a10', stride: 0.6 },
  ram: { model: 'castle/siege-ram.glb', height: 0.45, rigid: true },
  // ---- expansion
  swarm: { model: M + 'Bee.glb', height: 0.38, stride: 1.4 },
  shade: { model: C + 'Rogue_Hooded.glb', height: 0.7, show: ['Knife', 'Knife_Offhand'], tint: '#2a2440', tintAmount: 0.85, stride: 1.2 },
  skullwisp: { model: M + 'Skull.glb', height: 0.48, tint: '#fff4dc', tintAmount: 0.55, stride: 1.3 },
  ossuary: { model: M + 'Skeleton.glb', height: 1.05, tint: '#e8e0c8', tintAmount: 0.25, stride: 0.6 },
  myconid: { model: M + 'Mushroom.glb', height: 0.55, stride: 0.9 },
  cactoid: { model: M + 'Cactus.glb', height: 0.6, stride: 0.8 },
  voidling: { model: M + 'Alien.glb', height: 0.58, tint: '#7a5fd0', tintAmount: 0.45, glow: '#3a1a6a' },
  hiveQueen: { model: M + 'Bee.glb', height: 0.7, tint: '#ffcf40', tintAmount: 0.3, glow: '#6a4a00', stride: 0.8 },
  cyclopsKing: { model: M + 'Cyclops.glb', height: 0.72, tint: '#b5654a', tintAmount: 0.55, stride: 0.6 },
  prismGolem: { model: M + 'Yeti.glb', height: 0.72, tint: '#8fe8f0', tintAmount: 0.7, glow: '#3a4aa0', stride: 0.6 },
  iceKnight: { model: C + 'Knight.glb', height: 0.8, show: ['2H_Sword'], tint: '#bfe8ff', tintAmount: 0.55, stride: 0.85 },
};
