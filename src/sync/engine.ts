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
import { useDataStore } from '../store/dataStore';
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

  return result;
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
