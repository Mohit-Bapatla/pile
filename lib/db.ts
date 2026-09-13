import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
export interface DB {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<T>(fn: (db: DB) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function openDB(location?: string): Promise<DB> {
  if ((process.env.TIGER_DATABASE_URL || process.env.DATABASE_URL) && !location) {
    const pool = new Pool({
      connectionString: process.env.TIGER_DATABASE_URL || process.env.DATABASE_URL,
    });
    const db: DB = {
      query: async <T>(s: string, p?: unknown[]) => ({
        rows: (await pool.query(s, p)).rows as T[],
      }),
      transaction: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          const tx = {
            ...db,
            query: async <T>(s: string, p?: unknown[]) => ({
              rows: (await c.query(s, p)).rows as T[],
            }),
          };
          const result = await fn(tx);
          await c.query('COMMIT');
          return result;
        } catch (e) {
          await c.query('ROLLBACK');
          throw e;
        } finally {
          c.release();
        }
      },
      close: () => pool.end(),
    };
    return db;
  }
  if (!location && process.env.VERCEL === '1')
    throw new Error('Configure DATABASE_URL or TIGER_DATABASE_URL for persistent hosted storage.');
  const dir = location || process.env.DATA_DIR || '.data/pile';
  if (dir !== 'memory://')
    await mkdir(path.resolve(/* turbopackIgnore: true */ dir), { recursive: true });
  const pg = new PGlite(dir);
  await pg.waitReady;
  const wrap = (p: Pick<PGlite, 'query'>): DB => ({
    query: async <T>(s: string, v?: unknown[]) => ({
      rows: (await p.query<T>(s, v)).rows,
    }),
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
    close: () => pg.close(),
  });
  return wrap(pg);
}
export async function migrate(db: DB) {
  for (const file of (await readdir(path.join(process.cwd(), 'migrations')))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const sql = await readFile(path.join(process.cwd(), 'migrations', file), 'utf8');
    for (const statement of sql.split(';').filter((s) => s.trim())) await db.query(statement);
  }
}
const globalDB = globalThis as unknown as { pileDB?: Promise<DB> };
export function database() {
  return (globalDB.pileDB ??= openDB().then(async (db) => {
    await migrate(db);
    return db;
  }));
}
