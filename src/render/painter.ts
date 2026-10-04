import { shade, rgba } from './color';
import { Camera, DY, VIEW } from './projection';

/** Vertical squash of screen-aligned ellipses used for round solids. */
const ELLIPSE = DY * 0.85;

/** Light direction (normalized): from the front-left, high above. */
const LIGHT = (() => {
  const v = { x: -0.45, y: 0.55, z: 0.85 };
  const l = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
})();

/** Shade amount for a face normal: tops are bright, faces away from light darker. */
export function faceShade(nx: number, ny: number, nz: number): number {
  const d = nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z;
  return -0.34 + d * 0.42;
}

type P2 = [number, number];

const SEG = 20;
const COS: number[] = [];
const SIN: number[] = [];
for (let i = 0; i < SEG; i++) {
  COS.push(Math.cos((i / SEG) * Math.PI * 2));
  SIN.push(Math.sin((i / SEG) * Math.PI * 2));
}

/**
 * Draws simple shaded solids in cavalier projection. All coordinates are world
 * units (tiles). Primitives are drawn immediately in call order; callers build
 * models bottom-to-top, back-to-front.
 */
export class Painter {
  ctx!: CanvasRenderingContext2D;
  outline = 'rgba(40,32,60,0.18)';

  constructor(public cam: Camera) {}

  private moveTo(x: number, y: number, z: number): void {
    this.ctx.moveTo(this.cam.px(x, y), this.cam.py(y, z));
  }
  private lineTo(x: number, y: number, z: number): void {
    this.ctx.lineTo(this.cam.px(x, y), this.cam.py(y, z));
  }

  /** Generic convex prism from a footprint polygon (world x/y). */
  prism(foot: P2[], z: number, h: number, color: string, top: string | null = null, outline = true): void {
    const ctx = this.ctx;
    const n = foot.length;
    // Orientation of footprint (signed area) to compute outward normals.
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
        ctx.fillStyle = shade(color, faceShade(nx, ny, 0));
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
    if (outline) this.strokeThin();
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

  /**
   * Vertical cylinder (or truncated cone if rTop differs). Round solids use
   * screen-aligned ellipses (a common oblique-projection "cheat") so lids read
   * as level instead of sheared.
   */
  cylinder(cx: number, cy: number, z: number, r: number, h: number, color: string, top: string | null = null, rTop = r): void {
    const ctx = this.ctx;
    const cam = this.cam;
    const S = cam.scale;
    const x = cam.px(cx, cy);
    const yb = cam.py(cy, z);
    const yt = cam.py(cy, z + h);
    const rb = r * S;
    const rt = rTop * S;
    ctx.beginPath();
    ctx.ellipse(x, yb, rb, rb * ELLIPSE, 0, 0, Math.PI, false);
    ctx.lineTo(x - rt, yt);
    ctx.ellipse(x, yt, rt, rt * ELLIPSE, 0, Math.PI, 0, true);
    ctx.closePath();
    const R = Math.max(rb, rt);
    const g = ctx.createLinearGradient(x - R, 0, x + R, 0);
    g.addColorStop(0, shade(color, 0.04));
    g.addColorStop(0.35, shade(color, 0.02));
    g.addColorStop(0.7, shade(color, -0.14));
    g.addColorStop(1, shade(color, -0.32));
    ctx.fillStyle = g;
    ctx.fill();
    this.strokeThin();
    this.cap(cx, cy, z + h, rTop, top ?? shade(color, faceShade(0, 0, 1)));
  }

  /** Screen-aligned flat ellipse (lid of a round object). */
  cap(cx: number, cy: number, z: number, r: number, fill: string, stroke = true): void {
    const ctx = this.ctx;
    const S = this.cam.scale;
    ctx.beginPath();
    ctx.ellipse(this.cam.px(cx, cy), this.cam.py(cy, z), r * S, r * S * ELLIPSE, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) this.strokeThin();
  }

  /** Screen-aligned ring on a round object (halos, coils). */
  capRing(cx: number, cy: number, z: number, r: number, stroke: string, width: number): void {
    const ctx = this.ctx;
    const S = this.cam.scale;
    ctx.beginPath();
    ctx.ellipse(this.cam.px(cx, cy), this.cam.py(cy, z), r * S, r * S * ELLIPSE, 0, 0, Math.PI * 2);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  /** Flat circle on a horizontal plane. */
  disc(cx: number, cy: number, z: number, r: number, fill: string, stroke = true): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < SEG; i++) {
      const x = cx + COS[i] * r;
      const y = cy + SIN[i] * r;
      if (i === 0) this.moveTo(x, y, z);
      else this.lineTo(x, y, z);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) this.strokeThin();
  }

  /** Ring outline on a horizontal plane. */
  ring(cx: number, cy: number, z: number, r: number, stroke: string, width: number, dash?: number[]): void {
    const ctx = this.ctx;
    ctx.beginPath();
    const n = Math.max(24, Math.round(r * 16));
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) this.moveTo(x, y, z);
      else this.lineTo(x, y, z);
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }

  /** Cone with apex at (cx, cy, z+h). Negative h points the apex down. */
  cone(cx: number, cy: number, z: number, r: number, h: number, color: string): void {
    const ctx = this.ctx;
    const cam = this.cam;
    const S = cam.scale;
    const x = cam.px(cx, cy);
    const y = cam.py(cy, z);
    const pts: P2[] = [];
    for (let i = 0; i < SEG; i++) pts.push([x + COS[i] * r * S, y + SIN[i] * r * S * ELLIPSE]);
    pts.push([x, cam.py(cy, z + h)]);
    const hull = convexHull(pts);
    ctx.beginPath();
    hull.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    const g = ctx.createLinearGradient(x - r * S, 0, x + r * S, 0);
    g.addColorStop(0, shade(color, 0.12));
    g.addColorStop(0.45, shade(color, 0.02));
    g.addColorStop(1, shade(color, -0.3));
    ctx.fillStyle = g;
    ctx.fill();
    this.strokeThin();
  }

  /** Four-sided pyramid roof over a rectangle. */
  pyramid(x: number, y: number, z: number, w: number, d: number, h: number, color: string): void {
    const ctx = this.ctx;
    const ax = x + w / 2;
    const ay = y + d / 2;
    const az = z + h;
    const corners: P2[] = [
      [x, y],
      [x + w, y],
      [x + w, y + d],
      [x, y + d],
    ];
    const faces: { pts: [number, number, number][]; n: [number, number, number] }[] = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      // Edge normal in ground plane (footprint is clockwise in y-down → outward = (dy, -dx)).
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      let nx = ey;
      let ny = -ex;
      const l = Math.hypot(nx, ny);
      nx /= l;
      ny /= l;
      // Tilt by roof slope.
      const run = Math.abs(nx) > 0.5 ? w / 2 : d / 2;
      const slope = h / run;
      const nz = 1 / Math.sqrt(1 + slope * slope);
      const k = slope * nz;
      faces.push({ pts: [[a[0], a[1], z], [b[0], b[1], z], [ax, ay, az]], n: [nx * k, ny * k, nz] });
    }
    for (const f of faces) {
      const [nx, ny, nz] = f.n;
      if (nx * VIEW.x + ny * VIEW.y + nz * VIEW.z <= 0) continue;
      ctx.beginPath();
      f.pts.forEach(([px, py, pz], i) => (i === 0 ? this.moveTo(px, py, pz) : this.lineTo(px, py, pz)));
      ctx.closePath();
      ctx.fillStyle = shade(color, faceShade(nx, ny, nz));
      ctx.fill();
      this.strokeThin();
    }
  }

  /** Square frustum (tapered box) centred on (cx, cy). */
  frustum(cx: number, cy: number, z: number, w0: number, w1: number, h: number, color: string, top: string | null = null): void {
    const a = w0 / 2;
    const b = w1 / 2;
    const z1 = z + h;
    const slope = (a - b) / h;
    // Back, right, front faces (left is never visible).
    this.face([[cx - a, cy - a, z], [cx + a, cy - a, z], [cx + b, cy - b, z1], [cx - b, cy - b, z1]], color, [0, -1, slope]);
    this.face([[cx + a, cy - a, z], [cx + a, cy + a, z], [cx + b, cy + b, z1], [cx + b, cy - b, z1]], color, [1, 0, slope]);
    this.face([[cx - a, cy + a, z], [cx + a, cy + a, z], [cx + b, cy + b, z1], [cx - b, cy + b, z1]], color, [0, 1, slope]);
    this.flat([[cx - b, cy - b], [cx + b, cy - b], [cx + b, cy + b], [cx - b, cy + b]], z1, top ?? shade(color, faceShade(0, 0, 1)));
  }

  /** Two-sided gable roof along the x axis. */
  gable(x: number, y: number, z: number, w: number, d: number, h: number, color: string, alongY = false): void {
    if (alongY) {
      // Ridge along y: slopes face −x and +x, gables face ±y.
      const rx = x + w / 2;
      this.quad([[x, y, z], [rx, y, z + h], [rx, y + d, z + h], [x, y + d, z]], color, [-h, 0, w / 2]);
      this.quad([[rx, y, z + h], [x + w, y, z], [x + w, y + d, z], [rx, y + d, z + h]], color, [h, 0, w / 2]);
      this.tri([[x, y + d, z], [x + w, y + d, z], [rx, y + d, z + h]], color, [0, 1, 0]);
    } else {
      const ry = y + d / 2;
      this.quad([[x, y, z], [x + w, y, z], [x + w, ry, z + h], [x, ry, z + h]], color, [0, -h, d / 2]);
      this.quad([[x, ry, z + h], [x + w, ry, z + h], [x + w, y + d, z], [x, y + d, z]], color, [0, h, d / 2]);
      this.tri([[x + w, y, z], [x + w, y + d, z], [x + w, ry, z + h]], color, [1, 0, 0]);
    }
  }

  private quad(pts: [number, number, number][], color: string, n: [number, number, number]): void {
    this.face(pts, color, n);
  }
  private tri(pts: [number, number, number][], color: string, n: [number, number, number]): void {
    this.face(pts, color, n);
  }

  /** Arbitrary planar face with a normal (culled when facing away). */
  face(pts: [number, number, number][], color: string, n: [number, number, number], cull = true): void {
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

  /** Shaded sphere. */
  sphere(cx: number, cy: number, z: number, r: number, color: string, glow = 0): void {
    const ctx = this.ctx;
    const x = this.cam.px(cx, cy);
    const y = this.cam.py(cy, z);
    const R = r * this.cam.scale;
    if (glow > 0) {
      const gg = ctx.createRadialGradient(x, y, R * 0.3, x, y, R * (2 + glow));
      gg.addColorStop(0, rgba(color, 0.55));
      gg.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(x, y, R * (2 + glow), 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    g.addColorStop(0, shade(color, 0.45));
    g.addColorStop(0.6, color);
    g.addColorStop(1, shade(color, -0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Soft ground shadow (ellipse on the ground plane). */
  shadow(cx: number, cy: number, z: number, r: number, alpha = 0.22): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < SEG; i++) {
      const x = cx + COS[i] * r + 0.06;
      const y = cy + SIN[i] * r + 0.04;
      if (i === 0) this.moveTo(x, y, z);
      else this.lineTo(x, y, z);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(30,25,60,${alpha})`;
    ctx.fill();
  }

  line(a: [number, number, number], b: [number, number, number], color: string, width: number): void {
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
  flat(pts: P2[], z: number, fill: string): void {
    const ctx = this.ctx;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? this.moveTo(x, y, z) : this.lineTo(x, y, z)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  /** Vertical flat banner/flag facing the viewer. */
  flag(x: number, y: number, z: number, w: number, h: number, color: string, wave: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    this.moveTo(x, y, z);
    const segs = 6;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      this.lineTo(x + w * t, y, z + Math.sin(wave + t * 3) * 0.04 * t);
    }
    for (let i = segs; i >= 0; i--) {
      const t = i / segs;
      this.lineTo(x + w * t, y, z - h + Math.sin(wave + t * 3) * 0.04 * t + (i === segs ? h * 0.25 : 0));
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
