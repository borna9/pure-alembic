import { addDays, daysBetween, dayOfMonth, dayOfWeek, eachDay, isWithin } from '../dates';

describe('date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29'); // leap year
  });

  it('computes day spans and containment', () => {
    expect(daysBetween('2026-07-01', '2026-07-31')).toBe(30);
    expect(isWithin('2026-07-15', '2026-07-01', '2026-07-31')).toBe(true);
    expect(isWithin('2026-08-01', '2026-07-01', '2026-07-31')).toBe(false);
  });

  it('enumerates inclusive day ranges', () => {
    expect(eachDay('2026-07-01', '2026-07-03')).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
    expect(eachDay('2026-07-03', '2026-07-01')).toEqual([]);
  });

  it('reports weekday and day of month', () => {
    expect(dayOfWeek('2026-07-04')).toBe(6); // Saturday
    expect(dayOfMonth('2026-07-04')).toBe(4);
  });
});
