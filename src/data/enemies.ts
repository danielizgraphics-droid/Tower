import type { EnemyDef, EnemyId } from './types';

const defs: EnemyDef[] = [
  {
    id: 'goblin', name: 'Trasgo', description: 'Rápido y numeroso. Carne de cañón.',
    hp: 30, armor: 0, shield: 0, speed: 1.15, gold: 4, leak: 1,
    size: 0.8, shape: 'humanoid', color: '#7fbf4d', accent: '#5a3d2b', minWave: 1, threat: 1,
  },
  {
    id: 'bandit', name: 'Bandido', description: 'Lleva una cota ligera que amortigua los golpes.',
    hp: 52, armor: 12, shield: 0, speed: 0.95, gold: 6, leak: 1,
    size: 0.9, shape: 'humanoid', color: '#c06a4a', accent: '#3c3c46', minWave: 2, threat: 2,
  },
  {
    id: 'wolf', name: 'Lobo', description: 'Corre el doble que un trasgo.',
    hp: 34, armor: 0, shield: 0, speed: 1.9, gold: 5, leak: 1,
    size: 0.85, shape: 'beast', color: '#8a8f99', accent: '#5d616b', minWave: 3, threat: 1.7,
  },
  {
    id: 'bat', name: 'Murciélago', description: 'Vuela sobre el camino. Solo las torres antiaéreas lo alcanzan.',
    hp: 26, armor: 0, shield: 0, speed: 1.6, gold: 5, leak: 1, flying: true,
    size: 0.7, shape: 'flyer', color: '#5b4a7a', accent: '#c44d6b', minWave: 4, threat: 1.8,
  },
  {
    id: 'knight', name: 'Caballero', description: 'Armadura pesada. El fuego y lo arcano la atraviesan.',
    hp: 70, armor: 85, shield: 0, speed: 0.8, gold: 12, leak: 2,
    size: 1, shape: 'humanoid', color: '#9aa3b5', accent: '#3d5a99', minWave: 5, threat: 4.5,
  },
  {
    id: 'slime', name: 'Limo', description: 'Al morir se divide en dos limos pequeños.',
    hp: 85, armor: 0, shield: 0, speed: 0.85, gold: 6, leak: 1, split: { into: 'slimeling', count: 2 },
    size: 1, shape: 'blob', color: '#5fd3a0', accent: '#2f9e72', minWave: 6, threat: 4,
  },
  {
    id: 'slimeling', name: 'Limito', description: 'Restos de un limo.',
    hp: 26, armor: 0, shield: 0, speed: 1.2, gold: 2, leak: 1,
    size: 0.55, shape: 'blob', color: '#7fe3b8', accent: '#2f9e72', minWave: 999, threat: 0,
  },
  {
    id: 'runeguard', name: 'Guardián rúnico', description: 'Un escudo mágico que se regenera. Usa rayos o arcano.',
    hp: 60, armor: 0, shield: 75, speed: 0.9, gold: 12, leak: 2, shieldRegen: 8,
    size: 1, shape: 'humanoid', color: '#4a6fd1', accent: '#8fd6ff', minWave: 7, threat: 4.5,
  },
  {
    id: 'shaman', name: 'Chamán', description: 'Cura a los aliados cercanos. Prioridad alta.',
    hp: 70, armor: 0, shield: 22, speed: 0.9, gold: 14, leak: 1, heal: 14,
    size: 0.95, shape: 'humanoid', color: '#9b6bc9', accent: '#f2d16b', minWave: 8, threat: 5,
  },
  {
    id: 'troll', name: 'Trol', description: 'Enorme y se regenera rápidamente.',
    hp: 260, armor: 20, shield: 0, speed: 0.7, gold: 24, leak: 3, regen: 0.025,
    size: 1.35, shape: 'giant', color: '#6f9a6a', accent: '#4a3a2a', minWave: 9, threat: 9,
  },
  {
    id: 'skeleton', name: 'Esqueleto', description: 'No-muerto. El daño sagrado lo pulveriza.',
    hp: 38, armor: 16, shield: 0, speed: 1.05, gold: 4, leak: 1, undead: true,
    size: 0.85, shape: 'humanoid', color: '#e8e2d0', accent: '#6b6455', minWave: 11, threat: 1.6,
  },
  {
    id: 'golem', name: 'Gólem', description: 'Una montaña de piedra. Lento, casi inmune a ralentizaciones.',
    hp: 300, armor: 260, shield: 0, speed: 0.5, gold: 34, leak: 4, ccResist: 0.6,
    size: 1.45, shape: 'giant', color: '#9c8f7e', accent: '#ffb347', minWave: 13, threat: 14,
  },
  {
    id: 'wraith', name: 'Espectro', description: 'No-muerto etéreo: el daño físico le afecta a medias.',
    hp: 90, armor: 0, shield: 65, speed: 1.45, gold: 14, leak: 2, undead: true, ccResist: 0.3,
    resist: { physical: 0.5 },
    size: 1, shape: 'ghost', color: '#a9c7e8', accent: '#5e7bb0', minWave: 15, threat: 6,
  },
  {
    id: 'wyvern', name: 'Guiverno', description: 'Bestia voladora acorazada.',
    hp: 160, armor: 90, shield: 0, speed: 1.1, gold: 22, leak: 2, flying: true,
    size: 1.2, shape: 'flyer', color: '#c25b4a', accent: '#f0c05a', minWave: 17, threat: 9,
  },
  {
    id: 'warlord', name: 'Señor de la Guerra', description: 'JEFE. Acorazado. Convoca trasgos durante la marcha.',
    hp: 1000, armor: 300, shield: 0, speed: 0.55, gold: 200, leak: 8, boss: true, ccResist: 0.7,
    summon: { into: 'goblin', count: 3, every: 6 },
    size: 1.8, shape: 'giant', color: '#a34a3a', accent: '#d9b54a', minWave: 999, threat: 60,
  },
  {
    id: 'lich', name: 'Liche', description: 'JEFE. Escudo mágico regenerativo e invoca esqueletos.',
    hp: 950, armor: 0, shield: 850, speed: 0.5, gold: 300, leak: 12, boss: true, undead: true,
    shieldRegen: 22, ccResist: 0.7, summon: { into: 'skeleton', count: 4, every: 6 },
    size: 1.7, shape: 'ghost', color: '#4b3a6b', accent: '#7cf2c8', minWave: 999, threat: 80,
  },
  {
    id: 'dragon', name: 'Dragón ancestral', description: 'JEFE FINAL. Vuela, resiste el fuego y lleva escamas y escudo.',
    hp: 2800, armor: 1300, shield: 800, speed: 0.45, gold: 600, leak: 30, boss: true, flying: true,
    ccResist: 0.8, resist: { fire: 0.2 },
    size: 2.3, shape: 'dragon', color: '#6b3fa0', accent: '#ffcf4a', minWave: 999, threat: 120,
  },
];

export const ENEMIES: Record<EnemyId, EnemyDef> = Object.fromEntries(defs.map((d) => [d.id, d])) as Record<
  EnemyId,
  EnemyDef
>;
export const ENEMY_LIST = defs;
