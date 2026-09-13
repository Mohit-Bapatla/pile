import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { MockAIProvider } from '../lib/ai';
import { normalizedTitle } from '../lib/actionability';
const dir = 'tests/fixtures/extraction-corpus';
const rows = [];
let expectedCount = 0,
  correct = 0,
  fp = 0,
  fn = 0,
  dateErrors = 0,
  typeErrors = 0,
  unwanted = 0,
  detailErrors = 0,
  duplicateErrors = 0;
for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()) {
  const c = JSON.parse(await readFile(`${dir}/${file}`, 'utf8'));
  const result = await new MockAIProvider().parseText(c.text, {
    now: new Date(c.now),
    timezone: c.timezone,
    projects: [],
  });
  const expected = [...c.expected, ...c.optional];
  const remaining = [...result.items];
  const errors: string[] = [];
  expectedCount += expected.length;
  for (const e of expected) {
    const idx = remaining.findIndex((a) =>
      [e.title, ...(e.acceptableTitles || [])].some(
        (t) => normalizedTitle(t) === normalizedTitle(a.title),
      ),
    );
    if (idx < 0) {
      fn++;
      errors.push(`Missing: ${e.title}`);
      continue;
    }
    const a = remaining.splice(idx, 1)[0];
    if (c.optional.some((v: { title: string }) => v.title === e.title) && a.tier !== 'optional') {
      detailErrors++;
      errors.push(`Tier: ${e.title} should be optional`);
    }
    correct++;
    if (a.type !== e.type) {
      typeErrors++;
      errors.push(`Type: ${e.title}: expected ${e.type}, got ${a.type}`);
    }
    if ((a.dueDate || a.startDateTime || null) !== (e.date || null)) {
      dateErrors++;
      errors.push(
        `Date: ${e.title}: expected ${e.date || 'none'}, got ${a.dueDate || a.startDateTime || 'none'}`,
      );
    }
    for (const field of ['needsClarification', 'location', 'project'])
      if (e[field] !== undefined && a[field as keyof typeof a] !== e[field]) {
        detailErrors++;
        errors.push(`${field}: ${e.title}`);
      }
    if (e.recurrence && JSON.stringify(a.recurrence?.days) !== JSON.stringify(e.recurrence)) {
      detailErrors++;
      errors.push(`Recurrence: ${e.title}`);
    }
  }
  fp += remaining.length;
  for (const a of remaining) errors.push(`Unexpected: ${a.title}`);
  for (const phrase of c.forbidden)
    for (const a of result.items)
      if (a.title.toLowerCase().includes(phrase.toLowerCase())) {
        unwanted++;
        errors.push(`Forbidden: ${phrase}`);
      }
  for (const [key, value] of Object.entries(c.metadata || {}))
    if (result.metadata?.[key as keyof typeof result.metadata] !== value) {
      detailErrors++;
      errors.push(`Metadata: ${key}`);
    }
  const keys = result.items.map(
    (a) => normalizedTitle(a.title) + '|' + (a.dueDate || a.startDateTime || ''),
  );
  duplicateErrors += keys.length - new Set(keys).size;
  rows.push({
    id: c.id,
    category: c.category,
    expected: expected.length,
    actual: result.items.length,
    errors,
    items: result.items.map((a) => ({
      title: a.title,
      type: a.type,
      date: a.dueDate || a.startDateTime,
      needsClarification: a.needsClarification,
    })),
  });
}
const segmentation = rows.filter((r) => ['voice', 'text'].includes(r.category));
const totals = {
  cases: rows.length,
  expectedItems: expectedCount,
  matched: correct,
  falsePositives: fp,
  falseNegatives: fn,
  dateMismatches: dateErrors,
  typeMismatches: typeErrors,
  unwantedViolations: unwanted,
  detailMismatches: detailErrors,
  falseDiscoveryRate: fp / Math.max(1, correct + fp),
  segmentation: {
    cases: segmentation.length,
    exactCounts: segmentation.filter((r) => r.expected === r.actual).length,
    underCount: segmentation.filter((r) => r.actual < r.expected).length,
    overCount: segmentation.filter((r) => r.actual > r.expected).length,
    dateBindingErrors: segmentation.flatMap((r) => r.errors).filter((e) => e.startsWith('Date:'))
      .length,
    duplicateErrors,
  },
};
console.log(JSON.stringify(totals, null, 2));
for (const r of rows) if (r.errors.length) console.log(r.id + '\n  ' + r.errors.join('\n  '));
await mkdir('docs/qa', { recursive: true });
await writeFile(
  'docs/qa/extraction-results.json',
  JSON.stringify({ totals, rows }, null, 2) + '\n',
);
if (fp + fn + dateErrors + typeErrors + unwanted + detailErrors + duplicateErrors)
  process.exitCode = 1;
