// Field-level merge (NFR-3): concurrent edits to different fields of the
// same record are both preserved. A conflict arises only when the same
// field changed on both sides since the last sync with different values
// (NFR-3a) — the local value is kept until the user resolves it.

import type { FieldClock } from './fieldClock';

export interface VersionedRecord {
  fields: Record<string, unknown>;
  clock: FieldClock;
}

export interface FieldConflict {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  localAt: string;
  remoteAt: string;
}

export interface MergeOutcome {
  merged: VersionedRecord;
  conflicts: FieldConflict[];
  /** True when the merge produced values differing from the remote copy (needs push). */
  differsFromRemote: boolean;
  /** True when the merge changed the local copy (needs local write). */
  differsFromLocal: boolean;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function mergeRecord(
  local: VersionedRecord,
  remote: VersionedRecord,
  lastSyncAt: string
): MergeOutcome {
  const fields: Record<string, unknown> = {};
  const clock: FieldClock = {};
  const conflicts: FieldConflict[] = [];

  const keys = new Set([
    ...Object.keys(local.fields),
    ...Object.keys(remote.fields),
    ...Object.keys(local.clock),
    ...Object.keys(remote.clock),
  ]);

  for (const key of keys) {
    const lv = local.fields[key];
    const rv = remote.fields[key];
    const lt = local.clock[key] ?? '';
    const rt = remote.clock[key] ?? '';

    if (same(lv, rv)) {
      fields[key] = lv;
      clock[key] = lt > rt ? lt : rt;
      continue;
    }

    const localChanged = lt > lastSyncAt;
    const remoteChanged = rt > lastSyncAt;

    if (localChanged && remoteChanged) {
      // Same field edited on both sides → user decides (NFR-3a).
      conflicts.push({ field: key, localValue: lv, remoteValue: rv, localAt: lt, remoteAt: rt });
      fields[key] = lv;
      clock[key] = lt;
    } else if (remoteChanged || (!localChanged && rt > lt)) {
      fields[key] = rv;
      clock[key] = rt;
    } else {
      fields[key] = lv;
      clock[key] = lt;
    }
  }

  const merged = { fields, clock };
  return {
    merged,
    conflicts,
    differsFromRemote: !recordsEqual(merged, remote),
    differsFromLocal: !recordsEqual(merged, local),
  };
}

function recordsEqual(a: VersionedRecord, b: VersionedRecord): boolean {
  const keys = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)]);
  for (const k of keys) if (!same(a.fields[k], b.fields[k])) return false;
  return true;
}
