// Graphics level chosen by the player, or picked automatically from how fast
// frames actually arrive: when the device can't keep up (or throttles itself
// because it is getting hot) the level drops; it climbs back only after a long
// smooth stretch, and stops trying after flip-flopping.

import type { Quality } from '../render3d/scene3d';

export type GraphicsSetting = 'auto' | 'high' | 'saver';

export const IS_MOBILE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export class AutoQuality {
  level: Quality;
  private ema = 0;
  private slow = 0;
  private smooth = 0;
  private drops = 0;

  constructor(
    readonly setting: GraphicsSetting,
    /** Highest level auto mode may use. */
    readonly max: Quality = IS_MOBILE ? 1 : 2,
  ) {
    this.level = setting === 'high' ? 2 : setting === 'saver' ? 0 : max;
  }

  /** Frames per second to aim for (0 = as many as the screen shows). */
  fpsCap(busy: boolean): number {
    if (this.setting === 'saver') return 30;
    // Between waves, little moves: half the frames is plenty (and keeps phones cool).
    if (!busy && (IS_MOBILE || this.setting === 'auto')) return 30;
    return 0;
  }

  /**
   * Feed the time between two drawn frames (ms) and the interval aimed for.
   * Returns true when the level changed.
   */
  sample(intervalMs: number, targetMs: number): boolean {
    if (this.setting !== 'auto' || intervalMs > 250) return false;
    this.ema = this.ema === 0 ? intervalMs : this.ema * 0.95 + intervalMs * 0.05;
    const sec = intervalMs / 1000;
    if (this.ema > targetMs * 1.3) {
      this.slow += sec;
      this.smooth = 0;
    } else {
      this.slow = 0;
      if (this.ema < targetMs * 1.08) this.smooth += sec;
    }
    if (this.slow > 3 && this.level > 0) {
      this.level = (this.level - 1) as Quality;
      this.drops++;
      this.slow = 0;
      this.smooth = 0;
      this.ema = targetMs;
      return true;
    }
    if (this.smooth > 20 && this.level < this.max && this.drops < 2) {
      this.level = (this.level + 1) as Quality;
      this.smooth = 0;
      return true;
    }
    return false;
  }
}
