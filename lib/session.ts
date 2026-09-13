import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'node:crypto';
import type { DB } from './db';
import { seed, seedRecording } from './store';
export async function session(db: DB) {
  const jar = await cookies();
  let token = jar.get('pile_session')?.value;
  const hash = (t: string) => createHash('sha256').update(t).digest('hex');
  if (token) {
    const user = (
      await db.query<{ id: string }>('SELECT id FROM users WHERE session_hash=$1', [hash(token)])
    ).rows[0];
    if (user) return user.id;
  }
  token = randomBytes(32).toString('hex');
  const id = crypto.randomUUID();
  await db.query('INSERT INTO users(id,session_hash) VALUES($1,$2)', [id, hash(token)]);
  jar.set('pile_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure:
      process.env.VERCEL === '1' || process.env.GOOGLE_REDIRECT_URI?.startsWith('https:') || false,
    maxAge: 60 * 60 * 24 * 90,
    path: '/',
  });
  if (process.env.DEMO_MODE !== 'false')
    await (process.env.PILE_WORKSPACE_MODE === 'recording' ? seedRecording : seed)(db, id);
  return id;
}
