import { inferHours } from '../hours';

// FR-5: Full/Half/Quarter = 100/50/25 % of (available hours − routine hours).
describe('inferHours (FR-5)', () => {
  it('computes fractions of the full day when no routine hours are planned', () => {
    expect(inferHours('Full', 24, 0)).toBe(24);
    expect(inferHours('Half', 24, 0)).toBe(12);
    expect(inferHours('Quarter', 24, 0)).toBe(6);
  });

  it('subtracts daily-routine hours before applying the fraction', () => {
    expect(inferHours('Full', 24, 8)).toBe(16);
    expect(inferHours('Half', 24, 8)).toBe(8);
    expect(inferHours('Quarter', 24, 8)).toBe(4);
  });

  it('respects a custom available-hours-per-day setting (FR-32)', () => {
    expect(inferHours('Half', 10, 2)).toBe(4);
  });

  it('never returns negative hours when routines exceed the available hours', () => {
    expect(inferHours('Full', 8, 10)).toBe(0);
  });
});
