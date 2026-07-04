import { scheduleEvenSpread, SchedulableItem } from '../scheduling';

const item = (id: string, overrides: Partial<SchedulableItem> = {}): SchedulableItem => ({
  id,
  priority: 'Medium',
  hours: 2,
  earliest: '2026-07-01',
  latest: '2026-07-07',
  ...overrides,
});

const base = { availableHoursPerDay: 24, dailyRoutineHours: {}, fixedHours: {} };

describe('scheduleEvenSpread (FR-19 / FR-19a / FR-23)', () => {
  it('spreads equal-priority tasks evenly instead of piling them on one day', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => item(id));
    const { assignments } = scheduleEvenSpread({ ...base, items });
    const dates = new Set(Object.values(assignments));
    expect(dates.size).toBe(7); // 7 tasks over a 7-day window → one per day
  });

  it('places Urgent before High before Medium before Low (FR-19)', () => {
    const items = [
      item('low', { priority: 'Low' }),
      item('urgent', { priority: 'Urgent' }),
      item('medium', { priority: 'Medium' }),
      item('high', { priority: 'High' }),
    ];
    const { assignments } = scheduleEvenSpread({ ...base, items });
    expect(assignments['urgent'] < assignments['high']).toBe(true);
    expect(assignments['high'] < assignments['medium']).toBe(true);
    expect(assignments['medium'] < assignments['low']).toBe(true);
  });

  it('respects each task’s earliest/latest constraints', () => {
    const items = [item('pinned', { earliest: '2026-07-05', latest: '2026-07-05' })];
    const { assignments } = scheduleEvenSpread({ ...base, items });
    expect(assignments['pinned']).toBe('2026-07-05');
  });

  it('never exceeds availableHours − routineHours on any day (FR-19a)', () => {
    const routine: Record<string, number> = {};
    for (let d = 1; d <= 7; d++) routine[`2026-07-0${d}`] = 4;
    const items = Array.from({ length: 10 }, (_, i) => item(`t${i}`, { hours: 3 }));
    const { dayLoads, overCapacity } = scheduleEvenSpread({
      ...base,
      items,
      availableHoursPerDay: 10,
      dailyRoutineHours: routine,
    });
    // Cap per day: 10 − 4 routine = 6 non-routine hours → 2 tasks × 3h; total load ≤ 10.
    expect(overCapacity).toEqual([]);
    for (const load of Object.values(dayLoads)) expect(load).toBeLessThanOrEqual(10);
  });

  it('counts fixed-date (recurring / Phase B) hours toward the cap', () => {
    const items = [item('x', { hours: 4, earliest: '2026-07-01', latest: '2026-07-02' })];
    const { assignments } = scheduleEvenSpread({
      ...base,
      items,
      availableHoursPerDay: 8,
      fixedHours: { '2026-07-01': 6 }, // only 2h left on the 1st
    });
    expect(assignments['x']).toBe('2026-07-02');
  });

  it('reports tasks that cannot fit under the cap instead of dropping them', () => {
    const items = [
      item('big1', { hours: 20, earliest: '2026-07-01', latest: '2026-07-02' }),
      item('big2', { hours: 20, earliest: '2026-07-01', latest: '2026-07-02' }),
      item('big3', { hours: 20, earliest: '2026-07-01', latest: '2026-07-02' }),
    ];
    const { assignments, overCapacity } = scheduleEvenSpread({ ...base, items });
    expect(Object.keys(assignments)).toHaveLength(3); // all still get dates
    expect(overCapacity).toEqual(['big3']);
  });

  it('handles an empty item list', () => {
    const { assignments, overCapacity } = scheduleEvenSpread({ ...base, items: [] });
    expect(assignments).toEqual({});
    expect(overCapacity).toEqual([]);
  });
});
