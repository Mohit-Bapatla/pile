import { PDFParse } from 'pdf-parse';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AIProvider, ParseContext } from './ai';
export async function pdfText(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('This file is not a valid PDF.');
  const parser = new PDFParse({ data: new Uint8Array(bytes) });
  try {
    const result = await parser.getText();
    if (!result.text.trim())
      throw new Error('This PDF has no readable text. Try a text-based PDF or paste its contents.');
    return result.text.slice(0, 60000);
  } finally {
    await parser.destroy();
  }
}
export async function parseImage(
  bytes: Buffer,
  mime: string,
  provider: AIProvider,
  c: ParseContext,
) {
  if (!process.env.OPENAI_API_KEY && process.env.DEMO_MODE !== 'false') {
    const fixture = await readFile(path.join(process.cwd(), 'demo-assets/sample-event.png'));
    const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
    if (hash(bytes) === hash(fixture))
      return {
        summary: 'Found an event in the sample flyer.',
        items: [
          {
            type: 'event' as const,
            title: 'HackRice Closing Ceremony',
            description: 'Celebrate the things we made together.',
            startDateTime: '2026-09-20T15:00:00-05:00',
            endDateTime: '2026-09-20T17:00:00-05:00',
            allDay: false,
            location: 'RMC Grand Hall',
            priority: 'medium' as const,
            confidence: 1,
            needsClarification: false,
            project: 'HackRice',
          },
        ],
      };
  }
  return provider.parseImage(bytes, mime, c);
}
