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

import { lexicalSearch } from '../lib/search';
import { createICS, foldICS, recurrenceRule } from '../lib/ics';
import { filterExtraction } from '../lib/actionability';
import { nextMeeting, calendarOccurrences } from '../lib/recurrence';
import { formatInTimeZone } from 'date-fns-tz';
import { itemDay } from '../lib/model';
describe('actionability, search and calendar regression', () => {
  const maya = toItem(
    { ...extracted, title: 'Email Maya', description: 'Email Maya about internships' },
    source,
  );
  const unrelated = toItem(
    { ...extracted, title: 'Finish HackRice demo', description: 'Prepare slides' },
    source,
  );
  const shared = { ...source, rawText: 'Email Maya about internships. Finish HackRice demo.' };
  it('Maya excludes unrelated cards from the same source', () =>
    expect(lexicalSearch('Maya', [maya, unrelated], [shared]).items.map((i) => i.title)).toEqual([
      'Email Maya',
    ]));
  it('stopword and nonsense queries yield zero cards', () => {
    expect(lexicalSearch('qzxqzxqzx', [maya, unrelated], [shared]).items).toEqual([]);
    expect(lexicalSearch('what did I say', [maya, unrelated], [shared]).items).toEqual([]);
  });
  it('chemistry deadlines requires both context terms', () => {
    const chemistry = toItem(
      {
        ...extracted,
        title: 'Lab report',
        project: 'Chemistry',
        type: 'deadline',
        dueDate: '2026-09-20',
      },
      source,
    );
    const chat = toItem(
      { ...extracted, title: 'Call chemistry tutor', project: 'Chemistry' },
      source,
    );
    expect(
      lexicalSearch('chemistry deadlines', [chemistry, chat, maya], [shared]).items.map(
        (i) => i.id,
      ),
    ).toEqual([chemistry.id]);
  });
  it('normalizes punctuation, case and sensible plurals', () =>
    expect(lexicalSearch('What did I say about INTERNSHIP?', [maya], [shared]).items).toHaveLength(
      1,
    ));
  it('ranks exact titles over content matches', () => {
    const other = toItem({ ...extracted, title: 'Check in', description: 'Email Maya' }, source);
    expect(lexicalSearch('Email Maya', [other, maya], [shared]).items[0].id).toBe(maya.id);
  });
  it('retrieves source text independently without polluting sibling cards', () => {
    const r = lexicalSearch('internship', [unrelated], [shared]);
    expect(r.items).toHaveLength(0);
    expect(r.sources).toHaveLength(1);
  });
  it('finds the flyer from yesterday, not an older flyer', () => {
    const s = { ...source, type: 'image' as const, createdAt: '2026-09-10T18:00:00Z' };
    expect(lexicalSearch('the flyer from yesterday', [], [s], context.now).sources).toHaveLength(1);
    expect(
      lexicalSearch(
        'the flyer from yesterday',
        [],
        [{ ...s, createdAt: '2026-09-09T18:00:00Z' }],
        context.now,
      ).sources,
    ).toHaveLength(0);
  });
  it('allows no actionable items in a document', () =>
    expect(
      filterExtraction(
        {
          summary: 'metadata',
          items: [
            { ...extracted, type: 'note', title: 'Overview' },
            { ...extracted, type: 'note', title: 'Professor Avery Morgan' },
            { ...extracted, type: 'reference', title: 'https://canvas.example.edu' },
          ],
        },
        true,
      ).items,
    ).toEqual([]));
  it('keeps optional schedules out of Today', () =>
    expect(
      section(
        toItem(
          { ...extracted, type: 'event', tier: 'optional', startDateTime: '2026-09-01' },
          source,
        ),
        '2026-09-12',
      ),
    ).toBe('Later'));
  it('deduplicates repeated deadline facts', () =>
    expect(
      filterExtraction(
        {
          summary: 'dates',
          items: [
            { ...extracted, title: 'Homework due', dueDate: '2026-09-18' },
            { ...extracted, title: 'Homework', dueDate: '2026-09-18' },
          ],
        },
        true,
      ).items,
    ).toHaveLength(1));
  it('voice sentence produces a Maya action and dentist event', async () => {
    const r = await new MockAIProvider().parseText(
      'I need to email Maya tomorrow and dentist Tuesday at three.',
      context,
    );
    expect(r.items).toHaveLength(2);
    expect(r.items[0].title).toContain('Maya');
    expect(r.items[1].type).toBe('event');
    expect(r.items[1].startDateTime).toContain('T');
  });
  it('a schedule without term bounds asks instead of inventing infinite recurrence', async () => {
    const r = await new MockAIProvider().parseText(
      'UGS 303\nCourse syllabus\nInstructor: Avery\nMeetings: Tuesday and Thursday at 9:30 AM in CAL 100',
      context,
    );
    expect(r.items[0].needsClarification).toBe(true);
    expect(() => recurrenceRule(toItem(r.items[0], source))).toThrow('Confirm');
  });
  it('Chicago and New York display different hours for the same instant', () => {
    const instant = '2026-09-15T20:00:00Z';
    expect(formatInTimeZone(instant, 'America/Chicago', 'HH:mm')).toBe('15:00');
    expect(formatInTimeZone(instant, 'America/New_York', 'HH:mm')).toBe('16:00');
  });
  it('all-day dates do not move when timezone changes', () =>
    expect(itemDay('2026-09-20', 'America/Chicago')).toBe(
      itemDay('2026-09-20', 'America/New_York'),
    ));
  const recurring = toItem(
    {
      ...extracted,
      type: 'event',
      title: 'Class; discussion, questions\nBring notes',
      startDateTime: '2026-08-25T14:30:00Z',
      endDateTime: '2026-08-25T15:45:00Z',
      recurrence: { days: ['TU', 'TH'], until: '2026-12-10', timezone: 'America/Chicago' },
    },
    source,
  );
  it('ICS includes UID, timestamps, source URL, escaped text, bounded recurrence and timezone', () => {
    const ics = createICS([recurring], 'https://pile.example', context.now);
    for (const token of [
      'BEGIN:VCALENDAR',
      'UID:',
      'DTSTAMP:',
      'DTSTART;TZID=America/Chicago:20260825T093000',
      'SUMMARY:Class\\; discussion\\, questions\\nBring notes',
      'RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261211T055959Z',
      'BEGIN:VTIMEZONE',
      'URL:https://pile.example/app/inbox',
    ])
      expect(ics).toContain(token);
  });
  it('ICS all-day events have exclusive next-day end', () => {
    const ics = createICS(
      [toItem({ ...extracted, dueDate: '2026-09-20', allDay: true }, source)],
      'https://pile.example',
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20260920');
    expect(ics).toContain('DTEND;VALUE=DATE:20260921');
  });
  it('folds by UTF-8 bytes without splitting characters', () => {
    const original = 'DESCRIPTION:' + 'é🌱'.repeat(60);
    const folded = foldICS(original);
    expect(folded.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    expect(folded.replaceAll('\r\n ', '')).toBe(original);
  });
  it('recurrence keeps local meeting time across daylight saving', () => {
    const occurrences = calendarOccurrences(
      [eventFromItem(recurring, true)],
      '2026-11-01',
      '2026-11-07',
    );
    expect(occurrences.find((e) => e.start.startsWith('2026-11-03'))?.start).toBe(
      '2026-11-03T15:30:00.000Z',
    );
    expect(nextMeeting(recurring, new Date('2026-12-11T18:00:00Z'))).toBeUndefined();
  });
});

it('searches item-specific excerpts while ignoring the legacy shared prefix', () => {
  const shared = { ...source, rawText: 'Professor metadata. Meet in Anderson Hall.' };
  const item = toItem({ ...extracted, title: 'Meeting', description: 'Attend studio' }, shared);
  item.sourceExcerpt = 'Meet in Anderson Hall.';
  const unrelated = {
    ...item,
    id: 'other',
    title: 'Task',
    description: 'Prepare slides',
    sourceExcerpt: shared.rawText,
  };
  expect(lexicalSearch('Anderson', [item, unrelated], [shared]).items.map((i) => i.id)).toEqual([
    item.id,
  ]);
});
