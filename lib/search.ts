import type { Item, Source } from './model';
const stop = new Set(
  'the a an i me my what did say about find that thing things do need to in from uploaded for is of and where was it saved you your yet'.split(
    ' ',
  ),
);
export function searchTokens(value: string) {
  return (value.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((t) => !stop.has(t))
    .map((t) => {
      if (/^(deadline|deadlines|due)$/.test(t)) return 'due';
      if (t.endsWith('ies') && t.length > 4) return t.slice(0, -3) + 'y';
      return t.endsWith('s') && !t.endsWith('ss') && t.length > 4 ? t.slice(0, -1) : t;
    });
}
function scoreFields(tokens: string[], fields: [string | undefined, number][]) {
  if (!tokens.length) return 0;
  const values = fields.map(([value, weight]) => ({
    words: new Set(searchTokens(value || '')),
    weight,
  }));
  const scores = tokens.map((token) =>
    Math.max(0, ...values.map((f) => (f.words.has(token) ? f.weight : 0))),
  );
  // Meaningful conjunctions must match all terms, not drown the best result in partial hits.
  return scores.every((s) => s > 0) ? scores.reduce((a, b) => a + b, 0) + tokens.length * 10 : 0;
}
export function lexicalSearch(
  query: string,
  items: Item[],
  sources: Source[],
  now = new Date(),
  timezone = 'America/Chicago',
) {
  let tokens = [...new Set(searchTokens(query))];
  const yesterday = tokens.includes('yesterday');
  tokens = tokens.filter((t) => t !== 'yesterday');
  const sourceMap = new Map(sources.map((s) => [s.id, s]));
  const localToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  // Calendar arithmetic, not a 24-hour instant subtraction across a DST day.
  const yesterdayDate = new Date(Date.parse(localToday) - 86400000).toISOString().slice(0, 10);
  const recent = (source?: Source) =>
    !yesterday ||
    (!!source &&
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(source.createdAt)) === yesterdayDate);
  const ranked = items
    .map((item) => {
      const source = sourceMap.get(item.sourceId);
      // Old versions copied the source prefix onto every sibling. Only index a bounded item-specific excerpt.
      const excerpt =
        item.evidence ||
        (item.sourceExcerpt !== source?.rawText.slice(0, 1500) ? item.sourceExcerpt : undefined);
      const dateContext = item.dueDate || item.type === 'deadline' ? 'due deadline' : '';
      let score = recent(source)
        ? scoreFields(tokens, [
            [item.title, 100],
            [item.project, 65],
            [source?.fileName, 45],
            [item.category, 35],
            [item.description, 25],
            [excerpt, 20],
            [dateContext, 40],
            [source?.type === 'image' ? 'flyer image' : source?.type, 12],
          ])
        : 0;
      if (score && searchTokens(item.title).join(' ') === tokens.join(' ')) score += 300;
      if (score && searchTokens(item.title).join(' ').startsWith(tokens.join(' '))) score += 100;
      return { item, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt));
  const matchedIds = new Set(ranked.map((r) => r.item.sourceId));
  const sourceResults = sources
    .map((source) => ({
      source,
      score: recent(source)
        ? scoreFields(tokens, [
            [source.fileName, 70],
            [source.summary, 35],
            [source.rawText, 20],
            [source.transcription, 25],
            [source.type === 'image' ? 'flyer image' : source.type, 40],
          ])
        : 0,
    }))
    .filter(
      (r) =>
        r.score > 0 &&
        (!matchedIds.has(r.source.id) || ['pdf', 'image', 'voice'].includes(r.source.type)),
    )
    .sort((a, b) => b.score - a.score)
    .map((r) => r.source);
  return { items: ranked.map((r) => r.item), sources: sourceResults, provider: 'Local search' };
}
export function matchingExcerpt(text: string, query: string) {
  const tokens = searchTokens(query);
  const words = text.split(/(\s+)/);
  const index = words.findIndex((w) => searchTokens(w).some((t) => tokens.includes(t)));
  return words
    .slice(Math.max(0, index - 8), Math.max(0, index - 8) + 42)
    .join('')
    .slice(0, 260);
}
