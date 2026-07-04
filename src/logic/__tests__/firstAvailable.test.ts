import { firstAvailableTime } from '../firstAvailable';

describe('firstAvailableTime (FR-26)', () => {
  it('starts at the beginning of the day when nothing is planned', () => {
    expect(firstAvailableTime([], 2)).toBe('09:00');
  });

  it('starts after existing items when the morning is taken', () => {
    expect(firstAvailableTime([{ startTime: '09:00', hours: 2 }], 1)).toBe('11:00');
  });

  it('uses a gap between items when the task fits', () => {
    const busy = [
      { startTime: '09:00', hours: 1 },
      { startTime: '12:00', hours: 2 },
    ];
    expect(firstAvailableTime(busy, 2)).toBe('10:00');
  });

  it('skips gaps that are too small', () => {
    const busy = [
      { startTime: '09:00', hours: 1 },
      { startTime: '11:00', hours: 2 },
    ];
    expect(firstAvailableTime(busy, 2)).toBe('13:00');
  });

  it('falls back to 09:00 when the day is fully booked (FR-26)', () => {
    expect(firstAvailableTime([{ startTime: '09:00', hours: 15 }], 2)).toBe('09:00');
  });

  it('ignores ordering of the busy list', () => {
    const busy = [
      { startTime: '12:00', hours: 2 },
      { startTime: '09:00', hours: 3 },
    ];
    expect(firstAvailableTime(busy, 1)).toBe('14:00');
  });
});
