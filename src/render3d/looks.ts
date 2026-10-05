// How each enemy is represented in 3D: which rigged character, its gear and tint.
// Enemies without an entry keep their 2D illustration until a model is added.

import type { EnemyId } from '../data/types';

export interface EnemyLook3D {
  model: string;
  /** Uniform scale (multiplied by the enemy's size). KayKit characters are ~2.4 units tall. */
  scale: number;
  /** Accessory meshes to show (weapons, shields...). */
  show: string[];
  /** Parts to hide (hats, capes...). */
  hide?: string[];
  /** Multiplies the texture colours. */
  tint?: string;
  /** Soft self-illumination colour. */
  glow?: string;
  /** Semi-transparent (spectral). */
  ghost?: boolean;
  /** Walk-cycle speed factor. */
  stride: number;
}

const C = 'chars/';
const S = 0.34;

export const ENEMY_LOOKS: Partial<Record<EnemyId, EnemyLook3D>> = {
  goblin: { model: C + 'Rogue.glb', scale: S * 0.95, show: ['Knife'], tint: '#9fdc7a', stride: 1.1 },
  bandit: { model: C + 'Rogue_Hooded.glb', scale: S, show: ['Knife', 'Knife_Offhand'], tint: '#ffd2c4', stride: 1 },
  knight: { model: C + 'Knight.glb', scale: S, show: ['1H_Sword', 'Badge_Shield'], stride: 0.9 },
  runeguard: { model: C + 'Knight.glb', scale: S, show: ['1H_Sword', 'Rectangle_Shield'], tint: '#9fb4ff', stride: 0.9 },
  shaman: { model: C + 'Mage.glb', scale: S, show: ['2H_Staff'], tint: '#d7b4ff', stride: 0.9 },
  skeleton: { model: C + 'Skeleton_Minion.glb', scale: S * 1.05, show: [], stride: 1 },
  wraith: { model: C + 'Skeleton_Rogue.glb', scale: S, show: [], tint: '#bfe0ff', ghost: true, stride: 1.2 },
  necromancer: { model: C + 'Skeleton_Mage.glb', scale: S, show: [], tint: '#c8ffd8', stride: 0.9 },
  mummy: { model: C + 'Skeleton_Warrior.glb', scale: S, show: [], tint: '#fff0c8', stride: 0.8 },
  orc: { model: C + 'Barbarian.glb', scale: S, show: ['1H_Axe', '1H_Axe_Offhand'], tint: '#a8e080', stride: 1 },
  warlord: { model: C + 'Barbarian.glb', scale: S * 0.95, show: ['2H_Axe'], tint: '#ffb0a0', stride: 0.8 },
  triton: { model: C + 'Rogue.glb', scale: S, show: ['2H_Crossbow'], tint: '#8fe8e0', stride: 1 },
  witch: { model: C + 'Mage.glb', scale: S, show: ['1H_Wand', 'Spellbook_open'], tint: '#bde89a', stride: 0.9 },
  troll: { model: C + 'Barbarian.glb', scale: S * 0.9, show: ['2H_Axe'], hide: ['Barbarian_Hat'], tint: '#a8c8a0', stride: 0.8 },
  yeti: { model: C + 'Barbarian.glb', scale: S * 0.9, show: [], hide: ['Barbarian_Hat'], tint: '#ffffff', stride: 0.8 },
  golem: { model: C + 'Knight.glb', scale: S * 0.85, show: ['2H_Sword'], tint: '#b8b0a4', stride: 0.7 },
  lich: { model: C + 'Skeleton_Mage.glb', scale: S * 0.85, show: [], tint: '#e0c8ff', stride: 0.7 },
};
