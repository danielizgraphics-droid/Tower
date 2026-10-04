/** Small color helpers with caching (shading is called thousands of times per frame). */

type RGB = [number, number, number];

const parseCache = new Map<string, RGB>();

export function parse(hex: string): RGB {
  let c = parseCache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  parseCache.set(hex, c);
  return c;
}

const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
const fmt = (c: RGB) => `#${toHex(c[0])}${toHex(c[1])}${toHex(c[2])}`;

const shadeCache = new Map<string, string>();

/** amount > 0 lightens towards white, < 0 darkens towards a cool shadow tone. */
export function shade(hex: string, amount: number): string {
  const q = Math.round(amount * 100);
  const key = hex + q;
  let out = shadeCache.get(key);
  if (out) return out;
  const c = parse(hex);
  const a = q / 100;
  if (a >= 0) out = fmt([c[0] + (255 - c[0]) * a, c[1] + (255 - c[1]) * a, c[2] + (255 - c[2]) * a]);
  else {
    // Shadows lean slightly blue/purple for a softer, illustrated look.
    const t = -a;
    out = fmt([c[0] * (1 - t) + 40 * t, c[1] * (1 - t) + 38 * t, c[2] * (1 - t) + 70 * t]);
  }
  shadeCache.set(key, out);
  return out;
}

export function mix(a: string, b: string, t: number): string {
  const ca = parse(a);
  const cb = parse(b);
  return fmt([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

export function rgba(hex: string, alpha: number): string {
  const c = parse(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
}
