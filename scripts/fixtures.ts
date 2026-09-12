import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('demo-assets', { recursive: true });
const doc = await PDFDocument.create();
const page = doc.addPage([612, 792]);
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
page.drawRectangle({
  x: 0,
  y: 640,
  width: 612,
  height: 152,
  color: rgb(0.22, 0.34, 0.24),
});
page.drawText('CALCULUS II', {
  x: 48,
  y: 731,
  size: 12,
  font: bold,
  color: rgb(0.76, 0.84, 0.63),
});
page.drawText('A little plan for the semester.', {
  x: 48,
  y: 683,
  size: 26,
  font: bold,
  color: rgb(1, 0.99, 0.93),
});
const lines = [
  'Fall 2026 | Demo syllabus',
  'Assignment 1 due September 21, 2026',
  'Assignment 2 due October 5, 2026',
  'Assignment 3 due October 26, 2026',
  'Midterm exam October 16, 2026 at 2 PM',
  'Final exam December 11, 2026 at 9 AM',
  'Office hours September 22, 2026 at 3 PM',
  'Bring your questions and your curiosity.',
  'Course reference: integration, series, and probability.',
];
lines.forEach((t, i) =>
  page.drawText(t, {
    x: 48,
    y: 591 - i * 44,
    size: i === 0 ? 12 : 14,
    font,
    color: rgb(0.33, 0.41, 0.29),
  }),
);
await writeFile('demo-assets/sample-syllabus.pdf', await doc.save());
const flyer = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250"><rect width="1000" height="1250" fill="#e8edc9"/><rect x="50" y="50" width="900" height="1150" rx="12" fill="#2d4937"/><text x="120" y="160" fill="#bdd290" font-family="Helvetica,Arial" font-size="24" letter-spacing="6">HACKRICE 16 · YOU MADE IT</text><text x="110" y="355" fill="#fcf8e9" font-family="Georgia" font-size="100">Closing</text><text x="110" y="470" fill="#fcf8e9" font-family="Georgia" font-size="100">Ceremony.</text><line x1="115" y1="540" x2="880" y2="540" stroke="#93a778"/><text x="120" y="620" fill="#bdd290" font-family="Helvetica,Arial" font-size="24">HACKRICE CLOSING CEREMONY</text><text x="120" y="725" fill="#fcf8e9" font-family="Helvetica,Arial" font-size="38">Sunday, September 20, 2026</text><text x="120" y="800" fill="#fcf8e9" font-family="Helvetica,Arial" font-size="38">3:00 PM – 5:00 PM · America/Chicago</text><text x="120" y="875" fill="#fcf8e9" font-family="Helvetica,Arial" font-size="38">RMC Grand Hall</text><text x="120" y="1060" fill="#bdd290" font-family="Georgia" font-style="italic" font-size="32">Celebrate the things we made together.</text></svg>`;
await sharp(Buffer.from(flyer)).png().toFile('demo-assets/sample-event.png');
await writeFile(
  'demo-assets/sample-meeting-notes.txt',
  'Meeting notes — September 11, 2026\nEmail Maya about the meeting.\nSend the updated proposal to Alex.\nFinish client slides by September 18, 2026.\nThe team prefers a short demo and a live walkthrough.\n',
);
console.log('Created PDF, PNG, and text fixtures.');
