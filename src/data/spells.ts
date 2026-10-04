import type { SpellDef, SpellId } from './types';

const defs: SpellDef[] = [
  {
    id: 'meteor',
    name: 'Lluvia de Meteoros',
    description: 'Tres meteoros caen sobre la zona elegida: daño de fuego masivo y quemaduras.',
    mana: 80,
    cooldown: 18,
    radius: 1.6,
    targeted: true,
    color: '#ff8a3d',
    unlockedByDefault: true,
  },
  {
    id: 'frostNova',
    name: 'Nova de Escarcha',
    description: 'Congela a todos los enemigos de la zona durante 3 segundos.',
    mana: 100,
    cooldown: 25,
    radius: 2.2,
    targeted: true,
    color: '#8fd6ff',
    unlockedByDefault: false,
  },
  {
    id: 'blessing',
    name: 'Bendición de Batalla',
    description: 'Todas las torres disparan un 50% más rápido durante 8 segundos.',
    mana: 120,
    cooldown: 35,
    radius: 0,
    targeted: false,
    color: '#ffe066',
    unlockedByDefault: false,
  },
];

export const SPELLS: Record<SpellId, SpellDef> = Object.fromEntries(defs.map((d) => [d.id, d])) as Record<SpellId, SpellDef>;
export const SPELL_LIST = defs;

/** Base damage values for spells (scaled by spell power and wave). */
export const METEOR_DAMAGE = 140;
export const METEOR_BURN = 25;
export const FROST_NOVA_DURATION = 3;
export const BLESSING_DURATION = 8;
export const BLESSING_RATE = 0.5;
