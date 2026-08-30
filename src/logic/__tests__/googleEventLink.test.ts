import { parseGoogleEventLink } from '../googleEventLink';

describe('parseGoogleEventLink', () => {
  it('decodes the event id from an htmlLink', () => {
    const eid = btoa('abc123def456 someone@gmail.com')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(parseGoogleEventLink(`https://www.google.com/calendar/event?eid=${eid}`)).toBe(
      'abc123def456'
    );
  });

  it('returns null for links without an eid', () => {
    expect(parseGoogleEventLink('https://to-do.office.com/tasks/id/x/details')).toBeNull();
    expect(parseGoogleEventLink('eventkit:ABC')).toBeNull();
  });
});
