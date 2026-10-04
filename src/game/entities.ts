import type { DamageType, EnemyDef, TargetMode, TowerDef, TowerStats } from '../data/types';

let nextId = 1;
export const newId = (): number => nextId++;

export interface PoisonStack {
  tower: Tower | null;
  dps: number;
  time: number;
}

export class Enemy {
  readonly uid = newId();
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  shield: number;
  maxShield: number;
  /** Distance travelled along the path. */
  dist: number;
  x = 0;
  y = 0;
  angle = 0;
  alive = true;
  /** Total effective pool at spawn (for XP sharing). */
  readonly pool: number;

  slow = 0;
  slowTime = 0;
  stunTime = 0;
  freezeTime = 0;
  burnDps = 0;
  burnTime = 0;
  burnSource: Tower | null = null;
  poison: PoisonStack[] = [];
  vuln = 0;
  vulnTime = 0;
  /** Seconds since the shield last took damage. */
  shieldIdle = 99;
  summonTimer = 0;
  healTimer = 0;
  /** Visual: seconds since last hit (for the white flash). */
  hitFlash = 1;
  /** Visual: time alive. */
  age = 0;
  /** Distance moved this frame (for walk animation). */
  walk = 0;

  constructor(
    readonly def: EnemyDef,
    readonly wave: number,
    hpMult: number,
    dist: number,
  ) {
    this.maxHp = this.hp = Math.round(def.hp * hpMult);
    this.maxArmor = this.armor = Math.round(def.armor * hpMult);
    this.maxShield = this.shield = Math.round(def.shield * hpMult);
    this.pool = this.maxHp + this.maxArmor + this.maxShield;
    this.dist = dist;
    if (def.summon) this.summonTimer = def.summon.every * 0.5;
  }

  get flying(): boolean {
    return !!this.def.flying;
  }

  get ccFactor(): number {
    return 1 - (this.def.ccResist ?? 0);
  }

  get currentSpeed(): number {
    if (this.stunTime > 0 || this.freezeTime > 0) return 0;
    return this.def.speed * (1 - this.slow * this.ccFactor);
  }

  get isSlowed(): boolean {
    return this.slowTime > 0 || this.freezeTime > 0 || this.stunTime > 0;
  }

  /** 0..1 of total remaining pool, used for "strongest" targeting. */
  get totalHp(): number {
    return this.hp + this.armor + this.shield;
  }
}

export class Tower {
  readonly uid = newId();
  tier = 1;
  branch = -1;
  stats!: TowerStats;
  statsRev = -1;
  cooldown = 0;
  angle = -Math.PI / 2;
  targetMode: TargetMode = 'first';
  spent: number;
  /** Placed during the current build phase (full refund on sale). */
  freshBuild = true;
  kills = 0;
  damageDealt = 0;
  /** Aura buffs received from support towers. */
  buffDamage = 0;
  buffRate = 0;
  buffRange = 0;
  buffCrit = 0;
  /** Permanent flat damage gained from kills (Soul Reaper). */
  souls = 0;

  // Continuous attacks
  beamTarget: Enemy | null = null;
  beamTime = 0;
  beamTick = 0;
  coneTime = 0;
  /** Visual: time since last shot (recoil animation). */
  fireAnim = 1;
  /** Visual: time since built/upgraded (pop animation). */
  buildAnim = 0;

  constructor(
    readonly def: TowerDef,
    readonly tx: number,
    readonly ty: number,
    cost: number,
  ) {
    this.spent = cost;
  }

  get x(): number {
    return this.tx + 0.5;
  }
  get y(): number {
    return this.ty + 0.5;
  }
}

export interface HitPayload {
  tower: Tower | null;
  stats: TowerStats;
  damage: number;
  type: DamageType;
}

export type ProjectileKind = 'homing' | 'lob' | 'bolt' | 'orb' | 'bomblet';

export interface Projectile {
  uid: number;
  kind: ProjectileKind;
  x: number;
  y: number;
  z: number;
  /** Start position (lobs). */
  sx: number;
  sy: number;
  sz: number;
  /** Target point. */
  tx: number;
  ty: number;
  target: Enemy | null;
  vx: number;
  vy: number;
  speed: number;
  /** 0..1 progress for lobs. */
  t: number;
  duration: number;
  arc: number;
  travelled: number;
  maxTravel: number;
  pierceLeft: number;
  hit: Set<number>;
  /** Per-enemy hit cooldown for orbs. */
  hitCd?: Map<number, number>;
  payload: HitPayload;
  splash: number;
  alive: boolean;
  color: string;
  /** Visual style key (arrow, bolt, ball, orb, flask, shard, holy, shadow, bomb). */
  style: string;
}

export interface Strike {
  x: number;
  y: number;
  delay: number;
  total: number;
  radius: number;
  payload: HitPayload;
  style: 'meteor' | 'smite' | 'thunder' | 'spellMeteor';
}

export interface Rift {
  uid: number;
  x: number;
  y: number;
  radius: number;
  time: number;
  total: number;
  pull: number;
  payload: HitPayload;
}
