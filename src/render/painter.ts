import { rgba, shade } from './color';
import { Camera, CIRCLE_RX, CIRCLE_RY, VIEW } from './projection';

/** Light direction (normalized): sun high in the upper-left of the screen (world −x, +y side). */
const LIGHT = (() => {
  const v = { x: -0.35, y: 0.62, z: 0.95 };
  const l = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
})();

/** Shade amount for a face normal: tops are bright, faces away from the sun darker. */
export function faceShade(nx: number, ny: number, nz: number): number {
  const d = nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z;
  return -0.36 + d * 0.44;
}

type P2 = [number, number];
type P3 = [number, number, number];

const SEG = 24;
const COS: number[] = [];
const SIN: number[] = [];
for (let i = 0; i < SEG; i++) {
  COS.push(Math.cos((i / SEG) * Math.PI * 2));
  SIN.push(Math.sin((i / SEG) * Math.PI * 2));
}

/**
 * Draws shaded solids in isometric projection. All coordinates are world units
 * (tiles). Primitives are drawn immediately in call order; models are built
 * bottom-to-top, back-to-front.
 */
export class Painter {
  ctx!: CanvasRenderingContext2D;
  outline = 'rgba(38,28,40,0.22)';
  /** When false every primitive is skipped (used to split models into static/dynamic layers). */
  enabled = true;
  /** Adds soft ambient occlusion gradients to vertical faces (costly; used for cached art). */
  detail = true;

  constructor(public cam: Camera) {}

  private moveTo(x: number, y: number, z: number): void {
    this.ctx.moveTo(this.cam.sx(x, y), this.cam.sy(x, y, z));
  }
  private lineTo(x: number, y: number, z: number): void {
    this.ctx.lineTo(this.cam.sx(x, y), this.cam.sy(x, y, z));
  }

  /** Fill for a vertical face: lit colour with a darker foot (ambient occlusion). */
  private wallFill(color: string, nx: number, ny: number, zTop: number, zBot: number, x: number, y: number): string | CanvasGradient {
    const base = shade(color, faceShade(nx, ny, 0));
    if (!this.detail || zTop - zBot < 0.08) return base;
    const g = this.ctx.createLinearGradient(0, this.cam.sy(x, y, zTop), 0, this.cam.sy(x, y, zBot));
    g.addColorStop(0, shade(color, faceShade(nx, ny, 0) + 0.04));
    g.addColorStop(0.7, base);
    g.addColorStop(1, shade(color, faceShade(nx, ny, 0) - 0.12));
    return g;
  }

  /** Generic convex prism from a footprint polygon (world x/y). */
  prism(foot: P2[], z: number, h: number, color: string, top: string | null = null, outline = true): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const n = foot.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = foot[i];
      const b = foot[(i + 1) % n];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const sgn = area > 0 ? 1 : -1;
    if (h > 0) {
      for (let i = 0; i < n; i++) {
        const a = foot[i];
        const b = foot[(i + 1) % n];
        let nx = (b[1] - a[1]) * sgn;
        let ny = -(b[0] - a[0]) * sgn;
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        if (nx * VIEW.x + ny * VIEW.y <= 0) continue;
        ctx.beginPath();
        this.moveTo(a[0], a[1], z);
        this.lineTo(b[0], b[1], z);
        this.lineTo(b[0], b[1], z + h);
        this.lineTo(a[0], a[1], z + h);
        ctx.closePath();
        ctx.fillStyle = this.wallFill(color, nx, ny, z + h, z, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        ctx.fill();
        if (outline) this.strokeThin();
      }
    }
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === 0) this.moveTo(foot[i][0], foot[i][1], z + h);
      else this.lineTo(foot[i][0], foot[i][1], z + h);
    }
    ctx.closePath();
    ctx.fillStyle = top ?? shade(color, faceShade(0, 0, 1));
    ctx.fill();
    if (outline) {
      this.strokeThin();
      if (h > 0.03 && this.detail) this.rimTop(foot, z + h, color);
    }
  }

  /** Light rim along the front edges of a top face (bevel highlight). */
  private rimTop(foot: P2[], z: number, color: string): void {
    const ctx = this.ctx;
    // Front edges are those whose outward normal faces the viewer.
    const n = foot.length;
    let area = 0;
    for (let i = 0; i < n; i++) area += foot[i][0] * foot[(i + 1) % n][1] - foot[(i + 1) % n][0] * foot[i][1];
    const sgn = area > 0 ? 1 : -1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = foot[i];
      const b = foot[(i + 1) % n];
      const nx = (b[1] - a[1]) * sgn;
      const ny = -(b[0] - a[0]) * sgn;
      if (nx * VIEW.x + ny * VIEW.y <= 0) continue;
      this.moveTo(a[0], a[1], z);
      this.lineTo(b[0], b[1], z);
    }
    ctx.strokeStyle = rgba(shade(color, 0.45), 0.55);
    ctx.lineWidth = Math.max(0.6, this.cam.scale * 0.014);
    ctx.stroke();
  }

  private strokeThin(): void {
    const ctx = this.ctx;
    ctx.strokeStyle = this.outline;
    ctx.lineWidth = Math.max(0.6, this.cam.scale * 0.012);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  box(x: number, y: number, z: number, w: number, d: number, h: number, color: string, top: string | null = null, outline = true): void {
    this.prism(
      [
        [x, y],
        [x + w, y],
        [x + w, y + d],
        [x, y + d],
      ],
      z,
      h,
      color,
      top,
      outline,
    );
  }

  /** Box centred on (cx, cy). */
  cbox(cx: number, cy: number, z: number, w: number, d: number, h: number, color: string, top: string | null = null): void {
    this.box(cx - w / 2, cy - d / 2, z, w, d, h, color, top);
  }

  /** Box rotated around its centre by `angle` (radians, ground plane). */
  rbox(cx: number, cy: number, z: number, w: number, d: number, h: number, angle: number, color: string, top: string | null = null): void {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const pts: P2[] = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
    this.prism(pts, z, h, color, top);
  }

  /** Brick/stone courses on the two visible faces of an axis-aligned box. */
  boxBricks(x: number, y: number, z: number, w: number, d: number, h: number, color: string, course = 0.11, brick = 0.2): void {
    if (!this.enabled || !this.detail) return;
    const ctx = this.ctx;
    ctx.strokeStyle = rgba(shade(color, -0.45), 0.35);
    ctx.lineWidth = Math.max(0.5, this.cam.scale * 0.01);
    ctx.beginPath();
    const rows = Math.max(1, Math.round(h / course));
    for (let r = 1; r < rows; r++) {
      const zz = z + (r / rows) * h;
      // +y face (front-left) and +x face (front-right)
      this.moveTo(x, y + d, zz);
      this.lineTo(x + w, y + d, zz);
      this.lineTo(x + w, y, zz);
    }
    for (let r = 0; r < rows; r++) {
      const z0 = z + (r / rows) * h;
      const z1 = z + ((r + 1) / rows) * h;
      const off = (r % 2) * brick * 0.5;
      for (let t = off + brick; t < w - 0.02; t += brick) {
        this.moveTo(x + t, y + d, z0);
        this.lineTo(x + t, y + d, z1);
      }
      for (let t = off + brick; t < d - 0.02; t += brick) {
        this.moveTo(x + w, y + t, z0);
        this.lineTo(x + w, y + t, z1);
      }
    }
    ctx.stroke();
  }

  /** Vertical cylinder (or truncated cone if rTop differs). */
  cylinder(cx: number, cy: number, z: number, r: number, h: number, color: string, top: string | null = null, rTop = r): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const cam = this.cam;
    const S = cam.scale;
    const x = cam.sx(cx, cy);
    const yb = cam.sy(cx, cy, z);
    const yt = cam.sy(cx, cy, z + h);
    const rb = r * S * CIRCLE_RX;
    const rt = rTop * S * CIRCLE_RX;
    ctx.beginPath();
    ctx.ellipse(x, yb, rb, r * S * CIRCLE_RY, 0, 0, Math.PI, false);
    ctx.lineTo(x - rt, yt);
    ctx.ellipse(x, yt, rt, rTop * S * CIRCLE_RY, 0, Math.PI, 0, true);
    ctx.closePath();
    const R = Math.max(rb, rt);
    const g = ctx.createLinearGradient(x - R, 0, x + R, 0);
    g.addColorStop(0, shade(color, 0.02));
    g.addColorStop(0.3, shade(color, 0.08));
    g.addColorStop(0.62, shade(color, -0.1));
    g.addColorStop(1, shade(color, -0.34));
    ctx.fillStyle = g;
    ctx.fill();
    if (this.detail && h > 0.15) {
      // Ambient occlusion at the foot.
      const ao = ctx.createLinearGradient(0, yb - Math.min(h, 0.25) * S, 0, yb + r * S * CIRCLE_RY);
      ao.addColorStop(0, 'rgba(30,20,40,0)');
      ao.addColorStop(1, 'rgba(30,20,40,0.22)');
      ctx.fillStyle = ao;
      ctx.fill();
    }
    this.strokeThin();
    this.cap(cx, cy, z + h, rTop, top ?? shade(color, faceShade(0, 0, 1)));
  }

  /** Masonry courses and staggered joints on the visible half of a cylinder. */
  cylinderBricks(cx: number, cy: number, z: number, r: number, h: number, color: string, course = 0.11, perRing = 9): void {
    if (!this.enabled || !this.detail) return;
    const ctx = this.ctx;
    const S = this.cam.scale;
    const x = this.cam.sx(cx, cy);
    const rx = r * S * CIRCLE_RX;
    const ry = r * S * CIRCLE_RY;
    ctx.strokeStyle = rgba(shade(color, -0.45), 0.3);
    ctx.lineWidth = Math.max(0.5, S * 0.01);
    ctx.beginPath();
    const rows = Math.max(1, Math.round(h / course));
    for (let i = 1; i < rows; i++) {
      const y = this.cam.sy(cx, cy, z + (i / rows) * h);
      ctx.moveTo(x + rx, y);
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI, false);
    }
    for (let i = 0; i < rows; i++) {
      const y0 = this.cam.sy(cx, cy, z + (i / rows) * h);
      const y1 = this.cam.sy(cx, cy, z + ((i + 1) / rows) * h);
      for (let k = 0; k < perRing; k++) {
        const a = ((k + (i % 2) * 0.5) / perRing) * Math.PI;
        if (a <= 0.05 || a >= Math.PI - 0.05) continue;
        const px = x + Math.cos(a) * rx;
        const py = Math.sin(a) * ry;
        ctx.moveTo(px, y0 + py);
        ctx.lineTo(px, y1 + py);
      }
    }
    ctx.stroke();
  }

  /** Flat ellipse lid of a round object. */
  cap(cx: number, cy: number, z: number, r: number, fill: string, stroke = true): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const S = this.cam.scale;
    ctx.beginPath();
    ctx.ellipse(this.cam.sx(cx, cy), this.cam.sy(cx, cy, z), r * S * CIRCLE_RX, r * S * CIRCLE_RY, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) this.strokeThin();
  }

  /** Ring around a round object (halos, coils). */
  capRing(cx: number, cy: number, z: number, r: number, stroke: string, width: number): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const S = this.cam.scale;
    ctx.beginPath();
    ctx.ellipse(this.cam.sx(cx, cy), this.cam.sy(cx, cy, z), r * S * CIRCLE_RX, r * S * CIRCLE_RY, 0, 0, Math.PI * 2);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  /** Flat circle on a horizontal plane. */
  disc(cx: number, cy: number, z: number, r: number, fill: string, stroke = true): void {
    this.cap(cx, cy, z, r, fill, stroke);
  }

  /** Ring outline on a horizontal plane. */
  ring(cx: number, cy: number, z: number, r: number, stroke: string, width: number, dash?: number[]): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    if (dash) ctx.setLineDash(dash);
    this.capRing(cx, cy, z, r, stroke, width);
    if (dash) ctx.setLineDash([]);
  }

  /** Cone with apex at (cx, cy, z+h). Negative h points the apex down. */
  cone(cx: number, cy: number, z: number, r: number, h: number, color: string): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const cam = this.cam;
    const S = cam.scale;
    const x = cam.sx(cx, cy);
    const y = cam.sy(cx, cy, z);
    const pts: P2[] = [];
    for (let i = 0; i < SEG; i++) pts.push([x + COS[i] * r * S * CIRCLE_RX, y + SIN[i] * r * S * CIRCLE_RY]);
    pts.push([x, cam.sy(cx, cy, z + h)]);
    const hull = convexHull(pts);
    ctx.beginPath();
    hull.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    const R = r * S * CIRCLE_RX;
    const g = ctx.createLinearGradient(x - R, 0, x + R, 0);
    g.addColorStop(0, shade(color, 0.08));
    g.addColorStop(0.35, shade(color, 0.12));
    g.addColorStop(0.65, shade(color, -0.06));
    g.addColorStop(1, shade(color, -0.32));
    ctx.fillStyle = g;
    ctx.fill();
    this.strokeThin();
  }

  /** Conical roof with tile rows (slate/shingle look). */
  roofCone(cx: number, cy: number, z: number, r: number, h: number, color: string, rows = 4): void {
    if (!this.enabled) return;
    this.cone(cx, cy, z, r, h, color);
    if (!this.detail) return;
    const ctx = this.ctx;
    const S = this.cam.scale;
    const x = this.cam.sx(cx, cy);
    ctx.strokeStyle = rgba(shade(color, -0.4), 0.35);
    ctx.lineWidth = Math.max(0.5, S * 0.012);
    ctx.beginPath();
    for (let i = 1; i < rows; i++) {
      const t = i / rows;
      const rr = r * (1 - t);
      const y = this.cam.sy(cx, cy, z + h * t);
      ctx.moveTo(x + rr * S * CIRCLE_RX, y);
      ctx.ellipse(x, y, rr * S * CIRCLE_RX, rr * S * CIRCLE_RY, 0, 0, Math.PI, false);
    }
    ctx.stroke();
  }

  /** Four-sided pyramid roof over a rectangle. */
  pyramid(x: number, y: number, z: number, w: number, d: number, h: number, color: string): void {
    if (!this.enabled) return;
    const ax = x + w / 2;
    const ay = y + d / 2;
    const az = z + h;
    const corners: P2[] = [
      [x, y],
      [x + w, y],
      [x + w, y + d],
      [x, y + d],
    ];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      let nx = ey;
      let ny = -ex;
      const l = Math.hypot(nx, ny);
      nx /= l;
      ny /= l;
      const run = Math.abs(nx) > 0.5 ? w / 2 : d / 2;
      const slope = h / run;
      const nz = 1 / Math.sqrt(1 + slope * slope);
      const k = slope * nz;
      this.face(
        [
          [a[0], a[1], z],
          [b[0], b[1], z],
          [ax, ay, az],
        ],
        color,
        [nx * k, ny * k, nz],
      );
    }
  }

  /** Square frustum (tapered box) centred on (cx, cy). */
  frustum(cx: number, cy: number, z: number, w0: number, w1: number, h: number, color: string, top: string | null = null): void {
    if (!this.enabled) return;
    const a = w0 / 2;
    const b = w1 / 2;
    const z1 = z + h;
    const slope = (a - b) / h;
    this.face(
      [
        [cx + a, cy - a, z],
        [cx + a, cy + a, z],
        [cx + b, cy + b, z1],
        [cx + b, cy - b, z1],
      ],
      color,
      [1, 0, slope],
    );
    this.face(
      [
        [cx - a, cy + a, z],
        [cx + a, cy + a, z],
        [cx + b, cy + b, z1],
        [cx - b, cy + b, z1],
      ],
      color,
      [0, 1, slope],
    );
    if (b > 0.001)
      this.flat(
        [
          [cx - b, cy - b],
          [cx + b, cy - b],
          [cx + b, cy + b],
          [cx - b, cy + b],
        ],
        z1,
        top ?? shade(color, faceShade(0, 0, 1)),
      );
  }

  /** Two-sided gable roof; the ridge runs along x (or along y). */
  gable(x: number, y: number, z: number, w: number, d: number, h: number, color: string, alongY = false): void {
    if (!this.enabled) return;
    if (alongY) {
      const rx = x + w / 2;
      this.face(
        [
          [x, y, z],
          [rx, y, z + h],
          [rx, y + d, z + h],
          [x, y + d, z],
        ],
        color,
        [-h, 0, w / 2],
      );
      this.face(
        [
          [x + w, y, z],
          [rx, y, z + h],
          [rx, y + d, z + h],
          [x + w, y + d, z],
        ],
        color,
        [h, 0, w / 2],
      );
      this.face(
        [
          [x, y + d, z],
          [x + w, y + d, z],
          [rx, y + d, z + h],
        ],
        shade(color, -0.25),
        [0, 1, 0],
      );
    } else {
      const ry = y + d / 2;
      this.face(
        [
          [x, y, z],
          [x + w, y, z],
          [x + w, ry, z + h],
          [x, ry, z + h],
        ],
        color,
        [0, -h, d / 2],
      );
      this.face(
        [
          [x, ry, z + h],
          [x + w, ry, z + h],
          [x + w, y + d, z],
          [x, y + d, z],
        ],
        color,
        [0, h, d / 2],
      );
      this.face(
        [
          [x + w, y, z],
          [x + w, y + d, z],
          [x + w, ry, z + h],
        ],
        shade(color, -0.25),
        [1, 0, 0],
      );
    }
  }

  /** Arbitrary planar face with a normal (culled when facing away). */
  face(pts: P3[], color: string, n: P3, cull = true): void {
    if (!this.enabled) return;
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    const nx = n[0] / l;
    const ny = n[1] / l;
    const nz = n[2] / l;
    if (cull && nx * VIEW.x + ny * VIEW.y + nz * VIEW.z <= 0) return;
    const ctx = this.ctx;
    ctx.beginPath();
    pts.forEach(([x, y, z], i) => (i === 0 ? this.moveTo(x, y, z) : this.lineTo(x, y, z)));
    ctx.closePath();
    ctx.fillStyle = shade(color, faceShade(nx, ny, nz));
    ctx.fill();
    this.strokeThin();
  }

  /** Stylised flame (teardrop) standing on (cx, cy, z). `t` animates the flicker. */
  flame(cx: number, cy: number, z: number, w: number, h: number, t: number, outer = '#ff7a2b', inner = '#ffd25a'): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const S = this.cam.scale;
    const x = this.cam.sx(cx, cy);
    const y = this.cam.sy(cx, cy, z);
    const draw = (ww: number, hh: number, color: string, phase: number) => {
      const W = ww * S;
      const H = hh * S * (0.9 + Math.sin(t * 11 + phase) * 0.08 + Math.sin(t * 17 + phase * 2) * 0.05);
      const sway = Math.sin(t * 7 + phase) * W * 0.25;
      ctx.beginPath();
      ctx.moveTo(x - W, y);
      ctx.bezierCurveTo(x - W * 1.05, y - H * 0.45, x - W * 0.35 + sway, y - H * 0.6, x + sway, y - H);
      ctx.bezierCurveTo(x + W * 0.35 + sway, y - H * 0.6, x + W * 1.05, y - H * 0.45, x + W, y);
      ctx.quadraticCurveTo(x, y + W * 0.45, x - W, y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    const g = ctx.createRadialGradient(x, y - h * S * 0.3, 1, x, y - h * S * 0.3, h * S * 1.4);
    g.addColorStop(0, 'rgba(255,160,60,0.35)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - h * S * 0.3, h * S * 1.4, 0, Math.PI * 2);
    ctx.fill();
    draw(w, h, outer, 0);
    draw(w * 0.62, h * 0.72, inner, 1.7);
    draw(w * 0.3, h * 0.4, '#fff6d0', 3.1);
  }

  /** Shaded sphere. */
  sphere(cx: number, cy: number, z: number, r: number, color: string, glow = 0): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const x = this.cam.sx(cx, cy);
    const y = this.cam.sy(cx, cy, z);
    const R = r * this.cam.scale * CIRCLE_RX * 0.95;
    if (glow > 0) {
      const gg = ctx.createRadialGradient(x, y, R * 0.3, x, y, R * (2 + glow));
      gg.addColorStop(0, rgba(color, 0.55));
      gg.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(x, y, R * (2 + glow), 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.08, x, y, R);
    g.addColorStop(0, shade(color, 0.5));
    g.addColorStop(0.55, color);
    g.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Soft ground shadow, cast slightly down-right (away from the sun). */
  shadow(cx: number, cy: number, z: number, r: number, alpha = 0.24): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const S = this.cam.scale;
    const x = this.cam.sx(cx + 0.08, cy - 0.02);
    const y = this.cam.sy(cx + 0.08, cy - 0.02, z);
    const rx = r * S * CIRCLE_RX;
    const ry = r * S * CIRCLE_RY;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, `rgba(28,22,48,${alpha})`);
    g.addColorStop(0.65, `rgba(28,22,48,${alpha * 0.7})`);
    g.addColorStop(1, 'rgba(28,22,48,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  line(a: P3, b: P3, color: string, width: number): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    ctx.beginPath();
    this.moveTo(a[0], a[1], a[2]);
    this.lineTo(b[0], b[1], b[2]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * this.cam.scale;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /** Flat polygon on a horizontal plane. */
  flat(pts: P2[], z: number, fill: string | CanvasGradient): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? this.moveTo(x, y, z) : this.lineTo(x, y, z)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  /** Vertical banner hanging from (x, y, z), waving along +x. */
  flag(x: number, y: number, z: number, w: number, h: number, color: string, wave: number): void {
    if (!this.enabled) return;
    const ctx = this.ctx;
    ctx.beginPath();
    this.moveTo(x, y, z);
    const segs = 6;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      this.lineTo(x + w * t, y + Math.sin(wave + t * 3) * 0.03 * t, z + Math.sin(wave + t * 3) * 0.03 * t);
    }
    for (let i = segs; i >= 0; i--) {
      const t = i / segs;
      this.lineTo(x + w * t, y + Math.sin(wave + t * 3) * 0.03 * t, z - h + Math.sin(wave + t * 3) * 0.03 * t + (i === segs ? h * 0.25 : 0));
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    this.strokeThin();
  }
}

function convexHull(points: P2[]): P2[] {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
