import type { ModifierDef, StatKey, TalentEffectDef, TowerDef, TowerId } from './types';

/** Tower-scoped percentage modifier helper (pct: 0.1 = +10%). */
const pct = (tower: TowerId, stat: StatKey, value: number, branch?: number): ModifierDef => ({
  target: 'tower',
  scope: { kind: 'tower', tower, branch },
  stat,
  pct: value,
});
/** Tower-scoped flat modifier helper. */
const flat = (tower: TowerId, stat: StatKey, value: number, branch?: number): ModifierDef => ({
  target: 'tower',
  scope: { kind: 'tower', tower, branch },
  stat,
  add: value,
});
const talent = (name: string, description: string, mods: ModifierDef[], maxRank = 2): TalentEffectDef => ({
  name,
  description,
  mods,
  maxRank,
});

const defs: TowerDef[] = [
  // ------------------------------------------------------------------ 1. Archer
  {
    id: 'archer',
    name: 'Torre de Arqueros',
    description: 'Disparo rápido y barato. Alcanza objetivos voladores.',
    role: 'Daño constante',
    tags: ['physical'],
    cost: 70,
    attack: 'projectile',
    damageType: 'physical',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 9, range: 3.3, rate: 1.25, projectileSpeed: 12 },
    tiers: [
      { cost: 55, add: { damage: 4 } },
      { cost: 90, add: { damage: 5, range: 0.3, rate: 0.15 } },
    ],
    branches: [
      {
        id: 'longbow',
        name: 'Arco Largo',
        description: 'Alcance enorme y golpes críticos devastadores. Ideal contra jefes.',
        visual: { body: '#d8cbb0', accent: '#4f8a4b', fx: '#e8f5c8' },
        steps: [
          { cost: 170, add: { range: 1.6, damage: 18, critChance: 0.25, critMult: 1 } },
          { cost: 300, add: { damage: 30, critChance: 0.1, bossDamage: 0.5 } },
        ],
      },
      {
        id: 'volley',
        name: 'Andanada',
        description: 'Dispara varias flechas a la vez a objetivos distintos.',
        visual: { body: '#d8cbb0', accent: '#c4573f', fx: '#fff1d6' },
        steps: [
          { cost: 160, add: { multishot: 2, rate: 0.3 } },
          { cost: 280, add: { multishot: 2, damage: 6 } },
        ],
      },
      {
        id: 'runic',
        name: 'Flechas Rúnicas',
        description: 'Flechas arcanas que atraviesan enemigos y debilitan escudos.',
        damageType: 'arcane',
        visual: { body: '#cfc6d8', accent: '#8a5cd6', fx: '#c9a6ff' },
        steps: [
          { cost: 180, add: { pierce: 2, damage: 10 } },
          { cost: 320, add: { pierce: 2, damage: 18, vulnerability: 0.1, vulnerabilityDuration: 2 } },
        ],
      },
    ],
    visual: { body: '#d8cbb0', accent: '#b5523b', fx: '#f5e6c8' },
    unlockCost: 0,
    talents: {
      branchBoost: [
        talent('Puntería', 'Arco Largo: +6% probabilidad de crítico por rango.', [flat('archer', 'critChance', 0.06, 0)]),
        talent('Cuerdas tensas', 'Andanada: +10% cadencia por rango.', [pct('archer', 'rate', 0.1, 1)]),
        talent('Runas afiladas', 'Flechas Rúnicas: +12% daño por rango.', [pct('archer', 'damage', 0.12, 2)]),
      ],
      capstone: talent('Ojo de Halcón', 'Todas las torres de arqueros disparan una flecha adicional.', [flat('archer', 'multishot', 1)], 1),
    },
  },
  // ------------------------------------------------------------------ 2. Ballista
  {
    id: 'ballista',
    name: 'Balista',
    description: 'Virotes pesados que atraviesan filas enteras de enemigos.',
    role: 'Perforación',
    tags: ['physical', 'siege'],
    cost: 120,
    attack: 'bolt',
    damageType: 'physical',
    targetsGround: true,
    targetsAir: false,
    base: { damage: 32, range: 3.8, rate: 0.55, projectileSpeed: 15, pierce: 2 },
    tiers: [
      { cost: 85, add: { damage: 12 } },
      { cost: 140, add: { damage: 16, pierce: 1 } },
    ],
    branches: [
      {
        id: 'siege',
        name: 'Balista de Asedio',
        description: 'Virotes colosales que perforan todo y quiebran armaduras.',
        visual: { body: '#b9b2a6', accent: '#7a4a2a', fx: '#d9c09a' },
        steps: [
          { cost: 260, add: { damage: 45, pierce: 4, armorDamage: 0.5 } },
          { cost: 380, add: { damage: 60, knockback: 0.3 } },
        ],
      },
      {
        id: 'repeater',
        name: 'Repetidora',
        description: 'Mecanismo de recarga automática: una lluvia de virotes.',
        visual: { body: '#b9b2a6', accent: '#3f6f8f', fx: '#cfe2ee' },
        steps: [
          { cost: 240, mul: { rate: 2.6, damage: 0.65 } },
          { cost: 360, mul: { rate: 1.4 }, add: { multishot: 1 } },
        ],
      },
      {
        id: 'harpoon',
        name: 'Arpón',
        description: 'Arpones encadenados que frenan, empujan y derriban voladores.',
        targetsAir: true,
        visual: { body: '#b9b2a6', accent: '#3d8a7a', fx: '#bfe8de' },
        steps: [
          { cost: 230, add: { damage: 15, slow: 0.45, slowDuration: 2, knockback: 0.6, airDamage: 0.5 } },
          { cost: 350, add: { stunChance: 0.25, stunDuration: 0.8, slow: 0.15 } },
        ],
      },
    ],
    visual: { body: '#b9b2a6', accent: '#8a5a32', fx: '#e0caa0' },
    unlockCost: 4,
    talents: {
      branchBoost: [
        talent('Contrapesos', 'Asedio: +12% daño por rango.', [pct('ballista', 'damage', 0.12, 0)]),
        talent('Engranajes', 'Repetidora: +10% cadencia por rango.', [pct('ballista', 'rate', 0.1, 1)]),
        talent('Cadenas pesadas', 'Arpón: +0.25 s de ralentización por rango.', [flat('ballista', 'slowDuration', 0.25, 2)]),
      ],
      capstone: talent('Tensores de Acero', 'Todas las balistas perforan 2 enemigos más.', [flat('ballista', 'pierce', 2)], 1),
    },
  },
  // ------------------------------------------------------------------ 3. Cannon
  {
    id: 'cannon',
    name: 'Bombarda',
    description: 'Proyectiles explosivos que dañan en área. Solo objetivos terrestres.',
    role: 'Área',
    tags: ['physical', 'siege'],
    cost: 110,
    attack: 'lob',
    damageType: 'physical',
    targetsGround: true,
    targetsAir: false,
    base: { damage: 22, range: 3.2, rate: 0.6, projectileSpeed: 6, splash: 0.9 },
    tiers: [
      { cost: 80, add: { damage: 9, splash: 0.1 } },
      { cost: 130, add: { damage: 12, range: 0.3 } },
    ],
    branches: [
      {
        id: 'mortar',
        name: 'Mortero',
        description: 'Alcance gigantesco y explosiones enormes que dejan fuego griego.',
        visual: { body: '#a9a39a', accent: '#5a5f6a', fx: '#ffb347' },
        steps: [
          { cost: 260, add: { range: 2.6, minRange: 1.5, splash: 0.6, damage: 35 }, mul: { rate: 0.85 } },
          { cost: 380, add: { damage: 45, splash: 0.3, burnDps: 12, burnDuration: 3 } },
        ],
      },
      {
        id: 'grapeshot',
        name: 'Metralla',
        description: 'Escupe un cono de metralla a corta distancia. Destroza grupos.',
        attack: 'cone',
        visual: { body: '#a9a39a', accent: '#8f3b2f', fx: '#ffd27a' },
        steps: [
          { cost: 240, add: { coneAngle: 32, range: -0.7 }, mul: { rate: 3.6, damage: 0.55 } },
          { cost: 340, add: { damage: 12, knockback: 0.12 } },
        ],
      },
      {
        id: 'cluster',
        name: 'Bombas de Racimo',
        description: 'Cada impacto suelta bombas más pequeñas a su alrededor.',
        visual: { body: '#a9a39a', accent: '#c9902f', fx: '#ffcf6a' },
        steps: [
          { cost: 250, add: { bomblets: 4, damage: 10 } },
          { cost: 360, add: { bomblets: 3, splash: 0.2, stunChance: 0.15, stunDuration: 0.5 } },
        ],
      },
    ],
    visual: { body: '#a9a39a', accent: '#4c4f57', fx: '#ffb347' },
    unlockCost: 0,
    talents: {
      branchBoost: [
        talent('Trayectoria alta', 'Mortero: +10% radio de explosión por rango.', [pct('cannon', 'splash', 0.1, 0)]),
        talent('Cañón recortado', 'Metralla: +12% daño por rango.', [pct('cannon', 'damage', 0.12, 1)]),
        talent('Mechas cortas', 'Racimo: +1 bomba por rango.', [flat('cannon', 'bomblets', 1, 2)]),
      ],
      capstone: talent('Pólvora Negra', 'Todas las bombardas: +25% radio de explosión.', [pct('cannon', 'splash', 0.25)], 1),
    },
  },
  // ------------------------------------------------------------------ 4. Arcane
  {
    id: 'arcane',
    name: 'Torre Arcana',
    description: 'Proyectiles de magia pura, eficaces contra escudos y armaduras.',
    role: 'Magia',
    tags: ['magic'],
    cost: 100,
    attack: 'projectile',
    damageType: 'arcane',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 20, range: 3.0, rate: 0.85, projectileSpeed: 8 },
    tiers: [
      { cost: 75, add: { damage: 8 } },
      { cost: 120, add: { damage: 10, range: 0.3, rate: 0.1 } },
    ],
    branches: [
      {
        id: 'archmage',
        name: 'Archimago',
        description: 'Rayos arcanos que saltan de enemigo en enemigo.',
        attack: 'chain',
        visual: { body: '#d5d0e6', accent: '#6a4fc9', fx: '#c3a8ff' },
        steps: [
          { cost: 250, add: { chains: 2, damage: 20, chainFalloff: 0.05 } },
          { cost: 360, add: { chains: 3, damage: 15 } },
        ],
      },
      {
        id: 'voidorb',
        name: 'Orbe del Vacío',
        description: 'Lanza un orbe lento que arrasa todo lo que toca a su paso.',
        attack: 'orb',
        visual: { body: '#cfc8e0', accent: '#3b2a6b', fx: '#9a6bff' },
        steps: [
          { cost: 270, add: { damage: 45, splash: 0.5, projectileSpeed: -5.5 }, mul: { rate: 0.55 } },
          { cost: 400, add: { damage: 60, splash: 0.2, slow: 0.25, slowDuration: 1 } },
        ],
      },
      {
        id: 'runemaster',
        name: 'Maestro de Runas',
        description: 'Marca a los enemigos: reciben más daño de todas las fuentes.',
        visual: { body: '#d9d3e3', accent: '#3fa7a0', fx: '#8ff2e4' },
        steps: [
          { cost: 230, add: { damage: 10, vulnerability: 0.15, vulnerabilityDuration: 3 } },
          { cost: 340, add: { vulnerability: 0.15, multishot: 1 } },
        ],
      },
    ],
    visual: { body: '#d8d2e6', accent: '#7b5cd6', fx: '#c9b0ff' },
    unlockCost: 0,
    talents: {
      branchBoost: [
        talent('Conducción', 'Archimago: +1 salto por rango.', [flat('arcane', 'chains', 1, 0)]),
        talent('Gravedad', 'Orbe del Vacío: +12% daño por rango.', [pct('arcane', 'damage', 0.12, 1)]),
        talent('Sellos', 'Maestro de Runas: +1 s de duración de marca por rango.', [flat('arcane', 'vulnerabilityDuration', 1, 2)]),
      ],
      capstone: talent(
        'Sobrecarga Arcana',
        'Todo el daño arcano: +15% daño y +10% probabilidad de crítico.',
        [
          { target: 'tower', scope: { kind: 'damageType', type: 'arcane' }, stat: 'damage', pct: 0.15 },
          { target: 'tower', scope: { kind: 'damageType', type: 'arcane' }, stat: 'critChance', add: 0.1 },
        ],
        1,
      ),
    },
  },
  // ------------------------------------------------------------------ 5. Pyre
  {
    id: 'pyre',
    name: 'Pira',
    description: 'Lanzallamas de corto alcance. Quema y funde armaduras.',
    role: 'Quemadura',
    tags: ['elemental'],
    cost: 140,
    attack: 'cone',
    damageType: 'fire',
    targetsGround: true,
    targetsAir: false,
    base: { damage: 3, range: 2.0, rate: 3.2, coneAngle: 26, burnDps: 5, burnDuration: 2.5 },
    tiers: [
      { cost: 95, add: { damage: 1.5, burnDps: 2 } },
      { cost: 150, add: { damage: 2, range: 0.3, burnDps: 3 } },
    ],
    branches: [
      {
        id: 'inferno',
        name: 'Infierno',
        description: 'Un rayo de fuego concentrado cuyo daño crece sin parar sobre un mismo objetivo.',
        attack: 'beam',
        visual: { body: '#b8aca4', accent: '#d9442b', fx: '#ff6a2b' },
        steps: [
          { cost: 280, add: { damage: 4, range: 0.6, beamRamp: 0.8, beamRampMax: 2.5 }, mul: { rate: 1.5 } },
          { cost: 420, add: { damage: 6, beamRampMax: 2 } },
        ],
      },
      {
        id: 'dragonbreath',
        name: 'Aliento de Dragón',
        description: 'Un cono de llamas enorme que deja quemaduras muy intensas.',
        visual: { body: '#b8aca4', accent: '#e07a1f', fx: '#ffb347' },
        steps: [
          { cost: 260, add: { coneAngle: 14, range: 0.8, burnDps: 10, burnDuration: 1.5 } },
          { cost: 400, add: { burnDps: 18, damage: 4 } },
        ],
      },
      {
        id: 'meteor',
        name: 'Invocador de Meteoros',
        description: 'Hace caer meteoros a gran distancia que aturden y prenden el suelo.',
        attack: 'strike',
        visual: { body: '#b0a7a7', accent: '#a32d4a', fx: '#ff8a3d' },
        steps: [
          { cost: 300, add: { damage: 70, splash: 1.1, range: 3 }, mul: { rate: 0.12 } },
          { cost: 440, add: { damage: 120, splash: 0.3, stunChance: 0.3, stunDuration: 0.6 } },
        ],
      },
    ],
    visual: { body: '#b8aca4', accent: '#e0582b', fx: '#ff8a3d' },
    unlockCost: 6,
    talents: {
      branchBoost: [
        talent('Combustión', 'Infierno: +1 de rampa máxima por rango.', [flat('pyre', 'beamRampMax', 1, 0)]),
        talent('Escamas de dragón', 'Aliento: +15% daño de quemadura por rango.', [pct('pyre', 'burnDps', 0.15, 1)]),
        talent('Astronomía', 'Meteoros: +10% cadencia por rango.', [pct('pyre', 'rate', 0.1, 2)]),
      ],
      capstone: talent(
        'Llama Eterna',
        'Todo el fuego: +40% daño de quemadura.',
        [{ target: 'tower', scope: { kind: 'damageType', type: 'fire' }, stat: 'burnDps', pct: 0.4 }],
        1,
      ),
    },
  },
  // ------------------------------------------------------------------ 6. Frost
  {
    id: 'frost',
    name: 'Aguja de Escarcha',
    description: 'Ralentiza a los enemigos. Alcanza voladores.',
    role: 'Control',
    tags: ['magic', 'elemental'],
    cost: 90,
    attack: 'projectile',
    damageType: 'frost',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 6, range: 2.8, rate: 1, projectileSpeed: 9, slow: 0.3, slowDuration: 1.5 },
    tiers: [
      { cost: 65, add: { damage: 3, slow: 0.05 } },
      { cost: 100, add: { damage: 4, range: 0.3, slowDuration: 0.5 } },
    ],
    branches: [
      {
        id: 'glacier',
        name: 'Glaciar',
        description: 'Congela por completo a los enemigos y los hace añicos.',
        visual: { body: '#d6e6ef', accent: '#3f8fd6', fx: '#bfe8ff' },
        steps: [
          { cost: 200, add: { damage: 8, freezeChance: 0.2, freezeDuration: 1.2, bonusVsSlowed: 0.5 } },
          { cost: 320, add: { freezeChance: 0.1, bonusVsSlowed: 0.5, splash: 0.6 } },
        ],
      },
      {
        id: 'blizzard',
        name: 'Ventisca',
        description: 'Una tormenta helada constante que ralentiza todo a su alrededor.',
        attack: 'pulse',
        visual: { body: '#d6e6ef', accent: '#7fb7e0', fx: '#e6f6ff' },
        steps: [
          { cost: 210, add: { damage: 2, slow: 0.15 }, mul: { rate: 0.8 } },
          { cost: 330, add: { slow: 0.1, range: 0.6, damage: 6 } },
        ],
      },
      {
        id: 'icelance',
        name: 'Lanza de Hielo',
        description: 'Carámbanos perforantes que castigan a los enemigos ralentizados.',
        attack: 'bolt',
        visual: { body: '#d6e6ef', accent: '#2f6fb0', fx: '#a6dcff' },
        steps: [
          { cost: 230, add: { damage: 38, pierce: 3, bonusVsSlowed: 0.6, projectileSpeed: 8 }, mul: { rate: 0.7 } },
          { cost: 350, add: { damage: 55, pierce: 2 } },
        ],
      },
    ],
    visual: { body: '#d6e6ef', accent: '#4aa3df', fx: '#bfe8ff' },
    unlockCost: 0,
    talents: {
      branchBoost: [
        talent('Cero absoluto', 'Glaciar: +5% probabilidad de congelar por rango.', [flat('frost', 'freezeChance', 0.05, 0)]),
        talent('Ojo de la tormenta', 'Ventisca: +8% alcance por rango.', [pct('frost', 'range', 0.08, 1)]),
        talent('Carámbanos', 'Lanza de Hielo: +12% daño por rango.', [pct('frost', 'damage', 0.12, 2)]),
      ],
      capstone: talent('Invierno Eterno', 'Todas las agujas: +10% de ralentización.', [flat('frost', 'slow', 0.1)], 1),
    },
  },
  // ------------------------------------------------------------------ 7. Storm
  {
    id: 'storm',
    name: 'Torre de Tormenta',
    description: 'Rayos encadenados que destrozan escudos mágicos.',
    role: 'Cadena',
    tags: ['magic', 'elemental'],
    cost: 150,
    attack: 'chain',
    damageType: 'lightning',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 20, range: 3.0, rate: 0.7, chains: 2 },
    tiers: [
      { cost: 110, add: { damage: 8 } },
      { cost: 170, add: { damage: 10, chains: 1 } },
    ],
    branches: [
      {
        id: 'tesla',
        name: 'Bobina Tesla',
        description: 'Descargas rapidísimas que saltan por toda la horda.',
        visual: { body: '#c9ccd6', accent: '#3a7bd5', fx: '#9fd0ff' },
        steps: [
          { cost: 300, add: { chains: 5 }, mul: { rate: 1.6, damage: 0.8 } },
          { cost: 440, add: { chains: 4, damage: 10 } },
        ],
      },
      {
        id: 'thunder',
        name: 'Martillo del Trueno',
        description: 'Relámpagos colosales desde el cielo que aturden en área.',
        attack: 'strike',
        visual: { body: '#c4c4cf', accent: '#d9b42b', fx: '#ffe066' },
        steps: [
          { cost: 320, add: { damage: 80, splash: 0.9, stunChance: 0.35, stunDuration: 0.8 }, mul: { rate: 0.5 } },
          { cost: 460, add: { damage: 120, stunChance: 0.15 } },
        ],
      },
      {
        id: 'static',
        name: 'Campo Estático',
        description: 'Electrifica el aire: daña sin parar a todo lo que entra en su radio.',
        attack: 'pulse',
        visual: { body: '#c9ccd6', accent: '#5fc4d9', fx: '#b8f4ff' },
        steps: [
          { cost: 290, add: { shieldDamage: 1 }, mul: { damage: 0.45, rate: 3 } },
          { cost: 420, add: { damage: 6, range: 0.7, slow: 0.15, slowDuration: 0.6 } },
        ],
      },
    ],
    visual: { body: '#c9ccd6', accent: '#4f7fd9', fx: '#cfe6ff' },
    unlockCost: 8,
    talents: {
      branchBoost: [
        talent('Bobinado', 'Tesla: +8% cadencia por rango.', [pct('storm', 'rate', 0.08, 0)]),
        talent('Ira de los cielos', 'Trueno: +15% daño por rango.', [pct('storm', 'damage', 0.15, 1)]),
        talent('Ionización', 'Campo Estático: +8% alcance por rango.', [pct('storm', 'range', 0.08, 2)]),
      ],
      capstone: talent(
        'Conductividad',
        'Todas las tormentas: +1 salto y +20% daño a escudos.',
        [flat('storm', 'chains', 1), flat('storm', 'shieldDamage', 0.2)],
        1,
      ),
    },
  },
  // ------------------------------------------------------------------ 8. Alchemist
  {
    id: 'alchemist',
    name: 'Alquimista',
    description: 'Arroja frascos de veneno que se acumulan. Brutal contra enemigos con mucha vida.',
    role: 'Veneno',
    tags: ['elemental'],
    cost: 100,
    attack: 'lob',
    damageType: 'poison',
    targetsGround: true,
    targetsAir: false,
    base: { damage: 4, range: 2.9, rate: 0.55, projectileSpeed: 5, splash: 0.8, poisonDps: 5, poisonDuration: 4, poisonStacks: 3 },
    tiers: [
      { cost: 70, add: { poisonDps: 3 } },
      { cost: 110, add: { poisonDps: 4, splash: 0.15, poisonStacks: 1 } },
    ],
    branches: [
      {
        id: 'plague',
        name: 'Peste',
        description: 'El veneno se propaga a los enemigos cercanos cuando su portador muere.',
        visual: { body: '#c2c7b0', accent: '#5f8f2f', fx: '#a8e05f' },
        steps: [
          { cost: 220, add: { spreadOnDeath: 1.4, poisonDps: 8, poisonStacks: 2 } },
          { cost: 330, add: { poisonDps: 14, spreadOnDeath: 0.6, poisonDuration: 2 } },
        ],
      },
      {
        id: 'acid',
        name: 'Ácido Corrosivo',
        description: 'Corroe la armadura y deja a los enemigos expuestos.',
        visual: { body: '#c2c7b0', accent: '#b8c42f', fx: '#e8f25f' },
        steps: [
          { cost: 210, add: { armorShred: 18, armorDamage: 0.6, vulnerability: 0.1, vulnerabilityDuration: 3, poisonDps: 4 } },
          { cost: 320, add: { armorShred: 30, vulnerability: 0.1, poisonDps: 6 } },
        ],
      },
      {
        id: 'transmuter',
        name: 'Transmutador',
        description: 'Convierte a los enemigos en oro. Genera oro extra en cada oleada.',
        visual: { body: '#d2c9a8', accent: '#d9a62b', fx: '#ffd84a' },
        steps: [
          { cost: 200, add: { goldChance: 0.25, goldAmount: 4, waveGold: 15, poisonDps: 3 } },
          { cost: 300, add: { goldChance: 0.2, goldAmount: 3, waveGold: 25, poisonDps: 4 } },
        ],
      },
    ],
    visual: { body: '#c2c7b0', accent: '#6fae3a', fx: '#9be15d' },
    unlockCost: 5,
    talents: {
      branchBoost: [
        talent('Contagio', 'Peste: +0.3 de radio de propagación por rango.', [flat('alchemist', 'spreadOnDeath', 0.3, 0)]),
        talent('Disolvente', 'Ácido: +20% de corrosión por rango.', [pct('alchemist', 'armorShred', 0.2, 1)]),
        talent('Piedra filosofal', 'Transmutador: +10 de oro por oleada por rango.', [flat('alchemist', 'waveGold', 10, 2)]),
      ],
      capstone: talent(
        'Destilación',
        'Todos los alquimistas: +1 acumulación y +15% daño de veneno.',
        [flat('alchemist', 'poisonStacks', 1), pct('alchemist', 'poisonDps', 0.15)],
        1,
      ),
    },
  },
  // ------------------------------------------------------------------ 9. Sanctum
  {
    id: 'sanctum',
    name: 'Santuario',
    description: 'Aura sagrada que potencia las torres cercanas. Castiga a los no-muertos.',
    role: 'Apoyo',
    tags: ['support', 'magic'],
    cost: 125,
    attack: 'projectile',
    damageType: 'holy',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 10, range: 2.4, rate: 0.6, projectileSpeed: 9, auraDamage: 0.1 },
    tiers: [
      { cost: 90, add: { auraDamage: 0.05, damage: 4 } },
      { cost: 140, add: { auraDamage: 0.05, auraRate: 0.05, range: 0.3 } },
    ],
    branches: [
      {
        id: 'cathedral',
        name: 'Catedral',
        description: 'Un aura sagrada inmensa: más daño y cadencia para las torres cercanas.',
        visual: { body: '#efe9da', accent: '#d9b44a', fx: '#fff2b0' },
        steps: [
          { cost: 260, add: { auraDamage: 0.12, auraRate: 0.12 } },
          { cost: 380, add: { auraDamage: 0.1, auraRate: 0.1, range: 0.5 } },
        ],
      },
      {
        id: 'judgement',
        name: 'Juicio Divino',
        description: 'Columnas de luz que caen del cielo y aturden a los impíos.',
        attack: 'strike',
        visual: { body: '#efe9da', accent: '#f0a830', fx: '#fff6c8' },
        steps: [
          { cost: 250, add: { damage: 60, splash: 0.7, range: 1.2 }, mul: { rate: 0.8 } },
          { cost: 370, add: { damage: 100, stunChance: 0.2, stunDuration: 0.5 } },
        ],
      },
      {
        id: 'oracle',
        name: 'Oráculo',
        description: 'Visión divina: más alcance y críticos para las torres cercanas, y oro en cada oleada.',
        visual: { body: '#e9e6f0', accent: '#5fa8d9', fx: '#cdeaff' },
        steps: [
          { cost: 240, add: { auraRange: 0.15, auraCrit: 0.1, waveGold: 20 } },
          { cost: 360, add: { auraRange: 0.1, auraCrit: 0.1, waveGold: 30 } },
        ],
      },
    ],
    visual: { body: '#efe9da', accent: '#e0b84a', fx: '#fff2b0' },
    unlockCost: 8,
    talents: {
      branchBoost: [
        talent('Liturgia', 'Catedral: +4% aura de daño por rango.', [flat('sanctum', 'auraDamage', 0.04, 0)]),
        talent('Ira sagrada', 'Juicio: +15% daño por rango.', [pct('sanctum', 'damage', 0.15, 1)]),
        talent('Profecía', 'Oráculo: +10 de oro por oleada por rango.', [flat('sanctum', 'waveGold', 10, 2)]),
      ],
      capstone: talent(
        'Bendición',
        'Todos los santuarios: +5% aura de daño y +10% alcance.',
        [flat('sanctum', 'auraDamage', 0.05), pct('sanctum', 'range', 0.1)],
        1,
      ),
    },
  },
  // ------------------------------------------------------------------ 10. Obelisk
  {
    id: 'obelisk',
    name: 'Obelisco Sombrío',
    description: 'Magia oscura que atraviesa armaduras y ralentiza a sus víctimas.',
    role: 'Oscuridad',
    tags: ['magic', 'dark'],
    cost: 150,
    attack: 'projectile',
    damageType: 'shadow',
    targetsGround: true,
    targetsAir: true,
    base: { damage: 30, range: 3.1, rate: 0.7, projectileSpeed: 7, slow: 0.15, slowDuration: 1 },
    tiers: [
      { cost: 115, add: { damage: 10 } },
      { cost: 175, add: { damage: 14, range: 0.3 } },
    ],
    branches: [
      {
        id: 'reaper',
        name: 'Segador de Almas',
        description: 'Ejecuta a los enemigos debilitados y se fortalece con cada alma.',
        visual: { body: '#5d566b', accent: '#7cf2c8', fx: '#7cf2c8' },
        steps: [
          { cost: 320, add: { damage: 35, execute: 0.12, soulStacks: 1 } },
          { cost: 460, add: { damage: 30, execute: 0.06, soulStacks: 1, bossDamage: 0.4 } },
        ],
      },
      {
        id: 'curse',
        name: 'Maldición',
        description: 'Maldice a varios enemigos: reciben mucho más daño y se arrastran.',
        visual: { body: '#5a4f6b', accent: '#c44dd9', fx: '#e08aff' },
        steps: [
          { cost: 300, add: { vulnerability: 0.2, vulnerabilityDuration: 4, slow: 0.05, slowDuration: 1, multishot: 1 } },
          { cost: 430, add: { vulnerability: 0.1, multishot: 1, damage: 20 } },
        ],
      },
      {
        id: 'void',
        name: 'Grieta del Vacío',
        description: 'Abre grietas que arrastran a los enemigos hacia atrás en el camino.',
        attack: 'rift',
        visual: { body: '#4f4866', accent: '#6b4fd9', fx: '#a68cff' },
        steps: [
          { cost: 330, add: { pull: 1.5, splash: 0.9, range: 0.5 }, mul: { damage: 0.8, rate: 0.45 } },
          { cost: 470, add: { pull: 1, damage: 60, splash: 0.3 } },
        ],
      },
    ],
    visual: { body: '#5d566b', accent: '#9a6bff', fx: '#b48cff' },
    unlockCost: 10,
    talents: {
      branchBoost: [
        talent('Cosecha', 'Segador: +3% umbral de ejecución por rango.', [flat('obelisk', 'execute', 0.03, 0)]),
        talent('Maleficio', 'Maldición: +5% de vulnerabilidad por rango.', [flat('obelisk', 'vulnerability', 0.05, 1)]),
        talent('Horizonte de sucesos', 'Vacío: +0.4 casillas de arrastre por rango.', [flat('obelisk', 'pull', 0.4, 2)]),
      ],
      capstone: talent(
        'Pacto Oscuro',
        'Todo el daño de sombra: +12% daño y +10% alcance.',
        [
          { target: 'tower', scope: { kind: 'damageType', type: 'shadow' }, stat: 'damage', pct: 0.12 },
          { target: 'tower', scope: { kind: 'damageType', type: 'shadow' }, stat: 'range', pct: 0.1 },
        ],
        1,
      ),
    },
  },
];

export const TOWERS: Record<TowerId, TowerDef> = Object.fromEntries(defs.map((d) => [d.id, d])) as Record<TowerId, TowerDef>;
export const TOWER_LIST: TowerDef[] = defs;
/** Tier at which the player picks one of the three branches. */
export const BRANCH_TIER = 3;
/** Highest tier (1..5). */
export const MAX_TIER = 5;
