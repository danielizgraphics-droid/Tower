import { DAMAGE_TYPES } from '../data/damage';
import type { DamageType } from '../data/types';
import { formatNumber } from '../engine/math';
import { rgba, shade } from './color';
import type { Painter } from './painter';

export type ParticleKind = 'spark' | 'smoke' | 'flame' | 'debris' | 'coin' | 'snow' | 'glow' | 'bubble' | 'leaf';

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
}

interface Ring {
  x: number;
  y: number;
  z: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: string;
  width: number;
  fill: boolean;
}

interface Bolt {
  points: { x: number; y: number; z: number }[];
  life: number;
  max: number;
  color: string;
  width: number;
  /** Pre-jittered screen-independent offsets. */
  jitter: number[];
}

interface FloatText {
  x: number;
  y: number;
  z: number;
  text: string;
  amount: number;
  color: string;
  life: number;
  max: number;
  size: number;
  type?: DamageType;
  born: number;
}

const MAX_PARTICLES = 900;

/** Purely visual effects: particles, rings, lightning, floating numbers. */
export class Fx {
  particles: Particle[] = [];
  rings: Ring[] = [];
  bolts: Bolt[] = [];
  texts: FloatText[] = [];
  shake = 0;
  private clock = 0;

  emit(kind: ParticleKind, x: number, y: number, z: number, opts: Partial<Particle> = {}): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({
      kind,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      max: 0.6,
      size: 0.05,
      color: '#ffffff',
      gravity: kind === 'debris' || kind === 'coin' ? -6 : kind === 'smoke' || kind === 'flame' || kind === 'bubble' ? 0.8 : 0,
      ...opts,
    });
  }

  burst(kind: ParticleKind, x: number, y: number, z: number, n: number, color: string, speed = 1.5, size = 0.05, life = 0.6): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.emit(kind, x, y, z, {
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: kind === 'debris' || kind === 'coin' ? 2 + Math.random() * 2 : Math.random() * speed,
        max: life * (0.6 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8),
        color,
      });
    }
  }

  ring(x: number, y: number, z: number, r0: number, r1: number, color: string, life = 0.4, width = 0.05, fill = false): void {
    this.rings.push({ x, y, z, r0, r1, life: 0, max: life, color, width, fill });
  }

  bolt(points: { x: number; y: number; z: number }[], color: string, life = 0.22, width = 0.04): void {
    const jitter: number[] = [];
    for (let i = 0; i < points.length * 6; i++) jitter.push((Math.random() - 0.5) * 0.18);
    this.bolts.push({ points, life: 0, max: life, color, width, jitter });
  }

  damage(x: number, y: number, z: number, amount: number, crit: boolean, type: DamageType): void {
    // Merge with a recent number nearby so DoT ticks and multi-hits stay readable.
    for (const t of this.texts) {
      if (t.type === type && this.clock - t.born < 0.25 && Math.abs(t.x - x) < 0.35 && Math.abs(t.y - y) < 0.35 && t.color !== '#ffd84a') {
        t.amount += amount;
        t.text = formatNumber(t.amount);
        t.life = Math.min(t.life, 0.1);
        if (crit) t.size = Math.max(t.size, 1.35);
        return;
      }
    }
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({
      x: x + (Math.random() - 0.5) * 0.2,
      y,
      z: z + 0.5,
      text: formatNumber(amount),
      amount,
      color: crit ? '#ffef6b' : shade(DAMAGE_TYPES[type].color, 0.25),
      life: 0,
      max: 0.8,
      size: crit ? 1.35 : 1,
      type,
      born: this.clock,
    });
  }

  label(x: number, y: number, z: number, text: string, color: string, size = 1.1, life = 1.1): void {
    this.texts.push({ x, y, z, text, amount: 0, color, life: 0, max: life, size, born: this.clock });
  }

  update(dt: number): void {
    this.clock += dt;
    this.shake = Math.max(0, this.shake - dt * 3);
    for (const p of this.particles) {
      p.life += dt;
      p.vz += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.kind !== 'snow' && p.kind !== 'leaf') {
        p.vx *= 1 - dt * 2;
        p.vy *= 1 - dt * 2;
      }
      if ((p.kind === 'debris' || p.kind === 'coin') && p.z < 0) {
        p.z = 0;
        p.vz *= -0.35;
        p.vx *= 0.5;
        p.vy *= 0.5;
      }
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const r of this.rings) r.life += dt;
    this.rings = this.rings.filter((r) => r.life < r.max);
    for (const b of this.bolts) b.life += dt;
    this.bolts = this.bolts.filter((b) => b.life < b.max);
    for (const t of this.texts) {
      t.life += dt;
      t.z += dt * 0.6;
    }
    this.texts = this.texts.filter((t) => t.life < t.max);
  }

  /** Ground-level and world effects (drawn after the scene). */
  drawWorld(p: Painter): void {
    const ctx = p.ctx;
    const s = p.cam.scale;
    for (const r of this.rings) {
      const t = r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - t) ** 3);
      if (r.fill) p.disc(r.x, r.y, r.z, rad, rgba(r.color, 0.35 * (1 - t)), false);
      p.ring(r.x, r.y, r.z, rad, rgba(r.color, 0.85 * (1 - t)), Math.max(1, r.width * s * (1 - t * 0.5)));
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const b of this.bolts) {
      const t = b.life / b.max;
      const pts: [number, number][] = [];
      for (let i = 0; i < b.points.length - 1; i++) {
        const a = b.points[i];
        const c = b.points[i + 1];
        const n = 5;
        for (let k = 0; k < n; k++) {
          const u = k / n;
          const j = k === 0 ? 0 : b.jitter[(i * 6 + k) % b.jitter.length];
          pts.push([
            p.cam.px(a.x + (c.x - a.x) * u, a.y + (c.y - a.y) * u) + j * s,
            p.cam.py(a.y + (c.y - a.y) * u, a.z + (c.z - a.z) * u) + j * s * 0.7,
          ]);
        }
      }
      const last = b.points[b.points.length - 1];
      pts.push([p.cam.px(last.x, last.y), p.cam.py(last.y, last.z)]);
      for (const [w, col] of [
        [b.width * 3, rgba(b.color, 0.25 * (1 - t))],
        [b.width, rgba('#ffffff', 1 - t)],
      ] as const) {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1, w * s);
        ctx.stroke();
      }
    }
    for (const pt of this.particles) {
      const t = pt.life / pt.max;
      const x = p.cam.px(pt.x, pt.y);
      const y = p.cam.py(pt.y, pt.z);
      let r = pt.size * s;
      let alpha = 1 - t;
      let color = pt.color;
      switch (pt.kind) {
        case 'smoke':
          r *= 1 + t * 2;
          alpha = 0.35 * (1 - t);
          break;
        case 'flame':
          r *= 1.2 - t * 0.8;
          color = t < 0.3 ? '#fff1a8' : t < 0.6 ? pt.color : '#c43d24';
          alpha = 0.9 * (1 - t);
          break;
        case 'glow':
          alpha = 0.8 * (1 - t);
          break;
        case 'coin':
          alpha = t > 0.8 ? (1 - t) * 5 : 1;
          break;
      }
      if (r < 0.3 || alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      if (pt.kind === 'debris') ctx.rect(x - r, y - r, r * 2, r * 2);
      else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(p: Painter, font: string): void {
    const ctx = p.ctx;
    const s = p.cam.scale;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k < 0.15 ? 0.7 + (k / 0.15) * 0.5 : k < 0.3 ? 1.2 - ((k - 0.15) / 0.15) * 0.2 : 1;
      const size = Math.max(9, s * 0.24 * t.size * pop);
      ctx.font = `700 ${size}px ${font}`;
      const x = p.cam.px(t.x, t.y);
      const y = p.cam.py(t.y, t.z);
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.lineWidth = Math.max(2, size * 0.22);
      ctx.strokeStyle = 'rgba(30,22,50,0.75)';
      ctx.strokeText(t.text, x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, y);
    }
    ctx.globalAlpha = 1;
  }
}
