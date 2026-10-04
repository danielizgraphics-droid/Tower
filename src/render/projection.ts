/**
 * Cavalier (oblique) projection.
 *
 * World axes (in tiles): x → right, y → towards the viewer (rows), z → up.
 * Front faces (x/z plane) keep their true shape; depth recedes up and to the
 * right at ANGLE with DEPTH_SCALE foreshortening.
 */
export const ANGLE = (58 * Math.PI) / 180;
export const DEPTH_SCALE = 0.8;
export const HEIGHT_SCALE = 0.92;

/** Screen offset produced by moving one tile towards the BACK (−y). */
export const DX = Math.cos(ANGLE) * DEPTH_SCALE;
export const DY = Math.sin(ANGLE) * DEPTH_SCALE;

/** Direction pointing from the scene towards the viewer (for back-face culling and sorting). */
export const VIEW = { x: DX, y: 1, z: DY / HEIGHT_SCALE };

export class Camera {
  /** Pixels per tile. */
  scale = 48;
  /** Screen position of world origin (0, 0, 0). */
  ox = 0;
  oy = 0;
  /** Number of rows of the board, used so the back rows shift right. */
  rows = 12;

  /** World → screen (CSS pixels). */
  project(x: number, y: number, z: number): { x: number; y: number } {
    const back = this.rows - y;
    return {
      x: this.ox + (x + back * DX) * this.scale,
      y: this.oy + (y * DY - z * HEIGHT_SCALE) * this.scale,
    };
  }

  px(x: number, y: number): number {
    return this.ox + (x + (this.rows - y) * DX) * this.scale;
  }

  py(y: number, z: number): number {
    return this.oy + (y * DY - z * HEIGHT_SCALE) * this.scale;
  }

  /** Screen → world on the horizontal plane at height z. */
  unproject(sx: number, sy: number, z = 0): { x: number; y: number } {
    const y = ((sy - this.oy) / this.scale + z * HEIGHT_SCALE) / DY;
    const x = (sx - this.ox) / this.scale - (this.rows - y) * DX;
    return { x, y };
  }

  /** Projected size of the board (without heights) in tiles. */
  static boardExtent(cols: number, rows: number): { w: number; h: number } {
    return { w: cols + rows * DX, h: rows * DY };
  }
}

/** Painter's-algorithm depth for a world point (bigger = closer to viewer). */
export const depthOf = (x: number, y: number): number => y + x * DX;
