import { fromZonedTime } from 'date-fns-tz';
import type { ParseContext, resolveDate } from './ai';
import type { Extraction, ExtractedItem, CourseMetadata } from './model';
import { filterExtraction } from './actionability';
import { assessment, explicitDate, isPolicyOrDescription, normalizeActionTitle } from './intents';
const weekdays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const dayWords: [RegExp, (typeof weekdays)[number]][] = [
  [/\bmon(?:day)?\b/i, 'MO'],
  [/\btue(?:s(?:day)?)?\b/i, 'TU'],
  [/\bwed(?:nesday)?\b/i, 'WE'],
  [/\bthu(?:r(?:s(?:day)?)?)?\b/i, 'TH'],
  [/\bfri(?:day)?\b/i, 'FR'],
  [/\bsat(?:urday)?\b/i, 'SA'],
  [/\bsun(?:day)?\b/i, 'SU'],
];
export function parseSyllabus(
  text: string,
  context: ParseContext,
  resolve: typeof resolveDate,
): Extraction | undefined {
  if (
    !/syllabus|course overview|weekly schedule/i.test(text) ||
    !/meetings|office hours|instructor/i.test(text)
  )
    return;
  const lines = text
    .replace(/\s*\+\s*(?=(?:section|discussion|lab)\b)/gi, '\nDiscussion: ')
    .split(/\n|\.\s+(?=Submit|Complete|Essay|Observation|Midterm)/)
    .map((l) => l.trim())
    .filter(Boolean);
  const course = text.match(/\b([A-Z]{2,5})\s?(\d{3}[A-Z]?)\b/)?.[0];
  const courseLine = lines.find((l) => course && l.includes(course));
  const courseName =
    courseLine?.replace(course || '', '').replace(/^[\s:—–-]+/, '') ||
    lines[lines.indexOf(courseLine || '') + 1] ||
    'Course';
  const project = (course ? `${course} — ${courseName}` : courseName).slice(0, 80);
  const year =
    text.match(/(?:Fall|Spring|Summer)\s+(20\d{2})/i)?.[1] || String(context.now.getFullYear());
  const datedContext = { ...context, now: new Date(`${year}-01-01T12:00:00Z`) };
  const termLine = lines.find((l) => /^term\b/i.test(l));
  const dates = termLine?.match(
    /(?:Jan\w*|Feb\w*|Mar\w*|Apr\w*|May|Jun\w*|Jul\w*|Aug\w*|Sep\w*|Oct\w*|Nov\w*|Dec\w*)\s+\d{1,2}(?:,?\s+20\d{2})?/gi,
  );
  const termStart = dates?.[0] ? resolve(dates[0], datedContext).day : undefined;
  const termEnd = dates?.[1] ? resolve(dates[1], datedContext).day : undefined;
  const meetings = lines.find((l) => /^(meetings|class schedule)\b/i.test(l));
  const metadata: CourseMetadata = {
    courseName,
    instructor: lines
      .find((l) => /^(instructor|professor)\s*:/i.test(l))
      ?.replace(/^[^:]+:\s*/, ''),
    contactEmail: text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0],
    website: text.match(/https?:\/\/[^\s)]+/)?.[0],
    classSchedule: meetings?.replace(/^[^:]+:\s*/, ''),
    location: meetings?.match(/\b(?:in|Location:)\s+(.+)$/i)?.[1],
    termStart,
    termEnd,
  };
  const items: ExtractedItem[] = [];
  let assessmentTable = false;
  let assignmentColumn = -1;
  for (const rawLine of lines) {
    let line = rawLine;
    if (/Assignment.*\|.*Due/i.test(line))
      assignmentColumn = line.split('|').findIndex((c) => /assignment/i.test(c));
    else if (assignmentColumn >= 0 && line.includes('|')) {
      const cells = line.split('|').map((c) => c.trim());
      line = `${cells[assignmentColumn]} due ${cells.at(-1)}`;
    }
    if (/assignment.*(?:due|date)|assessment.*date/i.test(line)) assessmentTable = true;
    const schedule =
      /^(meetings|class schedule|discussion|lab(?! report)|office hours|tutoring)\b/i.test(line);
    if (schedule) {
      const days = dayWords.filter(([r]) => r.test(line)).map(([, d]) => d);
      if (!days.length) continue;
      const time = line.match(
        /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*(?:[–—-]|to)\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i,
      );
      const single = line.match(/(?:at|\s)(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
      const hour = (h: string, ap: string) => (+h % 12) + (/pm/i.test(ap) ? 12 : 0);
      const startHour = time
        ? hour(time[1], time[3] || time[6])
        : single
          ? hour(single[1], single[3])
          : undefined;
      const endHour = time ? hour(time[4], time[6]) : undefined;
      let first = termStart;
      if (first) {
        for (let n = 0; n < 7; n++) {
          const d = new Date(Date.parse(termStart!) + n * 86400000);
          if (days.includes(weekdays[d.getUTCDay()])) {
            first = d.toISOString().slice(0, 10);
            break;
          }
        }
      }
      const stamp = (h: number, m: string) =>
        fromZonedTime(
          `${first}T${String(h).padStart(2, '0')}:${m.padStart(2, '0')}:00`,
          context.timezone,
        ).toISOString();
      const optional = /office hours|tutoring/i.test(line);
      const missing = !first || !termEnd || startHour === undefined;
      items.push({
        type: 'event',
        title: /^(meetings|class schedule)/i.test(line)
          ? `${course || courseName} Lecture`
          : `${course || courseName} ${line.match(/^(discussion|lab(?! report)|office hours|tutoring)/i)?.[1] || 'Schedule'}`,
        description: line,
        evidence: line,
        project,
        tier: optional ? 'optional' : 'important',
        priority: 'medium',
        confidence: missing ? 0.6 : 0.94,
        needsClarification: missing,
        ...(missing
          ? { clarificationQuestion: 'Confirm the first meeting date, time, and term end date.' }
          : {}),
        ...(first && startHour !== undefined
          ? {
              startDateTime: stamp(startHour, time?.[2] || single?.[2] || '00'),
              allDay: false,
              ...(endHour !== undefined ? { endDateTime: stamp(endHour, time?.[5] || '00') } : {}),
            }
          : {}),
        recurrence: { days, until: termEnd, timezone: context.timezone },
        sourceTimezone: context.timezone,
        location: line.match(/\bin\s+(.+)$/i)?.[1],
      });
      continue;
    }
    const scheduleChange = /\b(no class|cancelled|canceled|rescheduled|moved to)\b/i.test(line);
    // Assessment rows must carry both a date and an explicit assessment/action signal.
    if (
      (!/\b(due|deadline|exam|midterm|quiz|proposal|essay|observation|report|final project|assignment|registration|payment|cancelled)\b/i.test(
        line,
      ) &&
        !scheduleChange &&
        !(assessmentTable && /[|\t]/.test(line))) ||
      line.length > 240
    )
      continue;
    if (isPolicyOrDescription(line) || !explicitDate.test(line)) continue;
    // A table position is not evidence of an assignment; require a named deliverable.
    if (!assessment.test(line) && !scheduleChange) continue;
    const d = resolve(line, datedContext);
    if (!d.date) continue;
    const type = scheduleChange
      ? 'reminder'
      : /\b(exam|midterm|quiz)\b/i.test(line)
        ? 'event'
        : 'deadline';
    const title = normalizeActionTitle(
      line
        .replace(d.matched || '', '')
        .replace(/^\s*[|:—–-]+|[|:—–-]+\s*$/g, '')
        .replace(/\b(due|by|on)\s*$/i, '')
        .replace(/\s*\|\s*(?:via\s+)?Canvas.*$/i, '')
        .replace(/\bvia\s+Canvas\s*\d*%?$/i, '')
        .trim(),
    );
    items.push({
      type,
      title,
      description: line,
      evidence: line,
      project,
      tier: 'important',
      priority: /exam|midterm|final/i.test(line) ? 'high' : 'medium',
      confidence: d.ambiguous || scheduleChange ? 0.6 : 0.95,
      needsClarification: !!d.ambiguous || scheduleChange,
      ...(d.ambiguous || scheduleChange
        ? {
            clarificationQuestion: scheduleChange
              ? 'Schedule change: confirm this date and adjust the recurring class in your calendar.'
              : 'The source gives more than one date. Which should be used?',
          }
        : {}),
      allDay: !d.hasTime,
      sourceTimezone: context.timezone,
      ...(type === 'event' ? { startDateTime: d.date } : { dueDate: d.date }),
    });
  }
  return filterExtraction(
    { summary: 'Your semester, with room to breathe.', suggestedProject: project, metadata, items },
    true,
  );
}
