import { makeFollowUpTask, makePreparationTask } from '../prepFollowUp';

const parent = { id: 'p1', description: 'Quarterly report', tagIds: ['t1', 't2'] };

describe('makePreparationTask (FR-9)', () => {
  it('prefixes the description, blocks time, and lands one week before the first occurrence', () => {
    const prep = makePreparationTask(parent, 3, '2026-07-15');
    expect(prep.description).toBe('Preparation for Quarterly report');
    expect(prep.taskType).toBe('Blocked time');
    expect(prep.hours).toBe(3);
    expect(prep.dueDate).toBe('2026-07-08');
    expect(prep.tagIds).toEqual(['t1', 't2']);
    expect(prep.parentTaskId).toBe('p1');
  });
});

describe('makeFollowUpTask (FR-10)', () => {
  it('prefixes the description and lands one week after the last occurrence', () => {
    const follow = makeFollowUpTask(parent, 1.5, '2026-07-15');
    expect(follow.description).toBe('Follow up on Quarterly report');
    expect(follow.taskType).toBe('Blocked time');
    expect(follow.hours).toBe(1.5);
    expect(follow.dueDate).toBe('2026-07-22');
  });
});
