/** Minimal typed event emitter. */
export class Emitter<Events extends { [K in keyof Events]: unknown }> {
  private handlers = new Map<keyof Events, Set<(payload: never) => void>>();

  on<K extends keyof Events>(type: K, fn: (payload: Events[K]) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as (payload: never) => void);
    return () => set!.delete(fn as (payload: never) => void);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    // Listeners are presentation (sound, effects, UI): one failing must not stop the simulation that emits.
    for (const fn of set)
      try {
        (fn as (p: Events[K]) => void)(payload);
      } catch (e) {
        console.error('event', String(type), e);
      }
  }

  clear(): void {
    this.handlers.clear();
  }
}
