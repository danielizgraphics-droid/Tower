// Organic drawing kit for creatures: shaded ellipsoids, tapered limbs, smooth
// membranes and faces, all projected isometrically. Parts are queued on a Rig,
// depth-sorted towards the viewer and drawn in one pass, so limbs on the far
// side of a body end up behind it.

import { rgba, shade } from '../color';
import type { Painter } from '../painter';
import { CIRCLE_RX, ISO_X, ISO_Y, HEIGHT_SCALE, VIEW } from '../projection';

export type V3 = [number, number, number];

/** Screen-space light direction (upper-left). */
const LX = -0.42;
const LY = -0.62;

/** Projected 2D delta of a world vector (pixels). */
function proj(p: Painter, v: V3): [number, number] {
  const S = p.cam.scale;
  return [(v[0] - v[1]) * ISO_X * S, ((v[0] + v[1]) * ISO_Y - v[2] * HEIGHT_SCALE) * S];
}

function scr(p: Painter, v: V3): [number, number] {
  return [p.cam.sx(v[0], v[1]), p.cam.sy(v[0], v[1], v[2])];
}

export interface FillOpts {
  /** 0..1 strength of the specular highlight (wet / metal). */
  shine?: number;
  alpha?: number;
  /** Thin inner contour (defaults on). */
  line?: boolean;
  /** Overrides the shading gradient with a flat color. */
  flat?: boolean;
  /** Emissive: no shading, soft glow around. */
  glow?: number;
}

const INK = 'rgba(34,24,38,0.55)';

function inkLine(p: Painter, alpha = 1): void {
  const ctx = p.ctx;
  ctx.strokeStyle = alpha === 1 ? INK : `rgba(34,24,38,${0.55 * alpha})`;
  ctx.lineWidth = Math.max(0.6, p.cam.scale * 0.011);
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Ellipsoid with world half-axes a, b, c (exact orthographic silhouette). */
export function ellipsoid(p: Painter, c: V3, a: V3, b: V3, w: V3, color: string, o: FillOpts = {}): void {
  if (!p.enabled) return;
  const ctx = p.ctx;
  const [cx, cy] = scr(p, c);
  const u = proj(p, a);
  const v = proj(p, b);
  const t = proj(p, w);
  const A = u[0] * u[0] + v[0] * v[0] + t[0] * t[0];
  const B = u[0] * u[1] + v[0] * v[1] + t[0] * t[1];
  const C = u[1] * u[1] + v[1] * v[1] + t[1] * t[1];
  const mid = (A + C) / 2;
  const dif = Math.sqrt(((A - C) / 2) ** 2 + B * B);
  const r1 = Math.sqrt(Math.max(0.01, mid + dif));
  const r2 = Math.sqrt(Math.max(0.01, mid - dif));
  const th = 0.5 * Math.atan2(2 * B, A - C);
  const prevAlpha = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = prevAlpha * o.alpha;
  if (o.glow) {
    const R = Math.max(r1, r2) * (1.3 + o.glow * 0.35);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, rgba(color, 0.45));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(th);
  ctx.scale(r1, r2);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  if (o.flat || o.glow) ctx.fillStyle = o.glow ? shade(color, 0.25) : color;
  else {
    // Light offset expressed in the unit-circle frame.
    const rm = (r1 + r2) / 2;
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    let lx = ((cs * LX + sn * LY) * rm * 0.55) / r1;
    let ly = ((-sn * LX + cs * LY) * rm * 0.55) / r2;
    const l = Math.hypot(lx, ly);
    if (l > 0.6) {
      lx *= 0.6 / l;
      ly *= 0.6 / l;
    }
    const g = ctx.createRadialGradient(lx, ly, 0.02, 0, 0, 1.08);
    g.addColorStop(0, shade(color, 0.36));
    g.addColorStop(0.32, shade(color, 0.12));
    g.addColorStop(0.72, color);
    g.addColorStop(1, shade(color, -0.34));
    ctx.fillStyle = g;
  }
  ctx.fill();
  ctx.restore();
  if (o.line !== false && !o.glow) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r1, r2, th, 0, Math.PI * 2);
    inkLine(p, 0.7);
  }
  if (o.shine) {
    const R = Math.min(r1, r2);
    ctx.fillStyle = `rgba(255,255,255,${0.55 * o.shine})`;
    ctx.beginPath();
    ctx.ellipse(cx + LX * R * 0.45, cy + LY * R * 0.45, R * 0.22, R * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = prevAlpha;
}

/** Sphere helper. */
export function ball(p: Painter, c: V3, r: number, color: string, o: FillOpts = {}): void {
  ellipsoid(p, c, [r, 0, 0], [0, r, 0], [0, 0, r], color, o);
}

function capsulePath(ctx: CanvasRenderingContext2D, ax: number, ay: number, ra: number, bx: number, by: number, rb: number): void {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  ctx.beginPath();
  if (d < Math.abs(ra - rb) + 0.01) {
    const big = ra > rb ? [ax, ay, ra] : [bx, by, rb];
    ctx.arc(big[0], big[1], big[2], 0, Math.PI * 2);
    return;
  }
  const ang = Math.atan2(dy, dx);
  const off = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / d)));
  ctx.arc(ax, ay, ra, ang + off, ang - off + Math.PI * 2, false);
  ctx.arc(bx, by, rb, ang - off, ang + off, false);
  ctx.closePath();
}

/** Tapered, rounded limb from a (radius ra) to b (radius rb). */
export function limb(p: Painter, a: V3, b: V3, ra: number, rb: number, color: string, o: FillOpts = {}): void {
  if (!p.enabled) return;
  const ctx = p.ctx;
  const k = p.cam.scale * CIRCLE_RX * 0.82;
  const [ax, ay] = scr(p, a);
  const [bx, by] = scr(p, b);
  const Ra = Math.max(0.5, ra * k);
  const Rb = Math.max(0.5, rb * k);
  const prevAlpha = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = prevAlpha * o.alpha;
  if (o.glow) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = Math.max(Ra, Rb) * 3 * o.glow;
    capsulePath(ctx, ax, ay, Ra, bx, by, Rb);
    ctx.fillStyle = shade(color, 0.3);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = prevAlpha;
    return;
  }
  capsulePath(ctx, ax, ay, Ra, bx, by, Rb);
  ctx.fillStyle = o.flat ? color : shade(color, -0.28);
  ctx.fill();
  if (o.line !== false) inkLine(p, 0.7);
  if (!o.flat) {
    // Lit side: the same capsule nudged towards the light and slightly thinner.
    ctx.save();
    capsulePath(ctx, ax, ay, Ra, bx, by, Rb);
    ctx.clip();
    const m = (Ra + Rb) / 2;
    capsulePath(ctx, ax + LX * m * 0.28, ay + LY * m * 0.28, Ra * 0.86, bx + LX * m * 0.28, by + LY * m * 0.28, Rb * 0.86);
    ctx.fillStyle = color;
    ctx.fill();
    capsulePath(ctx, ax + LX * m * 0.55, ay + LY * m * 0.55, Ra * 0.42, bx + LX * m * 0.55, by + LY * m * 0.55, Rb * 0.42);
    ctx.fillStyle = rgba(shade(color, 0.3), o.shine ? 0.9 : 0.55);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = prevAlpha;
}

/** Thin stick (weapons, staffs, bones). */
export function stick(p: Painter, a: V3, b: V3, w: number, color: string): void {
  limb(p, a, b, w, w, color, { line: true });
}

/** Closed polygon through world points; smooth = quadratic curves through midpoints. */
export function poly(p: Painter, pts: V3[], color: string, o: FillOpts & { smooth?: boolean; grad?: [string, string] } = {}): void {
  if (!p.enabled || pts.length < 3) return;
  const ctx = p.ctx;
  const sp = pts.map((v) => scr(p, v));
  const prevAlpha = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = prevAlpha * o.alpha;
  ctx.beginPath();
  if (o.smooth) {
    const n = sp.length;
    const m = (i: number) => {
      const a = sp[i % n];
      const b = sp[(i + 1) % n];
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    };
    const s0 = m(n - 1);
    ctx.moveTo(s0[0], s0[1]);
    for (let i = 0; i < n; i++) {
      const mm = m(i);
      ctx.quadraticCurveTo(sp[i][0], sp[i][1], mm[0], mm[1]);
    }
  } else sp.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  if (o.grad) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of sp) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const g = ctx.createLinearGradient(0, minY, 0, maxY);
    g.addColorStop(0, o.grad[0]);
    g.addColorStop(1, o.grad[1]);
    ctx.fillStyle = g;
  } else ctx.fillStyle = color;
  ctx.fill();
  if (o.line !== false) inkLine(p, 0.7);
  ctx.globalAlpha = prevAlpha;
}

/** Open stroke through world points (tails, hair, cracks). */
export function curve(p: Painter, pts: V3[], color: string, width: number, alpha = 1): void {
  if (!p.enabled || pts.length < 2) return;
  const ctx = p.ctx;
  const sp = pts.map((v) => scr(p, v));
  ctx.beginPath();
  ctx.moveTo(sp[0][0], sp[0][1]);
  for (let i = 1; i < sp.length - 1; i++) {
    const mx = (sp[i][0] + sp[i + 1][0]) / 2;
    const my = (sp[i][1] + sp[i + 1][1]) / 2;
    ctx.quadraticCurveTo(sp[i][0], sp[i][1], mx, my);
  }
  const last = sp[sp.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.strokeStyle = alpha === 1 ? color : rgba(color, alpha);
  ctx.lineWidth = Math.max(0.6, width * p.cam.scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Screen-space dot (pupils, gems, sparks). Radius in world units. */
export function dot(p: Painter, c: V3, r: number, color: string, glow = 0): void {
  if (!p.enabled) return;
  const ctx = p.ctx;
  const [x, y] = scr(p, c);
  const R = Math.max(0.6, r * p.cam.scale * CIRCLE_RX);
  if (glow) {
    const G = R * (1.8 + glow * 0.8);
    const g = ctx.createRadialGradient(x, y, 0, x, y, G);
    g.addColorStop(0, rgba(color, 0.6));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, G, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
}

/** Depth of a world point towards the viewer (bigger = closer). */
export const depth = (v: V3) => v[0] * VIEW.x + v[1] * VIEW.y + v[2] * VIEW.z;

/**
 * Local frame of a creature: f = forward, s = left, u = up, in world units
 * scaled by `k`. Parts are queued and drawn back-to-front with flush().
 */
export class Rig {
  readonly ca: number;
  readonly sa: number;
  private parts: { d: number; i: number; fn: () => void }[] = [];

  constructor(
    readonly p: Painter,
    readonly x: number,
    readonly y: number,
    readonly z: number,
    readonly angle: number,
    readonly k: number,
  ) {
    this.ca = Math.cos(angle);
    this.sa = Math.sin(angle);
  }

  /** Local → world point. */
  at(f: number, s: number, u: number): V3 {
    const k = this.k;
    return [this.x + (this.ca * f - this.sa * s) * k, this.y + (this.sa * f + this.ca * s) * k, this.z + u * k];
  }

  /** Local → world direction (scaled). */
  dir(f: number, s: number, u: number): V3 {
    const k = this.k;
    return [(this.ca * f - this.sa * s) * k, (this.sa * f + this.ca * s) * k, u * k];
  }

  /** True when a local outward normal points towards the camera. */
  facing(f: number, s: number, u: number): boolean {
    const d = this.dir(f, s, u);
    return d[0] * VIEW.x + d[1] * VIEW.y + d[2] * VIEW.z > 0;
  }

  /** Queue a draw call at a local anchor (used for depth sorting). `bias` nudges ordering. */
  add(f: number, s: number, u: number, fn: () => void, bias = 0): void {
    this.parts.push({ d: depth(this.at(f, s, u)) + bias * this.k, i: this.parts.length, fn });
  }

  // Convenience wrappers in local coordinates ---------------------------------

  blob(f: number, s: number, u: number, rf: number, rs: number, ru: number, color: string, o: FillOpts = {}, bias = 0): void {
    this.add(f, s, u, () => ellipsoid(this.p, this.at(f, s, u), this.dir(rf, 0, 0), this.dir(0, rs, 0), this.dir(0, 0, ru), color, o), bias);
  }

  /** Ellipsoid tilted: forward axis pitched by `pitch` radians (positive = nose up). */
  tilted(f: number, s: number, u: number, rf: number, rs: number, ru: number, pitch: number, color: string, o: FillOpts = {}, bias = 0): void {
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    this.add(
      f,
      s,
      u,
      () => ellipsoid(this.p, this.at(f, s, u), this.dir(rf * cp, 0, rf * sp), this.dir(0, rs, 0), this.dir(-ru * sp, 0, ru * cp), color, o),
      bias,
    );
  }

  limb(a: V3, b: V3, ra: number, rb: number, color: string, o: FillOpts = {}, bias = 0): void {
    const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    this.add(m[0], m[1], m[2], () => limb(this.p, this.at(...a), this.at(...b), ra * this.k, rb * this.k, color, o), bias);
  }

  stick(a: V3, b: V3, w: number, color: string, bias = 0): void {
    this.limb(a, b, w, w, color, {}, bias);
  }

  poly(pts: V3[], color: string, o: FillOpts & { smooth?: boolean; grad?: [string, string] } = {}, bias = 0): void {
    let f = 0;
    let s = 0;
    let u = 0;
    for (const q of pts) {
      f += q[0];
      s += q[1];
      u += q[2];
    }
    const n = pts.length;
    this.add(
      f / n,
      s / n,
      u / n,
      () =>
        poly(
          this.p,
          pts.map((q) => this.at(...q)),
          color,
          o,
        ),
      bias,
    );
  }

  curve(pts: V3[], color: string, width: number, alpha = 1, bias = 0): void {
    const q = pts[Math.floor(pts.length / 2)];
    this.add(
      q[0],
      q[1],
      q[2],
      () =>
        curve(
          this.p,
          pts.map((v) => this.at(...v)),
          color,
          width * this.k,
          alpha,
        ),
      bias,
    );
  }

  dot(f: number, s: number, u: number, r: number, color: string, glow = 0, bias = 0): void {
    this.add(f, s, u, () => dot(this.p, this.at(f, s, u), r * this.k, color, glow), bias);
  }

  /**
   * A pair of eyes on a head centred at local (f, s, u) with radius r. Only
   * drawn when the face is turned towards the camera.
   */
  eyes(f: number, s: number, u: number, r: number, spread: number, color: string, o: { white?: boolean; glow?: number; size?: number } = {}): void {
    const size = o.size ?? 0.22;
    for (const side of [1, -1]) {
      const nf = Math.cos(spread);
      const ns = Math.sin(spread) * side;
      if (!this.facing(nf, ns, 0.1)) continue;
      const ef = f + r * nf * 0.92;
      const es = s + r * ns * 0.92;
      const eu = u + r * 0.12;
      this.add(
        ef,
        es,
        eu,
        () => {
          const c = this.at(ef, es, eu);
          if (o.white) {
            dot(this.p, c, r * size * this.k * 1.25, '#fbf6ea');
            dot(this.p, this.at(ef + r * 0.05, es, eu - r * 0.02), r * size * this.k * 0.65, color);
          } else dot(this.p, c, r * size * this.k, color, o.glow ?? 0);
        },
        0.4,
      );
    }
  }

  flush(): void {
    this.parts.sort((a, b) => a.d - b.d || a.i - b.i);
    for (const part of this.parts) part.fn();
    this.parts = [];
  }
}
