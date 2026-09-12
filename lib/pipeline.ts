import type { DB } from './db';
import { aiProvider, MockAIProvider } from './ai';
import { parseImage, pdfText, pdfPageCount } from './files';
import { state, getSource, updateSource, commitExtraction } from './store';
import { extractionSchema } from './model';
import { filterExtraction } from './actionability';
export async function processSource(db: DB, user: string, id: string) {
  const record = await getSource(db, user, id);
  if (!record) throw new Error('Source not found.');
  const source = record.body;
  const claim = await db.query(
    "UPDATE processing_jobs SET status='processing',updated_at=now() WHERE source_id=$1 AND (status IN ('queued','error') OR (status='processing' AND updated_at < now()-interval '2 minutes')) RETURNING source_id",
    [id],
  );
  if (!claim.rows.length) return [];
  source.processingStatus = 'processing';
  await updateSource(db, source);
  try {
    if (source.type === 'pdf' && !source.rawText)
      source.rawText = await pdfText(Buffer.from(record.file_data));
    if (source.type === 'pdf' && record.file_data)
      source.pageCount = await pdfPageCount(Buffer.from(record.file_data));
    const provider = aiProvider();
    const c = {
      now: new Date(),
      timezone: source.timezone,
      projects: (await state(db, user)).projects.map((p) => p.name),
    };
    let extraction;
    try {
      extraction =
        source.type === 'image'
          ? await parseImage(Buffer.from(record.file_data), record.mime, provider, c)
          : await provider.parseText(source.rawText, c);
      source.provider = provider.name;
    } catch (e) {
      if (
        process.env.DEMO_MODE === 'false' ||
        source.type === 'image' ||
        provider instanceof MockAIProvider
      )
        throw e;
      extraction = await new MockAIProvider().parseText(source.rawText, c);
      source.provider = 'Demo fallback · AI provider unavailable';
    }
    return await commitExtraction(
      db,
      source,
      filterExtraction(
        extractionSchema.parse(extraction),
        ['pdf', 'file'].includes(source.type) || source.rawText.split(/\n/).length > 5,
      ),
    );
  } catch (e) {
    source.processingStatus = 'error';
    source.error = e instanceof Error ? e.message : 'Could not sort this capture.';
    await updateSource(db, source);
    throw e;
  }
}
