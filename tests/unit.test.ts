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

describe('prejudge adversarial capture and calendars', () => {
  const parser = new MockAIProvider();
  it.each([
    ['email maya tomorrow', 'task', 'Email maya'],
    ['emial maya tomorow', 'task', 'Email maya'],
    ['📧 email maya tomorrow!!!', 'task', 'Email maya'],
  ])('handles short capture %s', async (text, type, title) => {
    const r = await parser.parseText(text, context);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ type, title, dueDate: '2026-09-12' });
  });
  it('extracts a location and keeps a clean appointment title', async () => {
    const r = await parser.parseText('dentist tuesday 3pm at west campus dental', context);
    expect(r.items[0]).toMatchObject({
      title: 'Dentist appointment',
      location: 'west campus dental',
      startDateTime: '2026-09-15T20:00:00.000Z',
    });
  });
  it('separates a firm deadline from a vague reminder', async () => {
    const r = await parser.parseText(
      'prob hw due sunday and call mom maybe sometime this weekend',
      context,
    );
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({
      type: 'deadline',
      project: 'Probability',
      needsClarification: false,
    });
    expect(r.items[1].needsClarification).toBe(true);
  });
  it.each([
    'random thought: plants are cool',
    'I think I should maybe look into grad school but not now',
  ])('keeps non-actionable source text without a board card: %s', async (text) => {
    expect((await parser.parseText(text, context)).items).toHaveLength(0);
  });
  it('preserves a deliberate preference note', async () => {
    expect((await parser.parseText('I prefer morning meetings', context)).items[0].type).toBe(
      'note',
    );
  });
  it('requires review when one clause has conflicting dates', async () => {
    const r = await parser.parseText('Submit essay due September 18 or September 20', context);
    expect(r.items[0].needsClarification).toBe(true);
    expect(() => eventFromItem(toItem(r.items[0], source), false)).toThrow(/Resolve/);
  });
  it('deduplicates within a dump and flags conflicting copies', async () => {
    const same = await parser.parseText('email Maya tomorrow; email Maya tomorrow', context);
    expect(same.items).toHaveLength(1);
    const conflict = await parser.parseText(
      'Submit essay September 18; Submit essay September 20',
      context,
    );
    expect(conflict.items).toHaveLength(2);
    expect(conflict.items.every((i) => i.needsClarification)).toBe(true);
  });
  it('bounds long evidence without losing the original source or failing validation', async () => {
    const r = await parser.parseText('Email Maya about ' + 'the project '.repeat(900), context);
    expect(r.items[0].evidence!.length).toBeLessThanOrEqual(1500);
    expect(r.items[0].description!.length).toBeLessThanOrEqual(5000);
    expect(extractionSchema.safeParse(r).success).toBe(true);
  });
  it('retains explicit event time ranges', async () => {
    const r = await parser.parseText('Meeting September 18 from 2pm to 3pm at Library', context);
    expect(r.items[0].endDateTime).toBe('2026-09-18T20:00:00.000Z');
  });
  it('handles a second syllabus table and flags exceptions and conflicting dates', async () => {
    const r = await parser.parseText(
      'Course syllabus\nCS 101: Computing\nInstructor: Dr Example\nTerm: August 24 - December 10, 2026\nMeetings: Mon/Wed 11:00 AM - 12:15 PM in Room 101\nAssignment | Due date\nEssay | September 18, 2026\nMidterm | October 14, 2026\nNo class November 2, 2026\nEssay due September 20, 2026\nCourse overview\nWe value curiosity.',
      context,
    );
    expect(r.items).toHaveLength(5);
    expect(r.items.filter((i) => i.title === 'Essay').every((i) => i.needsClarification)).toBe(
      true,
    );
    expect(r.items.find((i) => i.title.startsWith('No class'))?.needsClarification).toBe(true);
    expect(r.items.find((i) => i.recurrence)?.endDateTime).toBe('2026-08-24T17:15:00.000Z');
  });
  it.each([
    'America/Chicago',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Asia/Tokyo',
  ])('uses local relative dates and stable all-day values in %s', async (timezone) => {
    const now = new Date('2026-09-12T02:30:00Z');
    const local = localDate(now, timezone);
    const tomorrow = new Date(Date.parse(local) + 86400000).toISOString().slice(0, 10);
    const r = await parser.parseText('Email Maya tomorrow', { ...context, now, timezone });
    expect(r.items[0].dueDate).toBe(tomorrow);
    expect(itemDay(r.items[0].dueDate!, timezone)).toBe(tomorrow);
    const timed = resolveDate('September 18 at 3pm', { ...context, timezone });
    expect(formatInTimeZone(timed.date!, timezone, 'HH:mm')).toBe('15:00');
  });
  it('rejects backwards ends and a recurrence ending before its start', () => {
    const item = toItem(
      {
        ...extracted,
        type: 'event',
        startDateTime: '2026-09-18T20:00:00Z',
        endDateTime: '2026-09-18T19:00:00Z',
      },
      source,
    );
    expect(() => eventFromItem(item, false)).toThrow(/end after/);
    delete item.endDateTime;
    item.recurrence = { days: ['FR'], until: '2026-09-01', timezone: 'America/Chicago' };
    expect(() => eventFromItem(item, false)).toThrow(/term end/);
  });
});
it('yesterday uses the prior calendar day at the end of a 25-hour DST day', () => {
  const src = { ...source, rawText: 'Maya', createdAt: '2026-10-31T17:00:00Z' };
  expect(
    lexicalSearch('Maya yesterday', [], [src], new Date('2026-11-02T05:30:00Z'), 'America/Chicago')
      .sources,
  ).toHaveLength(1);
});
it('all-day recurring occurrences retain date-only values across display zones', () => {
  const result = calendarOccurrences(
    [
      {
        id: 'qa',
        title: 'Monday',
        start: '2026-09-14',
        end: '2026-09-15',
        allDay: true,
        demo: true,
        recurrence: { days: ['MO'], until: '2026-10-01', timezone: 'America/Chicago' },
      },
    ],
    '2026-09-12',
    '2026-09-19',
  );
  expect(result[0]).toMatchObject({ start: '2026-09-14', end: '2026-09-15' });
  for (const zone of ['Asia/Tokyo', 'America/Los_Angeles'])
    expect(itemDay(result[0].start, zone)).toBe('2026-09-14');
});

describe('final correctness properties', () => {
  it('never schedules policy fragments or arbitrary numeric grading cells', async () => {
    const parser = new MockAIProvider();
    for (let n = 1; n <= 25; n++) {
      const result = await parser.parseText(
        `UGS 303 Ethics\nSyllabus\nInstructor: Jane\nAssignment | Due date\nBy via Canvas ${n}% | September 18\nRequests must be submitted ${n} weeks in advance.\nLate work may receive reduced credit.`,
        context,
      );
      expect(result.items).toEqual([]);
    }
  });
  it('keeps punctuation, Unicode, empty input and large unstructured sources valid and bounded', async () => {
    const parser = new MockAIProvider();
    for (const text of [
      '',
      '🧠'.repeat(500),
      ';;;!!!???',
      'Title '.repeat(10000),
      'Email José tomorrow!!!',
      'Submit essay February 30',
    ]) {
      const result = await parser.parseText(text, context);
      expect(extractionSchema.safeParse(result).success).toBe(true);
      expect(result.items.every((i) => i.title.length <= 80)).toBe(true);
      if (text.includes('February 30'))
        expect(
          result.items.every((i) => !i.startDateTime && !i.dueDate && i.needsClarification),
        ).toBe(true);
    }
  });
});
