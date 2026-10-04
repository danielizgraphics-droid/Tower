/**
 * Isometric projection.
 *
 * World axes (in tiles): x → down-right on screen, y → down-left, z → up.
 * The visible vertical faces of any solid are the ones facing +x and +y.
 */
export const ISO_X = Math.cos(Math.PI / 6); // 0.866
export const ISO_Y = 0.5;
export const HEIGHT_SCALE = 1;

/** Screen radii (per world unit) of a horizontal circle: exact for isometric. */
export const CIRCLE_RX = Math.SQRT2 * ISO_X; // 1.2247
export const CIRCLE_RY = Math.SQRT2 * ISO_Y; // 0.7071

/** Direction pointing from the scene towards the viewer (for back-face culling). */
export const VIEW = (() => {
  const v = { x: 1, y: 1, z: (2 * ISO_Y) / HEIGHT_SCALE };
  const l = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
})();

export class Camera {
  /** Pixels per world unit along an axis. */
  scale = 48;
  /** Screen position of world origin (0, 0, 0). */
  ox = 0;
  oy = 0;
  /** Kept for API compatibility; isometric needs no board size. */
  rows = 0;

  sx(x: number, y: number): number {
    return this.ox + (x - y) * ISO_X * this.scale;
  }

  sy(x: number, y: number, z: number): number {
    return this.oy + ((x + y) * ISO_Y - z * HEIGHT_SCALE) * this.scale;
  }

  project(x: number, y: number, z: number): { x: number; y: number } {
    return { x: this.sx(x, y), y: this.sy(x, y, z) };
  }

  /** Screen → world on the horizontal plane at height z. */
  unproject(sx: number, sy: number, z = 0): { x: number; y: number } {
    const u = (sx - this.ox) / (ISO_X * this.scale); // x - y
    const v = ((sy - this.oy) / this.scale + z * HEIGHT_SCALE) / ISO_Y; // x + y
    return { x: (u + v) / 2, y: (v - u) / 2 };
  }

  /** Screen-space bounds (world units, origin-relative) of a W×H board's ground. */
  static boardBounds(cols: number, rows: number): { left: number; right: number; top: number; bottom: number } {
    return { left: -rows * ISO_X, right: cols * ISO_X, top: 0, bottom: (cols + rows) * ISO_Y };
  }
}

/** Painter's-algorithm depth for a world point (bigger = closer to viewer). */
export const depthOf = (x: number, y: number): number => x + y;
