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
  it('PDF fixture extracts all six dates and requires review', async () => {
    const bytes = await readFile('demo-assets/sample-syllabus.pdf');
    const text = await pdfText(bytes);
    expect(text).toContain('Assignment 1');
    const { items } = await capture(text, 'pdf', bytes, 'application/pdf');
    expect(items.filter((i) => i.dueDate || i.startDateTime)).toHaveLength(6);
    expect(items.filter((i) => i.type === 'deadline')).toHaveLength(3);
    expect(items.every((i) => i.status === 'inbox')).toBe(true);
  });
  it('image fixture yields correct event and persisted source', async () => {
    const bytes = await readFile('demo-assets/sample-event.png');
    const { items } = await capture('', 'image', bytes, 'image/png');
    expect(items[0].title).toBe('HackRice Closing Ceremony');
    expect(items[0].location).toBe('RMC Grand Hall');
    expect(items[0].startDateTime).toBe('2026-09-20T15:00:00-05:00');
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
    const { source, items } = await capture('Private information');
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
