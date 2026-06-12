import { describe, expect, test } from 'vitest';
import { buildIcs } from './ics';
import type { EventData } from '../../../../shared/types/events';

const base: EventData = {
  id: 'ev1', title: 'A, B; C\nD', date: '2026-06-11', description: '',
  url: 'https://x.y/a\r\nb', venue: 'PMK Innsbruck',
};

describe('buildIcs', () => {
  test('rfc skeleton, uid, escaping, url sanitized', () => {
    const ics = buildIcs([base], '2026-06-11T12:00:00.000Z')!;
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//wosweat//WQL//DE');
    expect(ics).toContain('UID:ev1@wosweat');
    expect(ics).toContain('DTSTAMP:20260611T120000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260611');
    expect(ics).toContain('SUMMARY:A\\, B\\; C\\nD');
    expect(ics).toContain('URL:https://x.y/ab');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  test('time becomes local datetime DTSTART', () => {
    const ics = buildIcs([{ ...base, time: '20:30' }], '2026-06-11T12:00:00.000Z')!;
    expect(ics).toContain('DTSTART:20260611T203000');
  });
  test('lines fold at 75 octets', () => {
    const long = { ...base, title: 'Ä'.repeat(120) };
    const ics = buildIcs([long], '2026-06-11T12:00:00.000Z')!;
    const enc = new TextEncoder();
    for (const line of ics.split('\r\n')) {
      expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    }
  });
  test('empty input → null', () => {
    expect(buildIcs([], '2026-06-11T12:00:00.000Z')).toBeNull();
  });
});
