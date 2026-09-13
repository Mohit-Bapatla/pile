import type { Extraction, ExtractedItem } from './model';
export function normalizedTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(due|deadline|on|by)\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
export function candidateKey(item: ExtractedItem) {
  const date = item.startDateTime || item.dueDate || '';
  return `${normalizedTitle(item.title)}|${date.includes('T') ? new Date(date).toISOString() : date}|${item.recurrence?.days.join(',') || ''}`;
}
export function actionability(item: ExtractedItem) {
  const text = `${item.title} ${item.description || ''}`;
  if (
    /^(overview|course overview|course resources|weekly schedule|key dates|instructor|professor|canvas|copyright|grading philosophy|attendees)\b/i.test(
      item.title,
    ) &&
    !/\b(due|deadline|exam|appointment)\b/i.test(item.title)
  )
    return 0;
  if (/^(?:https?:\/\/|[\w.+-]+@[\w.-]+\.)/.test(item.title)) return 0;
  if (item.tier === 'optional' || /office hours|tutoring|optional|review session/i.test(text))
    return 45;
  let score = 0;
  if (['task', 'reminder', 'deadline'].includes(item.type)) score += 40;
  if (item.startDateTime || item.dueDate) score += 25;
  if (item.type === 'event' || item.recurrence) score += 45;
  if (/exam|assignment|application|registration|payment|cancel|schedule change/i.test(text))
    score += 20;
  if (['idea', 'reference'].includes(item.type)) score += 55;
  if (item.type === 'note' && /remember|prefer|when i say|save this/i.test(text)) score += 55;
  return Math.min(100, score);
}
export function filterExtraction(extraction: Extraction, _document: boolean): Extraction {
  void _document;
  const seen = new Set<string>();
  const items = extraction.items
    .filter((i) => {
      const key = candidateKey(i);
      if (seen.has(key)) return false;
      seen.add(key);
      // Explicit actions/preferences qualify; generic prose remains in the source.
      return actionability(i) >= 40;
    })
    .map((i) => {
      const score = actionability(i);
      const recurrenceIncomplete = !!i.recurrence && (!i.recurrence.until || !i.startDateTime);
      return {
        ...i,
        actionabilityScore: score,
        tier:
          i.tier ||
          ((/office hours|tutoring|optional|review session/i.test(`${i.title} ${i.description}`)
            ? 'optional'
            : i.type === 'reference'
              ? 'reference'
              : 'important') as ExtractedItem['tier']),
        ...(recurrenceIncomplete
          ? {
              needsClarification: true,
              confidence: 0.6,
              clarificationQuestion: 'What are the first meeting date and the term end date?',
            }
          : {}),
      };
    });
  // Conflicting dates are alternatives to resolve, never two confidently scheduled commitments.
  for (const item of items) {
    const conflicts = items.filter(
      (other) =>
        normalizedTitle(other.title) === normalizedTitle(item.title) &&
        (other.dueDate || other.startDateTime) !== (item.dueDate || item.startDateTime),
    );
    if (conflicts.length) {
      item.needsClarification = true;
      item.confidence = 0.6;
      item.clarificationQuestion =
        'The source gives different dates for this item. Which date is correct?';
    }
  }
  return {
    ...extraction,
    items,
    summary: items.length
      ? `${items.filter((i) => i.tier === 'important').length} important items${items.some((i) => i.tier === 'optional') ? ` · ${items.filter((i) => i.tier === 'optional').length} optional schedules` : ''}. The rest stays with your source.`
      : 'No actions or dates to manage. Your original is saved.',
  };
}
