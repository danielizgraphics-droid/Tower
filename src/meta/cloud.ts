// Cloud save: when the game runs as a claude.ai Artifact, the profile is also
// kept in the artifact's per-viewer store (data/users/<id>/...), so progress
// follows the player's account across devices and browsers. Elsewhere (local
// dev, a saved copy) the platform is absent and only browser storage is used.

import { migrateProfile, type Profile } from './profile';

export type CloudStatus = 'connecting' | 'off' | 'synced' | 'saving' | 'error';

/** The slice of the platform's `db` document API this module uses. */
interface DocSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  metadata: { hasPendingWrites: boolean };
}
interface DocRef {
  get(): Promise<DocSnapshot>;
  set(data: Record<string, unknown>): Promise<void>;
  onSnapshot(next: (s: DocSnapshot) => void, error?: (e: { code: string }) => void): () => void;
}
interface Platform {
  use(name: 'db'): Promise<{ doc(path: string): DocRef } | null>;
  use(name: 'user'): Promise<{ id(): Promise<string | null> } | null>;
}

export interface CloudHost {
  readonly profile: Profile;
  /** Replace the local profile with a newer one from the cloud. */
  adoptProfile(p: Profile): void;
}

const DEBOUNCE_MS = 1500;

export class CloudSave {
  status: CloudStatus = 'connecting';
  private listeners = new Set<(s: CloudStatus) => void>();
  private ref: DocRef | null = null;
  private pending: Profile | null = null;
  private writing: Promise<void> | null = null;
  private timer = 0;
  private retried = false;

  constructor(private host: CloudHost) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush();
    });
  }

  onStatus(fn: (s: CloudStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private setStatus(s: CloudStatus): void {
    if (s === this.status) return;
    this.status = s;
    for (const fn of this.listeners) fn(s);
  }

  /** Finds the player's cloud save, keeps whichever copy is newer and starts listening for other devices. */
  async connect(): Promise<void> {
    try {
      const claude = (window as unknown as { claude?: Platform }).claude;
      if (!claude?.use) return this.setStatus('off');
      const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
      const id = db && user ? await user.id() : null;
      if (!db || !id) return this.setStatus('off');
      const ref = db.doc(`data/users/${id}/save`);
      const snap = await ref.get();
      this.ref = ref;
      const remote = this.remoteProfile(snap);
      if (remote && (remote.savedAt ?? 0) > (this.host.profile.savedAt ?? 0)) {
        this.host.adoptProfile(remote);
        this.setStatus('synced');
      } else if (!remote || (remote.savedAt ?? 0) < (this.host.profile.savedAt ?? 0)) {
        this.save(this.host.profile, true);
      } else this.setStatus('synced');
      // Progress made on another device arrives live.
      ref.onSnapshot(
        (s) => {
          if (s.metadata.hasPendingWrites || this.pending || this.writing) return;
          const r = this.remoteProfile(s);
          if (r && (r.savedAt ?? 0) > (this.host.profile.savedAt ?? 0)) this.host.adoptProfile(r);
        },
        () => undefined,
      );
    } catch {
      this.setStatus(this.ref ? 'error' : 'off');
    }
  }

  private remoteProfile(s: DocSnapshot): Profile | null {
    const body = s.exists ? s.data() : undefined;
    return body?.profile ? migrateProfile(body.profile) : null;
  }

  /** Queues the profile for upload (coalescing bursts of changes). */
  save(p: Profile, now = false): void {
    if (!this.ref) return;
    this.pending = JSON.parse(JSON.stringify(p)) as Profile;
    this.setStatus('saving');
    clearTimeout(this.timer);
    if (now) void this.flush();
    else this.timer = window.setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }

  /** Uploads any queued change now; resolves when the store has it. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    // One write at a time to the document.
    while (this.writing) await this.writing;
    const body = this.pending;
    if (!this.ref || !body) return;
    this.pending = null;
    this.writing = this.ref
      .set({ profile: body as unknown as Record<string, unknown>, savedAt: body.savedAt ?? Date.now() })
      .then(
        () => {
          this.retried = false;
          if (!this.pending) this.setStatus('synced');
        },
        (e: { code?: string }) => {
          if (e?.code === 'unavailable' && !this.retried) {
            // Transient: try once more shortly (unless newer data is already queued).
            this.retried = true;
            this.pending ??= body;
            this.timer = window.setTimeout(() => void this.flush(), 1500 + Math.random() * 1500);
          } else this.setStatus(e?.code === 'invalid_argument' || e?.code === 'revoked' ? 'off' : 'error');
        },
      )
      .finally(() => {
        this.writing = null;
      });
    await this.writing;
  }
}
