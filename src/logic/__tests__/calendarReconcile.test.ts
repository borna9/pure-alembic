import { reconcile } from '../calendarReconcile';

const base = { dueDate: '2026-09-03', startTime: '14:00', hours: 2, description: 'Deep work' };

describe('reconcile (bidirectional calendar sync)', () => {
  it('does nothing when task, event, and snapshot agree', () => {
    expect(reconcile(base, base, base).kind).toBe('none');
  });

  it('pulls when only the calendar changed', () => {
    const event = { ...base, dueDate: '2026-09-04' };
    const action = reconcile(base, event, base);
    expect(action).toEqual({ kind: 'pull', fields: event });
  });

  it('pushes when only the app task changed', () => {
    const task = { ...base, hours: 3 };
    const action = reconcile(task, base, base);
    expect(action).toEqual({ kind: 'push', fields: task });
  });

  it('lets the calendar win when both sides changed', () => {
    const task = { ...base, hours: 3 };
    const event = { ...base, dueDate: '2026-09-05' };
    const action = reconcile(task, event, base);
    expect(action).toEqual({ kind: 'conflict-pull', fields: event });
  });

  it('treats a missing baseline as calendar-wins', () => {
    const task = { ...base, description: 'Edited in app' };
    expect(reconcile(task, base, null)).toEqual({ kind: 'pull', fields: base });
    expect(reconcile(base, base, null).kind).toBe('none');
  });

  it('ignores sub-minute hour rounding differences', () => {
    expect(reconcile({ ...base, hours: 2.004 }, base, base).kind).toBe('none');
  });
});
