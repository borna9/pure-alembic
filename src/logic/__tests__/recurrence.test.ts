import {
  expandDailyRoutine,
  expandMonthlyByDay,
  expandRepeat,
  expandWeeklyByWeekday,
} from '../recurrence';

describe('expandDailyRoutine (FR-12)', () => {
  it('creates one instance per day, inclusive of both window ends', () => {
    expect(expandDailyRoutine('2026-07-01', '2026-07-05')).toHaveLength(5);
  });
});

describe('expandWeeklyByWeekday (FR-14c)', () => {
  it('returns each matching weekday in the window', () => {
    // Mondays in July 2026: 6, 13, 20, 27
    expect(expandWeeklyByWeekday('2026-07-01', '2026-07-31', 1)).toEqual([
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
      '2026-07-27',
    ]);
  });
});

describe('expandMonthlyByDay (FR-14d)', () => {
  it('returns the given day for each month in the window', () => {
    expect(expandMonthlyByDay('2026-07-01', '2026-09-30', 15)).toEqual([
      '2026-07-15',
      '2026-08-15',
      '2026-09-15',
    ]);
  });

  it('skips months that lack the day', () => {
    expect(expandMonthlyByDay('2026-01-01', '2026-03-31', 31)).toEqual([
      '2026-01-31',
      '2026-03-31', // February has no 31st
    ]);
  });
});

describe('expandRepeat (FR-17)', () => {
  it('yields nothing for "No repeat" (scheduler assigns the date)', () => {
    expect(expandRepeat('2026-07-01', '2026-07-31', 'No repeat')).toEqual([]);
  });

  it('Daily covers every day of the range', () => {
    expect(expandRepeat('2026-07-01', '2026-07-03', 'Daily')).toHaveLength(3);
  });

  it('Weekly recurs on the same weekday as the start date', () => {
    expect(expandRepeat('2026-07-01', '2026-07-31', 'Weekly')).toEqual([
      '2026-07-01',
      '2026-07-08',
      '2026-07-15',
      '2026-07-22',
      '2026-07-29',
    ]);
  });

  it('Biweekly recurs every 14 days from the start date', () => {
    expect(expandRepeat('2026-07-01', '2026-07-31', 'Biweekly')).toEqual([
      '2026-07-01',
      '2026-07-15',
      '2026-07-29',
    ]);
  });

  it('Monthly recurs on the same day of month as the start date', () => {
    expect(expandRepeat('2026-07-10', '2026-09-30', 'Monthly')).toEqual([
      '2026-07-10',
      '2026-08-10',
      '2026-09-10',
    ]);
  });

  it('returns empty when the range is inverted', () => {
    expect(expandRepeat('2026-07-31', '2026-07-01', 'Daily')).toEqual([]);
  });
});
