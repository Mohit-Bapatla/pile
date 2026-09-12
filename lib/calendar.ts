import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { DB } from './db';
import { calendarId, type Item, type CalendarEvent } from './model';
import { saveItem, activity } from './store';
export interface CalendarAdapter {
  name: string;
  list(): Promise<CalendarEvent[]>;
  create(item: Item): Promise<CalendarEvent>;
  remove(id: string): Promise<void>;
}
export function eventFromItem(item: Item, demo: boolean): CalendarEvent {
  const start = item.startDateTime || item.dueDate;
  if (!start) throw new Error('Choose a date before adding this item to your calendar.');
  if (item.needsClarification)
    throw new Error('Resolve the question before adding this item to your calendar.');
  const allDay = item.allDay || start.length === 10;
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
  async request(path: string, method = 'GET', body?: unknown) {
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${await this.token()}`,
          'Content-Type': 'application/json',
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
    if (!r.ok) throw new Error('Google Calendar could not complete this change. Please retry.');
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
  async create(item: Item) {
    const event = eventFromItem(item, false);
    await this.request('', 'POST', {
      id: event.id,
      summary: event.title,
      description: item.description,
      location: event.location,
      start: event.allDay ? { date: event.start.slice(0, 10) } : { dateTime: event.start },
      end: event.allDay ? { date: event.end!.slice(0, 10) } : { dateTime: event.end },
      extendedProperties: { private: { pileItemId: item.id } },
    });
    return event;
  }
  async remove(id: string) {
    await this.request('/' + encodeURIComponent(id), 'DELETE');
  }
}
export async function calendarAdapter(db: DB, user: string): Promise<CalendarAdapter> {
  const linked = (await db.query('SELECT user_id FROM oauth_tokens WHERE user_id=$1', [user])).rows
    .length;
  if (linked) return new GoogleCalendarAdapter(db, user);
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
