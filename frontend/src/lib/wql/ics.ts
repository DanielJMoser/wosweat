import type { EventData } from '../../../../shared/types/events';

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|[\r\n]/g, '\\n');
}

function sanitizeUrl(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001F\u007F]/g, '');
}

function fold(line: string): string[] {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    if (bytes + len > 75) {
      out.push(current);
      current = ' ';
      bytes = 1;
    }
    current += ch;
    bytes += len;
  }
  out.push(current);
  return out;
}

export function buildIcs(events: EventData[], nowIso: string): string | null {
  if (events.length === 0) return null;
  const dtstamp = nowIso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//wosweat//WQL//DE'];
  for (const e of events.slice(0, 500)) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${esc(e.id ?? '')}@wosweat`);
    lines.push(`DTSTAMP:${dtstamp}`);
    const day = e.date?.replace(/-/g, '') ?? '';
    if (e.time && /^\d{2}:\d{2}$/.test(e.time)) {
      lines.push(`DTSTART:${day}T${e.time.replace(':', '')}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${day}`);
    }
    lines.push(`SUMMARY:${esc(e.title ?? '')}`);
    if (e.venue) lines.push(`LOCATION:${esc(e.venue)}`);
    if (e.url) lines.push(`URL:${sanitizeUrl(e.url)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.flatMap(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
