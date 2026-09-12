import { z } from 'zod';
import { nextMeeting } from './recurrence';
import { formatInTimeZone } from 'date-fns-tz';
export const types = [
  'task',
  'event',
  'deadline',
  'reminder',
  'note',
  'idea',
  'reference',
] as const;
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/)
  .refine((v) => {
    const day = v.slice(0, 10);
    return (
      !Number.isNaN(Date.parse(v)) &&
      new Date(day + 'T12:00:00Z').toISOString().slice(0, 10) === day
    );
  }, 'Invalid date');
export const ianaTimezone = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      Intl.DateTimeFormat('en', { timeZone: value });
      return !/[\r\n;]/.test(value);
    } catch {
      return false;
    }
  }, 'Invalid timezone');
export const recurrenceSchema = z
  .object({
    days: z
      .array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']))
      .min(1)
      .max(7),
    until: date.refine((v) => v.length === 10).optional(),
    timezone: ianaTimezone,
  })
  .strict();
export const metadataSchema = z
  .object({
    courseName: z.string().optional(),
    instructor: z.string().optional(),
    contactEmail: z.string().optional(),
    website: z.string().optional(),
    location: z.string().optional(),
    classSchedule: z.string().optional(),
    termStart: z.string().optional(),
    termEnd: z.string().optional(),
  })
  .strict();
export type CourseMetadata = z.infer<typeof metadataSchema>;
export const extractedItemSchema = z
  .object({
    type: z.enum(types),
    tier: z.enum(['important', 'optional', 'reference']).optional(),
    actionabilityScore: z.number().min(0).max(100).optional(),
    evidence: z.string().max(1500).optional(),
    sourceTimezone: ianaTimezone.optional(),
    recurrence: recurrenceSchema.optional(),
    title: z.string().min(1).max(240),
    description: z.string().max(5000).optional(),
    dueDate: date.optional(),
    startDateTime: date.optional(),
    endDateTime: date.optional(),
    allDay: z.boolean().optional(),
    location: z.string().max(500).optional(),
    priority: z.enum(['low', 'medium', 'high']),
    confidence: z.number().min(0).max(1),
    project: z.string().max(80).optional(),
    needsClarification: z.boolean(),
    clarificationQuestion: z.string().max(300).optional(),
  })
  .strict();
export const extractionSchema = z
  .object({
    summary: z.string().max(1000),
    suggestedProject: z.string().max(80).optional(),
    metadata: metadataSchema.optional(),
    items: z.array(extractedItemSchema).max(50),
  })
  .strict();
export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedItem = z.infer<typeof extractedItemSchema>;
export type Item = ExtractedItem & {
  id: string;
  sourceId: string;
  userId: string;
  projectId?: string;
  category?: string;
  status: 'inbox' | 'planned' | 'in_progress' | 'done' | 'archived';
  calendarStatus: 'not_applicable' | 'suggested' | 'pending' | 'synced' | 'failed';
  externalCalendarEventId?: string;
  calendarRevision?: number;
  calendarDemo?: boolean;
  sourceExcerpt: string;
  reasoningSummary: string;
  createdAt: string;
  updatedAt: string;
};
export type Source = {
  id: string;
  userId: string;
  type: 'text' | 'voice' | 'pdf' | 'image' | 'file';
  rawText: string;
  fileName?: string;
  fileUrl?: string;
  transcription?: string;
  durationSeconds?: number;
  metadata?: CourseMetadata;
  fingerprint?: string;
  pageCount?: number;
  duplicateOf?: string;
  createdAt: string;
  processingStatus: 'queued' | 'processing' | 'parsed' | 'needs_review' | 'error';
  summary?: string;
  error?: string;
  provider?: string;
  timezone: string;
};
export type Project = {
  id: string;
  name: string;
  color: string;
  metadata?: CourseMetadata;
  sourceId?: string;
};
export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  location?: string;
  demo: boolean;
  itemId?: string;
  calendarId?: string;
  recurrence?: z.infer<typeof recurrenceSchema>;
};
export function localDate(now: Date, timezone: string) {
  return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}
export function itemDay(value: string, timezone = 'America/Chicago') {
  return value.length === 10 ? value : localDate(new Date(value), timezone);
}
export function section(item: Item, today: string, timezone = 'America/Chicago') {
  if (item.tier === 'optional' || item.tier === 'reference') return 'Later';
  if (item.status === 'inbox' || item.needsClarification) return 'Inbox';
  const value = item.recurrence
    ? nextMeeting(item, new Date(today + 'T12:00:00Z'))
    : item.dueDate || item.startDateTime;
  const d = value ? itemDay(value, timezone) : undefined;
  if (!d || ['idea', 'note', 'reference'].includes(item.type)) return 'Later';
  if (d <= today) return 'Today';
  if (d <= new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0, 10))
    return 'This week';
  return 'Later';
}
export function needsReview(item: ExtractedItem) {
  return item.needsClarification || item.confidence < 0.75;
}
export function calendarId(id: string, revision = 0) {
  return 'pile' + id.replaceAll('-', '') + (revision ? 'r' + revision : '');
}
export function toItem(extracted: ExtractedItem, source: Source, project?: Project): Item {
  const now = new Date().toISOString();
  return {
    ...extracted,
    sourceTimezone: extracted.sourceTimezone || source.timezone,
    id: crypto.randomUUID(),
    sourceId: source.id,
    userId: source.userId,
    projectId: project?.id,
    status: needsReview(extracted) ? 'inbox' : 'planned',
    calendarStatus:
      (extracted.type === 'event' || extracted.type === 'deadline') &&
      (extracted.dueDate || extracted.startDateTime)
        ? 'suggested'
        : 'not_applicable',
    sourceExcerpt: (extracted.evidence || extracted.description || extracted.title).slice(0, 1500),
    reasoningSummary: needsReview(extracted)
      ? 'Please review the date or meaning before acting.'
      : `Saved as ${extracted.type} from your ${source.type} capture.`,
    createdAt: now,
    updatedAt: now,
  };
}
