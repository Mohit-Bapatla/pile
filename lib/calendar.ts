import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { DB } from './db';
import { calendarId, type Item, type CalendarEvent } from './model';
import { saveItem, activity } from './store';
import { preferences } from './preferences';
import { recurrenceRule } from './ics';
export interface CalendarAdapter {
  name: string;
  list(): Promise<CalendarEvent[]>;
  create(item: Item): Promise<CalendarEvent>;
  remove(id: string): Promise<void>;
  update?(item: Item): Promise<CalendarEvent>;
}
export function eventFromItem(item: Item, demo: boolean): CalendarEvent {
  const start = item.startDateTime || item.dueDate;
  if (!start) throw new Error('Choose a date before adding this item to your calendar.');
  if (item.needsClarification)
    throw new Error('Resolve the question before adding this item to your calendar.');
  if (item.recurrence) recurrenceRule(item);
  const allDay = item.allDay || start.length === 10;
  if (
    item.endDateTime &&
    (Date.parse(item.endDateTime) <= Date.parse(start) ||
      (item.endDateTime.length === 10) !== (start.length === 10))
  )
    throw new Error('Choose an end after the start, using the same date or time format.');
  return {
    id: calendarId(item.id, item.calendarRevision),
    itemId: item.id,
    title: item.title,
    start,
    end:
      item.endDateTime ||
      (allDay
        ? new Date(Date.parse(start.slice(0, 10)) + 86400000).toISOString().slice(0, 10)
        : new Date(Date.parse(start) + 3600000).toISOString()),
    allDay: !!allDay,
    location: item.location,
    demo,
    recurrence: item.recurrence,
  };
}
export class DemoCalendarAdapter implements CalendarAdapter {
  name = 'Demo calendar';
  async list() {
    return [];
  }
  async create(item: Item) {
    return eventFromItem(item, true);
  }
  async update(item: Item) {
    return eventFromItem(item, true);
  }
  async remove() {}
}
type Tokens = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
};
function key() {
  const value = process.env.TOKEN_ENCRYPTION_KEY;
  if (!value || value.length < 32)
    throw new Error('Google Calendar needs a TOKEN_ENCRYPTION_KEY of at least 32 characters.');
  return createHash('sha256').update(value).digest();
}
export function encrypt(tokens: Tokens) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  return Buffer.concat([
    iv,
    cipher.update(JSON.stringify(tokens)),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString('base64');
}
export function decrypt(value: string): Tokens {
  const b = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(-16));
  return JSON.parse(
    Buffer.concat([decipher.update(b.subarray(12, -16)), decipher.final()]).toString(),
  );
}
export function googleConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI &&
    process.env.TOKEN_ENCRYPTION_KEY &&
    process.env.TOKEN_ENCRYPTION_KEY.length >= 32
  );
}
export async function saveTokens(db: DB, user: string, tokens: Tokens) {
  await db.query(
    'INSERT INTO oauth_tokens(user_id,encrypted) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET encrypted=excluded.encrypted',
    [user, encrypt(tokens)],
  );
}
export class GoogleCalendarAdapter implements CalendarAdapter {
  name = 'Google Calendar';
  constructor(
    private db: DB,
    private user: string,
    private calendar = 'primary',
  ) {}
  async token() {
    const row = (
      await this.db.query<{ encrypted: string }>(
        'SELECT encrypted FROM oauth_tokens WHERE user_id=$1',
        [this.user],
      )
    ).rows[0];
    if (!row) throw new Error('Connect Google Calendar first.');
    const t = decrypt(row.encrypted);
    if (t.expires_at > Date.now() + 60000) return t.access_token;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: t.refresh_token || '',
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error('Reconnect Google Calendar to continue.');
    const fresh = await res.json();
    await saveTokens(this.db, this.user, {
      ...t,
      ...fresh,
      expires_at: Date.now() + fresh.expires_in * 1000,
    });
    return fresh.access_token;
  }
  async request(path: string, method = 'GET', body?: unknown, etag?: string) {
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendar)}/events${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${await this.token()}`,
          'Content-Type': 'application/json',
          ...(etag ? { 'If-Match': etag } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (
      (method === 'POST' && r.status === 409) ||
      (method === 'DELETE' && [404, 410].includes(r.status))
    )
      return { conflict: r.status === 409 };
    if (!r.ok)
      throw new Error(
        r.status === 412
          ? 'This event changed in Google Calendar. Reload and try again.'
          : r.status === 401 || r.status === 403
            ? 'Reconnect Google Calendar to continue.'
            : 'Google Calendar could not complete this change. Please retry.',
      );
    return r.status === 204 ? {} : r.json();
  }
  async list(): Promise<CalendarEvent[]> {
    const data = await this.request(
      `?timeMin=${encodeURIComponent(new Date().toISOString())}&singleEvents=true&orderBy=startTime&maxResults=100`,
    );
    return (data.items || []).map(
      (e: {
        id: string;
        summary: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
        location?: string;
      }) => ({
        id: e.id,
        title: e.summary || 'Untitled event',
        start: e.start.dateTime || e.start.date!,
        end: e.end.dateTime || e.end.date,
        allDay: !!e.start.date,
        location: e.location,
        demo: false,
      }),
    );
  }
  payload(item: Item, event: CalendarEvent) {
    const zone = item.recurrence?.timezone || item.sourceTimezone || 'America/Chicago';
    const rule = recurrenceRule(item);
    return {
      summary: event.title,
      description: item.description || '',
      location: event.location || '',
      start: event.allDay
        ? { date: event.start.slice(0, 10) }
        : { dateTime: event.start, timeZone: zone },
      end: event.allDay
        ? { date: event.end!.slice(0, 10) }
        : { dateTime: event.end, timeZone: zone },
      recurrence: rule ? [rule] : [],
      extendedProperties: { private: { pileItemId: item.id } },
    };
  }
  async create(item: Item) {
    const event = { ...eventFromItem(item, false), calendarId: this.calendar };
    await this.request('', 'POST', { id: event.id, ...this.payload(item, event) });
    return event;
  }
  async update(item: Item) {
    const event = {
      ...eventFromItem(item, false),
      id: item.externalCalendarEventId!,
      calendarId: this.calendar,
    };
    const existing = await this.request('/' + encodeURIComponent(event.id));
    if (existing.extendedProperties?.private?.pileItemId !== item.id)
      throw new Error('This Google event is no longer linked to this Pile item.');
    await this.request(
      '/' + encodeURIComponent(event.id),
      'PUT',
      { ...existing, ...this.payload(item, event) },
      existing.etag,
    );
    return event;
  }
  async calendars(): Promise<{ id: string; name: string }[]> {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer',
      {
        headers: { Authorization: `Bearer ${await this.token()}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw new Error('Reconnect Google Calendar to choose a calendar.');
    const data = await response.json();
    return (data.items || []).map((c: { id: string; summary: string }) => ({
      id: c.id,
      name: c.summary,
    }));
  }
  async remove(id: string) {
    await this.request('/' + encodeURIComponent(id), 'DELETE');
  }
}
export async function calendarAdapter(
  db: DB,
  user: string,
  calendarId?: string,
): Promise<CalendarAdapter> {
  const linked = (await db.query('SELECT user_id FROM oauth_tokens WHERE user_id=$1', [user])).rows
    .length;
  if (linked)
    return new GoogleCalendarAdapter(
      db,
      user,
      calendarId || (await preferences(db, user)).calendarId || 'primary',
    );
  if (process.env.DEMO_MODE !== 'false') return new DemoCalendarAdapter();
  throw new Error('Connect Google Calendar first.');
}
export async function syncItem(db: DB, user: string, item: Item, adapter: CalendarAdapter) {
  if (item.calendarStatus === 'synced') return item;
  try {
    const event = await adapter.create(item);
    await db.transaction(async (tx) => {
      await tx.query(
        'INSERT INTO calendar_links(id,user_id,item_id,body) VALUES($1,$2,$3,$4) ON CONFLICT(item_id) DO NOTHING',
        [event.id, user, item.id, JSON.stringify(event)],
      );
      item.calendarStatus = 'synced';
      item.calendarDemo = event.demo;
      item.externalCalendarEventId = event.id;
      item.status = 'planned';
      await saveItem(tx, item);
      await activity(tx, user, 'calendar_event_created', {
        itemId: item.id,
        demo: event.demo,
      });
    });
    return item;
  } catch (e) {
    item.calendarStatus = 'failed';
    await saveItem(db, item);
    throw e;
  }
}

export async function updateSyncedItem(db: DB, user: string, item: Item) {
  const link = (
    await db.query<{ body: CalendarEvent }>(
      'SELECT body FROM calendar_links WHERE item_id=$1 AND user_id=$2',
      [item.id, user],
    )
  ).rows[0]?.body;
  if (!link) throw new Error('Calendar link not found. Reload and try again.');
  const adapter = link.demo
    ? new DemoCalendarAdapter()
    : await calendarAdapter(db, user, link.calendarId);
  if (!link.demo && adapter instanceof DemoCalendarAdapter)
    throw new Error('Reconnect Google Calendar before editing this linked event.');
  if (!adapter.update) throw new Error('Calendar updates are unavailable.');
  const event = await adapter.update(item);
  await db.transaction(async (tx) => {
    await tx.query('UPDATE calendar_links SET body=$1 WHERE item_id=$2 AND user_id=$3', [
      JSON.stringify(event),
      item.id,
      user,
    ]);
    await saveItem(tx, item);
  });
}
