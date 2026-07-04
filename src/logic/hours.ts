// FR-5: hours entry — either a number of hours, or a day fraction
// computed from the hours still available on the task's day.

export const DAY_FRACTIONS = ['Full', 'Half', 'Quarter'] as const;
export type DayFraction = (typeof DAY_FRACTIONS)[number];

const FRACTION_RATIO: Record<DayFraction, number> = {
  Full: 1,
  Half: 0.5,
  Quarter: 0.25,
};

/**
 * available = availableHoursPerDay (FR-32) − daily-routine hours already
 * planned for that day; Full/Half/Quarter = 100/50/25 % of available.
 */
export function inferHours(
  fraction: DayFraction,
  availableHoursPerDay: number,
  dailyRoutineHoursForDay: number
): number {
  const available = Math.max(0, availableHoursPerDay - dailyRoutineHoursForDay);
  return available * FRACTION_RATIO[fraction];
}
