import { ENEMIES } from '../data/enemies';
import { SPELLS } from '../data/spells';
import { TOWERS } from '../data/towers';
import type { SpellId, TowerId } from '../data/types';
import { clamp, easeOutBack } from '../engine/math';
import type { Enemy, Projectile, Tower } from '../game/entities';
import type { Game } from '../game/game';
import { effectiveAttack } from '../game/modifiers';
import { rgba, shade } from './color';
import { Fx } from './fx';
import { drawEnemyModel, enemyHeight } from './models/enemies';
import { drawTowerModel } from './models/towers';
import { Painter } from './painter';
import { Camera, HEIGHT_SCALE, depthOf } from './projection';
import { drawSprite, makeSprite, type Sprite } from './sprites';
import { GRASS_H, GroundCache, SLAB } from './terrain';
import { THEMES, type Theme } from './theme';

export const UI_FONT = '"Fredoka", "Nunito", system-ui, sans-serif';

export interface ViewState {
  hover: { x: number; y: number } | null;
  selected: Tower | null;
  ghost: { id: TowerId; x: number; y: number; valid: boolean } | null;
  spell: { id: SpellId; x: number; y: number } | null;
  showDamage: boolean;
  shakeEnabled: boolean;
}

type Drawable = { depth: number; draw: () => void };

/** Renders a Game with cavalier projection on a 2D canvas. */
export class Renderer {
  readonly cam = new Camera();
  readonly painter: Painter;
  readonly fx = new Fx();
  readonly theme: Theme;
  private ground: GroundCache;
  /** Scale the cached bitmaps (ground, sprites) were rendered at. */
  private cacheScale = 0;
  private cacheDpr = 0;
  private zoomChangedAt = 0;
  private towerSprites = new Map<string, Sprite>();
  private castleSprite: Sprite | null = null;
  /** Paint the sky into the canvas (needed for snapshots); otherwise CSS paints it. */
  paintBackground = false;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private width = 0;
  private height = 0;
  private time = 0;
  /** User zoom multiplier and pan (CSS px). */
  zoom = 1;
  panX = 0;
  panY = 0;
  private baseScale = 48;
  /** Insets reserved for UI (CSS px). */
  insets = { top: 70, bottom: 120, left: 12, right: 12 };
  private unsub: (() => void)[] = [];
  private castleHit = 0;
  view: ViewState = { hover: null, selected: null, ghost: null, spell: null, showDamage: true, shakeEnabled: true };

  constructor(
    private canvas: HTMLCanvasElement,
    private game: Game,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.painter = new Painter(this.cam);
    this.painter.ctx = this.ctx;
    this.theme = THEMES[game.board.def.theme];
    this.ground = new GroundCache(game.board, this.theme);
    this.cam.rows = game.board.height;
    canvas.style.background = `linear-gradient(180deg, ${this.theme.bgTop}, ${this.theme.bgBottom})`;
    this.bindEvents();
  }

  destroy(): void {
    for (const u of this.unsub) u();
  }

  // ------------------------------------------------------------ layout

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(dpr, 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.fit();
  }

  /** Computes the base scale so the whole board fits between the UI insets. */
  fit(): void {
    const b = this.game.board;
    const ext = Camera.boardExtent(b.width, b.height);
    const availW = Math.max(100, this.width - this.insets.left - this.insets.right);
    const availH = Math.max(100, this.height - this.insets.top - this.insets.bottom);
    const extraTop = 1.3; // tall things on the back row
    const extraBottom = SLAB * HEIGHT_SCALE + 0.2;
    const sW = availW / (ext.w + 0.4);
    const sH = availH / (ext.h + extraTop + extraBottom);
    this.baseScale = Math.max(14, Math.min(sW, sH, 110));
    this.applyCamera();
  }

  private applyCamera(): void {
    const b = this.game.board;
    const ext = Camera.boardExtent(b.width, b.height);
    this.zoom = clamp(this.zoom, 1, 2.6);
    const scale = this.baseScale * this.zoom;
    this.cam.scale = scale;
    const availW = this.width - this.insets.left - this.insets.right;
    const availH = this.height - this.insets.top - this.insets.bottom;
    const boardW = ext.w * scale;
    const boardH = (ext.h + 1.3 + SLAB * HEIGHT_SCALE + 0.2) * scale;
    // Clamp pan so the board never leaves the screen.
    const maxPanX = Math.max(0, (boardW - availW) / 2 + scale);
    const maxPanY = Math.max(0, (boardH - availH) / 2 + scale);
    this.panX = clamp(this.panX, -maxPanX, maxPanX);
    this.panY = clamp(this.panY, -maxPanY, maxPanY);
    this.cam.ox = this.insets.left + (availW - boardW) / 2 + this.panX;
    // origin y: top of back row sits below the "extra top" area.
    this.cam.oy = this.insets.top + (availH - boardH) / 2 + 1.3 * scale + this.panY;
  }

  setZoom(z: number, anchorX = this.width / 2, anchorY = this.height / 2): void {
    this.zoomChangedAt = this.time;
    const before = this.cam.unproject(anchorX, anchorY, 0);
    this.zoom = clamp(z, 1, 2.6);
    this.applyCamera();
    const after = this.cam.project(before.x, before.y, 0);
    this.panX += anchorX - after.x;
    this.panY += anchorY - after.y;
    this.applyCamera();
  }

  pan(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.applyCamera();
  }

  recenter(): void {
    this.zoom = 1;
    this.panX = this.panY = 0;
    this.applyCamera();
  }

  /** Tile under a screen point (prefers raised tiles). */
  pickTile(sx: number, sy: number): { x: number; y: number } | null {
    const b = this.game.board;
    const hi = this.cam.unproject(sx, sy, GRASS_H);
    const tx = Math.floor(hi.x);
    const ty = Math.floor(hi.y);
    if (b.isBuildable(tx, ty) || b.tile(tx, ty)?.kind === 'tree' || b.tile(tx, ty)?.kind === 'rock') return { x: tx, y: ty };
    const lo = this.cam.unproject(sx, sy, 0);
    const lx = Math.floor(lo.x);
    const ly = Math.floor(lo.y);
    if (b.tile(lx, ly)) return { x: lx, y: ly };
    return null;
  }

  /** World point on the ground under the cursor (for targeted spells). */
  pickGround(sx: number, sy: number): { x: number; y: number } {
    return this.cam.unproject(sx, sy, 0);
  }

  /** Screen position of a world point (for DOM overlays). */
  toScreen(x: number, y: number, z: number): { x: number; y: number } {
    return this.cam.project(x, y, z);
  }

  // ------------------------------------------------------------ events → fx

  private bindEvents(): void {
    const ev = this.game.events;
    const fx = this.fx;
    this.unsub.push(
      ev.on('damage', (d) => {
        if (this.view.showDamage && d.amount >= 1) fx.damage(d.x, d.y, d.z, d.amount, d.crit, d.type);
      }),
      ev.on('kill', ({ enemy, gold }) => {
        const z = enemyHeight(enemy.def) * 0.6;
        fx.burst('debris', enemy.x, enemy.y, z, 6 + Math.round(enemy.def.size * 4), enemy.def.color, 1.4, 0.05);
        fx.burst('smoke', enemy.x, enemy.y, z, 4, '#ffffff', 0.6, 0.12, 0.7);
        if (gold > 0) {
          fx.label(enemy.x, enemy.y, z + 0.4, `+${gold}`, '#ffd84a', 0.9, 0.9);
          fx.emit('coin', enemy.x, enemy.y, z, { vz: 2.5, max: 0.7, size: 0.06, color: '#ffd84a' });
        }
        if (enemy.def.boss) {
          fx.shake = 1;
          fx.ring(enemy.x, enemy.y, 0.02, 0.2, 2.5, '#ffd84a', 0.8, 0.08);
          fx.burst('glow', enemy.x, enemy.y, z, 30, '#ffd84a', 3, 0.08, 1.2);
        }
      }),
      ev.on('leak', ({ enemy }) => {
        this.castleHit = 1;
        if (this.view.shakeEnabled) fx.shake = Math.max(fx.shake, enemy.def.boss ? 1 : 0.35);
        fx.burst('debris', enemy.x, enemy.y, 0.4, 8, '#c9b7a0', 1.5, 0.06);
      }),
      ev.on('explosion', ({ x, y, radius, color, style }) => {
        if (style === 'poison') {
          fx.ring(x, y, 0.02, 0.1, radius, color, 0.5, 0.05, true);
          fx.burst('bubble', x, y, 0.2, 8, color, 0.8, 0.07, 0.9);
        } else {
          const small = style === 'small';
          fx.ring(x, y, 0.02, 0.1, radius, small ? '#ffcf6a' : '#ffb347', small ? 0.3 : 0.45, 0.06, true);
          fx.burst('flame', x, y, 0.15, small ? 5 : 10, '#ff8a3d', small ? 1.2 : 2, small ? 0.08 : 0.12, 0.45);
          fx.burst('smoke', x, y, 0.2, small ? 2 : 6, '#ffffff', 0.8, 0.14, 0.9);
          fx.burst('debris', x, y, 0.05, small ? 2 : 5, '#8a7a6a', 1.8, 0.04);
          if (!small && radius > 1.2 && this.view.shakeEnabled) fx.shake = Math.max(fx.shake, 0.25);
        }
      }),
      ev.on('chain', ({ points, color }) => fx.bolt(points, color)),
      ev.on('pulse', ({ x, y, radius, color }) => fx.ring(x, y, 0.03, 0.2, radius, color, 0.5, 0.05, true)),
      ev.on('strike', ({ x, y, radius, style }) => {
        if (style === 'meteor' || style === 'spellMeteor') {
          fx.ring(x, y, 0.02, 0.2, radius * 1.2, '#ff7a2b', 0.6, 0.1, true);
          fx.burst('flame', x, y, 0.2, 22, '#ff7a2b', 2.6, 0.16, 0.6);
          fx.burst('debris', x, y, 0.1, 10, '#5a3a2a', 2.6, 0.07);
          fx.burst('smoke', x, y, 0.3, 10, '#ffffff', 1.2, 0.18, 1.1);
          if (this.view.shakeEnabled) fx.shake = Math.max(fx.shake, 0.5);
        } else if (style === 'thunder') {
          fx.bolt(
            [
              { x, y, z: 4 },
              { x: x + 0.1, y, z: 2 },
              { x, y, z: 0 },
            ],
            '#ffe066',
            0.3,
            0.08,
          );
          fx.ring(x, y, 0.02, 0.1, radius, '#ffe066', 0.4, 0.07, true);
          fx.burst('spark', x, y, 0.2, 14, '#fff3a0', 2.4, 0.05, 0.4);
        } else {
          fx.ring(x, y, 0.02, 0.1, radius, '#fff2b0', 0.5, 0.08, true);
          fx.burst('glow', x, y, 0.3, 14, '#fff6c8', 1.6, 0.07, 0.7);
        }
      }),
      ev.on('heal', ({ x, y }) => fx.burst('glow', x, y, 0.5, 4, '#7dffa0', 0.6, 0.05, 0.6)),
      ev.on('shieldBreak', ({ x, y }) => {
        fx.burst('spark', x, y, 0.6, 10, '#9fd8ff', 2, 0.05, 0.4);
        fx.ring(x, y, 0.5, 0.2, 0.6, '#9fd8ff', 0.3, 0.05);
      }),
      ev.on('gold', ({ x, y, amount }) => {
        fx.label(x, y, 1, `+${amount}`, '#ffd84a', 1.1);
        fx.burst('coin', x, y, 0.6, 4, '#ffd84a', 1, 0.06, 0.8);
      }),
      ev.on('build', ({ tower }) => {
        fx.burst('smoke', tower.x, tower.y, GRASS_H, 10, '#ffffff', 1.2, 0.12, 0.7);
        fx.ring(tower.x, tower.y, GRASS_H + 0.01, 0.2, 0.7, '#ffffff', 0.4, 0.05);
      }),
      ev.on('upgrade', ({ tower }) => {
        const v = tower.branch >= 0 ? tower.def.branches[tower.branch].visual : tower.def.visual;
        fx.burst('glow', tower.x, tower.y, 0.6, 18, v.fx, 1.6, 0.06, 0.8);
        fx.ring(tower.x, tower.y, GRASS_H + 0.01, 0.2, 0.9, v.fx, 0.5, 0.06);
      }),
      ev.on('sell', ({ tower }) => {
        fx.burst('debris', tower.x, tower.y, 0.4, 12, tower.def.visual.body, 1.6, 0.06);
        fx.burst('smoke', tower.x, tower.y, 0.3, 8, '#ffffff', 1, 0.14, 0.8);
      }),
      ev.on('spell', ({ id, x, y }) => {
        if (id === 'frostNova') {
          fx.burst('snow', x, y, 0.3, 40, '#e8f8ff', 2.4, 0.05, 1);
          fx.ring(x, y, 0.03, 0.2, SPELLS.frostNova.radius, '#bfe8ff', 0.7, 0.1, true);
        } else if (id === 'blessing') {
          for (const t of this.game.towers) fx.burst('glow', t.x, t.y, 1, 6, '#ffe066', 1, 0.06, 1);
        }
      }),
      ev.on('fire', ({ tower }) => {
        const kind = effectiveAttack(tower.def, tower.branch);
        if (tower.def.id === 'cannon' && kind !== 'cone') {
          fx.burst('smoke', tower.x + Math.cos(tower.angle) * 0.4, tower.y + Math.sin(tower.angle) * 0.4, 0.8, 3, '#ffffff', 0.5, 0.1, 0.6);
        } else if (kind === 'cone' && tower.def.id === 'cannon') {
          for (let i = 0; i < 6; i++) {
            const a = tower.angle + (Math.random() - 0.5) * ((tower.stats.coneAngle * Math.PI) / 180) * 2;
            const sp = 6 + Math.random() * 3;
            fx.emit('spark', tower.x, tower.y, 0.75, {
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              max: tower.stats.range / sp,
              size: 0.035,
              color: '#ffd27a',
            });
          }
        }
      }),
    );
  }

  // ------------------------------------------------------------ frame

  /** Rebuilds cached bitmaps when the zoom settled on a new scale. */
  private ensureCaches(): void {
    const scale = this.cam.scale;
    const stale = this.cacheScale === 0 || this.cacheDpr !== this.dpr || Math.abs(scale / this.cacheScale - 1) > 0.004;
    // While the user is actively zooming keep scaling the old bitmaps.
    if (!stale || (this.cacheScale !== 0 && this.time - this.zoomChangedAt < 0.18 && this.cacheDpr === this.dpr)) return;
    this.cacheScale = scale;
    this.cacheDpr = this.dpr;
    this.ground.build(scale, this.dpr);
    this.towerSprites.clear();
    this.castleSprite = null;
  }

  render(dt: number): void {
    this.time += dt;
    this.fx.update(dt);
    this.castleHit = Math.max(0, this.castleHit - dt * 2);
    this.spawnContinuousFx(dt);
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.paintBackground) this.drawBackground();
    else ctx.clearRect(0, 0, this.width, this.height);
    this.ensureCaches();

    // Screen shake
    if (this.fx.shake > 0 && this.view.shakeEnabled) {
      const m = this.fx.shake * this.fx.shake * 7;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    this.ground.draw(ctx, this.cam);
    this.drawDynamicGround();
    this.drawGroundOverlays();
    const list = this.buildDrawables();
    list.sort((a, b) => a.depth - b.depth);
    for (const d of list) d.draw();

    this.drawOverlays();
    this.fx.drawWorld(this.painter);
    this.drawHealthBars();
    this.fx.drawTexts(this.painter, UI_FONT);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, this.theme.bgTop);
    g.addColorStop(1, this.theme.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /** Animated ground layers (water ripples, rifts). */
  private drawDynamicGround(): void {
    const b = this.game.board;
    const p = this.painter;
    for (const row of b.tiles)
      for (const t of row) {
        if (t.kind !== 'water') continue;
        for (let i = 0; i < 2; i++) {
          const ph = (this.time * 0.4 + t.seed + i * 0.5) % 1;
          p.ring(
            t.x + 0.3 + i * 0.4,
            t.y + 0.35 + i * 0.3,
            -0.015,
            0.05 + ph * 0.2,
            `rgba(255,255,255,${0.45 * (1 - ph)})`,
            Math.max(1, this.cam.scale * 0.015),
          );
        }
      }
    for (const r of this.game.rifts) {
      const k = r.time / r.total;
      p.disc(r.x, r.y, 0.01, r.radius * (0.6 + 0.4 * Math.min(1, (1 - k) * 4)), rgba('#2a1650', 0.55 * Math.min(1, k * 3)), false);
      for (let i = 0; i < 3; i++)
        p.ring(
          r.x,
          r.y,
          0.015,
          r.radius * (((this.time * 0.8 + i / 3) % 1) * 0.9 + 0.1),
          rgba('#a68cff', 0.7 * k),
          Math.max(1, this.cam.scale * 0.03),
        );
    }
  }

  private buildDrawables(): Drawable[] {
    const out: Drawable[] = [];
    const g = this.game;
    const b = g.board;
    const k = this.cam.scale / this.cacheScale;
    for (const d of this.ground.decor) {
      const pos = this.cam.project(d.x, d.y, GRASS_H);
      out.push({ depth: depthOf(d.x, d.y), draw: () => drawSprite(this.ctx, d.sprite, pos.x, pos.y, k) });
    }
    out.push({ depth: depthOf(b.castle.x + 0.5, b.castle.y + 0.5), draw: () => this.drawCastle() });
    out.push({ depth: depthOf(b.spawn.x + 0.5, b.spawn.y + 0.5), draw: () => this.drawPortal() });
    for (const t of g.towers) out.push({ depth: depthOf(t.x, t.y), draw: () => this.drawTower(t) });
    for (const e of g.enemies) if (e.alive) out.push({ depth: depthOf(e.x, e.y) + 0.01, draw: () => this.drawEnemy(e) });
    for (const pr of g.projectiles) out.push({ depth: depthOf(pr.x, pr.y) + 0.02, draw: () => this.drawProjectile(pr) });
    for (const s of g.strikes) out.push({ depth: depthOf(s.x, s.y) + 0.03, draw: () => this.drawPendingStrike(s) });
    return out;
  }

  // ------------------------------------------------------------ entities

  private drawTower(t: Tower): void {
    const p = this.painter;
    const ctx = this.ctx;
    const anim = Math.min(1, t.buildAnim / 0.35);
    const scale = anim < 1 ? 0.6 + 0.4 * easeOutBack(anim) : 1;
    const base = this.cam.project(t.x, t.y, GRASS_H);
    if (this.view.selected === t) {
      p.disc(t.x, t.y, GRASS_H + 0.005, 0.5, 'rgba(255,240,180,0.35)', false);
    }
    if (scale !== 1) {
      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.scale(scale, scale);
      ctx.translate(-base.x, -base.y);
    }
    const kind = effectiveAttack(t.def, t.branch);
    const look = {
      id: t.def.id,
      tier: t.tier,
      branch: t.branch,
      angle: t.angle,
      fireAnim: t.fireAnim,
      time: this.time + t.uid,
      active: t.coneTime > 0 || !!t.beamTarget,
    };
    drawSprite(ctx, this.towerSprite(t.def.id, t.tier, t.branch), base.x, base.y, this.cam.scale / this.cacheScale);
    drawTowerModel(p, { ...look, layer: 'dynamic' }, t.x, t.y, GRASS_H);
    if (scale !== 1) ctx.restore();

    // Beam
    if (kind === 'beam' && t.beamTarget && t.beamTarget.alive) {
      const e = t.beamTarget;
      const ramp = Math.min(1, (t.beamTime * (t.stats.beamRamp || 1)) / Math.max(1, t.stats.beamRampMax));
      const top = this.cam.project(t.x, t.y, GRASS_H + 0.75 + t.tier * 0.06 + 0.32);
      const tgt = this.cam.project(e.x, e.y, enemyHeight(e.def));
      const w = this.cam.scale * (0.04 + ramp * 0.08);
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba('#ff6a2b', 0.35);
      ctx.lineWidth = w * 3;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();
      ctx.strokeStyle = ramp > 0.6 ? '#fff1a8' : '#ffb347';
      ctx.lineWidth = w;
      ctx.stroke();
    }
    // Pulse auras for blizzard / static field
    if (kind === 'pulse') {
      const v = t.branch >= 0 ? t.def.branches[t.branch].visual : t.def.visual;
      const k = (this.time * 0.7 + t.uid * 0.37) % 1;
      p.ring(t.x, t.y, GRASS_H + 0.01, t.stats.range * k, rgba(v.fx, 0.35 * (1 - k)), Math.max(1, this.cam.scale * 0.03));
    }
  }

  private towerSprite(id: TowerId, tier: number, branch: number): Sprite {
    const key = `${id}:${tier}:${branch}`;
    let s = this.towerSprites.get(key);
    if (!s) {
      s = makeSprite(this.cacheScale, this.dpr, this.cam.rows, 1.7, 3.1, 0.45, 0.84, { x: 0.5, y: 0.5, z: GRASS_H }, (sp) =>
        drawTowerModel(sp, { id, tier, branch, angle: 0, fireAnim: 1, time: 0, layer: 'static' }, 0.5, 0.5, GRASS_H),
      );
      this.towerSprites.set(key, s);
    }
    return s;
  }

  private drawEnemy(e: Enemy): void {
    const p = this.painter;
    const spawnFade = Math.min(1, e.age / 0.35);
    if (spawnFade < 1) this.ctx.globalAlpha = spawnFade;
    drawEnemyModel(p, {
      def: e.def,
      x: e.x,
      y: e.y,
      angle: e.angle,
      walk: e.walk,
      age: e.age,
      hitFlash: e.hitFlash,
      shield: e.shield,
      frozen: e.freezeTime > 0,
      slowed: e.slowTime > 0 && e.slow > 0,
      stunned: e.stunTime > 0,
      burning: e.burnTime > 0,
      poisoned: e.poison.length > 0,
      vulnerable: e.vulnTime > 0,
      time: this.time,
    });
    this.ctx.globalAlpha = 1;
  }

  private spawnContinuousFx(dt: number): void {
    const fx = this.fx;
    for (const e of this.game.enemies) {
      if (!e.alive) continue;
      const z = enemyHeight(e.def);
      if (e.burnTime > 0 && Math.random() < dt * 14)
        fx.emit('flame', e.x + (Math.random() - 0.5) * 0.2, e.y, z * 0.8, { vz: 0.8, max: 0.45, size: 0.07, color: '#ff8a3d' });
      if (e.poison.length && Math.random() < dt * 6)
        fx.emit('bubble', e.x + (Math.random() - 0.5) * 0.25, e.y, z, { vz: 0.5, max: 0.8, size: 0.04, color: '#9be15d' });
    }
    for (const t of this.game.towers) {
      if (t.coneTime > 0 && effectiveAttack(t.def, t.branch) === 'cone' && t.def.id === 'pyre') {
        const half = ((t.stats.coneAngle || 25) * Math.PI) / 180;
        for (let i = 0; i < 3; i++) {
          const a = t.angle + (Math.random() - 0.5) * half * 1.6;
          const sp = 3.2 + Math.random() * 1.5;
          fx.emit('flame', t.x + Math.cos(t.angle) * 0.2, t.y + Math.sin(t.angle) * 0.2, 0.7, {
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            vz: -0.4,
            gravity: 0,
            max: (t.stats.range / sp) * 0.95,
            size: 0.09,
            color: t.branch === 1 ? '#ffb347' : '#ff7a2b',
          });
        }
      }
      if (t.def.id === 'frost' && t.branch === 1 && Math.random() < dt * 8) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * t.stats.range;
        fx.emit('snow', t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, 0.8, { vx: 0.3, vz: -0.4, max: 1.4, size: 0.03, color: '#ffffff', gravity: 0 });
      }
    }
    // Ambient: drifting leaves / snow
    const theme = this.game.board.def.theme;
    if (Math.random() < dt * (theme === 'snow' ? 10 : theme === 'autumn' ? 3 : 0)) {
      const b = this.game.board;
      fx.emit(theme === 'snow' ? 'snow' : 'leaf', Math.random() * b.width, Math.random() * b.height, 2.5, {
        vx: 0.4,
        vy: 0.1,
        vz: -0.5,
        gravity: 0,
        max: 5,
        size: 0.03,
        color: theme === 'snow' ? '#ffffff' : this.theme.leaves[Math.floor(Math.random() * 3)],
      });
    }
  }

  private drawProjectile(pr: Projectile): void {
    const p = this.painter;
    const ctx = this.ctx;
    const s = this.cam.scale;
    const a = Math.atan2(pr.vy || pr.ty - pr.sy, pr.vx || pr.tx - pr.sx);
    const x = pr.x;
    const y = pr.y;
    const z = pr.z;
    switch (pr.style) {
      case 'arrow':
      case 'runeArrow':
      case 'bolt':
      case 'harpoon':
      case 'icicle': {
        const len = pr.style === 'arrow' || pr.style === 'runeArrow' ? 0.22 : 0.34;
        const col = pr.style === 'arrow' ? '#6e4a33' : pr.style === 'icicle' ? '#cdefff' : pr.style === 'runeArrow' ? pr.color : '#5a5f6a';
        p.shadow(x, y, 0.001, 0.05, 0.15);
        p.line([x - Math.cos(a) * len, y - Math.sin(a) * len, z], [x, y, z], col, pr.style === 'bolt' || pr.style === 'harpoon' ? 0.035 : 0.022);
        if (pr.style === 'runeArrow' || pr.style === 'icicle') p.sphere(x, y, z, 0.035, pr.color, 0.6);
        break;
      }
      case 'ball':
      case 'bomb':
        p.shadow(x, y, 0.001, 0.07, 0.2);
        p.sphere(x, y, z, pr.style === 'bomb' ? 0.05 : 0.08, '#3a3a44');
        break;
      case 'flask':
        p.shadow(x, y, 0.001, 0.06, 0.2);
        p.sphere(x, y, z, 0.07, pr.color, 0.2);
        ctx.fillStyle = '#c9b38a';
        ctx.fillRect(p.cam.px(x, y) - s * 0.015, p.cam.py(y, z + 0.1), s * 0.03, s * 0.05);
        break;
      case 'voidOrb':
        p.shadow(x, y, 0.001, pr.splash * 0.6, 0.2);
        p.sphere(x, y, z, Math.max(0.12, pr.splash * 0.4), pr.color, 1);
        p.sphere(x, y, z, Math.max(0.06, pr.splash * 0.2), '#140a28');
        break;
      default:
        p.sphere(x, y, z, 0.06, pr.color, 0.8);
    }
  }

  private drawPendingStrike(s: { x: number; y: number; delay: number; total: number; radius: number; style: string }): void {
    const p = this.painter;
    const k = 1 - s.delay / s.total;
    // Target marker
    p.ring(
      s.x,
      s.y,
      0.02,
      s.radius * (0.4 + 0.6 * k),
      rgba(s.style === 'smite' ? '#fff2b0' : s.style === 'thunder' ? '#ffe066' : '#ff7a2b', 0.5 + 0.4 * k),
      Math.max(1, this.cam.scale * 0.03),
      [6, 5],
    );
    if (s.style === 'meteor' || s.style === 'spellMeteor') {
      const h = (1 - k) * 5;
      const ox = (1 - k) * 2.2;
      p.sphere(s.x - ox, s.y - ox * 0.3, h, 0.18, '#ff7a2b', 1.2);
      p.sphere(s.x - ox, s.y - ox * 0.3, h, 0.12, '#5a2a2a');
      if (Math.random() < 0.6) this.fx.emit('flame', s.x - ox, s.y - ox * 0.3, h, { max: 0.4, size: 0.12, color: '#ff8a3d', gravity: 0 });
    } else if (s.style === 'smite') {
      const ctx = this.ctx;
      const top = this.cam.project(s.x, s.y, 5);
      const bot = this.cam.project(s.x, s.y, 0);
      const w = this.cam.scale * 0.25 * k;
      const g = ctx.createLinearGradient(top.x, top.y, bot.x, bot.y);
      g.addColorStop(0, 'rgba(255,242,176,0)');
      g.addColorStop(1, `rgba(255,242,176,${0.6 * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(bot.x - w / 2, top.y, w, bot.y - top.y);
    }
  }

  private drawCastle(): void {
    const b = this.game.board;
    const cx = b.castle.x + 0.5;
    const cy = b.castle.y + 0.5;
    if (!this.castleSprite) {
      this.castleSprite = makeSprite(this.cacheScale, this.dpr, this.cam.rows, 2.2, 2.6, 0.45, 0.78, { x: cx, y: cy, z: 0 }, (sp) =>
        drawCastleModel(sp, cx, cy),
      );
    }
    const pos = this.cam.project(cx, cy, 0);
    const ctx = this.ctx;
    if (this.castleHit > 0) {
      ctx.save();
      ctx.filter = `brightness(${1 - this.castleHit * 0.35}) sepia(${this.castleHit * 0.6})`;
    }
    drawSprite(ctx, this.castleSprite, pos.x, pos.y, this.cam.scale / this.cacheScale);
    if (this.castleHit > 0) ctx.restore();
    this.painter.flag(cx, cy - 0.05, 1.3, 0.3, 0.17, '#e0544a', this.time * 3);
  }

  private drawPortal(): void {
    const p = this.painter;
    const ctx = this.ctx;
    const b = this.game.board;
    const cx = b.spawn.x + 0.5;
    const cy = b.spawn.y + 0.5;
    const start = b.path[0];
    const next = b.path[1];
    const dir = Math.atan2(next.y - start.y, next.x - start.x);
    // Portal plane is perpendicular to the path direction.
    const nx = -Math.sin(dir);
    const ny = Math.cos(dir);
    const r = 0.38;
    const pillar = '#8f86a8';
    p.cylinder(cx + nx * 0.45, cy + ny * 0.45, 0, 0.08, 0.95, pillar);
    // Swirl
    const pts: [number, number][] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const s = this.cam.project(cx + nx * Math.cos(a) * r, cy + ny * Math.cos(a) * r, 0.5 + Math.sin(a) * r * 1.05);
      pts.push([s.x, s.y]);
    }
    const c = this.cam.project(cx, cy, 0.5);
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, r * this.cam.scale * 1.2);
    g.addColorStop(0, '#f2d6ff');
    g.addColorStop(0.4, '#9a6bff');
    g.addColorStop(1, '#3b1f7a');
    ctx.fillStyle = g;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1, this.cam.scale * 0.025);
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const a = t * Math.PI * 3 + this.time * 3;
      const rr = r * 0.9 * (1 - t);
      const s = this.cam.project(cx + nx * Math.cos(a) * rr, cy + ny * Math.cos(a) * rr, 0.5 + Math.sin(a) * rr);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
    p.cylinder(cx - nx * 0.45, cy - ny * 0.45, 0, 0.08, 0.95, pillar);
    if (Math.random() < 0.3)
      this.fx.emit('glow', cx + (Math.random() - 0.5) * 0.4 * nx, cy + (Math.random() - 0.5) * 0.4 * ny, 0.3 + Math.random() * 0.5, {
        vz: 0.4,
        max: 0.9,
        size: 0.035,
        color: '#c9a6ff',
      });
  }

  // ------------------------------------------------------------ overlays

  /** Range indicators drawn on the ground, below towers and enemies. */
  private drawGroundOverlays(): void {
    const p = this.painter;
    const v = this.view;
    const g = this.game;
    const sel = v.selected;
    if (sel && g.towers.includes(sel)) {
      const s = g.liveStats(sel);
      p.disc(sel.x, sel.y, GRASS_H + 0.01, s.range, 'rgba(255,255,255,0.10)', false);
      p.ring(sel.x, sel.y, GRASS_H + 0.01, s.range, 'rgba(255,255,255,0.85)', Math.max(1.5, this.cam.scale * 0.03), [8, 6]);
      if (s.minRange > 0) p.ring(sel.x, sel.y, GRASS_H + 0.01, s.minRange, 'rgba(255,120,100,0.7)', 1.5, [4, 4]);
      if (s.auraDamage || s.auraRate || s.auraRange) {
        for (const t of g.towers) {
          if (t !== sel && Math.hypot(t.x - sel.x, t.y - sel.y) <= s.range) p.ring(t.x, t.y, GRASS_H + 0.02, 0.42, 'rgba(255,230,120,0.9)', 2);
        }
      }
    }
    if (v.ghost) {
      const { id, x, y, valid } = v.ghost;
      const cx = x + 0.5;
      const cy = y + 0.5;
      const stats = g.previewStats(id, 1, -1);
      p.disc(cx, cy, GRASS_H + 0.01, stats.range, valid ? 'rgba(255,255,255,0.12)' : 'rgba(255,90,90,0.12)', false);
      p.ring(cx, cy, GRASS_H + 0.01, stats.range, valid ? 'rgba(255,255,255,0.8)' : 'rgba(255,110,110,0.8)', 1.5, [8, 6]);
      p.flat(
        [
          [x, y],
          [x + 1, y],
          [x + 1, y + 1],
          [x, y + 1],
        ],
        GRASS_H + 0.005,
        valid ? 'rgba(255,255,255,0.35)' : 'rgba(255,80,80,0.35)',
      );
    } else if (v.hover && !v.spell) {
      const { x, y } = v.hover;
      if (g.board.isBuildable(x, y) && !g.towerAt(x, y)) {
        p.flat(
          [
            [x, y],
            [x + 1, y],
            [x + 1, y + 1],
            [x, y + 1],
          ],
          GRASS_H + 0.005,
          'rgba(255,255,255,0.22)',
        );
      }
    }
    if (v.spell) {
      const def = SPELLS[v.spell.id];
      p.disc(v.spell.x, v.spell.y, 0.03, def.radius, rgba(def.color, 0.18), false);
      p.ring(v.spell.x, v.spell.y, 0.03, def.radius, rgba(def.color, 0.9), 2, [6, 4]);
    }
  }

  /** Overlays drawn above the scene (placement ghost). */
  private drawOverlays(): void {
    const ghost = this.view.ghost;
    if (!ghost) return;
    const pos = this.cam.project(ghost.x + 0.5, ghost.y + 0.5, GRASS_H);
    this.ctx.globalAlpha = ghost.valid ? 0.7 : 0.4;
    drawSprite(this.ctx, this.towerSprite(ghost.id, 1, -1), pos.x, pos.y, this.cam.scale / this.cacheScale);
    this.ctx.globalAlpha = 1;
  }

  private drawHealthBars(): void {
    const ctx = this.ctx;
    const s = this.cam.scale;
    for (const e of this.game.enemies) {
      if (!e.alive) continue;
      const total = e.maxHp + e.maxArmor + e.maxShield;
      const damaged = e.totalHp < total - 0.5;
      if (!damaged && !e.def.boss && e.maxArmor === 0 && e.maxShield === 0) continue;
      const pos = this.cam.project(e.x, e.y, enemyHeight(e.def) + 0.35 * Math.max(1, e.def.size));
      const w = s * (e.def.boss ? 1.1 : 0.55);
      const h = Math.max(3, s * (e.def.boss ? 0.09 : 0.065));
      const x = pos.x - w / 2;
      const y = pos.y;
      ctx.fillStyle = 'rgba(25,20,45,0.75)';
      roundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, h / 2 + 1.5);
      ctx.fill();
      let cursor = x;
      const seg = (val: number, color: string) => {
        const ww = (val / total) * w;
        if (ww <= 0.2) return;
        ctx.fillStyle = color;
        ctx.fillRect(cursor, y, ww, h);
        cursor += ww;
      };
      seg(Math.max(0, e.hp), e.hp / e.maxHp > 0.35 ? '#e5484d' : '#ff7a59');
      seg(Math.max(0, e.armor), '#c3c8d4');
      seg(Math.max(0, e.shield), '#58b7ff');
      if (e.def.boss) {
        ctx.font = `700 ${Math.max(10, s * 0.2)}px ${UI_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff3c4';
        ctx.strokeStyle = 'rgba(30,22,50,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeText(ENEMIES[e.def.id].name, pos.x, y - h);
        ctx.fillText(ENEMIES[e.def.id].name, pos.x, y - h);
      }
    }
  }
}

/** Static part of the castle (flag is animated separately). */
function drawCastleModel(p: Painter, cx: number, cy: number): void {
  const wall = '#d7d0c4';
  p.shadow(cx, cy, 0.001, 0.75, 0.25);
  p.cbox(cx, cy, 0, 0.95, 0.9, 0.12, '#b9b0a2');
  // Keep
  p.cbox(cx, cy - 0.05, 0.12, 0.62, 0.55, 0.62, wall);
  crenelRow(p, cx - 0.31, cy - 0.33, 0.74, 0.62, 0.55, shade(wall, 0.05));
  // Corner towers
  for (const [dx, dy] of [
    [-0.36, -0.32],
    [0.36, -0.32],
    [-0.36, 0.3],
    [0.36, 0.3],
  ]) {
    p.cylinder(cx + dx, cy + dy, 0.12, 0.14, 0.78, wall);
    p.cone(cx + dx, cy + dy, 0.9, 0.17, 0.32, '#5a6fc4');
  }
  // Gate
  p.box(cx - 0.1, cy + 0.225, 0.12, 0.2, 0.005, 0.26, '#6e4a33', null, false);
  // Flag pole
  p.cylinder(cx, cy - 0.05, 0.86, 0.015, 0.45, '#6e4a33');
}

function crenelRow(p: Painter, x: number, y: number, z: number, w: number, d: number, color: string): void {
  const n = 4;
  for (let i = 0; i < n; i++) p.box(x + (i / n) * w + 0.02, y, z, w / n - 0.06, 0.07, 0.07, color);
  for (let i = 0; i < n; i++) p.box(x + (i / n) * w + 0.02, y + d - 0.07, z, w / n - 0.06, 0.07, 0.07, color);
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export { TOWERS };
