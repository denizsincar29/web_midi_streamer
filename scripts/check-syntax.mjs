// scripts/check-syntax.mjs — syntax-check every ES module in src/ plus the SW.
//
// Usage:  npm test   (or: node scripts/check-syntax.mjs)

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  ...readdirSync(join(root, 'src'))
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => join(root, 'src', f)),
  join(root, 'service-worker.js'),
];

let failed = 0;
for (const file of files) {
  const r = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: readFileSync(file),
  });
  if (r.status === 0) {
    console.log(`ok ${file}`);
  } else {
    failed++;
    console.error(`FAIL ${file}`);
    console.error(r.stderr.toString());
  }
}

if (failed) {
  console.error(`\n${failed} file(s) failed syntax check`);
  process.exit(1);
}
console.log('\nAll files OK');
