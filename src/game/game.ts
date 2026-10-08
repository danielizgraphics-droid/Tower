import { AUGMENTS, AUGMENT_MAP, RARITY_WEIGHT } from '../data/augments';
import { DAMAGE_TYPES, UNDEAD_HOLY_BONUS } from '../data/damage';
import { ENEMIES } from '../data/enemies';
import { DIFFICULTY } from '../data/maps';
import { BLESSING_DURATION, BLESSING_RATE, FROST_NOVA_DURATION, METEOR_BURN, METEOR_DAMAGE, SPELLS } from '../data/spells';
import { BRANCH_TIER, MAX_TIER, TOWERS } from '../data/towers';
import type { AugmentDef, DamageType, Difficulty, EnemyId, GlobalStats, MapDef, SpellId, TargetMode, TowerId, TowerStats } from '../data/types';
import { Emitter } from '../engine/events';
import { dist2 } from '../engine/math';
import { Rng } from '../engine/rng';
import { runAttack } from './attacks';
import { Board } from './board';
import { Enemy, Tower, newId, type HitPayload, type Projectile, type Rift, type Strike } from './entities';
import { ModifierSet, effectiveDamageType, effectiveTargetsAir, STAT_DEFAULTS } from './modifiers';
import { generateWave, waveHpMultiplier, type WaveDef } from './waves';

export type Phase = 'build' | 'wave' | 'augment' | 'victory' | 'defeat';

export interface GameEvents {
  damage: { x: number; y: number; z: number; amount: number; crit: boolean; type: DamageType };
  kill: { enemy: Enemy; tower: Tower | null; gold: number };
  leak: { enemy: Enemy; lives: number };
  fire: { tower: Tower; target: Enemy | null };
  explosion: { x: number; y: number; radius: number; color: string; style: string };
  chain: { points: { x: number; y: number; z: number }[]; color: string };
  pulse: { x: number; y: number; radius: number; color: string };
  strike: { x: number; y: number; radius: number; style: Strike['style'] };
  heal: { x: number; y: number };
  spawn: { enemy: Enemy };
  waveStart: { wave: number; boss?: EnemyId };
  waveCleared: { wave: number; reward: number; interest: number };
  augmentOffer: { options: AugmentDef[] };
  build: { tower: Tower };
  upgrade: { tower: Tower };
  sell: { tower: Tower; refund: number };
  spell: { id: SpellId; x: number; y: number };
  gold: { x: number; y: number; amount: number };
  phase: { phase: Phase };
  shieldBreak: { x: number; y: number };
  blink: { x: number; y: number };
  revive: { x: number; y: number };
}

export interface GameOptions {
  map: MapDef;
  difficulty: Difficulty;
  mods: ModifierSet;
  unlockedTowers: TowerId[];
  seed?: number;
}

const FIXED_DT = 1 / 60;
/** Global tuning knob for gold dropped by enemies. */
const KILL_GOLD = 1.4;
const SPAWN_LEAD = 0.25;

/**
 * Complete simulation of a run. It has no rendering or DOM dependencies, so it
 * also runs headless in tests and balance simulations.
 */
export class Game {
  readonly events = new Emitter<GameEvents>();
  readonly board: Board;
  readonly rng: Rng;
  readonly mods: ModifierSet;
  readonly difficulty: Difficulty;
  readonly unlockedTowers: TowerId[];
  global: GlobalStats;

  phase: Phase = 'build';
  time = 0;
  gold: number;
  lives: number;
  maxLives: number;
  mana: number;
  wave = 0; // waves started
  wavesCleared = 0;
  totalWaves: number;
  speed = 1;
  paused = false;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  strikes: Strike[] = [];
  rifts: Rift[] = [];
  private spawners: { wave: WaveDef; time: number; spawned: number[]; done: boolean }[] = [];
  private pendingClears: number[] = [];

  augments: AugmentDef[] = [];
  augmentOffer: AugmentDef[] = [];
  rerollsLeft: number;
  freeTowersUsed = 0;
  spellCooldowns: Record<SpellId, number> = { meteor: 0, frostNova: 0, blessing: 0 };
  unlockedSpells: Set<SpellId>;
  blessingTime = 0;

  // Run statistics
  kills = 0;
  bossesKilled = 0;
  towerXp: Partial<Record<TowerId, number>> = {};
  leaked = 0;
  goldEarned = 0;

  private accumulator = 0;
  private auraDirty = true;
  private statsRevision = -1;

  constructor(opts: GameOptions) {
    this.board = new Board(opts.map);
    this.rng = new Rng(opts.seed ?? Date.now());
    this.mods = opts.mods;
    this.difficulty = opts.difficulty;
    this.unlockedTowers = opts.unlockedTowers;
    this.totalWaves = opts.map.waves;
    this.global = this.mods.global();
    this.gold = Math.round(this.global.startGold);
    this.maxLives = this.lives = DIFFICULTY[this.difficulty].lives + this.global.lives;
    this.mana = this.global.maxMana * 0.5;
    this.rerollsLeft = this.global.augmentRerolls;
    this.unlockedSpells = new Set<SpellId>(['meteor', ...this.mods.unlockedSpells()]);
  }

  // ------------------------------------------------------------ main loop

  /** Advance by real seconds (applies game speed, fixed timestep). */
  update(realDt: number): void {
    if (this.paused || this.halted) return;
    this.accumulator += Math.min(realDt, 0.25) * this.speed;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 12) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
      if (this.halted) {
        this.accumulator = 0;
        break;
      }
    }
  }

  step(dt: number): void {
    this.time += dt;
    this.refreshStats();
    this.mana = Math.min(this.global.maxMana, this.mana + this.global.manaRegen * dt);
    for (const k in this.spellCooldowns) this.spellCooldowns[k as SpellId] = Math.max(0, this.spellCooldowns[k as SpellId] - dt);
    if (this.blessingTime > 0) this.blessingTime -= dt;

    this.updateSpawners(dt);
    this.updateEnemies(dt);
    if (this.isOver) return;
    for (const t of this.towers) runAttack(this, t, dt);
    this.updateProjectiles(dt);
    this.updateStrikes(dt);
    this.updateRifts(dt);

    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
    this.checkWaveClears();
  }

  // ------------------------------------------------------------ stats

  private refreshStats(): void {
    if (this.statsRevision !== this.mods.revision) {
      this.statsRevision = this.mods.revision;
      this.global = this.mods.global();
      for (const t of this.towers) t.statsRev = -1;
      this.auraDirty = true;
    }
    for (const t of this.towers) {
      if (t.statsRev !== this.statsRevision) {
        t.stats = this.mods.towerStats(t.def.id, { tier: t.tier, branch: t.branch });
        t.statsRev = this.statsRevision;
        this.auraDirty = true;
      }
    }
    if (this.auraDirty) this.recomputeAuras();
  }

  private recomputeAuras(): void {
    this.auraDirty = false;
    for (const t of this.towers) t.buffDamage = t.buffRate = t.buffRange = t.buffCrit = 0;
    for (const s of this.towers) {
      const st = s.stats;
      if (!(st.auraDamage || st.auraRate || st.auraRange || st.auraCrit)) continue;
      const r2 = st.range * st.range;
      for (const t of this.towers) {
        if (t === s || dist2(t.x, t.y, s.x, s.y) > r2) continue;
        t.buffDamage += st.auraDamage;
        t.buffRate += st.auraRate;
        t.buffRange += st.auraRange;
        t.buffCrit += st.auraCrit;
      }
    }
    for (const t of this.towers) {
      t.buffDamage = Math.min(t.buffDamage, 1);
      t.buffRate = Math.min(t.buffRate, 0.8);
      t.buffRange = Math.min(t.buffRange, 0.5);
      t.buffCrit = Math.min(t.buffCrit, 0.4);
    }
  }

  /** Stats including temporary buffs (auras, blessing, souls). */
  liveStats(t: Tower): TowerStats {
    if (!t.stats) this.refreshStats();
    const s = t.stats;
    if (!t.buffDamage && !t.buffRate && !t.buffRange && !t.buffCrit && this.blessingTime <= 0 && !t.souls) return s;
    return {
      ...s,
      damage: (s.damage + t.souls) * (1 + t.buffDamage),
      rate: s.rate * (1 + t.buffRate) * (this.blessingTime > 0 ? 1 + BLESSING_RATE : 1),
      range: s.range * (1 + t.buffRange),
      critChance: Math.min(0.9, s.critChance + t.buffCrit),
    };
  }

  /** Stats preview for a hypothetical tower config (UI). */
  previewStats(id: TowerId, tier: number, branch: number): TowerStats {
    return this.mods.towerStats(id, { tier, branch });
  }

  // ------------------------------------------------------------ waves

  canStartWave(): boolean {
    return (this.phase === 'build' || this.phase === 'wave') && this.wave < this.totalWaves;
  }

  /** Starts the next wave. Calling it early during a wave grants bonus gold. */
  startNextWave(): number {
    if (!this.canStartWave()) return 0;
    let bonus = 0;
    if (this.phase === 'wave') {
      // Early-call bonus scales with how much of the current wave is left to spawn.
      bonus = 10 + this.wave * 2;
      this.addGold(bonus);
    }
    this.wave++;
    const w = generateWave(this.board.def, this.wave);
    this.spawners.push({ wave: w, time: 0, spawned: w.groups.map(() => 0), done: false });
    for (const t of this.towers) t.freshBuild = false;
    this.setPhase('wave');
    this.events.emit('waveStart', { wave: this.wave, boss: w.boss });
    return bonus;
  }

  nextWaveDef(): WaveDef | null {
    return this.wave < this.totalWaves ? generateWave(this.board.def, this.wave + 1) : null;
  }

  private updateSpawners(dt: number): void {
    for (const sp of this.spawners) {
      if (sp.done) continue;
      sp.time += dt;
      let allDone = true;
      sp.wave.groups.forEach((g, i) => {
        while (sp.spawned[i] < g.count && sp.time >= g.start + sp.spawned[i] * g.interval) {
          this.spawnEnemy(g.enemy, sp.wave.index, -SPAWN_LEAD);
          sp.spawned[i]++;
        }
        if (sp.spawned[i] < g.count) allDone = false;
      });
      sp.done = allDone;
    }
  }

  spawnEnemy(id: EnemyId, wave: number, dist: number): Enemy {
    const def = ENEMIES[id];
    const hpMult = waveHpMultiplier(wave) * this.board.def.hpScale * DIFFICULTY[this.difficulty].hp;
    const e = new Enemy(def, wave, hpMult, dist);
    const p = this.board.pointAt(Math.max(0, dist));
    e.x = p.x;
    e.y = p.y;
    e.angle = p.angle;
    this.enemies.push(e);
    this.events.emit('spawn', { enemy: e });
    return e;
  }

  private checkWaveClears(): void {
    if (this.isOver) return;
    for (const sp of this.spawners) {
      if (!sp.done) continue;
      const idx = sp.wave.index;
      if (this.enemies.some((e) => e.wave === idx)) continue;
      this.pendingClears.push(idx);
    }
    if (this.pendingClears.length === 0) return;
    const cleared = new Set(this.pendingClears);
    this.pendingClears = [];
    this.spawners = this.spawners.filter((s) => !cleared.has(s.wave.index));
    for (const idx of [...cleared].sort((a, b) => a - b)) this.onWaveCleared(generateWave(this.board.def, idx));
  }

  private onWaveCleared(w: WaveDef): void {
    this.wavesCleared++;
    const towerGold = this.towers.reduce((a, t) => a + (t.stats?.waveGold ?? 0), 0);
    const reward = Math.round(w.reward * DIFFICULTY[this.difficulty].gold + this.global.waveGold + towerGold);
    const interest = Math.min(this.global.interestCap, Math.floor(this.gold * this.global.interest));
    this.addGold(reward + interest);
    if (this.global.livesRegen > 0 && w.index % 5 === 0) {
      this.lives = Math.min(this.maxLives, this.lives + this.global.livesRegen);
    }
    this.events.emit('waveCleared', { wave: w.index, reward, interest });

    if (this.wavesCleared >= this.totalWaves && this.enemies.length === 0) {
      this.setPhase('victory');
      return;
    }
    if (this.spawners.length === 0) this.setPhase('build');
    const interval = Math.max(2, Math.round(this.global.augmentInterval));
    if (w.index % interval === 0 && w.index < this.totalWaves) this.offerAugments();
  }

  // ------------------------------------------------------------ augments

  rollAugments(): AugmentDef[] {
    const taken = new Set(this.augments.map((a) => a.id));
    const pool = AUGMENTS.filter((a) => (a.stackable || !taken.has(a.id)) && (!a.requiresTower || this.unlockedTowers.includes(a.requiresTower)));
    const luck = this.global.augmentLuck;
    const weights = pool.map((a) => RARITY_WEIGHT[a.rarity] * (a.rarity === 'rare' ? 1 + luck : a.rarity === 'epic' ? 1 + luck * 2 : 1));
    const count = Math.min(pool.length, Math.round(this.global.augmentChoices));
    const out: AugmentDef[] = [];
    while (out.length < count) {
      const i = this.rng.weighted(weights);
      if (i < 0) break;
      out.push(pool[i]);
      weights[i] = 0;
    }
    return out;
  }

  private offerAugments(): void {
    this.augmentOffer = this.rollAugments();
    if (this.augmentOffer.length === 0) return;
    this.setPhase('augment');
    this.events.emit('augmentOffer', { options: this.augmentOffer });
  }

  rerollAugments(): boolean {
    if (this.phase !== 'augment' || this.rerollsLeft <= 0) return false;
    this.rerollsLeft--;
    this.augmentOffer = this.rollAugments();
    this.events.emit('augmentOffer', { options: this.augmentOffer });
    return true;
  }

  pickAugment(id: string): boolean {
    if (this.phase !== 'augment') return false;
    const a = this.augmentOffer.find((x) => x.id === id) ?? AUGMENT_MAP[id];
    if (!a || !this.augmentOffer.includes(a)) return false;
    this.augments.push(a);
    this.mods.add(a.mods);
    if (a.gold) this.addGold(a.gold);
    if (a.lives) {
      this.lives = Math.max(1, this.lives + a.lives);
      if (a.lives > 0) this.maxLives = Math.max(this.maxLives, this.lives);
    }
    this.augmentOffer = [];
    this.refreshStats();
    this.setPhase(this.spawners.length > 0 ? 'wave' : 'build');
    return true;
  }

  // ------------------------------------------------------------ economy & building

  addGold(n: number): void {
    this.gold += n;
    if (n > 0) this.goldEarned += n;
  }

  get freeTowersLeft(): number {
    return Math.max(0, Math.round(this.global.freeTowers) - this.freeTowersUsed);
  }

  buildCost(id: TowerId): number {
    if (this.freeTowersLeft > 0) return 0;
    return Math.round(TOWERS[id].cost * this.mods.costMultiplier(id, 'build'));
  }

  /** Cost of upgrading to the next tier; `branch` is required when the next tier is the branch tier. */
  upgradeCost(t: Tower, branch = t.branch): number | null {
    if (t.tier >= MAX_TIER) return null;
    const def = t.def;
    let base: number;
    if (t.tier < BRANCH_TIER) base = def.tiers[t.tier - 1].cost;
    else {
      if (branch < 0) return null;
      base = def.branches[branch].steps[t.tier - BRANCH_TIER].cost;
    }
    return Math.round(base * this.mods.costMultiplier(def.id, 'upgrade'));
  }

  /** Free tile for a tower: grass for land towers, open water for naval ones (default: land). */
  canBuildAt(x: number, y: number, id?: TowerId): boolean {
    if (this.towerAt(x, y)) return false;
    return id && TOWERS[id].placement === 'water' ? this.board.isWater(x, y) : this.board.isBuildable(x, y);
  }

  /** The map has room for naval towers. */
  get hasWater(): boolean {
    return this.board.tiles.some((row) => row.some((t) => t.kind === 'water'));
  }

  towerAt(x: number, y: number): Tower | undefined {
    return this.towers.find((t) => t.tx === x && t.ty === y);
  }

  build(id: TowerId, x: number, y: number): Tower | null {
    if (this.phase === 'victory' || this.phase === 'defeat') return null;
    if (!this.unlockedTowers.includes(id) || !this.canBuildAt(x, y, id)) return null;
    const cost = this.buildCost(id);
    if (this.gold < cost) return null;
    if (cost === 0 && this.freeTowersLeft > 0) this.freeTowersUsed++;
    this.gold -= cost;
    const t = new Tower(TOWERS[id], x, y, cost);
    t.freshBuild = this.phase === 'build';
    this.towers.push(t);
    this.auraDirty = true;
    this.refreshStats();
    this.events.emit('build', { tower: t });
    return t;
  }

  upgrade(t: Tower, branch?: number): boolean {
    if (t.tier >= MAX_TIER) return false;
    const b = t.tier >= BRANCH_TIER ? (t.branch >= 0 ? t.branch : (branch ?? -1)) : t.branch;
    if (t.tier >= BRANCH_TIER && b < 0) return false;
    const cost = this.upgradeCost(t, b);
    if (cost === null || this.gold < cost) return false;
    this.gold -= cost;
    t.spent += cost;
    t.tier++;
    t.branch = b;
    t.statsRev = -1;
    t.buildAnim = 0;
    t.beamTarget = null;
    this.refreshStats();
    this.events.emit('upgrade', { tower: t });
    return true;
  }

  sellValue(t: Tower): number {
    return t.freshBuild ? t.spent : Math.round(t.spent * Math.min(1, this.global.sellRefund));
  }

  sell(t: Tower): number {
    const idx = this.towers.indexOf(t);
    if (idx < 0) return 0;
    const refund = this.sellValue(t);
    this.towers.splice(idx, 1);
    this.addGold(refund);
    this.auraDirty = true;
    this.events.emit('sell', { tower: t, refund });
    return refund;
  }

  setTargetMode(t: Tower, mode: TargetMode): void {
    t.targetMode = mode;
  }

  // ------------------------------------------------------------ spells

  spellReady(id: SpellId): boolean {
    return (
      this.unlockedSpells.has(id) &&
      this.spellCooldowns[id] <= 0 &&
      this.mana >= SPELLS[id].mana &&
      this.phase !== 'victory' &&
      this.phase !== 'defeat'
    );
  }

  castSpell(id: SpellId, x = 0, y = 0): boolean {
    if (!this.spellReady(id)) return false;
    const def = SPELLS[id];
    this.mana -= def.mana;
    this.spellCooldowns[id] = def.cooldown * Math.max(0.3, 1 + this.global.spellCooldown);
    const power = (1 + this.global.spellPower) * Math.pow(waveHpMultiplier(Math.max(1, this.wave)), 0.9);
    const payload = (damage: number, type: DamageType, extra: Partial<TowerStats> = {}): HitPayload => ({
      tower: null,
      stats: { ...STAT_DEFAULTS, damage, ...extra },
      damage,
      type,
    });
    if (id === 'meteor') {
      for (let i = 0; i < 3; i++) {
        const a = this.rng.next() * Math.PI * 2;
        const r = i === 0 ? 0 : this.rng.range(0.4, def.radius * 0.7);
        this.strikes.push({
          x: x + Math.cos(a) * r,
          y: y + Math.sin(a) * r,
          delay: 0.7 + i * 0.3,
          total: 0.7 + i * 0.3,
          radius: 1.1,
          payload: payload(METEOR_DAMAGE * power, 'fire', { burnDps: METEOR_BURN * power, burnDuration: 3 }),
          style: 'spellMeteor',
        });
      }
    } else if (id === 'frostNova') {
      for (const e of this.enemies) {
        if (dist2(e.x, e.y, x, y) <= def.radius * def.radius) {
          e.freezeTime = Math.max(e.freezeTime, FROST_NOVA_DURATION * e.ccFactor);
          this.damageEnemy(e, 30 * power, 'frost', payload(30 * power, 'frost'));
        }
      }
      this.events.emit('pulse', { x, y, radius: def.radius, color: def.color });
    } else if (id === 'blessing') {
      this.blessingTime = BLESSING_DURATION;
    }
    this.events.emit('spell', { id, x, y });
    return true;
  }

  // ------------------------------------------------------------ enemies

  private updateEnemies(dt: number): void {
    const board = this.board;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.age += dt;
      e.hitFlash += dt;
      // Status timers
      if (e.slowTime > 0 && (e.slowTime -= dt) <= 0) e.slow = 0;
      if (e.stunTime > 0) e.stunTime -= dt;
      if (e.freezeTime > 0) e.freezeTime -= dt;
      if (e.vulnTime > 0 && (e.vulnTime -= dt) <= 0) e.vuln = 0;
      e.shieldIdle += dt;

      // Damage over time
      if (e.burnTime > 0) {
        e.burnTime -= dt;
        this.damageEnemy(e, e.burnDps * dt, 'fire', null, e.burnSource, true);
      }
      if (e.poison.length) {
        for (const p of e.poison) {
          p.time -= dt;
          if (e.alive) this.damageEnemy(e, p.dps * dt, 'poison', null, p.tower, true);
        }
        e.poison = e.poison.filter((p) => p.time > 0);
      }
      if (!e.alive) continue;

      // Regeneration (fire stops it)
      const def = e.def;
      if (def.regen && e.burnTime <= 0) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * def.regen * dt);
      if (def.shieldRegen && e.shieldIdle > 2 && e.maxShield > 0)
        e.shield = Math.min(e.maxShield, e.shield + def.shieldRegen * dt * (e.maxShield / Math.max(1, def.shield)));
      if (def.heal) {
        e.healTimer += dt;
        if (e.healTimer >= 0.5) {
          e.healTimer = 0;
          let healed = false;
          for (const o of this.enemies) {
            if (o.alive && o !== e && o.hp < o.maxHp && dist2(o.x, o.y, e.x, e.y) < 2.25) {
              o.hp = Math.min(o.maxHp, o.hp + def.heal * 0.5 * waveHpMultiplier(e.wave));
              healed = true;
            }
          }
          if (healed) this.events.emit('heal', { x: e.x, y: e.y });
        }
      }
      if (def.shieldAura) {
        e.auraTimer += dt;
        if (e.auraTimer >= def.shieldAura.every) {
          e.auraTimer = 0;
          const amount = def.shieldAura.amount * waveHpMultiplier(e.wave);
          const r2 = def.shieldAura.radius * def.shieldAura.radius;
          for (const o of this.enemies) {
            if (!o.alive || o === e || dist2(o.x, o.y, e.x, e.y) > r2) continue;
            o.shield = Math.min(Math.max(o.maxShield, amount * 2), o.shield + amount);
            o.maxShield = Math.max(o.maxShield, o.shield);
            o.shieldIdle = 0;
          }
          this.events.emit('pulse', { x: e.x, y: e.y, radius: def.shieldAura.radius, color: '#b98bff' });
        }
      }
      if (def.blink && e.stunTime <= 0 && e.freezeTime <= 0) {
        e.blinkTimer += dt;
        if (e.blinkTimer >= def.blink.every) {
          e.blinkTimer = 0;
          this.events.emit('blink', { x: e.x, y: e.y });
          e.dist = Math.min(board.length - 0.3, e.dist + def.blink.distance);
          const bp = board.pointAt(e.dist);
          e.x = bp.x;
          e.y = bp.y;
          this.events.emit('blink', { x: e.x, y: e.y });
        }
      }
      if (def.summon) {
        e.summonTimer += dt;
        if (e.summonTimer >= def.summon.every) {
          e.summonTimer = 0;
          for (let i = 0; i < def.summon.count; i++) this.spawnEnemy(def.summon.into, e.wave, Math.max(0, e.dist - 0.4 - i * 0.35));
        }
      }

      // Movement
      const move = e.currentSpeed * dt;
      e.dist += move;
      e.walk += move;
      if (e.dist >= board.length) {
        e.alive = false;
        this.leaked++;
        this.lives -= def.leak;
        this.events.emit('leak', { enemy: e, lives: def.leak });
        if (this.lives <= 0) {
          this.lives = 0;
          this.setPhase('defeat');
          return;
        }
        continue;
      }
      const p = board.pointAt(Math.max(0, e.dist));
      e.x = p.x;
      e.y = p.y;
      e.angle = p.angle;
    }
  }

  // ------------------------------------------------------------ combat

  /** Enemies in range of a tower, sorted by its targeting mode. */
  findTargets(t: Tower, s: TowerStats, count: number, mode: TargetMode = t.targetMode): Enemy[] {
    const air = effectiveTargetsAir(t.def, t.branch);
    const ground = t.def.targetsGround;
    const r2 = s.range * s.range;
    const min2 = s.minRange * s.minRange;
    const list: Enemy[] = [];
    for (const e of this.enemies) {
      if (!e.alive || e.dist < 0) continue;
      if (e.flying ? !air : !ground) continue;
      const d2 = dist2(e.x, e.y, t.x, t.y);
      if (d2 <= r2 && d2 >= min2) list.push(e);
    }
    if (list.length <= 1) return list;
    switch (mode) {
      case 'first':
        list.sort((a, b) => b.dist - a.dist);
        break;
      case 'last':
        list.sort((a, b) => a.dist - b.dist);
        break;
      case 'strong':
        list.sort((a, b) => b.totalHp - a.totalHp);
        break;
      case 'close':
        list.sort((a, b) => dist2(a.x, a.y, t.x, t.y) - dist2(b.x, b.y, t.x, t.y));
        break;
    }
    return list.slice(0, count);
  }

  enemiesInRadius(x: number, y: number, r: number, includeAir = true): Enemy[] {
    const r2 = r * r;
    return this.enemies.filter((e) => e.alive && e.dist >= 0 && (includeAir || !e.flying) && dist2(e.x, e.y, x, y) <= r2);
  }

  /**
   * Applies a full hit (damage + on-hit effects) from a tower payload.
   * `mult` scales the damage (chain falloff, bomblets, splash...).
   */
  applyHit(e: Enemy, p: HitPayload, mult = 1): void {
    if (!e.alive) return;
    const s = p.stats;
    let dmg = p.damage * mult;
    let crit = false;
    if (s.critChance > 0 && this.rng.chance(s.critChance)) {
      dmg *= s.critMult;
      crit = true;
    }
    if (s.bonusVsSlowed && e.isSlowed) dmg *= 1 + s.bonusVsSlowed;
    if (s.bossDamage && e.def.boss) dmg *= 1 + s.bossDamage;
    if (s.airDamage && e.flying) dmg *= 1 + s.airDamage;

    // Statuses first so slows/vulnerability apply to this hit's follow-ups.
    const cc = e.ccFactor;
    if (s.slow > 0 && s.slowDuration > 0) {
      if (s.slow >= e.slow || e.slowTime <= 0) e.slow = s.slow;
      e.slowTime = Math.max(e.slowTime, s.slowDuration);
    }
    if (s.vulnerability > 0) {
      e.vuln = Math.max(e.vuln, s.vulnerability);
      e.vulnTime = Math.max(e.vulnTime, s.vulnerabilityDuration || 2);
    }
    if (s.stunChance > 0 && this.rng.chance(s.stunChance)) e.stunTime = Math.max(e.stunTime, s.stunDuration * cc);
    if (s.freezeChance > 0 && this.rng.chance(s.freezeChance)) e.freezeTime = Math.max(e.freezeTime, s.freezeDuration * cc);
    if (s.burnDps > 0) {
      e.burnDps = Math.max(e.burnTime > 0 ? e.burnDps : 0, s.burnDps * mult);
      e.burnTime = Math.max(e.burnTime, s.burnDuration || 2);
      e.burnSource = p.tower;
    }
    if (s.poisonDps > 0) this.addPoison(e, p.tower, s.poisonDps * mult, s.poisonDuration || 3, Math.max(1, Math.round(s.poisonStacks)));
    if (s.knockback > 0 && !e.def.boss && !e.def.unstoppable) e.dist = Math.max(0, e.dist - s.knockback * cc);
    if (s.armorShred > 0 && e.armor > 0) {
      const shred = Math.min(e.armor, s.armorShred * mult);
      e.armor -= shred;
      this.creditDamage(e, shred, p.tower);
    }

    if (dmg > 0) this.damageEnemy(e, dmg, p.type, p, p.tower, false, crit);
  }

  addPoison(e: Enemy, tower: Tower | null, dps: number, time: number, maxStacks: number): void {
    const own = e.poison.filter((x) => x.tower === tower);
    if (own.length < maxStacks) e.poison.push({ tower, dps, time });
    else {
      // Refresh the oldest stack.
      own.sort((a, b) => a.time - b.time);
      own[0].time = time;
      own[0].dps = Math.max(own[0].dps, dps);
    }
  }

  /** Raw damage through the shield → armor → health layers. Returns damage actually dealt. */
  damageEnemy(
    e: Enemy,
    amount: number,
    type: DamageType,
    p: HitPayload | null,
    source: Tower | null = p?.tower ?? null,
    dot = false,
    crit = false,
  ): number {
    if (!e.alive || amount <= 0) return 0;
    const info = DAMAGE_TYPES[type];
    let dmg = amount * (1 + e.vuln) * (e.def.resist?.[type] ?? 1);
    if (type === 'holy' && e.def.undead) dmg *= UNDEAD_HOLY_BONUS;
    const s = p?.stats;
    const before = e.totalHp;
    let remaining = dmg;
    if (e.shield > 0) {
      const eff = info.vs[0] * (1 + (s?.shieldDamage ?? 0) + this.global.shieldBreak);
      const absorbed = Math.min(e.shield, remaining * eff);
      e.shield -= absorbed;
      remaining -= absorbed / eff;
      e.shieldIdle = 0;
      if (e.shield <= 0.01) {
        e.shield = 0;
        this.events.emit('shieldBreak', { x: e.x, y: e.y });
      }
    }
    if (remaining > 0 && e.armor > 0) {
      const eff = info.vs[1] * (1 + (s?.armorDamage ?? 0) + this.global.armorBreak);
      const absorbed = Math.min(e.armor, remaining * eff);
      e.armor -= absorbed;
      remaining -= absorbed / eff;
    }
    if (remaining > 0) e.hp -= remaining * info.vs[2];
    const dealt = before - Math.max(0, e.totalHp);
    if (!dot) e.hitFlash = 0;
    this.creditDamage(e, dealt, source);
    if (!dot || dealt >= 1) {
      this.events.emit('damage', { x: e.x, y: e.y, z: e.flying ? 0.9 : 0.5, amount: dealt, crit, type });
    }
    if (e.hp <= 0.001) this.killEnemy(e, source);
    else if (s && s.execute > 0 && !e.def.boss && e.hp / e.maxHp < s.execute && e.shield <= 0) this.killEnemy(e, source);
    return dealt;
  }

  private creditDamage(e: Enemy, dealt: number, source: Tower | null): void {
    if (!source || dealt <= 0) return;
    source.damageDealt += dealt;
    const xp = (dealt / e.pool) * e.def.threat * 1.5 * (e.def.boss ? 2 : 1);
    this.towerXp[source.def.id] = (this.towerXp[source.def.id] ?? 0) + xp;
  }

  killEnemy(e: Enemy, source: Tower | null): void {
    if (!e.alive) return;
    if (e.def.revive && !e.revived) {
      // Rises again once: no bounty until the second death.
      e.revived = true;
      e.hp = Math.max(1, e.maxHp * e.def.revive);
      e.burnTime = 0;
      e.poison = [];
      e.stunTime = Math.max(e.stunTime, 0.8);
      this.events.emit('revive', { x: e.x, y: e.y });
      return;
    }
    e.alive = false;
    e.hp = 0;
    this.kills++;
    if (e.def.boss) this.bossesKilled++;
    let gold = e.def.gold * KILL_GOLD * DIFFICULTY[this.difficulty].gold * (1 + this.global.killGold);
    if (e.def.boss) gold += this.global.bossGold;
    if (source) {
      source.kills++;
      const s = source.stats;
      if (s.goldChance > 0 && this.rng.chance(s.goldChance)) {
        gold += s.goldAmount;
        this.events.emit('gold', { x: e.x, y: e.y, amount: s.goldAmount });
      }
      if (s.soulStacks > 0) source.souls = Math.min(400, source.souls + s.soulStacks);
    }
    gold = Math.round(gold);
    this.addGold(gold);
    this.events.emit('kill', { enemy: e, tower: source, gold });

    // Plague: poison spreads from a dying host.
    const spread = e.poison.reduce((m, p) => Math.max(m, p.tower?.stats.spreadOnDeath ?? 0), 0);
    if (spread > 0) {
      for (const o of this.enemiesInRadius(e.x, e.y, spread, false)) {
        if (o === e) continue;
        for (const p of e.poison) this.addPoison(o, p.tower, p.dps, Math.max(p.time, 2), Math.max(1, Math.round(p.tower?.stats.poisonStacks ?? 1)));
      }
      this.events.emit('pulse', { x: e.x, y: e.y, radius: spread, color: '#9be15d' });
    }
    if (e.def.split) {
      for (let i = 0; i < e.def.split.count; i++) {
        const child = this.spawnEnemy(e.def.split.into, e.wave, Math.max(0, e.dist + (i - (e.def.split.count - 1) / 2) * 0.35));
        child.x += (i - 0.5) * 0.1;
      }
    }
  }

  // ------------------------------------------------------------ projectiles

  spawnProjectile(p: Omit<Projectile, 'uid' | 'alive' | 'hit' | 'travelled' | 't'>): Projectile {
    const proj: Projectile = { ...p, uid: newId(), alive: true, hit: new Set(), travelled: 0, t: 0 };
    this.projectiles.push(proj);
    return proj;
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      switch (p.kind) {
        case 'homing':
          this.updateHoming(p, dt);
          break;
        case 'lob':
        case 'bomblet':
          this.updateLob(p, dt);
          break;
        case 'bolt':
        case 'orb':
          this.updateLine(p, dt);
          break;
      }
    }
    if (this.projectiles.some((p) => !p.alive)) this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private updateHoming(p: Projectile, dt: number): void {
    if (p.target && p.target.alive && !p.hit.has(p.target.uid)) {
      p.tx = p.target.x;
      p.ty = p.target.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    const targetZ = p.target?.flying ? 0.9 : 0.45;
    if (d <= step + 0.12) {
      p.x = p.tx;
      p.y = p.ty;
      const target = p.target && p.target.alive && !p.hit.has(p.target.uid) ? p.target : this.nearestUnhit(p, 0.45);
      if (target) {
        this.applyHit(target, p.payload);
        p.hit.add(target.uid);
        if (p.splash > 0) this.splash(p.x, p.y, p.splash, p.payload, target);
      }
      if (target && p.pierceLeft > 0) {
        // Continue straight on to the next enemy behind.
        p.pierceLeft--;
        const dir = Math.atan2(p.vy, p.vx);
        const next = this.nearestUnhit(p, 1.6, dir);
        if (next) {
          p.target = next;
          return;
        }
      }
      p.alive = false;
      return;
    }
    p.vx = dx / d;
    p.vy = dy / d;
    p.x += p.vx * step;
    p.y += p.vy * step;
    p.z += (targetZ - p.z) * Math.min(1, dt * 6);
    p.travelled += step;
    if (p.travelled > 14) p.alive = false;
  }

  private nearestUnhit(p: Projectile, radius: number, dir?: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = radius * radius;
    for (const e of this.enemies) {
      if (!e.alive || p.hit.has(e.uid) || e.dist < 0) continue;
      const d2 = dist2(e.x, e.y, p.x, p.y);
      if (d2 > bd) continue;
      if (dir !== undefined) {
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        if (Math.abs(Math.atan2(Math.sin(a - dir), Math.cos(a - dir))) > 1.1) continue;
      }
      bd = d2;
      best = e;
    }
    return best;
  }

  private updateLob(p: Projectile, dt: number): void {
    p.t += dt / p.duration;
    const t = Math.min(1, p.t);
    p.x = p.sx + (p.tx - p.sx) * t;
    p.y = p.sy + (p.ty - p.sy) * t;
    p.z = p.sz * (1 - t) + p.arc * 4 * t * (1 - t);
    if (t < 1) return;
    p.alive = false;
    const style = p.kind === 'bomblet' ? 'small' : p.payload.type === 'poison' ? 'poison' : p.payload.stats.burnDps > 0 ? 'fire' : 'blast';
    this.events.emit('explosion', { x: p.x, y: p.y, radius: p.splash, color: p.color, style });
    this.splash(p.x, p.y, p.splash, p.payload, null);
    const bomblets = p.kind === 'lob' ? Math.round(p.payload.stats.bomblets) : 0;
    for (let i = 0; i < bomblets; i++) {
      const a = (i / bomblets) * Math.PI * 2 + this.rng.next() * 0.6;
      const r = this.rng.range(0.6, 1.3) * Math.max(1, p.splash);
      this.spawnProjectile({
        kind: 'bomblet',
        x: p.x,
        y: p.y,
        z: 0.1,
        sx: p.x,
        sy: p.y,
        sz: 0.1,
        tx: p.x + Math.cos(a) * r,
        ty: p.y + Math.sin(a) * r,
        target: null,
        vx: 0,
        vy: 0,
        speed: 0,
        duration: 0.45,
        arc: 0.6,
        maxTravel: 0,
        pierceLeft: 0,
        payload: { ...p.payload, damage: p.payload.damage * 0.4, stats: { ...p.payload.stats, bomblets: 0 } },
        splash: 0.55,
        color: p.color,
        style: 'bomb',
      });
    }
  }

  private updateLine(p: Projectile, dt: number): void {
    const step = p.speed * dt;
    p.x += p.vx * step;
    p.y += p.vy * step;
    p.travelled += step;
    const radius = p.kind === 'orb' ? Math.max(0.35, p.splash) : 0.4;
    if (p.kind === 'orb') {
      // Orbs damage everything they touch, at most every 0.3 s per enemy.
      const cd = p.hitCd!;
      for (const [k, v] of cd) {
        if (v - dt <= 0) cd.delete(k);
        else cd.set(k, v - dt);
      }
      for (const e of this.enemiesInRadius(p.x, p.y, radius, true)) {
        if (cd.has(e.uid)) continue;
        cd.set(e.uid, 0.3);
        this.applyHit(e, p.payload, 0.5);
      }
    } else {
      for (const e of this.enemiesInRadius(p.x, p.y, radius, effectiveTargetsAir(p.payload.tower!.def, p.payload.tower!.branch))) {
        if (p.hit.has(e.uid)) continue;
        p.hit.add(e.uid);
        this.applyHit(e, p.payload);
        if (p.pierceLeft-- <= 0) {
          p.alive = false;
          return;
        }
      }
    }
    if (p.travelled >= p.maxTravel) p.alive = false;
  }

  /** Area damage around a point. Excluded enemy already took the direct hit. */
  splash(x: number, y: number, radius: number, payload: HitPayload, exclude: Enemy | null): void {
    if (radius <= 0) return;
    const air = payload.tower ? effectiveTargetsAir(payload.tower.def, payload.tower.branch) : true;
    for (const e of this.enemiesInRadius(x, y, radius, air)) {
      if (e === exclude) continue;
      const falloff = 1 - 0.35 * (Math.hypot(e.x - x, e.y - y) / radius);
      this.applyHit(e, payload, exclude ? 0.6 * falloff : falloff);
    }
  }

  private updateStrikes(dt: number): void {
    if (!this.strikes.length) return;
    for (const s of this.strikes) {
      s.delay -= dt;
      if (s.delay <= 0) {
        this.events.emit('strike', { x: s.x, y: s.y, radius: s.radius, style: s.style });
        this.splash(s.x, s.y, s.radius, s.payload, null);
      }
    }
    this.strikes = this.strikes.filter((s) => s.delay > 0);
  }

  private updateRifts(dt: number): void {
    if (!this.rifts.length) return;
    for (const r of this.rifts) {
      r.time -= dt;
      for (const e of this.enemiesInRadius(r.x, r.y, r.radius, false)) {
        if (e.def.boss) continue;
        if (!e.def.unstoppable) e.dist = Math.max(0, e.dist - (r.pull / r.total) * dt * e.ccFactor);
      }
    }
    this.rifts = this.rifts.filter((r) => r.time > 0);
  }

  // ------------------------------------------------------------ helpers

  damageTypeOf(t: Tower): DamageType {
    return effectiveDamageType(t.def, t.branch);
  }

  private setPhase(p: Phase): void {
    if (this.phase === p) return;
    this.phase = p;
    this.events.emit('phase', { phase: p });
  }

  /** Remaining waves are not started and nothing is alive: used by UI to show the start button. */
  get waitingForWave(): boolean {
    return this.phase === 'build';
  }

  /** After a victory: keep the same battle going with endless waves. */
  continueEndless(): boolean {
    if (this.phase !== 'victory') return false;
    this.totalWaves = Infinity;
    this.setPhase('build');
    return true;
  }

  /** Simulation is frozen (picking an augment or run finished). */
  get halted(): boolean {
    return this.phase === 'augment' || this.phase === 'victory' || this.phase === 'defeat';
  }

  get isOver(): boolean {
    return this.phase === 'victory' || this.phase === 'defeat';
  }
}
