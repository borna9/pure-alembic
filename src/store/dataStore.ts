// Offline-first local store (NFR-2): all task/tag/category data lives
// on-device in AsyncStorage; the sync engine mirrors it to the cloud.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Category, Tag, Task } from '../domain/types';
import { newId } from '../lib/id';
import { Clocked, stampClock } from '../sync/fieldClock';

export type StoredTask = Task & Clocked;
export type StoredTag = Tag & Clocked;
export type StoredCategory = Category & Clocked;

interface DataState {
  tasks: Record<string, StoredTask>;
  tags: Record<string, StoredTag>;
  categories: Record<string, StoredCategory>;

  createCategory: (name: string) => StoredCategory;
  /** DR-5/DR-6 select-or-create: reuse an existing tag by name (case-insensitive) or create one. */
  findOrCreateTag: (name: string, categoryId: string) => StoredTag;
  createTask: (task: Omit<Task, 'id'>) => StoredTask;
  createTasks: (tasks: Omit<Task, 'id'>[]) => StoredTask[];
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => void;
  deleteTask: (id: string) => void;

  /** Hours of Daily-routine tasks per day — the FR-5/FR-19a baseline input. */
  dailyRoutineHoursByDay: () => Record<string, number>;
  /** Timed items on a date, for the first-available-time rule (FR-26). */
  busyItemsOn: (date: string) => { startTime: string; hours: number }[];
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      tasks: {},
      tags: {},
      categories: {},

      createCategory: (name) => {
        const cat: StoredCategory = { id: newId(), name, _clock: stampClock(undefined, { name }) };
        set((s) => ({ categories: { ...s.categories, [cat.id]: cat } }));
        return cat;
      },

      findOrCreateTag: (name, categoryId) => {
        const existing = Object.values(get().tags).find(
          (t) => !t._deleted && t.name.toLowerCase() === name.toLowerCase()
        );
        if (existing) return existing;
        const tag: StoredTag = {
          id: newId(),
          name,
          categoryId,
          _clock: stampClock(undefined, { name, categoryId }),
        };
        set((s) => ({ tags: { ...s.tags, [tag.id]: tag } }));
        return tag;
      },

      createTask: (task) => get().createTasks([task])[0],

      createTasks: (specs) => {
        const created = specs.map((spec): StoredTask => {
          const t = { ...spec, id: newId() };
          return { ...t, _clock: stampClock(undefined, t) };
        });
        set((s) => {
          const tasks = { ...s.tasks };
          for (const t of created) tasks[t.id] = t;
          return { tasks };
        });
        return created;
      },

      updateTask: (id, patch) =>
        set((s) => {
          const prev = s.tasks[id];
          if (!prev) return s;
          const next: StoredTask = { ...prev, ...patch, _clock: stampClock(prev._clock, patch) };
          return { tasks: { ...s.tasks, [id]: next } };
        }),

      deleteTask: (id) =>
        set((s) => {
          const prev = s.tasks[id];
          if (!prev) return s;
          const next: StoredTask = {
            ...prev,
            _deleted: true,
            _clock: stampClock(prev._clock, { _deleted: true }),
          };
          return { tasks: { ...s.tasks, [id]: next } };
        }),

      dailyRoutineHoursByDay: () => {
        const out: Record<string, number> = {};
        for (const t of Object.values(get().tasks)) {
          if (t._deleted || t.taskType !== 'Daily routine') continue;
          out[t.dueDate] = (out[t.dueDate] ?? 0) + t.hours;
        }
        return out;
      },

      busyItemsOn: (date) =>
        Object.values(get().tasks)
          .filter((t) => !t._deleted && t.dueDate === date && t.startTime && t.hours > 0)
          .map((t) => ({ startTime: t.startTime as string, hours: t.hours })),
    }),
    {
      name: 'pure-alembic-data',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Non-deleted tasks, newest due date first. */
export function liveTasks(tasks: Record<string, StoredTask>): StoredTask[] {
  return Object.values(tasks).filter((t) => !t._deleted);
}
