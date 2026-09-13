import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
const manual = process.argv.includes('--manual');
const port = manual ? '3003' : '3002';
const dir = await mkdtemp(path.join(tmpdir(), manual ? 'pile-manual-qa-' : 'pile-e2e-'));
const env = {
  ...process.env,
  DATA_DIR: dir,
  PILE_WORKSPACE_MODE: manual ? 'qa' : 'test',
  DEMO_MODE: 'true',
};
// Empty values also prevent Next from loading real credentials from .env.local.
for (const key of [
  'TIGER_DATABASE_URL',
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'ELEVENLABS_API_KEY',
  'BACKBOARD_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'TOKEN_ENCRYPTION_KEY',
])
  env[key] = '';
env.GOOGLE_REDIRECT_URI = `http://127.0.0.1:${port}/api/oauth/callback`;
console.log(`Isolated ${manual ? 'manual QA' : 'automated test'} workspace: ${dir}; port ${port}`);
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    process.argv.includes('--production') ? 'start' : 'dev',
    '--hostname',
    '127.0.0.1',
    '--port',
    port,
  ],
  { env, stdio: 'inherit' },
);
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    if (!stopping) {
      stopping = true;
      child.kill(signal);
    }
  });
child.on('exit', async (code) => {
  await rm(dir, { recursive: true, force: true });
  process.exit(stopping ? 0 : (code ?? 1));
});
