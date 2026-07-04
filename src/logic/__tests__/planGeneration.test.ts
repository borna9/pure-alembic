import type { FlexibleDraft, KnownDateDraft, PlanningSession, RoutineDraft } from '../../domain/planning';
import { generatePlan } from '../planGeneration';

const baseDraft = {
  priority: 'Medium' as const,
  tagNames: [],
  notes: '',
  hours: 1,
  dayFraction: null,
  prepHours: 0,
  followUpHours: 0,
};

const emptySession: PlanningSession = {
  windowStart: '2026-07-01',
  windowEnd: '2026-07-07',
  routineCategoryId: 'cat-r',
  knownCategoryId: 'cat-k',
  scheduleCategoryId: 'cat-s',
  blockCategoryId: 'cat-b',
  routineDrafts: [],
  knownDrafts: [],
  scheduleDrafts: [],
  blockDrafts: [],
};

const routine = (over: Partial<RoutineDraft> = {}): RoutineDraft => ({
  localId: over.localId ?? 'r1',
  description: 'Morning pages',
  ...baseDraft,
  ...over,
});

describe('generatePlan — Phase A (FR-11/FR-12)', () => {
  it('creates one Daily routine instance per window day', () => {
    const { tasks } = generatePlan({ ...emptySession, routineDrafts: [routine()] }, 24);
    expect(tasks).toHaveLength(7);
    expect(new Set(tasks.map((t) => t.taskType))).toEqual(new Set(['Daily routine']));
    expect(tasks.map((t) => t.dueDate)).toContain('2026-07-04');
  });

  it('computes day-fraction hours per day after earlier routines (FR-5)', () => {
    const session = {
      ...emptySession,
      routineDrafts: [
        routine({ localId: 'r1', hours: 8 }),
        routine({ localId: 'r2', dayFraction: 'Half' as const }),
      ],
    };
    const { tasks } = generatePlan(session, 24);
    const halfDay = tasks.filter((t) => t.sourceDraftId === 'r2');
    // Half of (24 − 8 routine hours) = 8.
    expect(halfDay.every((t) => t.hours === 8)).toBe(true);
  });
});

describe('generatePlan — Phase B (FR-13..FR-15)', () => {
  const known = (over: Partial<KnownDateDraft>): KnownDateDraft => ({
    localId: 'k1',
    description: 'Board meeting',
    taskType: 'Scheduled',
    mode: 'dueOnly',
    ...baseDraft,
    ...over,
  });

  it('due-date-only tasks have no start date and end at the due date (FR-14b)', () => {
    const { tasks } = generatePlan(
      { ...emptySession, knownDrafts: [known({ dueDate: '2026-07-03' })] },
      24
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].dueDate).toBe('2026-07-03');
    expect(tasks[0].startDate).toBeNull();
  });

  it('range tasks keep their start date and are due at the end date (FR-14a)', () => {
    const { tasks } = generatePlan(
      {
        ...emptySession,
        knownDrafts: [known({ mode: 'range', startDate: '2026-07-02', endDate: '2026-07-05' })],
      },
      24
    );
    expect(tasks[0].startDate).toBe('2026-07-02');
    expect(tasks[0].dueDate).toBe('2026-07-05');
  });

  it('weekly tasks recur on the chosen weekday (FR-14c)', () => {
    const { tasks } = generatePlan(
      { ...emptySession, windowEnd: '2026-07-31', knownDrafts: [known({ mode: 'weekly', weekday: 1 })] },
      24
    );
    expect(tasks.map((t) => t.dueDate)).toEqual([
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
      '2026-07-27',
    ]);
  });

  it('creates preparation and follow-up tasks around the occurrence (FR-9/FR-10)', () => {
    const { tasks } = generatePlan(
      {
        ...emptySession,
        knownDrafts: [known({ dueDate: '2026-07-04', prepHours: 2, followUpHours: 1 })],
      },
      24
    );
    const prep = tasks.find((t) => t.description.startsWith('Preparation for '));
    const follow = tasks.find((t) => t.description.startsWith('Follow up on '));
    expect(prep).toMatchObject({ taskType: 'Blocked time', hours: 2, dueDate: '2026-06-27' });
    expect(follow).toMatchObject({ taskType: 'Blocked time', hours: 1, dueDate: '2026-07-11' });
  });
});

describe('generatePlan — Phases C/D (FR-16..FR-23)', () => {
  const flexible = (over: Partial<FlexibleDraft>): FlexibleDraft => ({
    localId: over.localId ?? 'f1',
    description: 'Deep work',
    earliest: '2026-07-01',
    latest: '2026-07-07',
    repeat: 'No repeat',
    ...baseDraft,
    ...over,
  });

  it('assigns dates to no-repeat tasks within their bounds (FR-19)', () => {
    const { tasks } = generatePlan(
      {
        ...emptySession,
        scheduleDrafts: [flexible({ earliest: '2026-07-03', latest: '2026-07-05' })],
      },
      24
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskType).toBe('Need to schedule');
    expect(tasks[0].dueDate >= '2026-07-03' && tasks[0].dueDate <= '2026-07-05').toBe(true);
  });

  it('expands repeating tasks on fixed dates (FR-17)', () => {
    const { tasks } = generatePlan(
      { ...emptySession, blockDrafts: [flexible({ repeat: 'Weekly' })] },
      24
    );
    expect(tasks.map((t) => t.dueDate)).toEqual(['2026-07-01']);
  });

  it('Phase C load counts against Phase D scheduling (FR-23) and caps hold (FR-19a)', () => {
    const c = Array.from({ length: 3 }, (_, i) =>
      flexible({ localId: `c${i}`, hours: 4, earliest: '2026-07-01', latest: '2026-07-03' })
    );
    const d = Array.from({ length: 3 }, (_, i) =>
      flexible({ localId: `d${i}`, hours: 4, earliest: '2026-07-01', latest: '2026-07-03' })
    );
    const { tasks, overCapacityIds } = generatePlan(
      { ...emptySession, scheduleDrafts: c, blockDrafts: d },
      8
    );
    expect(overCapacityIds).toEqual([]);
    const loads: Record<string, number> = {};
    for (const t of tasks) loads[t.dueDate] = (loads[t.dueDate] ?? 0) + t.hours;
    for (const load of Object.values(loads)) expect(load).toBeLessThanOrEqual(8);
  });

  it('flags tasks that cannot fit under the cap', () => {
    const { overCapacityIds } = generatePlan(
      {
        ...emptySession,
        scheduleDrafts: [
          flexible({ localId: 'a', hours: 20, latest: '2026-07-01' }),
          flexible({ localId: 'b', hours: 20, latest: '2026-07-01' }),
        ],
      },
      24
    );
    expect(overCapacityIds).toHaveLength(1);
  });
});
