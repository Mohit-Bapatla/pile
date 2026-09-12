import { execFileSync } from 'node:child_process';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const secrets = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /(?:postgres(?:ql)?:\/\/)[^\s:]+:[^\s@]{6,}@/g,
];
const forbidden =
  /(^|\/)(node_modules|\.next|\.data|test-results|playwright-report)(\/|$)|(^|\/)\.env(?:\..*)?$/;
const failures = [];
for (const file of files) {
  if (file !== '.env.example' && forbidden.test(file)) failures.push(file + ': forbidden artifact');
  if (/\.(png|pdf|woff2?)$/.test(file)) continue;
  const text = execFileSync('git', ['show', ':' + file], { encoding: 'utf8' });
  if (
    secrets.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    })
  )
    failures.push(file + ': possible credential');
  if (/^<{7} |^>{7} /m.test(text)) failures.push(file + ': conflict marker');
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(
  `Secret/artifact scan passed: ${files.length} tracked files. Variable names and empty example values are allowed.`,
);
