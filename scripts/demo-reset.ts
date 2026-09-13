import { config } from 'dotenv';
import { mkdir, readFile, writeFile, lstat, rename } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { openDB, migrate } from '../lib/db';
import { seedRecording } from '../lib/store';
config({ path: '.env.local', quiet: true });
const root = path.resolve('.data');
const target = path.join(root, 'demo');
const marker = path.join(root, 'demo-workspace.json');
if (
  process.env.DEMO_MODE !== 'true' ||
  process.env.PILE_WORKSPACE_MODE !== 'recording' ||
  process.env.DATABASE_URL ||
  process.env.TIGER_DATABASE_URL ||
  path.resolve(process.env.DATA_DIR || '') !== target
)
  throw new Error(
    'ABORT: reset requires DEMO_MODE=true, PILE_WORKSPACE_MODE=recording, DATA_DIR=.data/demo and no remote database URLs.',
  );
const listening = await new Promise<boolean>((resolve) => {
  const socket = net.connect(3001, '127.0.0.1');
  socket.once('connect', () => {
    socket.destroy();
    resolve(true);
  });
  socket.once('error', () => resolve(false));
});
if (listening)
  throw new Error(
    'ABORT: stop the Pile server on port 3001 before resetting; restart with pnpm start afterward.',
  );
await mkdir(root, { recursive: true });
if ((await lstat(root)).isSymbolicLink()) throw new Error('ABORT: .data cannot be a symlink.');
if (process.argv.includes('--initialize')) {
  try {
    await lstat(target);
    throw new Error('ABORT: initialization refuses an existing target.');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  await writeFile(marker, JSON.stringify({ purpose: 'pile-recording-demo', target }, null, 2), {
    flag: 'wx',
  });
}
const identity = JSON.parse(await readFile(marker, 'utf8'));
if (identity.purpose !== 'pile-recording-demo' || identity.target !== target)
  throw new Error('ABORT: demo identity marker does not match this checkout.');
try {
  if ((await lstat(target)).isSymbolicLink())
    throw new Error('ABORT: demo target cannot be a symlink.');
  await mkdir(path.join(root, 'demo-backups'), { recursive: true });
  await rename(target, path.join(root, 'demo-backups', String(Date.now())));
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
const db = await openDB(target);
try {
  await migrate(db);
  await db.query("INSERT INTO users(id,session_hash) VALUES('demo-template','demo-template')");
  await seedRecording(db, 'demo-template');
} finally {
  await db.close();
}
console.log(
  'Demo reset complete: 5 curated items, 1 intentional source, 0 needs-review items, 3 calendar events. Previous demo data was archived under .data/demo-backups. Restart Pile.',
);
