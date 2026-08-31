// Cloud synchronization engine (NFR-1..NFR-3a).
//
// Cloud schema (supabase/migrations): one row per record with
//   id uuid, user_id uuid, data jsonb, clock jsonb, deleted bool, updated_at timestamptz
// Sync: pull rows updated since the last sync, field-merge them into the
// local store (mergeRecord), queue conflicts, then push local records
// whose clocks advanced past the last sync.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { newId } from '../lib/id';
import { useDataStore } from '../store/dataStore';
import { usePlanningSession } from '../store/planningSession';
import { useSettingsStore } from '../store/settingsStore';
import { getSupabase, isBackendConfigured } from '../supabase/client';
import type { Clocked, FieldClock } from './fieldClock';
import { useConflictStore } from './conflictStore';
import { mergeRecord } from './merge';

type TableName = 'tasks' | 'tags' | 'categories';
const TABLES: TableName[] = ['categories', 'tags', 'tasks'];

interface SyncMeta {
  lastSyncAt: Record<string, string>;
  setLastSyncAt: (table: string, at: string) => void;
}

export const useSyncMeta = create<SyncMeta>()(
  persist(
    (set) => ({
      lastSyncAt: {},
      setLastSyncAt: (table, at) =>
        set((s) => ({ lastSyncAt: { ...s.lastSyncAt, [table]: at } })),
    }),
    { name: 'pure-alembic-syncmeta', storage: createJSONStorage(() => AsyncStorage) }
  )
);

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
}

const EPOCH = '1970-01-01T00:00:00Z';

function splitRecord(rec: Clocked & { id: string }): { fields: Record<string, unknown>; clock: FieldClock } {
  const { _clock, _deleted, ...fields } = rec as unknown as Record<string, unknown> & Clocked;
  if (_deleted !== undefined) (fields as Record<string, unknown>)._deleted = _deleted;
  return { fields, clock: _clock ?? {} };
}

function maxClock(clock: FieldClock): string {
  let max = '';
  for (const t of Object.values(clock)) if (t > max) max = t;
  return max;
}

export async function syncNow(): Promise<SyncResult> {
  if (!isBackendConfigured()) throw new Error('Cloud backend is not configured.');
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Sign in to sync.');

  const meta = useSyncMeta.getState();
  const conflictStore = useConflictStore.getState();
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0 };

  for (const table of TABLES) {
    const lastSyncAt = meta.lastSyncAt[table] ?? EPOCH;
    const syncStartedAt = new Date().toISOString();
    const local = localRecords(table);

    // ---- Pull & merge ----
    const { data: remoteRows, error: pullError } = await supabase
      .from(table)
      .select('id, data, clock, deleted')
      .gt('updated_at', lastSyncAt);
    if (pullError) throw new Error(`Pull ${table}: ${pullError.message}`);

    const needPush = new Set<string>();
    for (const row of remoteRows ?? []) {
      const remote = {
        fields: { ...(row.data as Record<string, unknown>), _deleted: row.deleted || undefined },
        clock: (row.clock as FieldClock) ?? {},
      };
      const localRec = local.get(row.id);
      if (!localRec) {
        writeLocal(table, row.id, remote.fields, remote.clock);
        result.pulled++;
        continue;
      }
      const { merged, conflicts, differsFromLocal, differsFromRemote } = mergeRecord(
        splitRecord(localRec),
        remote,
        lastSyncAt
      );
      if (differsFromLocal) {
        writeLocal(table, row.id, merged.fields, merged.clock);
        result.pulled++;
      }
      if (differsFromRemote) needPush.add(row.id);
      for (const c of conflicts) {
        if (c.field === '_deleted') continue; // deletion wins are handled by merge
        conflictStore.add({
          id: `${table}:${row.id}:${c.field}`,
          table,
          recordId: row.id,
          field: c.field,
          recordLabel: labelFor(table, row.id),
          localValue: c.localValue,
          remoteValue: c.remoteValue,
          localAt: c.localAt,
          remoteAt: c.remoteAt,
        });
        result.conflicts++;
      }
    }

    // ---- Push ----
    const fresh = localRecords(table); // re-read after merges
    const upserts: Record<string, unknown>[] = [];
    for (const [id, rec] of fresh) {
      const { fields, clock } = splitRecord(rec);
      if (maxClock(clock) > lastSyncAt || needPush.has(id)) {
        const { _deleted, ...data } = fields;
        upserts.push({
          id,
          user_id: userId,
          data,
          clock,
          deleted: Boolean(_deleted),
          updated_at: new Date().toISOString(),
        });
      }
    }
    if (upserts.length > 0) {
      const { error: pushError } = await supabase.from(table).upsert(upserts);
      if (pushError) throw new Error(`Push ${table}: ${pushError.message}`);
      result.pushed += upserts.length;
    }

    meta.setLastSyncAt(table, syncStartedAt);
  }

  await syncPlanningSession(supabase, userId, result);

  return result;
}

// The in-progress planning session syncs as a single record so a session
// started on one device can be continued on another. Same-field edits
// from two devices resolve last-writer-wins per field (it is transient
// working state, so no conflict UI).
const SESSION_FIELDS = [
  'windowStart',
  'windowEnd',
  'routineCategoryId',
  'knownCategoryId',
  'scheduleCategoryId',
  'blockCategoryId',
  'routineDrafts',
  'knownDrafts',
  'scheduleDrafts',
  'blockDrafts',
  'reviewEdits',
  'reviewRemoved',
  'step',
  'started',
] as const;

async function syncPlanningSession(
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
  result: SyncResult
): Promise<void> {
  const meta = useSyncMeta.getState();
  const lastSyncAt = meta.lastSyncAt['planning_sessions'] ?? EPOCH;
  const syncStartedAt = new Date().toISOString();

  const s = usePlanningSession.getState();
  const localFields: Record<string, unknown> = {};
  for (const f of SESSION_FIELDS) localFields[f] = s[f];
  const local = { fields: localFields, clock: s._clock ?? {} };

  // A pristine session (never touched on this device) must not be pushed —
  // it would compete with, and could overwrite, real work from another
  // device that predates clock stamping.
  const pristine =
    !s.started &&
    !s.windowStart &&
    s.routineDrafts.length + s.knownDrafts.length + s.scheduleDrafts.length + s.blockDrafts.length === 0 &&
    Object.keys(s._clock ?? {}).length === 0;

  const { data: rows, error } = await supabase
    .from('planning_sessions')
    .select('id, data, clock, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`Pull planning session: ${error.message}`);
  const remoteRow = rows?.[0];
  const cloudId = remoteRow?.id ?? s.cloudId ?? newId();

  let merged = local;
  if (remoteRow) {
    // Fields written before clock-stamping existed carry no timestamp;
    // give them the row's updated_at so they still win over an untouched
    // local field instead of being silently discarded.
    const rowStamp = new Date(remoteRow.updated_at as string).toISOString();
    const remoteClock: FieldClock = { ...((remoteRow.clock as FieldClock) ?? {}) };
    const remoteFields = remoteRow.data as Record<string, unknown>;
    for (const f of SESSION_FIELDS) {
      if (f in remoteFields && !remoteClock[f]) remoteClock[f] = rowStamp;
    }
    const remote = { fields: remoteFields, clock: remoteClock };
    const outcome = mergeRecord(local, remote, lastSyncAt);
    // LWW: on a same-field conflict the newer edit wins outright.
    for (const c of outcome.conflicts) {
      if (c.remoteAt > c.localAt) {
        outcome.merged.fields[c.field] = c.remoteValue;
        outcome.merged.clock[c.field] = c.remoteAt;
      }
    }
    merged = outcome.merged;
    if (JSON.stringify(merged.fields) !== JSON.stringify(localFields)) {
      usePlanningSession.setState({ ...(merged.fields as object), _clock: merged.clock, cloudId });
      result.pulled++;
    }
  }
  if (s.cloudId !== cloudId) usePlanningSession.setState({ cloudId });

  const remoteData = remoteRow ? JSON.stringify(remoteRow.data) : null;
  if ((!pristine || remoteRow) && remoteData !== JSON.stringify(merged.fields)) {
    const { error: pushError } = await supabase.from('planning_sessions').upsert({
      id: cloudId,
      user_id: userId,
      data: merged.fields,
      clock: merged.clock,
      deleted: false,
      updated_at: new Date().toISOString(),
    });
    if (pushError) throw new Error(`Push planning session: ${pushError.message}`);
    result.pushed++;
  }

  meta.setLastSyncAt('planning_sessions', syncStartedAt);
}

function localRecords(table: TableName): Map<string, Clocked & { id: string }> {
  const s = useDataStore.getState();
  const source = table === 'tasks' ? s.tasks : table === 'tags' ? s.tags : s.categories;
  return new Map(Object.entries(source));
}

function writeLocal(
  table: TableName,
  id: string,
  fields: Record<string, unknown>,
  clock: FieldClock
) {
  const { _deleted, ...rest } = fields;
  const rec = { ...rest, id, _clock: clock, _deleted: Boolean(_deleted) || undefined };
  useDataStore.setState((s) => ({ [table]: { ...s[table], [id]: rec } }) as never);
}

function labelFor(table: TableName, id: string): string {
  const s = useDataStore.getState();
  if (table === 'tasks') return s.tasks[id]?.description ?? id;
  if (table === 'tags') return s.tags[id]?.name ?? id;
  return s.categories[id]?.name ?? id;
}

/** Apply the user's conflict resolution (NFR-3a) and drop the conflict. */
export function resolveConflict(conflictId: string, value: unknown): void {
  const conflict = useConflictStore.getState().conflicts[conflictId];
  if (!conflict) return;
  const now = new Date().toISOString();
  useDataStore.setState((s) => {
    const source = conflict.table === 'tasks' ? s.tasks : conflict.table === 'tags' ? s.tags : s.categories;
    const rec = source[conflict.recordId] as unknown as Record<string, unknown> & Clocked;
    if (!rec) return s;
    const next = {
      ...rec,
      [conflict.field]: value,
      _clock: { ...rec._clock, [conflict.field]: now },
    };
    return { [conflict.table]: { ...source, [conflict.recordId]: next } } as never;
  });
  useConflictStore.getState().remove(conflictId);
}

/** NFR-3: sync automatically when connectivity returns (web online event / app start). */
export function registerAutoSync(): () => void {
  if (typeof window !== 'undefined' && 'addEventListener' in window) {
    const handler = () => {
      syncNow().catch(() => {}); // offline or signed out — retried on next trigger
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }
  return () => {};
}
