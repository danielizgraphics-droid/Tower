import type { DamageType } from './types';

export interface DamageTypeInfo {
  name: string;
  color: string;
  /** Efficiency against [shield, armor, health] layers. */
  vs: [number, number, number];
  hint: string;
}

/**
 * Enemies have three stacked layers: shield (blue) → armor (grey) → health (red).
 * Each damage type is better or worse against each layer, which is what makes
 * tower variety matter.
 */
export const DAMAGE_TYPES: Record<DamageType, DamageTypeInfo> = {
  physical: { name: 'Físico', color: '#c9b79c', vs: [0.6, 0.55, 1.0], hint: 'Fuerte contra salud, débil contra armadura y escudos.' },
  fire: { name: 'Fuego', color: '#ff8a3d', vs: [0.5, 1.15, 1.05], hint: 'Funde la armadura; los escudos lo apagan.' },
  frost: { name: 'Escarcha', color: '#8fd6ff', vs: [1.0, 0.8, 0.9], hint: 'Equilibrado; su fuerza es ralentizar.' },
  lightning: { name: 'Rayo', color: '#ffe066', vs: [1.6, 0.7, 0.9], hint: 'Destroza escudos mágicos.' },
  poison: { name: 'Veneno', color: '#9be15d', vs: [0.25, 0.6, 1.35], hint: 'Devastador contra la carne, inútil contra escudos.' },
  arcane: { name: 'Arcano', color: '#b98cff', vs: [1.3, 1.1, 0.9], hint: 'Magia pura: buena contra escudos y armadura.' },
  holy: { name: 'Sagrado', color: '#fff2b0', vs: [1.0, 1.0, 1.0], hint: 'Daño verdadero. +60% contra no-muertos.' },
  shadow: { name: 'Sombra', color: '#8b6bd9', vs: [0.8, 1.3, 1.0], hint: 'Atraviesa armaduras.' },
};

export const UNDEAD_HOLY_BONUS = 1.6;
