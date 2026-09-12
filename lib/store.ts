import type { DB } from './db';
import {
  type Source,
  type Item,
  type Project,
  type CalendarEvent,
  toItem,
  type Extraction,
  localDate,
} from './model';
export async function activity(db: DB, user: string, kind: string, body: unknown) {
  await db.query('INSERT INTO activity_events(id,user_id,kind,body) VALUES($1,$2,$3,$4)', [
    crypto.randomUUID(),
    user,
    kind,
    JSON.stringify(body),
  ]);
}
export async function projectFor(db: DB, user: string, name: string) {
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    color: ['purple', 'green', 'peach', 'blue'][name.length % 4],
  };
  await db.query(
    'INSERT INTO projects(id,user_id,name,body) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,name) DO NOTHING',
    [project.id, user, name, JSON.stringify(project)],
  );
  return (
    await db.query<{ body: Project }>('SELECT body FROM projects WHERE user_id=$1 AND name=$2', [
      user,
      name,
    ])
  ).rows[0].body;
}
export async function saveSource(db: DB, source: Source, bytes?: Buffer, mime?: string) {
  await db.query('INSERT INTO sources(id,user_id,body,file_data,mime) VALUES($1,$2,$3,$4,$5)', [
    source.id,
    source.userId,
    JSON.stringify(source),
    bytes || null,
    mime || null,
  ]);
  await db.query('INSERT INTO processing_jobs(source_id,status) VALUES($1,$2)', [
    source.id,
    'queued',
  ]);
  await activity(db, source.userId, 'capture_created', { sourceId: source.id });
}
export async function getSource(db: DB, user: string, id: string) {
  return (
    await db.query<{ body: Source; file_data: Buffer; mime: string }>(
      'SELECT body,file_data,mime FROM sources WHERE id=$1 AND user_id=$2',
      [id, user],
    )
  ).rows[0];
}
export async function updateSource(db: DB, s: Source) {
  await db.query('UPDATE sources SET body=$1 WHERE id=$2 AND user_id=$3', [
    JSON.stringify(s),
    s.id,
    s.userId,
  ]);
  await db.query('UPDATE processing_jobs SET status=$1,updated_at=now() WHERE source_id=$2', [
    s.processingStatus,
    s.id,
  ]);
}
export async function commitExtraction(db: DB, source: Source, extraction: Extraction) {
  return db.transaction(async (tx) => {
    const items: Item[] = [];
    for (const extracted of extraction.items) {
      const project = extracted.project
        ? await projectFor(tx, source.userId, extracted.project)
        : undefined;
      const item = toItem(extracted, source, project);
      if (source.type === 'pdf' && extraction.items.length > 2) item.status = 'inbox';
      await tx.query(
        'INSERT INTO items(id,user_id,source_id,project_id,body) VALUES($1,$2,$3,$4,$5)',
        [item.id, item.userId, item.sourceId, item.projectId || null, JSON.stringify(item)],
      );
      items.push(item);
    }
    source.summary = extraction.summary;
    source.processingStatus = items.some(
      (i) => i.status === 'inbox' || i.calendarStatus === 'suggested',
    )
      ? 'needs_review'
      : 'parsed';
    await updateSource(tx, source);
    await activity(tx, source.userId, 'source_processed', {
      sourceId: source.id,
      count: items.length,
    });
    return items;
  });
}
export async function state(db: DB, user: string) {
  const [items, sources, projects, events] = await Promise.all(
    ['items', 'sources', 'projects', 'calendar_links'].map((table) =>
      db.query<{ body: unknown }>(`SELECT body FROM ${table} WHERE user_id=$1`, [user]),
    ),
  );
  return {
    items: items.rows.map((r) => r.body) as Item[],
    sources: sources.rows.map((r) => r.body) as Source[],
    projects: projects.rows.map((r) => r.body) as Project[],
    events: events.rows.map((r) => r.body) as CalendarEvent[],
  };
}
export async function getItem(db: DB, user: string, id: string) {
  return (
    await db.query<{ body: Item }>('SELECT body FROM items WHERE id=$1 AND user_id=$2', [id, user])
  ).rows[0]?.body;
}
export async function saveItem(db: DB, item: Item) {
  item.updatedAt = new Date().toISOString();
  await db.query('UPDATE items SET body=$1,project_id=$2 WHERE id=$3 AND user_id=$4', [
    JSON.stringify(item),
    item.projectId || null,
    item.id,
    item.userId,
  ]);
}
export async function seed(db: DB, user: string) {
  if ((await db.query('SELECT id FROM sources WHERE user_id=$1', [user])).rows.length) return;
  for (const name of ['HackRice', 'Calculus', 'Personal', 'Job Search'])
    await projectFor(db, user, name);
  const today = new Date();
  const day = (n: number) =>
    new Date(Date.parse(localDate(today, 'America/Chicago')) + n * 86400000)
      .toISOString()
      .slice(0, 10);
  const s: Source = {
    id: crypto.randomUUID(),
    userId: user,
    type: 'text',
    rawText:
      'Finish HackRice demo. Probability homework. Email recruiter. Pick up package. Idea: a quieter internet, one tab at a time.',
    createdAt: today.toISOString(),
    processingStatus: 'queued',
    timezone: 'America/Chicago',
    provider: 'demo seed',
  };
  await saveSource(db, s);
  await commitExtraction(db, s, {
    summary: 'A little context to get your board started.',
    items: [
      {
        type: 'task',
        title: 'Finish HackRice demo',
        description: 'Bring the story together. Show the magic capture moment, then the calendar.',
        project: 'HackRice',
        dueDate: day(0),
        priority: 'high',
        confidence: 1,
        needsClarification: false,
      },
      {
        type: 'deadline',
        title: 'Probability homework',
        description: 'Problem set 03 · conditional probability and Bayes’ theorem.',
        project: 'Calculus',
        dueDate: day(3),
        allDay: true,
        priority: 'medium',
        confidence: 1,
        needsClarification: false,
      },
      {
        type: 'task',
        title: 'Email recruiter',
        description: 'Send the updated résumé and a quick thank-you.',
        project: 'Job Search',
        dueDate: day(0),
        priority: 'medium',
        confidence: 1,
        needsClarification: false,
      },
      {
        type: 'task',
        title: 'Pick up package',
        description: 'Waiting at the front desk. Bring your ID.',
        project: 'Personal',
        dueDate: day(0),
        priority: 'low',
        confidence: 1,
        needsClarification: false,
      },
      {
        type: 'idea',
        title: 'A quieter internet, one tab at a time',
        description:
          'What if a browser extension gently closed duplicate tabs? Worth exploring when there’s a little space.',
        project: 'Personal',
        priority: 'low',
        confidence: 1,
        needsClarification: false,
      },
    ],
  });
  for (const [title, days, hour] of [
    ['Design catch-up', 0, 14],
    ['Coffee with Maya', 1, 10],
    ['Team check-in', 3, 11],
  ] as const) {
    const event: CalendarEvent = {
      id: crypto.randomUUID(),
      title,
      start: `${day(days)}T${hour}:00:00-05:00`,
      allDay: false,
      demo: true,
    };
    await db.query('INSERT INTO calendar_links(id,user_id,body) VALUES($1,$2,$3)', [
      event.id,
      user,
      JSON.stringify(event),
    ]);
  }
}
export async function deleteSource(db: DB, user: string, id: string) {
  const linked = await db.query(
    "SELECT id FROM items WHERE source_id=$1 AND user_id=$2 AND body->>'calendarStatus'='synced'",
    [id, user],
  );
  if (linked.rows.length)
    throw new Error('Remove linked calendar events before deleting this source.');
  await db.query('DELETE FROM sources WHERE id=$1 AND user_id=$2', [id, user]);
}
