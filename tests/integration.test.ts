import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { openDB, migrate, type DB } from '../lib/db';
import { saveSource, getSource, getItem, saveItem, deleteSource, state, seed } from '../lib/store';
import { processSource } from '../lib/pipeline';
import { pdfText, parseImage } from '../lib/files';
import { MockAIProvider, DEMO_TRANSCRIPT } from '../lib/ai';
import { DemoCalendarAdapter, syncItem } from '../lib/calendar';
import { LocalMemoryAdapter } from '../lib/memory';
import type { Source } from '../lib/model';
let db: DB;
const user = 'test-user';
async function capture(text: string, type: Source['type'] = 'text', bytes?: Buffer, mime?: string) {
  const source: Source = {
    id: crypto.randomUUID(),
    userId: user,
    type,
    rawText: text,
    createdAt: new Date().toISOString(),
    processingStatus: 'queued',
    timezone: 'America/Chicago',
  };
  await saveSource(db, source, bytes, mime);
  const items = await processSource(db, user, source.id);
  return { source, items };
}
beforeAll(async () => {
  process.env.DEMO_MODE = 'true';
  delete process.env.OPENAI_API_KEY;
  db = await openDB('memory://');
  await migrate(db);
  await db.query('INSERT INTO users(id,session_hash) VALUES($1,$2)', [user, 'test-hash']);
});
afterAll(async () => {
  await db.close();
});
describe('real persistence and capture pipeline', () => {
  it('clean migration is repeatable and seed is idempotent', async () => {
    await migrate(db);
    await seed(db, user);
    const before = await state(db, user);
    await seed(db, user);
    const after = await state(db, user);
    expect(after.items).toHaveLength(5);
    expect(after.projects).toHaveLength(4);
    expect(after.items.length).toBe(before.items.length);
  });
  it('text capture creates source and linked extracted items', async () => {
    const { source, items } = await capture(
      'Physics exam Tuesday at 2 PM and remind me to email Alex tomorrow.',
    );
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('event');
    expect(items[1].type).toBe('reminder');
    expect(items.every((i) => i.sourceId === source.id)).toBe(true);
    expect((await getSource(db, user, source.id)).body.processingStatus).toBe('needs_review');
  });
  it('PDF fixture keeps four dates, one class and two optional schedules', async () => {
    const bytes = await readFile('demo-assets/sample-syllabus.pdf');
    const text = await pdfText(bytes);
    expect(text).toContain('Observation #2');
    const { items } = await capture(text, 'pdf', bytes, 'application/pdf');
    expect(items.filter((i) => i.dueDate || i.startDateTime)).toHaveLength(7);
    expect(items.filter((i) => i.type === 'deadline')).toHaveLength(3);
    expect(items.every((i) => i.status === 'inbox')).toBe(true);
    expect(items.filter((i) => i.tier === 'optional')).toHaveLength(2);
    expect(items.filter((i) => i.tier === 'important')).toHaveLength(5);
    expect(items.some((i) => /Overview|Avery|Canvas|http/.test(i.title))).toBe(false);
    const course = (await state(db, user)).projects.find((p) => p.name.startsWith('UGS 303'));
    expect(course?.metadata?.instructor).toBe('Dr. Avery Morgan');
    expect(items.filter((i) => i.title === 'Observation #2')).toHaveLength(1);
  });
  it('image fixture yields correct event and persisted source', async () => {
    const bytes = await readFile('demo-assets/sample-event.png');
    const { items } = await capture('', 'image', bytes, 'image/png');
    expect(items[0].title).toBe('Design Night');
    expect(items[0].location).toBe('Rice Architecture · Anderson Hall');
    expect(items[0].startDateTime).toBe('2026-09-17T19:00:00-05:00');
  });
  it('an arbitrary renamed image cannot trigger fixture output', async () => {
    await expect(
      parseImage(Buffer.from('not the flyer'), 'image/png', new MockAIProvider(), {
        now: new Date(),
        timezone: 'America/Chicago',
        projects: [],
      }),
    ).rejects.toThrow('Image understanding needs');
  });
  it('mock voice goes through same pipeline', async () => {
    const { source, items } = await capture(DEMO_TRANSCRIPT, 'voice');
    expect(items).toHaveLength(3);
    expect(items.some((i) => i.title.includes('Maya'))).toBe(true);
    expect((await getSource(db, user, source.id)).body.type).toBe('voice');
  });
  it('item edits persist', async () => {
    const { items } = await capture('Email a colleague');
    const item = items[0];
    item.title = 'Email Maya the updated deck';
    await saveItem(db, item);
    expect((await getItem(db, user, item.id))?.title).toBe(item.title);
  });
  it('calendar approval is repeatable without duplicate events', async () => {
    const { items } = await capture('Dentist Tuesday at 3 PM');
    const adapter = new DemoCalendarAdapter();
    await syncItem(db, user, items[0], adapter);
    await syncItem(db, user, items[0], adapter);
    expect((await state(db, user)).events.filter((e) => e.itemId === items[0].id)).toHaveLength(1);
    expect((await getItem(db, user, items[0].id))?.calendarStatus).toBe('synced');
  });
  it('concurrent extraction does not duplicate items', async () => {
    const source: Source = {
      id: crypto.randomUUID(),
      userId: user,
      type: 'text',
      rawText: 'Email Dana',
      createdAt: new Date().toISOString(),
      processingStatus: 'queued',
      timezone: 'America/Chicago',
    };
    await saveSource(db, source);
    await Promise.all([processSource(db, user, source.id), processSource(db, user, source.id)]);
    expect((await state(db, user)).items.filter((i) => i.sourceId === source.id)).toHaveLength(1);
  });
  it('deleting a source cascades items but prevents orphaned synced events', async () => {
    const { source, items } = await capture('Email Jasper');
    await deleteSource(db, user, source.id);
    expect(await getItem(db, user, items[0].id)).toBeUndefined();
    const linked = await capture('Dentist next Tuesday at 3 PM');
    await syncItem(db, user, linked.items[0], new DemoCalendarAdapter());
    await expect(deleteSource(db, user, linked.source.id)).rejects.toThrow('Remove linked');
  });
  it('search retrieves items via preserved source context', async () => {
    await capture('Email Maya about the internship');
    const s = await state(db, user);
    const found = await new LocalMemoryAdapter().search(
      user,
      'What did I say about Maya?',
      s.items,
      s.sources,
    );
    expect(found.items.some((i) => i.title.includes('Maya'))).toBe(true);
  });
  it('enforces source and item ownership', async () => {
    const { source, items } = await capture('Email private information to Maya');
    expect(await getSource(db, 'other-user', source.id)).toBeUndefined();
    expect(await getItem(db, 'other-user', items[0].id)).toBeUndefined();
  });
  it('failed processing preserves the original with error state', async () => {
    const source: Source = {
      id: crypto.randomUUID(),
      userId: user,
      type: 'image',
      rawText: '',
      createdAt: new Date().toISOString(),
      processingStatus: 'queued',
      timezone: 'America/Chicago',
    };
    await saveSource(db, source, Buffer.from('unknown'), 'image/png');
    await expect(processSource(db, user, source.id)).rejects.toThrow();
    expect((await getSource(db, user, source.id)).body.processingStatus).toBe('error');
  });
});

import { vi, afterEach } from 'vitest';
import { ElevenLabsTranscriptionProvider } from '../lib/ai';
import { BackboardMemoryAdapter, indexItems, memoryFor } from '../lib/memory';
import { GoogleCalendarAdapter, saveTokens, updateSyncedItem } from '../lib/calendar';
import { preferences, savePreferences } from '../lib/preferences';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('provider request contracts and persistent preferences', () => {
  it('sends recorded bytes to ElevenLabs with Scribe v2 and parses the real response shape', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key');
    const mock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'xi-api-key': 'test-key' });
      const form = init.body as FormData;
      expect(form.get('model_id')).toBe('scribe_v2');
      expect(await (form.get('file') as File).text()).toBe('recorded-bytes');
      return Response.json({ text: 'I need to email Maya tomorrow and dentist Tuesday at three.' });
    });
    vi.stubGlobal('fetch', mock);
    const transcript = await new ElevenLabsTranscriptionProvider().transcribe(
      new File(['recorded-bytes'], 'voice.webm', { type: 'audio/webm;codecs=opus' }),
    );
    const { items } = await capture(transcript, 'voice');
    expect(items).toHaveLength(2);
    expect(items[0].title).toContain('Maya');
    expect(items[1].type).toBe('event');
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('rejects empty and unsupported audio before spending a provider request', async () => {
    const mock = vi.fn();
    vi.stubGlobal('fetch', mock);
    const adapter = new ElevenLabsTranscriptionProvider();
    await expect(
      adapter.transcribe(new File([], 'voice.webm', { type: 'audio/webm' })),
    ).rejects.toThrow('nonempty');
    await expect(
      adapter.transcribe(new File(['hello'], 'file.txt', { type: 'text/plain' })),
    ).rejects.toThrow('WebM');
    expect(mock).not.toHaveBeenCalled();
  });
  it('reports authentication failure and does not fabricate a transcript', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 401 })),
    );
    await expect(
      new ElevenLabsTranscriptionProvider().transcribe(
        new File(['audio'], 'voice.webm', { type: 'audio/webm' }),
      ),
    ).rejects.toThrow('authenticate');
  });
  it('Backboard uses explicit memories and semantic retrieval with ownership and score gates', async () => {
    const { items, source } = await capture('Email Cedar about the internship');
    const memory = new BackboardMemoryAdapter('assistant-1');
    const mock = vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (url.endsWith('/search'))
        return Response.json({
          memories: [
            { score: 0.9, metadata: { userId: user, itemId: items[0].id } },
            { score: 0.99, metadata: { userId: 'other', itemId: 'secret' } },
          ],
        });
      expect(url).toContain('/assistants/assistant-1/memories');
      expect(body.metadata.itemId).toBe(items[0].id);
      expect(body.content).not.toContain('Overview');
      return Response.json({ memory_id: 'memory-1' });
    });
    vi.stubGlobal('fetch', mock);
    await memory.remember(user, source, items);
    const result = await memory.search(user, 'What was that career conversation?', items, [source]);
    expect(result.items.map((i) => i.id)).toEqual([items[0].id]);
    expect(result.provider).toBe('Backboard + local search');
  });
  it('Backboard outages preserve lexical search', async () => {
    const { items, source } = await capture('Email Fern');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const r = await new BackboardMemoryAdapter('assistant').search(
      user,
      'What about Fern?',
      items,
      [source],
    );
    expect(r.items).toHaveLength(1);
    expect(r.provider).toContain('unavailable');
  });
  it('Backboard creates private assistants, persists memory IDs, and updates corrections', async () => {
    vi.stubEnv('BACKBOARD_API_KEY', 'test-key');
    const { items } = await capture('Email Linden');
    const mock = vi.fn(async (url: string) =>
      Response.json(
        url.endsWith('/assistants')
          ? { assistant_id: 'private-assistant' }
          : { memory_id: 'persistent-memory' },
      ),
    );
    vi.stubGlobal('fetch', mock);
    await indexItems(db, user, items);
    await indexItems(db, user, items);
    expect(mock).toHaveBeenCalledTimes(2);
    items[0].description = 'Linden means our internship mentor';
    items[0].updatedAt = '2026-09-12T22:00:00Z';
    await indexItems(db, user, items);
    expect(mock.mock.calls.at(-1)?.[0]).toContain('/memories/persistent-memory');
    expect(await memoryFor(db, user)).toBeInstanceOf(BackboardMemoryAdapter);
  });
  it('timezone preferences persist without changing item timestamps', async () => {
    const { items } = await capture('Dentist September 15, 2026 at 3 PM');
    const original = items[0].startDateTime;
    await savePreferences(db, user, { timezone: 'America/Chicago', timezoneDetected: true });
    await savePreferences(db, user, { timezone: 'America/New_York', timezoneDetected: false });
    expect((await preferences(db, user)).timezone).toBe('America/New_York');
    expect((await getItem(db, user, items[0].id))?.startDateTime).toBe(original);
  });
  it('Google creates bounded recurrence and updates with the prior etag', async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'test-encryption-key-at-least-32-characters');
    await saveTokens(db, user, { access_token: 'test-token', expires_at: Date.now() + 3600000 });
    const { items } = await capture('Dentist September 15, 2026 at 3 PM');
    const item = items[0];
    item.recurrence = { days: ['TU'], until: '2026-12-08', timezone: 'America/Chicago' };
    const mock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toContain('/calendars/chosen%40example.com/events');
      if (init.method === 'GET')
        return Response.json({
          etag: '"etag-1"',
          extendedProperties: { private: { pileItemId: item.id } },
          attendees: [{ email: 'retained@example.com' }],
        });
      const body = JSON.parse(String(init.body));
      expect(body.recurrence[0]).toContain('UNTIL=');
      expect(body.start.timeZone).toBe('America/Chicago');
      if (init.method === 'PUT') {
        expect((init.headers as Record<string, string>)['If-Match']).toBe('"etag-1"');
        expect(body.attendees).toHaveLength(1);
      }
      return Response.json({ id: 'provider-event' });
    });
    vi.stubGlobal('fetch', mock);
    const adapter = new GoogleCalendarAdapter(db, user, 'chosen@example.com');
    await syncItem(db, user, item, adapter);
    item.title = 'Dentist follow-up';
    await updateSyncedItem(db, user, item);
    expect((await getItem(db, user, item.id))?.title).toBe('Dentist follow-up');
    expect(mock).toHaveBeenCalledTimes(3);
    await db.query('DELETE FROM oauth_tokens WHERE user_id=$1', [user]);
  });
  it('meeting notes keep actions and launch, not attendees and prose', async () => {
    const { items } = await capture(
      await readFile('demo-assets/sample-meeting-notes.txt', 'utf8'),
      'file',
    );
    expect(items).toHaveLength(3);
    expect(items.some((i) => /Maya/.test(i.title))).toBe(true);
    expect(items.some((i) => /Jordan/.test(i.title))).toBe(true);
    expect(items.some((i) => /Attendees|onboarding|Notes/.test(i.title))).toBe(false);
  });
});

describe('prejudge corpus, failure and provider paths', () => {
  it('extracts an alternate actual PDF and flags conflicting assessment rows', async () => {
    const bytes = await readFile('tests/fixtures/alternate-syllabus.pdf');
    const { items } = await capture('', 'pdf', bytes, 'application/pdf');
    expect(items).toHaveLength(6);
    expect(items.filter((i) => i.title === 'Essay')).toHaveLength(2);
    expect(items.filter((i) => i.title === 'Essay').every((i) => i.needsClarification)).toBe(true);
    expect(items.some((i) => /instructor|overview|Dr Example/i.test(i.title))).toBe(false);
    expect(items.find((i) => i.title.startsWith('No class'))?.needsClarification).toBe(true);
  });
  it('preserves a prose-only PDF with zero actionable cards', async () => {
    const bytes = await readFile('tests/fixtures/reference-only.pdf');
    const { source, items } = await capture('', 'pdf', bytes, 'application/pdf');
    expect(items).toHaveLength(0);
    expect((await getSource(db, user, source.id))?.body.rawText).toContain('community gardens');
  });
  it('rejects an image-only PDF with a useful recovery message', async () => {
    await expect(pdfText(await readFile('tests/fixtures/image-only.pdf'))).rejects.toThrow(
      /no readable text/,
    );
  });
  it('recovers text parsing locally when a configured AI request fails', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    const { source, items } = await capture('Email Maya tomorrow');
    expect(items[0].title).toBe('Email Maya');
    expect((await getSource(db, user, source.id))?.body.provider).toContain('fallback');
  });
  it('keeps a long original and commits bounded extracted fields', async () => {
    const text = 'Email Maya about ' + 'our project '.repeat(800);
    const { source, items } = await capture(text);
    expect(items).toHaveLength(1);
    expect((await getSource(db, user, source.id))?.body.rawText).toBe(text);
  });
  it('rolls back a failed PostgreSQL transaction', async () => {
    const id = crypto.randomUUID();
    await expect(
      db.transaction(async (tx) => {
        await tx.query('INSERT INTO users(id,session_hash) VALUES($1,$2)', [id, id]);
        throw new Error('deliberate rollback');
      }),
    ).rejects.toThrow('deliberate rollback');
    expect((await db.query('SELECT id FROM users WHERE id=$1', [id])).rows).toHaveLength(0);
  });
  it.each(['audio/mp4', 'audio/webm;codecs=opus'])(
    'sends browser audio format %s without converting bytes',
    async (mime) => {
      vi.stubEnv('ELEVENLABS_API_KEY', 'test-key');
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, init) => {
          expect((init.body as FormData).get('file')).toBeInstanceOf(File);
          expect((init.body as FormData).get('model_id')).toBe('scribe_v2');
          return Response.json({ text: 'Email Maya tomorrow' });
        }),
      );
      expect(
        await new ElevenLabsTranscriptionProvider().transcribe(
          new File(['recorded bytes'], 'voice', { type: mime }),
        ),
      ).toBe('Email Maya tomorrow');
    },
  );
  it('handles silent transcription and network errors without invented text', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ text: '  ' })),
    );
    const audio = new File(['bytes'], 'voice.webm', { type: 'audio/webm' });
    await expect(new ElevenLabsTranscriptionProvider().transcribe(audio)).rejects.toThrow(
      /No speech/,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network unavailable');
      }),
    );
    await expect(new ElevenLabsTranscriptionProvider().transcribe(audio)).rejects.toThrow(
      /Network/,
    );
  });
  it('Google refreshes, lists writable calendars, handles duplicate create and deleted events', async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'test-encryption-key-at-least-32-characters');
    await saveTokens(db, user, {
      access_token: 'expired-test-token',
      refresh_token: 'refresh-test-token',
      expires_at: 0,
    });
    const { items } = await capture('Dentist September 15, 2026 at 3 PM');
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        calls.push(String(url));
        if (String(url).includes('oauth2.googleapis.com'))
          return Response.json({ access_token: 'fresh-test-token', expires_in: 3600 });
        if (String(url).includes('calendarList'))
          return Response.json({ items: [{ id: 'test@calendar', summary: 'QA calendar' }] });
        if (init.method === 'POST') return new Response('', { status: 409 });
        if (init.method === 'DELETE') return new Response('', { status: 410 });
        return Response.json({ items: [] });
      }),
    );
    const adapter = new GoogleCalendarAdapter(db, user, 'test@calendar');
    expect(await adapter.calendars()).toEqual([{ id: 'test@calendar', name: 'QA calendar' }]);
    expect(await adapter.list()).toEqual([]);
    expect((await adapter.create(items[0])).id).toContain('pile');
    await adapter.remove('test-event');
    expect(calls.filter((url) => url.includes('oauth2.googleapis.com'))).toHaveLength(1);
    await db.query('DELETE FROM oauth_tokens WHERE user_id=$1', [user]);
  });
  it.each([401, 412, 503])('Google errors %i fail visibly', async (status) => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'test-encryption-key-at-least-32-characters');
    await saveTokens(db, user, { access_token: 'test-token', expires_at: Date.now() + 3600000 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status })),
    );
    await expect(new GoogleCalendarAdapter(db, user).list()).rejects.toThrow(
      status === 401 ? /Reconnect/ : status === 412 ? /changed/ : /retry/,
    );
    await db.query('DELETE FROM oauth_tokens WHERE user_id=$1', [user]);
  });
  it('Backboard delete uses the owned assistant memory endpoint', async () => {
    const mock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', mock);
    await new BackboardMemoryAdapter('qa-assistant').forget('qa-memory');
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/assistants/qa-assistant/memories/qa-memory'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
