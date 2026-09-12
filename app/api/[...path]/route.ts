import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { database } from '@/lib/db';
import { session } from '@/lib/session';
import {
  state,
  saveSource,
  getSource,
  getItem,
  saveItem,
  deleteSource,
  projectFor,
  activity,
  commitExtraction,
} from '@/lib/store';
import { type Source, extractedItemSchema, date } from '@/lib/model';
import { processSource } from '@/lib/pipeline';
import { DEMO_TRANSCRIPT, ElevenLabsTranscriptionProvider } from '@/lib/ai';
import {
  calendarAdapter,
  googleConfigured,
  saveTokens,
  syncItem,
  GoogleCalendarAdapter,
  updateSyncedItem,
} from '@/lib/calendar';
import { memoryFor, indexItems, forgetItems } from '@/lib/memory';
import { preferences, savePreferences } from '@/lib/preferences';
import { createICS } from '@/lib/ics';
import { pdfPreview } from '@/lib/files';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
const timezone = z.string().refine((v) => {
  try {
    Intl.DateTimeFormat('en', { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, 'Invalid timezone');
async function handle(req: Request, ctx: Context) {
  try {
    const parts = (await ctx.params).path;
    const route = parts.join('/');
    const method = req.method;
    const url = new URL(req.url);
    // Next may normalize localhost internally; preserve the actual browser origin.
    url.host = req.headers.get('host') || url.host;
    if (method !== 'GET') {
      const origin = req.headers.get('origin');
      if (origin && new URL(origin).host !== req.headers.get('host'))
        return NextResponse.json({ error: 'Request origin rejected.' }, { status: 403 });
      if (Number(req.headers.get('content-length') || 0) > 12 * 1024 * 1024)
        throw new Error('Please use a file smaller than 8 MB.');
    }
    const db = await database();
    const user = await session(db);
    if (method === 'GET' && route === 'state') {
      const snapshot = await state(db, user);
      const connected =
        (await db.query('SELECT user_id FROM oauth_tokens WHERE user_id=$1', [user])).rows.length >
        0;
      return NextResponse.json({
        ...snapshot,
        preferences: await preferences(db, user),
        config: {
          demo: process.env.DEMO_MODE !== 'false',
          ai: process.env.OPENAI_API_KEY ? 'AI connected' : 'Demo · local rules',
          voice: !!process.env.ELEVENLABS_API_KEY,
          elevenlabs: process.env.ELEVENLABS_API_KEY ? 'Configured' : 'Not configured',
          backboard: process.env.BACKBOARD_API_KEY ? 'Configured' : 'Not configured',
          persistence: process.env.TIGER_DATABASE_URL
            ? 'Tiger Data · connected'
            : process.env.DATABASE_URL
              ? 'PostgreSQL · connected'
              : 'Local PostgreSQL',
          googleConfigured: googleConfigured(),
          calendar: connected ? 'Google Calendar' : 'Demo calendar',
          googleConnected: connected,
        },
      });
    }
    if (method === 'PATCH' && route === 'preferences') {
      const patch = z
        .object({
          timezone: timezone.optional(),
          timezoneDetected: z.boolean().optional(),
          calendarId: z.string().max(500).optional(),
          calendarName: z.string().max(200).optional(),
        })
        .strict()
        .parse(await req.json());
      if (patch.calendarId) {
        const calendars = await new GoogleCalendarAdapter(db, user).calendars();
        const selected =
          patch.calendarId === 'primary'
            ? { id: 'primary', name: 'Primary calendar' }
            : calendars.find((c) => c.id === patch.calendarId);
        if (!selected) throw new Error('Choose a connected Google calendar.');
        patch.calendarName = selected.name;
      }
      return NextResponse.json(await savePreferences(db, user, patch));
    }
    if (method === 'GET' && route === 'google/calendars')
      return NextResponse.json(await new GoogleCalendarAdapter(db, user).calendars());
    if (method === 'DELETE' && route === 'google/connection') {
      await db.query('DELETE FROM oauth_tokens WHERE user_id=$1', [user]);
      await savePreferences(db, user, { calendarId: 'primary', calendarName: 'Primary calendar' });
      return NextResponse.json({ ok: true });
    }
    if (method === 'POST' && route === 'calendar-export') {
      const { ids } = z
        .object({ ids: z.array(z.string()).min(1).max(100) })
        .parse(await req.json());
      const items = (await state(db, user)).items.filter((i) => ids.includes(i.id));
      if (items.length !== new Set(ids).size)
        throw new Error('One of these items is no longer available.');
      const content = createICS(items, url.origin);
      const course = items[0].project?.match(/[A-Z]{2,5}\s?\d{3}/)?.[0].replace(/\s/g, '');
      const filename = course
        ? `Pile-${course}.ics`
        : `Pile-events-${new Date().toISOString().slice(0, 10)}.ics`;
      await activity(db, user, 'calendar_exported', { ids });
      return new Response(content, {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }
    if (method === 'GET' && parts[0] === 'fixtures') {
      const name = z
        .enum(['sample-syllabus.pdf', 'sample-event.png', 'sample-meeting-notes.txt'])
        .parse(parts[1]);
      return new Response(await readFile(path.join(process.cwd(), 'demo-assets', name)), {
        headers: {
          'Content-Type': name.endsWith('.pdf')
            ? 'application/pdf'
            : name.endsWith('.png')
              ? 'image/png'
              : 'text/plain',
          'Content-Disposition': `attachment; filename="${name}"`,
        },
      });
    }
    if (method === 'GET' && parts[0] === 'files') {
      const source = await getSource(db, user, parts[1]);
      if (!source?.file_data)
        return NextResponse.json({ error: 'File not found.' }, { status: 404 });
      if (url.searchParams.has('preview') && source.mime === 'application/pdf') {
        const pageNumber = z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .parse(url.searchParams.get('page') || 1);
        const preview = await pdfPreview(Buffer.from(source.file_data), pageNumber);
        return new Response(new Uint8Array(preview), {
          headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' },
        });
      }
      return new Response(new Uint8Array(source.file_data), {
        headers: {
          'Content-Type': source.mime,
          'X-Content-Type-Options': 'nosniff',
          'Content-Disposition': 'inline',
        },
      });
    }
    if (method === 'POST' && route === 'capture') {
      const contentType = req.headers.get('content-type') || '';
      let source: Source;
      let bytes: Buffer | undefined;
      let mime: string | undefined;
      const base = {
        id: crypto.randomUUID(),
        userId: user,
        createdAt: new Date().toISOString(),
        processingStatus: 'queued' as const,
      };
      if (contentType.includes('multipart/form-data')) {
        const form = await req.formData();
        const file = form.get('file');
        if (!(file instanceof File) || file.size > 8 * 1024 * 1024 || file.size === 0)
          throw new Error('Choose a nonempty file smaller than 8 MB.');
        bytes = Buffer.from(await file.arrayBuffer());
        const ext = file.name.split('.').pop()?.toLowerCase();
        const tz = timezone.parse(form.get('timezone') || 'America/Chicago');
        if (!['pdf', 'png', 'jpg', 'jpeg', 'txt', 'md'].includes(ext || ''))
          throw new Error('Try a PDF, PNG, JPG, TXT or Markdown file.');
        mime =
          ext === 'pdf'
            ? 'application/pdf'
            : ext === 'png'
              ? 'image/png'
              : ['jpg', 'jpeg'].includes(ext!)
                ? 'image/jpeg'
                : 'text/plain';
        if (ext === 'png' && bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
          throw new Error('This is not a valid PNG.');
        if (['jpg', 'jpeg'].includes(ext!) && bytes.subarray(0, 3).toString('hex') !== 'ffd8ff')
          throw new Error('This is not a valid JPEG.');
        source = {
          ...base,
          type: ext === 'pdf' ? 'pdf' : mime.startsWith('image/') ? 'image' : 'file',
          rawText: mime === 'text/plain' ? bytes.toString('utf8').slice(0, 60000) : '',
          fileName: file.name.slice(0, 240),
          fileUrl: `/api/files/${base.id}`,
          timezone: tz,
        };
      } else {
        const body = z
          .object({
            text: z.string().trim().min(1).max(60000),
            type: z.enum(['text', 'voice']).default('text'),
            timezone: timezone.default('America/Chicago'),
            durationSeconds: z.number().min(0).max(3600).optional(),
          })
          .parse(await req.json());
        source = {
          ...base,
          type: body.type,
          rawText: body.text,
          timezone: body.timezone,
          ...(body.type === 'voice'
            ? { transcription: body.text, durationSeconds: body.durationSeconds }
            : {}),
        };
      }
      if (bytes) {
        source.fingerprint = createHash('sha256').update(bytes).digest('hex');
        const existing = (
          await db.query<{ body: Source }>(
            "SELECT body FROM sources WHERE user_id=$1 AND body->>'fingerprint'=$2",
            [user, source.fingerprint],
          )
        ).rows[0];
        if (existing) return NextResponse.json({ ...existing.body, duplicateOf: existing.body.id });
      }
      try {
        await saveSource(db, source, bytes, mime);
      } catch (error) {
        if (source.fingerprint) {
          const existing = (
            await db.query<{ body: Source }>(
              "SELECT body FROM sources WHERE user_id=$1 AND body->>'fingerprint'=$2",
              [user, source.fingerprint],
            )
          ).rows[0];
          if (existing)
            return NextResponse.json({ ...existing.body, duplicateOf: existing.body.id });
        }
        throw error;
      }
      return NextResponse.json(source, { status: 201 });
    }
    if (method === 'POST' && parts[0] === 'process') {
      const items = await processSource(db, user, parts[1]);
      let memoryWarning;
      try {
        await indexItems(db, user, items);
      } catch {
        memoryWarning = 'Saved locally. Backboard memory is currently unavailable.';
      }
      return NextResponse.json({ items, memoryWarning });
    }
    if (method === 'POST' && route === 'items') {
      const item = extractedItemSchema.parse(await req.json());
      const source: Source = {
        id: crypto.randomUUID(),
        userId: user,
        type: 'text',
        rawText: item.title + (item.description ? '\n' + item.description : ''),
        createdAt: new Date().toISOString(),
        processingStatus: 'queued',
        timezone: 'America/Chicago',
        provider: 'Manual entry',
      };
      await saveSource(db, source);
      const items = await commitExtraction(db, source, { summary: 'Added by you.', items: [item] });
      try {
        await indexItems(db, user, items);
      } catch {
        /* Manual entry remains saved locally. */
      }
      return NextResponse.json(items[0], { status: 201 });
    }
    if (method === 'DELETE' && parts[0] === 'items') {
      const item = await getItem(db, user, parts[1]);
      if (!item) throw new Error('Item not found.');
      if (item.calendarStatus === 'synced')
        throw new Error('Remove this item from the calendar before deleting it.');
      await forgetItems(db, user, [item.id]);
      await db.query('DELETE FROM items WHERE id=$1 AND user_id=$2', [item.id, user]);
      return NextResponse.json({ ok: true });
    }
    if (method === 'PATCH' && parts[0] === 'items') {
      const existing = await getItem(db, user, parts[1]);
      if (!existing) throw new Error('Item not found.');
      const patch = extractedItemSchema
        .partial()
        .extend({
          dueDate: date.nullable().optional(),
          startDateTime: date.nullable().optional(),
          endDateTime: date.nullable().optional(),
          recurrence: extractedItemSchema.shape.recurrence.unwrap().nullable().optional(),
          status: z.enum(['inbox', 'planned', 'in_progress', 'done', 'archived']).optional(),
        })
        .strict()
        .parse(await req.json());
      Object.assign(existing, patch);
      if (patch.recurrence === null) delete existing.recurrence;
      for (const field of ['dueDate', 'startDateTime', 'endDateTime'] as const) {
        if (patch[field] === null) delete existing[field];
      }
      if (
        existing.endDateTime &&
        existing.startDateTime &&
        Date.parse(existing.endDateTime) <= Date.parse(existing.startDateTime)
      )
        throw new Error('The end time must be after the start time.');
      if (patch.project) existing.projectId = (await projectFor(db, user, patch.project)).id;
      if (patch.status === 'planned') {
        existing.needsClarification = false;
        existing.confidence = 1;
      }
      if (
        (existing.type === 'event' || existing.type === 'deadline') &&
        (existing.dueDate || existing.startDateTime) &&
        existing.calendarStatus === 'not_applicable'
      )
        existing.calendarStatus = 'suggested';
      if (
        existing.calendarStatus !== 'synced' &&
        (!['event', 'deadline'].includes(existing.type) ||
          !(existing.dueDate || existing.startDateTime))
      )
        existing.calendarStatus = 'not_applicable';
      if (existing.calendarStatus === 'synced') await updateSyncedItem(db, user, existing);
      else await saveItem(db, existing);
      try {
        await indexItems(db, user, [existing]);
      } catch {
        /* Local persistence remains authoritative. */
      }
      if (patch.status === 'done')
        await activity(db, user, 'item_completed', { itemId: existing.id });
      return NextResponse.json(existing);
    }
    if (method === 'DELETE' && parts[0] === 'sources') {
      const linked = (await state(db, user)).items.filter((i) => i.sourceId === parts[1]);
      if (linked.some((i) => i.calendarStatus === 'synced'))
        throw new Error('Remove linked calendar events before deleting this source.');
      await forgetItems(
        db,
        user,
        linked.map((i) => i.id),
      );
      await deleteSource(db, user, parts[1]);
      return NextResponse.json({ ok: true });
    }
    if (method === 'POST' && parts[0] === 'calendar' && parts[1]) {
      const item = await getItem(db, user, parts[1]);
      if (!item) throw new Error('Item not found.');
      return NextResponse.json(await syncItem(db, user, item, await calendarAdapter(db, user)));
    }
    if (method === 'DELETE' && parts[0] === 'calendar' && parts[1]) {
      const item = await getItem(db, user, parts[1]);
      if (!item) throw new Error('Item not found.');
      if (item.externalCalendarEventId) {
        const link = (
          await db.query<{ body: { demo: boolean; calendarId?: string } }>(
            'SELECT body FROM calendar_links WHERE item_id=$1 AND user_id=$2',
            [item.id, user],
          )
        ).rows[0];
        if (!link?.body.demo) {
          const adapter = await calendarAdapter(db, user, link?.body.calendarId);
          if (adapter.name !== 'Google Calendar')
            throw new Error('Reconnect Google Calendar to remove this event.');
          await adapter.remove(item.externalCalendarEventId);
        }
        await db.query('DELETE FROM calendar_links WHERE item_id=$1 AND user_id=$2', [
          item.id,
          user,
        ]);
      }
      item.calendarStatus = 'suggested';
      item.calendarRevision = (item.calendarRevision || 0) + 1;
      delete item.externalCalendarEventId;
      await saveItem(db, item);
      return NextResponse.json(item);
    }
    if (method === 'GET' && route === 'calendar') {
      return NextResponse.json({
        events: await (await calendarAdapter(db, user)).list(),
      });
    }
    if (method === 'POST' && route === 'transcribe') {
      const form = await req.formData();
      if (form.get('demo') === 'true') {
        if (process.env.DEMO_MODE === 'false') throw new Error('Demo transcription is disabled.');
        return NextResponse.json({ text: DEMO_TRANSCRIPT, demo: true });
      }
      const audio = form.get('audio');
      if (!(audio instanceof File) || audio.size === 0 || audio.size > 8 * 1024 * 1024)
        throw new Error('Recording must be smaller than 8 MB.');
      if (!process.env.ELEVENLABS_API_KEY)
        throw new Error(
          'Transcription is not configured. Use the sample transcript or type your recording.',
        );
      const text = await new ElevenLabsTranscriptionProvider().transcribe(audio);
      await activity(db, user, 'elevenlabs_transcribed', { bytes: audio.size });
      return NextResponse.json({ text, demo: false, provider: 'ElevenLabs' });
    }
    if (method === 'GET' && route === 'search') {
      const snapshot = await state(db, user);
      const query = z
        .string()
        .max(1000)
        .parse(url.searchParams.get('q') || '');
      const memory = await memoryFor(db, user);
      return NextResponse.json(
        await memory.search(
          user,
          query,
          snapshot.items.filter((i) => i.status !== 'archived'),
          snapshot.sources,
        ),
      );
    }
    if (method === 'GET' && route === 'oauth/connect') {
      if (!googleConfigured())
        return NextResponse.redirect(new URL('/app/settings?calendar=unconfigured', url));
      const state = randomBytes(32).toString('hex');
      (await cookies()).set('pile_oauth_state', state, {
        httpOnly: true,
        sameSite: 'lax',
        secure: url.protocol === 'https:',
        maxAge: 600,
        path: '/',
      });
      const oauth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      oauth.search = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        response_type: 'code',
        scope:
          'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',
        access_type: 'offline',
        prompt: 'consent',
        state,
      }).toString();
      return NextResponse.redirect(oauth);
    }
    if (method === 'GET' && route === 'oauth/callback') {
      const jar = await cookies();
      const expected = jar.get('pile_oauth_state')?.value;
      jar.delete('pile_oauth_state');
      if (!expected || url.searchParams.get('state') !== expected)
        throw new Error('Calendar connection expired. Please try again.');
      if (url.searchParams.get('error'))
        return NextResponse.redirect(new URL('/app/settings?calendar=cancelled', url));
      const code = url.searchParams.get('code');
      if (!code) throw new Error('Calendar did not return an authorization code.');
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
          grant_type: 'authorization_code',
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error('Google Calendar connection failed. Please try again.');
      const tokens = await r.json();
      await saveTokens(db, user, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
      });
      return NextResponse.redirect(new URL('/app/settings?calendar=connected', url));
    }
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  } catch (e) {
    const message =
      e instanceof z.ZodError
        ? 'Please check the input fields.'
        : e instanceof Error
          ? e.message
          : 'Something went wrong. Please retry.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
