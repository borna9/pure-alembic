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
import { newId } from '../lib/id';
import { FieldClock, stampClock } from '../sync/fieldClock';

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
  /** Field-modification clock for cross-device session sync. */
  _clock: FieldClock;
  /** Cloud row id of this user's session record (adopted on first sync). */
  cloudId: string | null;
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

  setName: (name: string) => void;
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
  name: '',
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
    (set, get) => {
      // Every user mutation stamps the touched fields so the session can
      // field-merge across devices like any other synced record.
      const mutate = (patch: Partial<SessionState>) =>
        set({ ...patch, _clock: stampClock(get()._clock, patch) } as Partial<SessionState>);

      return {
        ...emptySession,
        step: 'window',
        started: false,
        _clock: {},
        cloudId: null,

        // Starting or resetting begins a NEW session record; the previous
        // one stays in the cloud as its own row (recoverable from the
        // sessions list).
        start: () => mutate({ ...emptySession, step: 'window', started: true, cloudId: newId() } as Partial<SessionState>),
        reset: () => mutate({ ...emptySession, step: 'window', started: false, cloudId: newId() } as Partial<SessionState>),
        goTo: (step) => mutate({ step }),
        next: () => {
          const i = WIZARD_STEPS.indexOf(get().step);
          if (i < WIZARD_STEPS.length - 1) mutate({ step: WIZARD_STEPS[i + 1] });
        },
        back: () => {
          const i = WIZARD_STEPS.indexOf(get().step);
          if (i > 0) mutate({ step: WIZARD_STEPS[i - 1] });
        },

        setName: (name) => mutate({ name }),
        setWindow: (windowStart, windowEnd) => mutate({ windowStart, windowEnd, ...clearReview }),
        setCategory: (phase, categoryId) => mutate({ [phase]: categoryId } as Partial<SessionState>),
        addRoutine: (d) => mutate({ routineDrafts: [...get().routineDrafts, d], ...clearReview }),
        addKnown: (d) => mutate({ knownDrafts: [...get().knownDrafts, d], ...clearReview }),
        addSchedule: (d) => mutate({ scheduleDrafts: [...get().scheduleDrafts, d], ...clearReview }),
        addBlock: (d) => mutate({ blockDrafts: [...get().blockDrafts, d], ...clearReview }),
        removeDraft: (list, localId) =>
          mutate({ [list]: get()[list].filter((d) => d.localId !== localId), ...clearReview } as Partial<SessionState>),

        editReview: (localIds, patch) => {
          const reviewEdits = { ...get().reviewEdits };
          for (const id of localIds) reviewEdits[id] = { ...reviewEdits[id], ...patch };
          mutate({ reviewEdits });
        },
        removeReview: (localIds) =>
          mutate({ reviewRemoved: [...new Set([...get().reviewRemoved, ...localIds])] }),
      };
    },
    { name: 'pure-alembic-session', storage: createJSONStorage(() => AsyncStorage) }
  )
);
