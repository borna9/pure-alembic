// Unresolved sync conflicts awaiting the user's decision (NFR-3a).
// Sync of unaffected records continues while these are pending.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface SyncConflict {
  id: string; // `${table}:${recordId}:${field}`
  table: 'tasks' | 'tags' | 'categories' | 'user_settings';
  recordId: string;
  field: string;
  recordLabel: string;
  localValue: unknown;
  remoteValue: unknown;
  localAt: string;
  remoteAt: string;
}

interface ConflictState {
  conflicts: Record<string, SyncConflict>;
  add: (c: SyncConflict) => void;
  remove: (id: string) => void;
  count: () => number;
}

export const useConflictStore = create<ConflictState>()(
  persist(
    (set, get) => ({
      conflicts: {},
      add: (c) => set((s) => ({ conflicts: { ...s.conflicts, [c.id]: c } })),
      remove: (id) =>
        set((s) => {
          const next = { ...s.conflicts };
          delete next[id];
          return { conflicts: next };
        }),
      count: () => Object.keys(get().conflicts).length,
    }),
    { name: 'pure-alembic-conflicts', storage: createJSONStorage(() => AsyncStorage) }
  )
);
