export type QuerySnapshot = Readonly<{
  status: "idle" | "loading" | "success" | "error";
  data: unknown;
  error: Error | null;
  updatedAt: number;
}>;

const empty: QuerySnapshot = Object.freeze({
  status: "idle", data: undefined, error: null, updatedAt: 0,
});

/** Shared snapshots with deduplication and protection against stale sessions. */
export class QueryStore {
  private snapshots = new Map<string, QuerySnapshot>();
  private listeners = new Map<string, Set<() => void>>();
  private pending = new Map<string, Promise<void>>();
  private generation = 0;

  get(key: string): QuerySnapshot { return this.snapshots.get(key) ?? empty; }

  subscribe(key: string, listener: () => void): () => void {
    const listeners = this.listeners.get(key) ?? new Set();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(key);
    };
  }

  private publish(key: string, snapshot: QuerySnapshot): void {
    this.snapshots.set(key, Object.freeze(snapshot));
    for (const listener of this.listeners.get(key) ?? []) listener();
  }

  invalidateAll(): void {
    this.generation += 1;
    this.pending.clear();
    this.snapshots.clear();
    for (const listeners of this.listeners.values())
      for (const listener of listeners) listener();
  }

  load(key: string, fetcher: () => Promise<unknown>, force = false): Promise<void> {
    const existing = this.pending.get(key);
    if (existing) return existing;
    const previous = this.get(key);
    if (!force && previous.status === "success" && Date.now() - previous.updatedAt < 15000)
      return Promise.resolve();
    const generation = this.generation;
    this.publish(key, { ...previous, status: "loading", error: null });
    const task = Promise.resolve().then(fetcher).then(
      (data) => {
        if (generation === this.generation)
          this.publish(key, { status: "success", data, error: null, updatedAt: Date.now() });
      },
      (cause: unknown) => {
        if (generation === this.generation)
          this.publish(key, { ...previous, status: "error", error: cause instanceof Error ? cause : new Error(String(cause)) });
      },
    ).finally(() => {
      if (this.pending.get(key) === task) this.pending.delete(key);
    });
    this.pending.set(key, task);
    return task;
  }
}

export const queryStore = new QueryStore();
