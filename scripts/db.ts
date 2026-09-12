import { config } from 'dotenv';
config({ path: '.env.local' });
import { openDB, migrate } from '../lib/db';
import { seed } from '../lib/store';
const db = await openDB();
await migrate(db);
if (process.argv[2] === 'seed') {
  await db.query(
    "INSERT INTO users(id,session_hash) VALUES('seed-template','seed-template') ON CONFLICT DO NOTHING",
  );
  await seed(db, 'seed-template');
}
await db.close();
console.log(
  process.argv[2] === 'seed'
    ? 'Demo template seeded. Each browser gets its own copy.'
    : 'Migration complete.',
);
