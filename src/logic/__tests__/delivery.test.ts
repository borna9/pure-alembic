import { deliveryTarget } from '../delivery';

describe('deliveryTarget', () => {
  it('sends dated tasks with hours to the calendar', () => {
    expect(deliveryTarget({ dueDate: '2026-09-01', hours: 2, taskType: 'Scheduled' })).toBe('calendar');
    expect(deliveryTarget({ dueDate: '2026-09-01', hours: 0.5, taskType: 'Blocked time' })).toBe('calendar');
  });

  it('never sends daily routines to the calendar (owner policy)', () => {
    expect(deliveryTarget({ dueDate: '2026-09-01', hours: 8, taskType: 'Daily routine' })).toBe('reminder');
  });

  it('sends undated or zero-hour tasks to reminders (FR-27)', () => {
    expect(deliveryTarget({ dueDate: '', hours: 2, taskType: 'Scheduled' })).toBe('reminder');
    expect(deliveryTarget({ dueDate: '2026-09-01', hours: 0, taskType: 'Scheduled' })).toBe('reminder');
  });
});
