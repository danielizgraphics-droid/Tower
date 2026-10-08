// Shared data-model types. Every piece of game content (towers, enemies, talents,
// augments, maps...) is plain data described by these types, so adding content
// never requires touching engine code.

export type DamageType = 'physical' | 'fire' | 'frost' | 'lightning' | 'poison' | 'arcane' | 'holy' | 'shadow';

/** Numeric tower stats. Every key defaults to 0 when absent. */
export interface TowerStats {
  damage: number;
  /** Range in tiles. */
  range: number;
  /** Attacks per second. */
  rate: number;
  /** Projectile speed in tiles per second (0 = instant). */
  projectileSpeed: number;
  /** Splash radius in tiles. */
  splash: number;
  /** Extra enemies a projectile passes through. */
  pierce: number;
  /** Extra projectiles fired per attack, each at a different target when possible. */
  multishot: number;
  /** Extra jumps for chain attacks. */
  chains: number;
  /** Damage kept per chain jump (0..1). */
  chainFalloff: number;
  critChance: number;
  /** Total multiplier on a critical hit (e.g. 2 = double damage). */
  critMult: number;
  /** Slow strength 0..1 (0.3 = 30% slower). */
  slow: number;
  slowDuration: number;
  burnDps: number;
  burnDuration: number;
  poisonDps: number;
  poisonDuration: number;
  /** Max poison stacks per enemy for this source. */
  poisonStacks: number;
  stunChance: number;
  stunDuration: number;
  freezeChance: number;
  freezeDuration: number;
  /** Extra damage taken from all sources, 0..1. */
  vulnerability: number;
  vulnerabilityDuration: number;
  /** Bonus damage multiplier against frozen / slowed targets. */
  bonusVsSlowed: number;
  /** Damage removed straight from the armor layer per hit. */
  armorShred: number;
  /** Knockback distance in tiles along the path. */
  knockback: number;
  /** Chance per kill to drop extra gold. */
  goldChance: number;
  goldAmount: number;
  /** Execute non-boss enemies under this fraction of max hp. */
  execute: number;
  /** Damage ramp per second of continuous beam focus (beam attacks). */
  beamRamp: number;
  beamRampMax: number;
  /** Cone half-angle in degrees (cone attacks). */
  coneAngle: number;
  /** Bomblets spawned on impact (cluster). */
  bomblets: number;
  /** Poison spreads to nearby enemies on death (radius tiles, 0 = off). */
  spreadOnDeath: number;
  /** Minimum range (mortars). */
  minRange: number;
  /** Aura: damage multiplier given to towers in range. */
  auraDamage: number;
  /** Aura: attack rate multiplier given to towers in range. */
  auraRate: number;
  /** Aura: range multiplier given to towers in range. */
  auraRange: number;
  /** Aura: crit chance given to towers in range. */
  auraCrit: number;
  /** Gold generated at the end of each wave. */
  waveGold: number;
  /** Rewind distance in tiles for void rifts. */
  pull: number;
  /** Stacks of permanent damage gained per kill (soul reaper). */
  soulStacks: number;
  /** Bonus multiplier against bosses. */
  bossDamage: number;
  /** Bonus multiplier against flying enemies. */
  airDamage: number;
  /** Multiplier against shield layer (added on top of damage-type efficiency). */
  shieldDamage: number;
  /** Multiplier against armor layer (added on top of damage-type efficiency). */
  armorDamage: number;
}

export type StatKey = keyof TowerStats;
export type PartialStats = Partial<TowerStats>;

/** How a tower turns its stats into attacks. Each kind has an implementation in game/attacks.ts. */
export type AttackKind =
  | 'projectile' // homing projectile, optional splash/pierce/multishot
  | 'lob' // ballistic shell to a ground point (cannon, mortar, alchemist)
  | 'bolt' // straight piercing bolt along a line (ballista, ice lance)
  | 'chain' // instant lightning chain
  | 'beam' // continuous focused beam with ramp
  | 'cone' // continuous cone (flamethrower, grapeshot)
  | 'pulse' // periodic area pulse around the tower
  | 'strike' // delayed strike from the sky on the target (meteor, smite, thunder)
  | 'orb' // slow orb travelling along a line, damaging everything it touches
  | 'rift' // void rift that pulls enemies back
  | 'aura'; // support aura only, no damage

export type TargetMode = 'first' | 'last' | 'strong' | 'close';

export type TowerId =
  | 'archer'
  | 'ballista'
  | 'cannon'
  | 'arcane'
  | 'pyre'
  | 'frost'
  | 'storm'
  | 'alchemist'
  | 'sanctum'
  | 'obelisk'
  | 'harbor'
  | 'tide'
  | 'quake'
  | 'falconer'
  | 'market';

export type TowerTag = 'physical' | 'magic' | 'siege' | 'elemental' | 'support' | 'dark';

export interface TowerVisual {
  /** Main stone / body color. */
  body: string;
  /** Accent color (roofs, banners, magic glow). */
  accent: string;
  /** Projectile / effect color. */
  fx: string;
}

export interface UpgradeStep {
  cost: number;
  /** Additive stat changes. */
  add?: PartialStats;
  /** Multiplicative stat changes (1.2 = +20%). */
  mul?: PartialStats;
}

export interface BranchDef {
  id: string;
  name: string;
  description: string;
  /** Optional new attack kind for this branch. */
  attack?: AttackKind;
  damageType?: DamageType;
  targetsAir?: boolean;
  visual: TowerVisual;
  /** Two ranks: the branch itself (tier 4) and its mastery (tier 5). */
  steps: [UpgradeStep, UpgradeStep];
}

export interface TowerDef {
  id: TowerId;
  name: string;
  description: string;
  role: string;
  tags: TowerTag[];
  cost: number;
  /** Where it can be built: grass (default) or open water. */
  placement?: 'land' | 'water';
  attack: AttackKind;
  damageType: DamageType;
  targetsGround: boolean;
  targetsAir: boolean;
  base: PartialStats;
  /** Tier 2 and tier 3 upgrades (before choosing a branch). */
  tiers: [UpgradeStep, UpgradeStep];
  branches: [BranchDef, BranchDef, BranchDef];
  visual: TowerVisual;
  /** Stars needed to unlock. 0 = available from the start. */
  unlockCost: number;
  talents: TowerTalentSet;
}

/** Tower-specific talent nodes; generic nodes are generated by meta/talentTrees.ts. */
export interface TowerTalentSet {
  /** One booster per branch, index-aligned with `branches`. */
  branchBoost: [TalentEffectDef, TalentEffectDef, TalentEffectDef];
  capstone: TalentEffectDef;
}

export interface TalentEffectDef {
  name: string;
  description: string;
  /** Effects per rank. */
  mods: ModifierDef[];
  maxRank?: number;
}

// ---------------------------------------------------------------- modifiers

export type ModScope =
  { kind: 'all' } | { kind: 'tower'; tower: TowerId; branch?: number } | { kind: 'damageType'; type: DamageType } | { kind: 'tag'; tag: TowerTag };

/** Global (non-tower) run stats. */
export interface GlobalStats {
  startGold: number;
  lives: number;
  /** Gold interest earned at the end of a wave (fraction of current gold). */
  interest: number;
  interestCap: number;
  killGold: number; // multiplier bonus (0.1 = +10%)
  waveGold: number; // flat bonus per wave
  sellRefund: number; // fraction
  buildCost: number; // multiplier bonus (-0.1 = 10% cheaper)
  upgradeCost: number;
  maxMana: number;
  manaRegen: number;
  spellPower: number; // multiplier bonus
  spellCooldown: number; // multiplier bonus (negative = faster)
  augmentChoices: number;
  augmentRerolls: number;
  augmentLuck: number;
  augmentInterval: number;
  livesRegen: number; // lives restored every 5 waves
  starGain: number; // multiplier bonus
  xpGain: number; // multiplier bonus
  bossGold: number;
  freeTowers: number;
  /** Bonus damage against shield / armor layers (all towers). */
  shieldBreak: number;
  armorBreak: number;
}
export type GlobalKey = keyof GlobalStats;

export type ModifierDef =
  | { target: 'tower'; scope: ModScope; stat: StatKey; add?: number; pct?: number }
  | { target: 'global'; stat: GlobalKey; add: number }
  | { target: 'unlockSpell'; spell: SpellId }
  /** Build and upgrade cost change for one tower (pct: -0.06 = 6% cheaper). */
  | { target: 'towerCost'; tower: TowerId; pct: number };

// ---------------------------------------------------------------- enemies

export type EnemyId =
  | 'goblin'
  | 'bandit'
  | 'wolf'
  | 'knight'
  | 'runeguard'
  | 'bat'
  | 'troll'
  | 'slime'
  | 'slimeling'
  | 'shaman'
  | 'golem'
  | 'skeleton'
  | 'wraith'
  | 'wyvern'
  | 'warlord'
  | 'lich'
  | 'dragon'
  | 'spider'
  | 'orc'
  | 'necromancer'
  | 'harpy'
  | 'ram'
  | 'imp'
  | 'scorpion'
  | 'mummy'
  | 'triton'
  | 'yeti'
  | 'salamander'
  | 'witch'
  | 'hydra'
  | 'colossus'
  | 'scorpionKing'
  | 'swarm'
  | 'shade'
  | 'skullwisp'
  | 'ossuary'
  | 'myconid'
  | 'cactoid'
  | 'voidling'
  | 'iceKnight'
  | 'hiveQueen'
  | 'cyclopsKing'
  | 'prismGolem';

export type EnemyShape = 'humanoid' | 'beast' | 'blob' | 'flyer' | 'giant' | 'ghost' | 'dragon' | 'siege';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  description: string;
  hp: number;
  armor: number;
  shield: number;
  /** Tiles per second. */
  speed: number;
  gold: number;
  /** Lives lost when it reaches the castle. */
  leak: number;
  flying?: boolean;
  boss?: boolean;
  undead?: boolean;
  /** Fraction of max hp regenerated per second. */
  regen?: number;
  /** Shield regenerated per second (after 2s without shield damage). */
  shieldRegen?: number;
  /** Heals nearby allies: hp per second in radius 1.5. */
  heal?: number;
  /** Split into N of `splitInto` on death. */
  split?: { into: EnemyId; count: number };
  /** Periodically summons minions. */
  summon?: { into: EnemyId; count: number; every: number };
  /** Resistance to slows/stuns 0..1. */
  ccResist?: number;
  /** Speeds up once its health drops below a fraction. */
  enrage?: { below: number; speed: number };
  /** Teleports forward along the path every few seconds. */
  blink?: { every: number; distance: number };
  /** Rises again once after dying, with this fraction of its health. */
  revive?: number;
  /** Periodically grants shield to nearby allies. */
  shieldAura?: { amount: number; every: number; radius: number };
  /** Chance (0..1) to evade each physical hit (arrows, bolts, cannonballs). */
  dodge?: number;
  /** On death, heals nearby allies by this fraction of their max health. */
  deathHeal?: number;
  /** Immune to knockback and pull effects. */
  unstoppable?: boolean;
  /** Regional enemy: only appears in these biomes (and more often there). */
  biomes?: Biome[];
  /** Damage-type multipliers (1 = normal). */
  resist?: Partial<Record<DamageType, number>>;
  /** Visual scale (1 = normal). */
  size: number;
  shape: EnemyShape;
  color: string;
  accent: string;
  /** First wave in which it may appear in generated waves. */
  minWave: number;
  /** Threat cost used by the wave generator. */
  threat: number;
}

// ---------------------------------------------------------------- spells

export type SpellId = 'meteor' | 'frostNova' | 'blessing';

export interface SpellDef {
  id: SpellId;
  name: string;
  description: string;
  mana: number;
  cooldown: number;
  /** Radius in tiles (0 = global). */
  radius: number;
  targeted: boolean;
  color: string;
  unlockedByDefault: boolean;
}

// ---------------------------------------------------------------- augments

export type Rarity = 'common' | 'rare' | 'epic';

export interface AugmentDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  icon: string;
  mods: ModifierDef[];
  /** Instant effects when picked. */
  gold?: number;
  lives?: number;
  /** Only offered if this tower is unlocked in the profile. */
  requiresTower?: TowerId;
  /** Can be picked more than once per run. */
  stackable?: boolean;
}

// ---------------------------------------------------------------- maps

export type Difficulty = 'easy' | 'normal' | 'hard';

export type Biome = 'meadow' | 'autumn' | 'snow' | 'dusk' | 'desert' | 'swamp' | 'coast' | 'volcano' | 'jungle' | 'canyon' | 'crystal';

export interface MapDef {
  id: string;
  name: string;
  description: string;
  /**
   * Tile rows, back (top of screen) to front.
   *  .  grass (buildable)     #  path          S  spawn (path start)
   *  C  castle (path end)     T  tree          R  rock
   *  W  water (naval towers)  F  flowers (buildable)
   *  L  lava
   */
  tiles: string[];
  waves: number;
  /** Multiplies enemy hp; lets later maps scale up. */
  hpScale: number;
  /** Map id that must be cleared before this one unlocks. */
  requires?: string;
  theme: Biome;
}
