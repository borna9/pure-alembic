// Bidirectional calendar reconciliation: given the task's fields, the
// event's fields, and the last-synced snapshot, decide which way to sync.

import type { ExternalSnapshot } from '../domain/types';

export type ReconcileAction =
  | { kind: 'none' }
  /** Calendar changed (or no baseline yet) → update the app task. */
  | { kind: 'pull'; fields: ExternalSnapshot }
  /** App task changed → update the calendar event. */
  | { kind: 'push'; fields: ExternalSnapshot }
  /** Both changed since the last sync → calendar wins (documented policy). */
  | { kind: 'conflict-pull'; fields: ExternalSnapshot };

const same = (a: ExternalSnapshot, b: ExternalSnapshot) =>
  a.dueDate === b.dueDate &&
  (a.startTime ?? null) === (b.startTime ?? null) &&
  Math.abs(a.hours - b.hours) < 0.01 &&
  a.description === b.description;

export function reconcile(
  task: ExternalSnapshot,
  event: ExternalSnapshot,
  snapshot: ExternalSnapshot | null
): ReconcileAction {
  if (!snapshot) {
    // No baseline (delivered before snapshots existed): calendar wins once,
    // and the result becomes the baseline.
    return same(task, event) ? { kind: 'none' } : { kind: 'pull', fields: event };
  }
  const eventChanged = !same(event, snapshot);
  const taskChanged = !same(task, snapshot);
  if (eventChanged && taskChanged) return { kind: 'conflict-pull', fields: event };
  if (eventChanged) return { kind: 'pull', fields: event };
  if (taskChanged) return { kind: 'push', fields: task };
  return { kind: 'none' };
}
