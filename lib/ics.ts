import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { eventFromItem } from './calendar';
import type { Item } from './model';
const stamp = (value: string) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
export function recurrenceRule(item: Item) {
  if (!item.recurrence) return;
  const r = item.recurrence;
  if (!r.until || !item.startDateTime)
    throw new Error(
      'Confirm the first meeting and term end date before adding a recurring schedule.',
    );
  if (r.until < item.startDateTime.slice(0, 10))
    throw new Error('The term end must follow the first meeting.');
  const until =
    item.allDay || item.startDateTime.length === 10
      ? r.until.replaceAll('-', '')
      : stamp(fromZonedTime(r.until + 'T23:59:59', r.timezone).toISOString());
  return `RRULE:FREQ=WEEKLY;BYDAY=${r.days.join(',')};UNTIL=${until}`;
}
export function escapeICS(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
export function foldICS(line: string) {
  let result = '',
    chunk = '';
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, 'utf8');
    if (bytes + size > 75) {
      result += chunk + '\r\n';
      chunk = ' ';
      bytes = 1;
    }
    chunk += char;
    bytes += size;
  }
  return result + chunk;
}
const offset = (instant: Date, zone: string) => formatInTimeZone(instant, zone, 'xx');
const offsetMinutes = (value: string) =>
  (value[0] === '-' ? -1 : 1) * (+value.slice(1, 3) * 60 + +value.slice(3, 5));
// Explicit observances cover the bounded export interval, including DST. No dependence on a client guessing IANA names.
function timezoneComponent(zone: string, minYear: number, maxYear: number) {
  const lines = ['BEGIN:VTIMEZONE', `TZID:${zone}`, `X-LIC-LOCATION:${zone}`];
  let previous = new Date(Date.UTC(minYear, 0, 1));
  let prior = offset(previous, zone);
  lines.push(
    'BEGIN:STANDARD',
    `DTSTART:${minYear}0101T000000`,
    `TZOFFSETFROM:${prior}`,
    `TZOFFSETTO:${prior}`,
    'END:STANDARD',
  );
  for (let t = previous.getTime() + 86400000; t <= Date.UTC(maxYear + 1, 0, 1); t += 86400000) {
    const next = new Date(t),
      current = offset(next, zone);
    if (current !== prior) {
      let lo = previous.getTime(),
        hi = t;
      while (hi - lo > 60000) {
        const mid = Math.floor((lo + hi) / 120000) * 60000;
        if (offset(new Date(mid), zone) === prior) lo = mid;
        else hi = mid;
      }
      const local = new Date(hi + offsetMinutes(prior) * 60000)
        .toISOString()
        .slice(0, 19)
        .replace(/[-:]/g, '');
      const kind = offsetMinutes(current) > offsetMinutes(prior) ? 'DAYLIGHT' : 'STANDARD';
      lines.push(
        `BEGIN:${kind}`,
        `DTSTART:${local}`,
        `TZOFFSETFROM:${prior}`,
        `TZOFFSETTO:${current}`,
        `END:${kind}`,
      );
      prior = current;
    }
    previous = next;
  }
  return [...lines, 'END:VTIMEZONE'];
}
export function createICS(items: Item[], origin: string, now = new Date()) {
  if (!items.length) throw new Error('Select at least one dated item.');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pile//Personal Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  const recurring = items.filter((i) => i.recurrence && !i.allDay);
  for (const zone of new Set(recurring.map((i) => i.recurrence!.timezone))) {
    const years = recurring
      .filter((i) => i.recurrence!.timezone === zone)
      .flatMap((i) => [
        +(i.startDateTime || '').slice(0, 4),
        +(i.recurrence?.until || '').slice(0, 4),
      ]);
    if (years.some((y) => !y) || Math.max(...years) - Math.min(...years) > 10)
      throw new Error('Confirm a recurring term of ten years or less.');
    lines.push(...timezoneComponent(zone, Math.min(...years) - 1, Math.max(...years) + 1));
  }
  for (const item of items) {
    const e = eventFromItem(item, false);
    const rule = recurrenceRule(item);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@pile.local`,
      `DTSTAMP:${stamp(now.toISOString())}`,
      `SUMMARY:${escapeICS(item.title)}`,
    );
    if (e.allDay)
      lines.push(
        `DTSTART;VALUE=DATE:${e.start.slice(0, 10).replaceAll('-', '')}`,
        `DTEND;VALUE=DATE:${e.end!.slice(0, 10).replaceAll('-', '')}`,
      );
    else if (item.recurrence) {
      const zone = item.recurrence.timezone;
      lines.push(
        `DTSTART;TZID=${zone}:${formatInTimeZone(e.start, zone, "yyyyMMdd'T'HHmmss")}`,
        `DTEND;TZID=${zone}:${formatInTimeZone(e.end!, zone, "yyyyMMdd'T'HHmmss")}`,
      );
    } else lines.push(`DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end!)}`);
    if (rule) lines.push(rule);
    if (e.location) lines.push(`LOCATION:${escapeICS(e.location)}`);
    lines.push(
      `DESCRIPTION:${escapeICS(`${item.description || item.title}\nFrom Pile · ${item.sourceExcerpt}`)}`,
      `URL:${origin}/app/inbox?source=${encodeURIComponent(item.sourceId)}`,
      'END:VEVENT',
    );
  }
  return [...lines, 'END:VCALENDAR'].map(foldICS).join('\r\n') + '\r\n';
}
