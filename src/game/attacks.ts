import type { AttackKind, TowerStats } from '../data/types';
import { angleDiff, dist2 } from '../engine/math';
import type { Enemy, HitPayload, Tower } from './entities';
import type { Game } from './game';
import { effectiveAttack, effectiveDamageType } from './modifiers';

type AttackFn = (g: Game, t: Tower, s: TowerStats, payload: HitPayload) => boolean;

/** Visual projectile style per tower/branch, used by the renderer. */
function projectileStyle(t: Tower): string {
  const id = t.def.id;
  if (id === 'archer') return t.branch === 2 ? 'runeArrow' : 'arrow';
  if (id === 'ballista') return t.branch === 2 ? 'harpoon' : 'bolt';
  if (id === 'cannon') return 'ball';
  if (id === 'alchemist') return 'flask';
  if (id === 'frost') return t.branch === 2 ? 'icicle' : 'shard';
  if (id === 'sanctum') return 'holy';
  if (id === 'obelisk') return 'shadow';
  return 'orb';
}

function lead(g: Game, e: Enemy, time: number): { x: number; y: number } {
  const p = g.board.pointAt(Math.min(g.board.length, e.dist + e.currentSpeed * time));
  return { x: p.x, y: p.y };
}

const aimAt = (t: Tower, x: number, y: number) => {
  t.angle = Math.atan2(y - t.y, x - t.x);
};

const ATTACKS: Record<AttackKind, AttackFn> = {
  projectile(g, t, s, payload) {
    const targets = g.findTargets(t, s, 1 + Math.round(s.multishot));
    if (!targets.length) return false;
    aimAt(t, targets[0].x, targets[0].y);
    const style = projectileStyle(t);
    targets.forEach((e, i) => {
      g.spawnProjectile({
        kind: 'homing',
        x: t.x, y: t.y, z: 1.15, sx: t.x, sy: t.y, sz: 1.15,
        tx: e.x, ty: e.y, target: e,
        vx: Math.cos(t.angle), vy: Math.sin(t.angle),
        speed: s.projectileSpeed * (1 - i * 0.04), duration: 0, arc: 0, maxTravel: 0,
        pierceLeft: Math.round(s.pierce), payload, splash: s.splash, color: t.def.branches[t.branch]?.visual.fx ?? t.def.visual.fx,
        style,
      });
    });
    g.events.emit('fire', { tower: t, target: targets[0] });
    return true;
  },

  lob(g, t, s, payload) {
    const [e] = g.findTargets(t, s, 1);
    if (!e) return false;
    const d = Math.hypot(e.x - t.x, e.y - t.y);
    const duration = 0.35 + d / Math.max(1, s.projectileSpeed);
    const p = lead(g, e, duration);
    aimAt(t, p.x, p.y);
    g.spawnProjectile({
      kind: 'lob',
      x: t.x, y: t.y, z: 1.1, sx: t.x, sy: t.y, sz: 1.1, tx: p.x, ty: p.y, target: null,
      vx: 0, vy: 0, speed: 0, duration, arc: 0.8 + d * 0.25, maxTravel: 0, pierceLeft: 0,
      payload, splash: s.splash, color: t.def.branches[t.branch]?.visual.fx ?? t.def.visual.fx,
      style: projectileStyle(t),
    });
    g.events.emit('fire', { tower: t, target: e });
    return true;
  },

  bolt(g, t, s, payload) {
    const targets = g.findTargets(t, s, 1 + Math.round(s.multishot));
    if (!targets.length) return false;
    targets.forEach((e) => {
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      const p = lead(g, e, d / Math.max(1, s.projectileSpeed));
      const a = Math.atan2(p.y - t.y, p.x - t.x);
      g.spawnProjectile({
        kind: 'bolt',
        x: t.x, y: t.y, z: 0.9, sx: t.x, sy: t.y, sz: 0.9, tx: p.x, ty: p.y, target: e,
        vx: Math.cos(a), vy: Math.sin(a), speed: s.projectileSpeed, duration: 0, arc: 0,
        maxTravel: s.range + 1.2, pierceLeft: Math.round(s.pierce), payload, splash: 0,
        color: t.def.branches[t.branch]?.visual.fx ?? t.def.visual.fx, style: projectileStyle(t),
      });
    });
    aimAt(t, targets[0].x, targets[0].y);
    g.events.emit('fire', { tower: t, target: targets[0] });
    return true;
  },

  chain(g, t, s, payload) {
    const [first] = g.findTargets(t, s, 1);
    if (!first) return false;
    aimAt(t, first.x, first.y);
    const color = t.def.branches[t.branch]?.visual.fx ?? t.def.visual.fx;
    const points = [{ x: t.x, y: t.y, z: 1.6 }];
    const hit = new Set<number>();
    let cur: Enemy | null = first;
    let mult = 1;
    for (let i = 0; cur && i <= Math.round(s.chains); i++) {
      hit.add(cur.uid);
      points.push({ x: cur.x, y: cur.y, z: cur.flying ? 0.9 : 0.45 });
      g.applyHit(cur, payload, mult);
      mult *= s.chainFalloff;
      let next: Enemy | null = null;
      let best = 2.2 * 2.2;
      for (const e of g.enemies) {
        if (!e.alive || hit.has(e.uid) || e.dist < 0) continue;
        const d2 = dist2(e.x, e.y, cur.x, cur.y);
        if (d2 < best) {
          best = d2;
          next = e;
        }
      }
      cur = next;
    }
    g.events.emit('chain', { points, color });
    g.events.emit('fire', { tower: t, target: first });
    return true;
  },

  beam(g, t, s, payload) {
    // Keep focus on the current target while it stays valid; reset the ramp otherwise.
    let target = t.beamTarget;
    if (!target || !target.alive || dist2(target.x, target.y, t.x, t.y) > s.range * s.range) {
      target = g.findTargets(t, s, 1)[0] ?? null;
      if (target !== t.beamTarget) t.beamTime = 0;
      t.beamTarget = target;
    }
    if (!target) return false;
    aimAt(t, target.x, target.y);
    const ramp = 1 + Math.min(s.beamRampMax, t.beamTime * s.beamRamp);
    g.applyHit(target, payload, ramp);
    return true;
  },

  cone(g, t, s, payload) {
    const [e] = g.findTargets(t, s, 1);
    if (!e) return false;
    const desired = Math.atan2(e.y - t.y, e.x - t.x);
    t.angle += angleDiff(t.angle, desired) * 0.6;
    const half = (s.coneAngle * Math.PI) / 180;
    const r2 = s.range * s.range;
    for (const o of g.enemies) {
      if (!o.alive || o.flying || o.dist < 0) continue;
      const d2 = dist2(o.x, o.y, t.x, t.y);
      if (d2 > r2) continue;
      const a = Math.atan2(o.y - t.y, o.x - t.x);
      if (Math.abs(angleDiff(t.angle, a)) <= half || d2 < 0.36) g.applyHit(o, payload);
    }
    t.coneTime = 0.25;
    g.events.emit('fire', { tower: t, target: e });
    return true;
  },

  pulse(g, t, s, payload) {
    const inRange = g.findTargets(t, s, 999);
    if (!inRange.length) return false;
    for (const e of inRange) g.applyHit(e, payload);
    g.events.emit('pulse', { x: t.x, y: t.y, radius: s.range, color: t.def.branches[t.branch]?.visual.fx ?? t.def.visual.fx });
    g.events.emit('fire', { tower: t, target: inRange[0] });
    return true;
  },

  strike(g, t, s, payload) {
    const mode = t.targetMode === 'first' ? 'first' : t.targetMode;
    const [e] = g.findTargets(t, s, 1, mode);
    if (!e) return false;
    const style = t.def.id === 'pyre' ? 'meteor' : t.def.id === 'storm' ? 'thunder' : 'smite';
    const delay = style === 'meteor' ? 0.8 : style === 'smite' ? 0.4 : 0.25;
    const p = lead(g, e, delay);
    aimAt(t, p.x, p.y);
    g.strikes.push({ x: p.x, y: p.y, delay, total: delay, radius: Math.max(0.5, s.splash), payload, style });
    g.events.emit('fire', { tower: t, target: e });
    return true;
  },

  orb(g, t, s, payload) {
    const [e] = g.findTargets(t, s, 1);
    if (!e) return false;
    const p = lead(g, e, Math.hypot(e.x - t.x, e.y - t.y) / Math.max(0.5, s.projectileSpeed));
    const a = Math.atan2(p.y - t.y, p.x - t.x);
    t.angle = a;
    g.spawnProjectile({
      kind: 'orb',
      x: t.x, y: t.y, z: 1.2, sx: t.x, sy: t.y, sz: 1.2, tx: p.x, ty: p.y, target: null,
      vx: Math.cos(a), vy: Math.sin(a), speed: Math.max(0.8, s.projectileSpeed), duration: 0, arc: 0,
      maxTravel: s.range * 1.7, pierceLeft: 999, payload, splash: s.splash,
      color: t.def.branches[t.branch]?.visual.fx ?? t.def.visual.fx, style: 'voidOrb', hitCd: new Map(),
    });
    g.events.emit('fire', { tower: t, target: e });
    return true;
  },

  rift(g, t, s, payload) {
    const [e] = g.findTargets(t, s, 1, 'first');
    if (!e) return false;
    aimAt(t, e.x, e.y);
    const total = 1.6;
    g.rifts.push({ uid: t.uid * 1000 + Math.floor(g.time * 10), x: e.x, y: e.y, radius: Math.max(0.6, s.splash), time: total, total, pull: s.pull, payload });
    g.splash(e.x, e.y, Math.max(0.6, s.splash), payload, null);
    g.events.emit('fire', { tower: t, target: e });
    return true;
  },

  aura() {
    return false;
  },
};

/** Runs one tick of a tower's attack logic. */
export function runAttack(g: Game, t: Tower, dt: number): void {
  t.fireAnim += dt;
  t.buildAnim += dt;
  if (t.coneTime > 0) t.coneTime -= dt;
  const kind = effectiveAttack(t.def, t.branch);
  const s = g.liveStats(t);
  if (kind === 'beam') {
    if (t.beamTarget) t.beamTime += dt;
  }
  t.cooldown -= dt;
  if (t.cooldown > 0) return;
  if (s.rate <= 0 || kind === 'aura') return;
  const payload: HitPayload = { tower: t, stats: s, damage: s.damage, type: effectiveDamageType(t.def, t.branch) };
  const fired = ATTACKS[kind](g, t, s, payload);
  if (fired) {
    t.cooldown += 1 / s.rate;
    if (t.cooldown < 0) t.cooldown = 0;
    if (kind !== 'beam' && kind !== 'cone' && kind !== 'pulse') t.fireAnim = 0;
  } else {
    t.cooldown = 0;
    if (kind === 'beam') {
      t.beamTarget = null;
      t.beamTime = 0;
    }
  }
}
