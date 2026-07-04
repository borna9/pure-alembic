// Field-level modification clocks powering merge-based sync (NFR-3).
// Every record carries a clock mapping field name → ISO timestamp of the
// last local edit. Merge rules live in src/sync/merge.ts.

export type FieldClock = Record<string, string>;

export interface Clocked {
  _clock: FieldClock;
  /** Tombstone: deletions must sync too. */
  _deleted?: boolean;
}

export function stampClock<T extends object>(
  clock: FieldClock | undefined,
  patch: Partial<T>,
  now = new Date().toISOString()
): FieldClock {
  const next = { ...(clock ?? {}) };
  for (const key of Object.keys(patch)) next[key] = now;
  return next;
}
