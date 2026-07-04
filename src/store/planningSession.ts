// In-progress Screen 1 planning session (SRS §4.2). Persisted so an
// interrupted session survives an app restart (NFR-2).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  FlexibleDraft,
  KnownDateDraft,
  PlanningSession,
  RoutineDraft,
} from '../domain/planning';

export const WIZARD_STEPS = [
  'window',
  'routines',
  'known',
  'schedule',
  'block',
  'review',
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

interface SessionState extends PlanningSession {
  step: WizardStep;
  started: boolean;

  start: () => void;
  reset: () => void;
  goTo: (step: WizardStep) => void;
  next: () => void;
  back: () => void;

  setWindow: (start: string, end: string) => void;
  setCategory: (
    phase: 'routineCategoryId' | 'knownCategoryId' | 'scheduleCategoryId' | 'blockCategoryId',
    categoryId: string | null
  ) => void;
  addRoutine: (d: RoutineDraft) => void;
  addKnown: (d: KnownDateDraft) => void;
  addSchedule: (d: FlexibleDraft) => void;
  addBlock: (d: FlexibleDraft) => void;
  removeDraft: (list: 'routineDrafts' | 'knownDrafts' | 'scheduleDrafts' | 'blockDrafts', localId: string) => void;
}

const emptySession: PlanningSession = {
  windowStart: '',
  windowEnd: '',
  routineCategoryId: null,
  knownCategoryId: null,
  scheduleCategoryId: null,
  blockCategoryId: null,
  routineDrafts: [],
  knownDrafts: [],
  scheduleDrafts: [],
  blockDrafts: [],
};

export const usePlanningSession = create<SessionState>()(
  persist(
    (set, get) => ({
      ...emptySession,
      step: 'window',
      started: false,

      start: () => set({ ...emptySession, step: 'window', started: true }),
      reset: () => set({ ...emptySession, step: 'window', started: false }),
      goTo: (step) => set({ step }),
      next: () => {
        const i = WIZARD_STEPS.indexOf(get().step);
        if (i < WIZARD_STEPS.length - 1) set({ step: WIZARD_STEPS[i + 1] });
      },
      back: () => {
        const i = WIZARD_STEPS.indexOf(get().step);
        if (i > 0) set({ step: WIZARD_STEPS[i - 1] });
      },

      setWindow: (windowStart, windowEnd) => set({ windowStart, windowEnd }),
      setCategory: (phase, categoryId) => set({ [phase]: categoryId } as Partial<SessionState>),
      addRoutine: (d) => set((s) => ({ routineDrafts: [...s.routineDrafts, d] })),
      addKnown: (d) => set((s) => ({ knownDrafts: [...s.knownDrafts, d] })),
      addSchedule: (d) => set((s) => ({ scheduleDrafts: [...s.scheduleDrafts, d] })),
      addBlock: (d) => set((s) => ({ blockDrafts: [...s.blockDrafts, d] })),
      removeDraft: (list, localId) =>
        set((s) => ({ [list]: s[list].filter((d) => d.localId !== localId) }) as Partial<SessionState>),
    }),
    { name: 'pure-alembic-session', storage: createJSONStorage(() => AsyncStorage) }
  )
);
