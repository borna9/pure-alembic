import { mergeRecord } from '../merge';

const T0 = '2026-07-01T00:00:00Z'; // last sync
const T1 = '2026-07-02T00:00:00Z';
const T2 = '2026-07-03T00:00:00Z';

describe('mergeRecord (NFR-3 / NFR-3a)', () => {
  it('preserves edits to different fields from both sides', () => {
    const local = { fields: { description: 'Edited locally', hours: 2 }, clock: { description: T1, hours: T0 } };
    const remote = { fields: { description: 'Original', hours: 5 }, clock: { description: T0, hours: T2 } };
    const { merged, conflicts } = mergeRecord(local, remote, T0);
    expect(conflicts).toEqual([]);
    expect(merged.fields).toEqual({ description: 'Edited locally', hours: 5 });
  });

  it('flags a conflict when the same field changed on both sides', () => {
    const local = { fields: { description: 'Local edit' }, clock: { description: T1 } };
    const remote = { fields: { description: 'Remote edit' }, clock: { description: T2 } };
    const { merged, conflicts } = mergeRecord(local, remote, T0);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      field: 'description',
      localValue: 'Local edit',
      remoteValue: 'Remote edit',
    });
    // Local value kept until the user resolves.
    expect(merged.fields.description).toBe('Local edit');
  });

  it('does not conflict when both sides wrote the same value', () => {
    const local = { fields: { hours: 3 }, clock: { hours: T1 } };
    const remote = { fields: { hours: 3 }, clock: { hours: T2 } };
    const { conflicts, merged } = mergeRecord(local, remote, T0);
    expect(conflicts).toEqual([]);
    expect(merged.clock.hours).toBe(T2);
  });

  it('takes the remote value when only the remote changed since last sync', () => {
    const local = { fields: { notes: 'old' }, clock: { notes: T0 } };
    const remote = { fields: { notes: 'newer' }, clock: { notes: T1 } };
    const { merged, differsFromLocal, differsFromRemote } = mergeRecord(local, remote, T0);
    expect(merged.fields.notes).toBe('newer');
    expect(differsFromLocal).toBe(true);
    expect(differsFromRemote).toBe(false);
  });

  it('keeps the local value when only the local side changed (push needed)', () => {
    const local = { fields: { notes: 'mine' }, clock: { notes: T2 } };
    const remote = { fields: { notes: 'old' }, clock: { notes: T0 } };
    const { merged, differsFromRemote } = mergeRecord(local, remote, T0);
    expect(merged.fields.notes).toBe('mine');
    expect(differsFromRemote).toBe(true);
  });

  it('handles fields present on only one side', () => {
    const local = { fields: { a: 1 }, clock: { a: T1 } };
    const remote = { fields: { b: 2 }, clock: { b: T1 } };
    const { merged, conflicts } = mergeRecord(local, remote, T0);
    expect(conflicts).toEqual([]);
    expect(merged.fields).toEqual({ a: 1, b: 2 });
  });
});
