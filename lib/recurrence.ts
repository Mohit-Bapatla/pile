import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { CalendarEvent, Item } from './model';
const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
export function nextMeeting(item: Item, now: Date) {
  if (!item.recurrence || !item.startDateTime || !item.recurrence.until) return item.startDateTime;
  const r = item.recurrence;
  const first =
    item.startDateTime.length === 10
      ? item.startDateTime
      : formatInTimeZone(item.startDateTime, r.timezone, 'yyyy-MM-dd');
  const today = formatInTimeZone(now, r.timezone, 'yyyy-MM-dd');
  for (let n = 0; n < 8; n++) {
    const d = new Date(Date.parse(today < first ? first : today) + n * 86400000);
    const day = d.toISOString().slice(0, 10);
    if (day > r.until!) return;
    if (r.days.includes(days[d.getUTCDay()] as (typeof r.days)[number]))
      return item.startDateTime.length === 10
        ? day
        : fromZonedTime(
            `${day}T${formatInTimeZone(item.startDateTime, r.timezone, 'HH:mm:ss')}`,
            r.timezone,
          ).toISOString();
  }
}
export function calendarOccurrences(events: CalendarEvent[], startDay: string, endDay: string) {
  return events.flatMap((event) => {
    const r = event.recurrence;
    if (!r?.until) return [event];
    const first = event.allDay
      ? event.start.slice(0, 10)
      : formatInTimeZone(event.start, r.timezone, 'yyyy-MM-dd');
    const duration = event.end ? Date.parse(event.end) - Date.parse(event.start) : 3600000;
    const occurrences: CalendarEvent[] = [];
    // Buffer source dates around the display zone. Render code filters exact displayed day.
    for (
      let time = Date.parse(startDay) - 86400000;
      time <= Date.parse(endDay) + 86400000;
      time += 86400000
    ) {
      const date = new Date(time),
        day = date.toISOString().slice(0, 10);
      if (
        day < first ||
        day > r.until ||
        !r.days.includes(days[date.getUTCDay()] as (typeof r.days)[number])
      )
        continue;
      const start = fromZonedTime(
        `${day}T${formatInTimeZone(event.start, r.timezone, 'HH:mm:ss')}`,
        r.timezone,
      ).toISOString();
      occurrences.push({
        ...event,
        id: `${event.id}:${day}`,
        start: event.allDay ? day : start,
        end: event.allDay
          ? new Date(Date.parse(day) + duration).toISOString().slice(0, 10)
          : new Date(Date.parse(start) + duration).toISOString(),
      });
    }
    return occurrences;
  });
}
