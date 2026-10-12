// Hero towers: one per battle, picked in the settings. They can't be upgraded
// with gold; instead they level up (to 10) with the enemies they kill in that
// battle, growing stronger and gaining new powers at levels 3, 6 and 9.

import type { HeroInfo, StatKey, TowerDef, TowerStats, TowerVisual } from './types';

/** Kills needed to reach each level (index = level - 1). */
export const HERO_LEVEL_KILLS = [0, 10, 25, 45, 75, 115, 165, 230, 310, 400];
export const HERO_MAX_LEVEL = HERO_LEVEL_KILLS.length;

export function heroLevel(kills: number): number {
  let l = 1;
  while (l < HERO_MAX_LEVEL && kills >= HERO_LEVEL_KILLS[l]) l++;
  return l;
}

/** Stats of a hero at a level: growth on the base, plus the powers reached so far. */
export function heroStats(base: TowerStats, info: HeroInfo, level: number): TowerStats {
  const s = { ...base };
  const steps = level - 1;
  for (const k in info.perLevel) s[k as StatKey] = base[k as StatKey] * (1 + info.perLevel[k as StatKey]! * steps);
  for (const m of info.milestones) {
    if (m.level > level) continue;
    if (m.add) for (const k in m.add) s[k as StatKey] += m.add[k as StatKey]!;
    if (m.mul) for (const k in m.mul) s[k as StatKey] *= m.mul[k as StatKey]!;
  }
  return s;
}

/** Hero towers keep the TowerDef shape: their tiers and branches are unused placeholders. */
function hero(d: Omit<TowerDef, 'tiers' | 'branches' | 'unlockCost' | 'talents' | 'hero'> & { hero: HeroInfo }): TowerDef {
  const v: TowerVisual = d.visual;
  const none = { name: '', description: '', mods: [] };
  return {
    ...d,
    tiers: [{ cost: 0 }, { cost: 0 }],
    branches: [0, 1, 2].map((i) => ({
      id: `${d.id}${i}`,
      name: '',
      description: '',
      visual: v,
      steps: [{ cost: 0 }, { cost: 0 }],
    })) as TowerDef['branches'],
    unlockCost: 0,
    talents: { branchBoost: [none, none, none], capstone: none },
  };
}

const C = 'chars/';

export const HERO_LIST: TowerDef[] = [
  hero({
    id: 'lyra',
    name: 'Lyra',
    description: 'Una ballestera legendaria: dispara muy rápido a tierra y aire, y con los niveles lanza varias saetas a la vez.',
    role: 'Heroína · tiradora',
    tags: ['physical'],
    cost: 180,
    attack: 'projectile',
    damageType: 'physical',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 20, range: 3.8, rate: 1.4, projectileSpeed: 16 },
    visual: { body: '#e8dcc0', accent: '#2f8a4a', fx: '#fff2c0' },
    hero: {
      title: 'la Cazadora',
      perLevel: { damage: 0.1, rate: 0.03 },
      milestones: [
        { level: 3, add: { multishot: 1 }, text: 'Dispara a 2 objetivos' },
        { level: 6, add: { critChance: 0.2, critMult: 1 }, text: 'Golpes críticos' },
        { level: 9, add: { multishot: 2, pierce: 1 }, text: 'Lluvia de saetas' },
      ],
      unlock: { kind: 'wins', amount: 1 },
      look: { model: C + 'Rogue_Hooded.glb', show: ['2H_Crossbow'], tint: '#3f9a58', attack: '2H_Ranged_Shoot', idle: '2H_Ranged_Aiming' },
      base: 'tower_A',
    },
  }),
  hero({
    id: 'eldrin',
    name: 'Eldrin',
    description: 'El archimago encadena rayos arcanos entre enemigos de tierra y aire. Cada nivel, más saltos.',
    role: 'Héroe · cadenas arcanas',
    tags: ['magic'],
    cost: 200,
    attack: 'chain',
    damageType: 'arcane',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 26, range: 3.2, rate: 0.9, chains: 3, chainFalloff: 0.8 },
    visual: { body: '#d8d0ec', accent: '#7a5ae0', fx: '#c9a8ff' },
    hero: {
      title: 'el Archimago',
      perLevel: { damage: 0.11 },
      milestones: [
        { level: 3, add: { chains: 2 }, text: '+2 saltos' },
        { level: 6, add: { vulnerability: 0.15, vulnerabilityDuration: 2 }, text: 'Los rayos debilitan' },
        { level: 9, add: { chains: 3, chainFalloff: 0.1 }, text: 'Tormenta arcana' },
      ],
      unlock: { kind: 'kills', amount: 2000 },
      look: { model: C + 'Mage.glb', show: ['2H_Staff'], attack: 'Spellcast_Shoot', idle: 'Idle' },
      base: 'tower_B',
    },
  }),
  hero({
    id: 'brunhild',
    name: 'Brunhild',
    description: 'Valquiria de hielo: proyectiles helados que frenan a todo lo que hay alrededor del impacto.',
    role: 'Heroína · hielo',
    tags: ['magic', 'elemental'],
    cost: 190,
    attack: 'projectile',
    damageType: 'frost',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 18, range: 3.2, rate: 1, projectileSpeed: 11, splash: 0.8, slow: 0.35, slowDuration: 2 },
    visual: { body: '#e0f0ff', accent: '#4a9ad8', fx: '#bfe8ff' },
    hero: {
      title: 'Valquiria de Hielo',
      perLevel: { damage: 0.1 },
      milestones: [
        { level: 3, add: { freezeChance: 0.12, freezeDuration: 1 }, text: 'Congela a veces' },
        { level: 6, add: { splash: 0.5, slow: 0.1 }, text: 'Ventisca: más área' },
        { level: 9, add: { bonusVsSlowed: 0.5 }, text: '+50% daño a frenados' },
      ],
      unlock: { kind: 'endless', amount: 30 },
      look: { model: C + 'Knight.glb', show: ['2H_Sword'], tint: '#9fd8ff', attack: '2H_Melee_Attack_Chop', idle: 'Idle' },
      base: 'tower_base',
    },
  }),
  hero({
    id: 'torvald',
    name: 'Torvald',
    description: 'Señor del trueno: hace caer rayos del cielo sobre el enemigo más avanzado.',
    role: 'Héroe · rayos',
    tags: ['magic', 'elemental'],
    cost: 210,
    attack: 'strike',
    damageType: 'lightning',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 60, range: 3.4, rate: 0.5, splash: 0.8 },
    visual: { body: '#e6dcc8', accent: '#e0b02a', fx: '#fff27a' },
    hero: {
      title: 'Señor del Trueno',
      perLevel: { damage: 0.12 },
      milestones: [
        { level: 3, add: { stunChance: 0.2, stunDuration: 0.6 }, text: 'Los rayos aturden' },
        { level: 6, mul: { rate: 1.3 }, text: '+30% cadencia' },
        { level: 9, add: { splash: 0.6, damage: 80 }, text: 'Martillo de los dioses' },
      ],
      unlock: { kind: 'bosses', amount: 15 },
      look: { model: C + 'Barbarian.glb', show: ['2H_Axe'], attack: '2H_Melee_Attack_Chop', idle: 'Idle' },
      base: 'tower_catapult',
    },
  }),
  hero({
    id: 'nerea',
    name: 'Nerea',
    description: 'Dama de las mareas: se construye sobre el agua y lanza oleadas que frenan, empujan y congelan.',
    role: 'Heroína · naval',
    tags: ['magic', 'elemental'],
    cost: 180,
    placement: 'water',
    attack: 'pulse',
    damageType: 'frost',
    targetsGround: true,
    targetsAir: false,
    base: { damage: 32, range: 2.3, rate: 0.7, slow: 0.4, slowDuration: 1.5, knockback: 0.12 },
    visual: { body: '#d8f0f0', accent: '#2ab0a8', fx: '#9ff0e8' },
    hero: {
      title: 'Dama de las Mareas',
      perLevel: { damage: 0.12 },
      milestones: [
        { level: 3, add: { range: 0.4 }, text: 'Más alcance' },
        { level: 6, add: { freezeChance: 0.15, freezeDuration: 1 }, text: 'Aguas heladas' },
        { level: 9, add: { damage: 60, armorShred: 8 }, text: 'Maremoto' },
      ],
      unlock: { kind: 'mission', id: 'tides' },
      look: { model: C + 'Mage.glb', show: ['Spellbook_open'], tint: '#4fd8c8', attack: 'Spellcast_Shoot', idle: 'Idle' },
      base: 'well',
    },
  }),
  hero({
    id: 'aurelia',
    name: 'Aurelia',
    description: 'La paladina: golpes sagrados, y su presencia hace más fuertes a las torres cercanas.',
    role: 'Heroína · apoyo sagrado',
    tags: ['support', 'magic'],
    cost: 200,
    attack: 'projectile',
    damageType: 'holy',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 24, range: 3, rate: 1.1, projectileSpeed: 12, auraDamage: 0.08 },
    visual: { body: '#fff4dc', accent: '#e0b02a', fx: '#fff2b0' },
    hero: {
      title: 'la Paladina',
      perLevel: { damage: 0.1, auraDamage: 0.1 },
      milestones: [
        { level: 3, add: { auraRate: 0.08 }, text: 'Las torres cercanas disparan más rápido' },
        { level: 6, add: { bossDamage: 0.5, auraDamage: 0.07 }, text: 'Cazadora de jefes' },
        { level: 9, add: { execute: 0.1 }, text: 'Juicio: remata a los heridos' },
      ],
      unlock: { kind: 'hardClear' },
      look: { model: C + 'Knight.glb', show: ['1H_Sword', 'Badge_Shield'], tint: '#ffe08a', attack: '1H_Melee_Attack_Chop', idle: 'Idle' },
      base: 'church',
    },
  }),
  hero({
    id: 'morwen',
    name: 'Morwen',
    description: 'La nigromante: proyectiles de sombra que roban almas, y cada alma la hace más fuerte.',
    role: 'Heroína · sombras',
    tags: ['magic', 'dark'],
    cost: 200,
    attack: 'projectile',
    damageType: 'shadow',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 22, range: 3.1, rate: 1, projectileSpeed: 11, soulStacks: 0.6, execute: 0.06 },
    visual: { body: '#d0c8d8', accent: '#5a3a8a', fx: '#b58cff' },
    hero: {
      title: 'la Nigromante',
      perLevel: { damage: 0.1 },
      milestones: [
        { level: 3, add: { vulnerability: 0.12, vulnerabilityDuration: 2 }, text: 'Maldice a sus presas' },
        { level: 6, add: { multishot: 1 }, text: 'Dos almas a la vez' },
        { level: 9, add: { soulStacks: 0.8, execute: 0.06 }, text: 'Cosecha de almas' },
      ],
      unlock: { kind: 'missions', amount: 6 },
      look: { model: C + 'Skeleton_Mage.glb', show: [], attack: 'Spellcast_Shoot', idle: 'Idle' },
      base: 'mine',
    },
  }),
  hero({
    id: 'brom',
    name: 'Brom',
    description: 'El ingeniero enano: obuses enormes que estallan en metralla. Solo contra tierra.',
    role: 'Héroe · asedio',
    tags: ['physical', 'siege'],
    cost: 200,
    attack: 'lob',
    damageType: 'physical',
    targetsGround: true,
    targetsAir: false,
    base: { damage: 45, range: 3.6, rate: 0.55, projectileSpeed: 7, splash: 1, armorDamage: 0.3 },
    visual: { body: '#d8ccb8', accent: '#a8552a', fx: '#ffc070' },
    hero: {
      title: 'el Ingeniero',
      perLevel: { damage: 0.12 },
      milestones: [
        { level: 3, add: { bomblets: 3 }, text: 'Bombas de racimo' },
        { level: 6, add: { armorShred: 8 }, text: 'Rompecorazas' },
        { level: 9, add: { splash: 0.6, damage: 60 }, text: 'Gran obús' },
      ],
      unlock: { kind: 'towers', amount: 12 },
      look: { model: C + 'Barbarian.glb', show: ['1H_Axe', 'Barbarian_Round_Shield'], tint: '#c8885a', attack: '1H_Melee_Attack_Chop', idle: 'Idle' },
      base: 'blacksmith',
    },
  }),
];
