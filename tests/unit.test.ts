import { describe, it, expect } from 'vitest';
import {
  extractionSchema,
  section,
  toItem,
  needsReview,
  localDate,
  type Source,
  type ExtractedItem,
  calendarId,
} from '../lib/model';
import { MockAIProvider, resolveDate, inferProject } from '../lib/ai';
import { eventFromItem } from '../lib/calendar';
const context = {
  now: new Date('2026-09-11T18:00:00Z'),
  timezone: 'America/Chicago',
  projects: ['HackRice', 'Calculus'],
};
const extracted: ExtractedItem = {
  type: 'task',
  title: 'Email Maya',
  priority: 'medium',
  confidence: 0.9,
  needsClarification: false,
};
const source: Source = {
  id: 'source-1',
  userId: 'user-1',
  type: 'text',
  rawText: 'Email Maya',
  createdAt: context.now.toISOString(),
  processingStatus: 'queued',
  timezone: context.timezone,
};
describe('structured extraction', () => {
  it('accepts valid extraction', () =>
    expect(extractionSchema.safeParse({ summary: 'One task', items: [extracted] }).success).toBe(
      true,
    ));
  it('rejects malformed extraction and extra keys', () => {
    expect(
      extractionSchema.safeParse({
        summary: 'bad',
        items: [{ ...extracted, confidence: 4 }],
      }).success,
    ).toBe(false);
    expect(
      extractionSchema.safeParse({
        summary: 'bad',
        items: [{ ...extracted, title: '' }],
      }).success,
    ).toBe(false);
    expect(
      extractionSchema.safeParse({
        summary: 'bad',
        items: [{ ...extracted, secretReasoning: 'no' }],
      }).success,
    ).toBe(false);
  });
  it('normalizes timed dates in user timezone', () =>
    expect(resolveDate('Dentist September 15, 2026 at 3 PM', context).date).toBe(
      '2026-09-15T20:00:00.000Z',
    ));
  it('resolves tomorrow and next Friday', () => {
    expect(resolveDate('email tomorrow', context).day).toBe('2026-09-12');
    expect(resolveDate('exam next Friday', context).day).toBe('2026-09-18');
  });
  it('uses local day across UTC midnight', () =>
    expect(localDate(new Date('2026-09-12T01:00:00Z'), 'America/Chicago')).toBe('2026-09-11'));
  it('distinguishes task, scheduled event, deadline and idea', async () => {
    const r = await new MockAIProvider().parseText(
      'Email Sarah; Physics exam Tuesday at 2 PM; Finish slides by tomorrow; Idea: a better browser',
      context,
    );
    expect(r.items.map((i) => i.type)).toEqual(['task', 'event', 'deadline', 'idea']);
    expect(r.items[0].dueDate).toBeUndefined();
  });
  it('never dates an undated idea', async () =>
    expect(
      (await new MockAIProvider().parseText('Idea: duplicate tab cleaner', context)).items[0]
        .dueDate,
    ).toBeUndefined());
  it('assigns all board sections including overdue', () => {
    const i = toItem(extracted, source);
    expect(section(i, '2026-09-11')).toBe('Later');
    expect(section({ ...i, dueDate: '2026-09-10' }, '2026-09-11')).toBe('Today');
    expect(section({ ...i, dueDate: '2026-09-15' }, '2026-09-11')).toBe('This week');
    expect(section({ ...i, status: 'inbox' }, '2026-09-11')).toBe('Inbox');
  });
  it('provides a stable calendar ID for retry protection', () => {
    expect(calendarId('abcd-1234')).toBe('pileabcd1234');
    expect(calendarId('abcd-1234')).toBe(calendarId('abcd-1234'));
  });
  it('associates projects from context', () => {
    expect(inferProject('calc homework')).toBe('Calculus');
    expect(inferProject('Review Apollo deck', ['Apollo'])).toBe('Apollo');
  });
  it('low confidence enters review', () => {
    expect(needsReview({ ...extracted, confidence: 0.6 })).toBe(true);
    expect(toItem({ ...extracted, confidence: 0.6 }, source).status).toBe('inbox');
  });
  it('links source and retains excerpt', () => {
    const i = toItem(extracted, source);
    expect(i.sourceId).toBe(source.id);
    expect(i.userId).toBe(source.userId);
    expect(i.sourceExcerpt).toBe('Email Maya');
  });
  it('uses exclusive next-day end for all-day deadlines', () => {
    const i = toItem({ ...extracted, type: 'deadline', dueDate: '2026-09-15' }, source);
    expect(eventFromItem(i, true).end).toBe('2026-09-16');
  });
  it('blocks ambiguous or undated calendar actions', () => {
    expect(() => eventFromItem(toItem(extracted, source), true)).toThrow('Choose a date');
    expect(() =>
      eventFromItem(
        toItem({ ...extracted, dueDate: '2026-09-15', needsClarification: true }, source),
        true,
      ),
    ).toThrow('Resolve');
  });
  it('flags imprecise weekend timing', async () => {
    const result = await new MockAIProvider().parseText('Call mom sometime this weekend', context);
    expect(result.items[0].needsClarification).toBe(true);
  });
});
