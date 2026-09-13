import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('demo-assets', { recursive: true });
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const serif = await doc.embedFont(StandardFonts.TimesRoman);
const ink = rgb(0.18, 0.2, 0.18),
  muted = rgb(0.39, 0.42, 0.37),
  line = rgb(0.79, 0.8, 0.75);
let page = doc.addPage([612, 792]),
  y = 730;
function text(value: string, size = 10, face = font) {
  page.drawText(value, { x: 52, y, size, font: face, color: ink });
  y -= size + 8;
}
function paragraph(value: string) {
  let row = '';
  for (const word of value.split(' ')) {
    if (font.widthOfTextAtSize(row + ' ' + word, 10) > 505) {
      text(row, 10);
      row = word;
    } else row += (row ? ' ' : '') + word;
  }
  if (row) text(row, 10);
  y -= 10;
}
function heading(value: string) {
  y -= 10;
  page.drawLine({ start: { x: 52, y }, end: { x: 560, y }, color: line, thickness: 0.6 });
  y -= 25;
  text(value, 13, bold);
  y -= 5;
}
function nextPage(label: string) {
  page = doc.addPage([612, 792]);
  y = 738;
  text('UGS 303  /  FALL 2026', 9, bold);
  y -= 12;
  text(label, 26, serif);
  y -= 16;
}
text('UGS 303', 12, bold);
y -= 5;
text('Identity, Community & Development', 27, serif);
text('Fall 2026  /  Course syllabus', 11);
y -= 14;
text('Instructor: Dr. Avery Morgan');
text('Contact: avery.morgan@example.edu');
text('Term: August 24, 2026 - December 10, 2026');
text('Meetings: Tue / Thu 9:30-10:45 AM in CAL 100');
text('Office hours: Tuesday 2-4 PM in CAL 214');
text('Tutoring: Wednesday at 6 PM in Learning Commons');
heading('Course Overview');
paragraph(
  'How does a sense of self take shape in relation to other people? This seminar brings developmental research into conversation with literature, public space and ordinary experience. We will consider identity as an ongoing process, paying particular attention to the communities that make certain stories possible and others difficult to tell.',
);
heading('Key Dates');
for (const row of [
  'September 18, 2026 | Observation #2 due',
  'October 14, 2026 at 9:30 AM | Midterm',
  'November 12, 2026 | Project proposal due',
  'December 8, 2026 | Final project due',
]) {
  text(row, 11);
  y -= 4;
}
nextPage('Reading, observation & conversation');
heading('Working together');
paragraph(
  "Our classroom is a place to practice careful attention. Productive disagreement depends on representing another person's view fairly before responding. The texts invite different interpretations, and discussion will be strongest when those interpretations are connected to particular passages or observations. Curiosity matters more than the performance of certainty.",
);
paragraph(
  'Writing in this course develops through revision. Early observations can be tentative, specific and incomplete. As a project grows, students should make the relationship between evidence and interpretation more visible. Feedback describes what a reader can follow, where a question remains and what further evidence could help.',
);
heading('Weekly Schedule');
for (const row of [
  'Week 1    Self, story and the social world',
  'Week 2    Attention and everyday observation',
  'Week 3    Families and inherited narratives',
  'Week 4    Community boundaries and belonging',
  'Week 5    Language, memory and identity',
  'Week 6    Development across contexts',
  'Week 7    Institutions and public space',
  'Week 8    Revisiting our questions',
  'Week 9    Field observations and interpretation',
  'Week 10   The ethics of representing others',
  'Week 11   From observation to argument',
  'Week 12   Workshop conversations',
  'Week 13   Revision and synthesis',
  'Week 14   Sharing perspectives',
])
  text(row, 10);
nextPage('Assessment & course resources');
heading('Assessment philosophy');
paragraph(
  'Assessment emphasizes the clarity of an argument, the care of its evidence and the thoughtfulness of revision. An ambitious question is valuable even when its answer remains open. Strong work acknowledges the limits of an observation and distinguishes a claim from an impression. Grades reflect the development of these practices across the semester.',
);
paragraph('Observation #2 due September 18, 2026');
paragraph(
  'The observation portfolio draws on ordinary settings such as a campus path, a shared kitchen or a public gathering. Descriptions should protect the privacy of people encountered. Names and identifying details are generally unnecessary for explaining a social pattern.',
);
heading('Course Resources');
text('Canvas: https://canvas.example.edu/courses/ugs303');
paragraph(
  'Canvas contains readings, assignment descriptions and the full course bibliography. The website is a shared reference shelf for the seminar. Office hours offer space for questions about a reading, a draft or an idea that does not yet have a clear shape. The weekly tutoring session provides an additional setting for conversation.',
);
heading('Access and participation');
paragraph(
  'People contribute in different ways. Listening carefully, connecting ideas and making space for another speaker all support the work of the group. Course materials are organized with clear headings and readable formats. Students may discuss access needs privately with the instructor so that classroom participation can be planned thoughtfully.',
);
heading('Academic integrity');
paragraph(
  "The distinction between one's own interpretation and the work of others should remain visible. Quotation, paraphrase and borrowed ideas all need appropriate attribution. The purpose of citation is to make an intellectual conversation traceable, giving readers a path back to the materials that shaped an argument.",
);
nextPage('Policies & grading');
heading('Extensions and communication');
paragraph(
  'Requests must be submitted at least one week in advance. Extensions may be granted for documented circumstances. Late work may receive reduced credit. Students should contact the professor if they need accommodations. These policies explain the process; they are not individual assignments.',
);
paragraph(
  'We aim to respond to emails if received on weekdays; sometimes delays occur due to other commitments. Email response times are not assignment deadlines.',
);
heading('Grading overview');
text('Canvas quizzes - 5%');
text('Participation - 10%');
text('Observation portfolio - 25%');
text('Midterm - 20%');
text('Final project - 40%');
paragraph(
  'The final grade is based on the assessments above. Submit work through Canvas using the dates listed in Key Dates. This table describes weights, not additional deliverables.',
);
for (const [index, p] of doc.getPages().entries()) {
  p.drawLine({ start: { x: 52, y: 43 }, end: { x: 560, y: 43 }, color: line, thickness: 0.5 });
  p.drawText(
    `UGS 303  /  Fall 2026                                              ${index + 1} / ${doc.getPageCount()}`,
    { x: 52, y: 28, size: 8, font, color: muted },
  );
}
await writeFile('demo-assets/sample-syllabus.pdf', await doc.save());
const flyer = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250"><rect width="1000" height="1250" fill="#f3efe3"/><text x="85" y="120" fill="#465648" font-family="Helvetica,Arial" font-size="22" letter-spacing="4">RICE ARCHITECTURE / OPEN STUDIO</text><line x1="85" y1="170" x2="915" y2="170" stroke="#465648"/><text x="75" y="380" fill="#292823" font-family="Helvetica,Arial" font-weight="bold" font-size="155" letter-spacing="-8">DESIGN</text><text x="75" y="535" fill="#292823" font-family="Helvetica,Arial" font-weight="bold" font-size="155" letter-spacing="-8">NIGHT</text><text x="85" y="710" fill="#465648" font-family="Georgia" font-size="50">Thursday, September 17</text><text x="85" y="780" fill="#292823" font-family="Helvetica,Arial" font-size="38">7:00 PM / 2026</text><line x1="85" y1="860" x2="915" y2="860" stroke="#465648"/><text x="85" y="940" fill="#292823" font-family="Helvetica,Arial" font-size="36">Rice Architecture</text><text x="85" y="995" fill="#292823" font-family="Helvetica,Arial" font-size="36">Anderson Hall</text><text x="85" y="1125" fill="#465648" font-family="Helvetica,Arial" font-size="26">Critique · snacks · open studio</text><text x="85" y="1175" fill="#465648" font-family="Helvetica,Arial" font-size="22">FREE ADMISSION</text></svg>`;
await sharp(Buffer.from(flyer)).png().toFile('demo-assets/sample-event.png');
await writeFile(
  'demo-assets/sample-meeting-notes.txt',
  `PROJECT CHECK-IN
September 12, 2026

Attendees
Maya, Jordan, Sam

Decisions
Keep onboarding to three screens.
Move launch to Monday.

Action Items
Maya - send updated copy by Saturday
Jordan - finish demo recording by Sunday

Notes
The first screen should make the purpose of the product clear without introducing every feature. A short example can establish the tone and give people a useful starting point.

The group discussed how the demo moves between capture and calendar. The transition is strongest when the original source remains visible and the audience can follow where each piece of information came from.

Everyone preferred a quiet visual treatment. The paper palette and restrained typography give the content room to speak. Additional decorative elements would distract from the central interaction.
`,
);
console.log('Created four-page syllabus, typographic flyer and meeting notes.');
