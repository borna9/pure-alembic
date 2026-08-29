// In-progress Screen 1 planning session (SRS §4.2). Persisted so an
// interrupted session survives an app restart (NFR-2).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  FlexibleDraft,
  GeneratedTask,
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
  /**
   * Phase E review overlay (FR-24), persisted so edits survive step
   * navigation and app restarts. Keyed by generated-task localId, which
   * is deterministic for a given set of drafts; any draft or window
   * change invalidates and clears the overlay.
   */
  reviewEdits: Record<string, Partial<GeneratedTask>>;
  reviewRemoved: string[];

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

  editReview: (localIds: string[], patch: Partial<GeneratedTask>) => void;
  removeReview: (localIds: string[]) => void;
}

const emptySession: PlanningSession & Pick<SessionState, 'reviewEdits' | 'reviewRemoved'> = {
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
  reviewEdits: {},
  reviewRemoved: [],
};

/** Draft/window changes shift generated ids — stale overlays must go. */
const clearReview = { reviewEdits: {} as Record<string, Partial<GeneratedTask>>, reviewRemoved: [] as string[] };

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

      setWindow: (windowStart, windowEnd) => set({ windowStart, windowEnd, ...clearReview }),
      setCategory: (phase, categoryId) => set({ [phase]: categoryId } as Partial<SessionState>),
      addRoutine: (d) => set((s) => ({ routineDrafts: [...s.routineDrafts, d], ...clearReview })),
      addKnown: (d) => set((s) => ({ knownDrafts: [...s.knownDrafts, d], ...clearReview })),
      addSchedule: (d) => set((s) => ({ scheduleDrafts: [...s.scheduleDrafts, d], ...clearReview })),
      addBlock: (d) => set((s) => ({ blockDrafts: [...s.blockDrafts, d], ...clearReview })),
      removeDraft: (list, localId) =>
        set(
          (s) =>
            ({ [list]: s[list].filter((d) => d.localId !== localId), ...clearReview }) as Partial<SessionState>
        ),

      editReview: (localIds, patch) =>
        set((s) => {
          const reviewEdits = { ...s.reviewEdits };
          for (const id of localIds) reviewEdits[id] = { ...reviewEdits[id], ...patch };
          return { reviewEdits };
        }),
      removeReview: (localIds) =>
        set((s) => ({ reviewRemoved: [...new Set([...s.reviewRemoved, ...localIds])] })),
    }),
    { name: 'pure-alembic-session', storage: createJSONStorage(() => AsyncStorage) }
  )
);
