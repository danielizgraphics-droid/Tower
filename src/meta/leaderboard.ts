// Online ranking: when the game runs as a claude.ai Artifact, every player's
// best marks are kept in one shared document each (scores/<their id>), which
// everyone can read and only its owner can write. Elsewhere (GitHub Pages,
// local dev) the platform is absent and the ranking is simply unavailable.

import type { Profile } from './profile';

export interface ScoreRow {
  id: string;
  /** Name the player chose (may be empty: then their account name is shown). */
  nick: string;
  /** Highest floor of the Torre infinita. */
  floor: number;
  /** Most waves survived in endless mode (any region). */
  endless: number;
  me: boolean;
  /** Display name to show. */
  name: string;
}

interface Snap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  get(): Promise<Snap>;
  set(data: Record<string, unknown>): Promise<void>;
}
interface Query {
  orderBy(field: string, dir?: 'asc' | 'desc'): Query;
  limit(n: number): Query;
  get(): Promise<{ docs: Snap[] }>;
}
interface DB {
  doc(path: string): DocRef;
  collection(path: string): Query & { doc(id: string): DocRef };
}
interface UserNs {
  id(): Promise<string | null>;
  profiles(ids: string[]): Promise<Record<string, { name: string }>>;
}
interface Platform {
  use(name: 'db'): Promise<DB | null>;
  use(name: 'user'): Promise<UserNs | null>;
}

export type BoardKind = 'floor' | 'endless';

/** Best endless run of the profile, over every region. */
export function bestEndless(p: Profile): number {
  return Math.max(0, ...Object.values(p.maps).map((m) => m.bestEndless ?? 0));
}

const clean = (s: unknown) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 20);

export class Leaderboard {
  private conn: Promise<{ db: DB; user: UserNs; id: string } | null> | null = null;
  private lastSent = '';

  private connect() {
    this.conn ??= (async () => {
      try {
        const claude = (window as unknown as { claude?: Platform }).claude;
        if (!claude?.use) return null;
        const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
        const id = db && user ? await user.id() : null;
        return db && user && id ? { db, user, id } : null;
      } catch {
        return null;
      }
    })();
    return this.conn;
  }

  /** Whether the online ranking works here (resolves false on GitHub Pages and the like). */
  async available(): Promise<boolean> {
    return !!(await this.connect());
  }

  /**
   * Publishes the player's marks if they changed. Never lowers a mark kept
   * online (another device may have done better). Failures are silent: the
   * ranking is a bonus, the game never depends on it.
   */
  async submit(p: Profile): Promise<void> {
    const c = await this.connect();
    if (!c) return;
    const mine = { nick: clean(p.climb.nick), floor: p.climb.best, endless: bestEndless(p) };
    const sig = JSON.stringify(mine);
    if (sig === this.lastSent) return;
    try {
      const ref = c.db.doc(`scores/${c.id}`);
      const snap = await ref.get();
      const old = snap.exists ? (snap.data() ?? {}) : {};
      const next = {
        nick: mine.nick,
        floor: Math.max(mine.floor, Number(old.floor) || 0),
        endless: Math.max(mine.endless, Number(old.endless) || 0),
        at: Date.now(),
      };
      if (!snap.exists || next.nick !== old.nick || next.floor !== old.floor || next.endless !== old.endless) await ref.set(next);
      this.lastSent = sig;
    } catch {
      /* a viewer without write access, or the platform is busy */
    }
  }

  /** The top of one ranking, plus the player's own row when it is further down. */
  async top(kind: BoardKind, n = 50): Promise<ScoreRow[] | null> {
    const c = await this.connect();
    if (!c) return null;
    try {
      const snap = await c.db.collection('scores').orderBy(kind, 'desc').limit(n).get();
      const rows = snap.docs
        .filter((d) => d.exists && Number(d.data()?.[kind]) > 0)
        .map((d) => {
          const v = d.data() ?? {};
          return { id: d.id, nick: clean(v.nick), floor: Number(v.floor) || 0, endless: Number(v.endless) || 0, me: d.id === c.id, name: '' };
        });
      if (!rows.some((r) => r.me)) {
        const own = await c.db.doc(`scores/${c.id}`).get();
        const v = own.exists ? own.data() : undefined;
        if (v && Number(v[kind]) > 0)
          rows.push({ id: c.id, nick: clean(v.nick), floor: Number(v.floor) || 0, endless: Number(v.endless) || 0, me: true, name: '' });
      }
      // Names are resolved now, never stored: a chosen nickname, else the account's name.
      const people = await c.user.profiles(rows.filter((r) => !r.nick).map((r) => r.id));
      for (const r of rows) r.name = r.nick || people[r.id]?.name || 'Defensor anónimo';
      return rows;
    } catch {
      return null;
    }
  }
}

export const leaderboard = new Leaderboard();
