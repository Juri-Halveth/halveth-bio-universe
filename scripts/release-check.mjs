import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const allowed = new Set([
  '.gitignore', 'LICENSE', 'README.md', 'package.json', 'plugin.json', 'assets/icon.svg',
  'catalog/labs.json', 'lib/catalog.mjs', 'lib/contract.mjs', 'lib/server.mjs',
  'scripts/bio-universe.mjs', 'scripts/release-check.mjs',
  'skills/bio-universe/SKILL.md', 'web/index.html', 'web/app.js', 'web/styles.css',
  'tests/catalog.test.mjs', 'tests/contract.test.mjs', 'tests/server.test.mjs'
]);
const forbidden = [
  /[A-Z]:[\\/](?:Users|HALVETH_WORKSPACE)[\\/]/i,
  new RegExp('My' + 'Heritage_(?:full_sequencing|raw_dna_data)', 'i'),
  /-----BEGIN (?:OPENSSH|RSA|PRIVATE) KEY-----/,
  /(?:sk-proj-|ghp_)[A-Za-z0-9_-]{12,}/
];
async function walk(dir) {
  const out = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (item.name === '.git') continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) out.push(...await walk(path));
    else out.push(path);
  }
  return out;
}
const files = await walk(root);
const names = files.map(path => relative(root, path).replaceAll('\\', '/')).sort();
const unexpected = names.filter(name => !allowed.has(name));
const missing = [...allowed].filter(name => !names.includes(name));
if (unexpected.length || missing.length) {
  console.error(JSON.stringify({ unexpected, missing }, null, 2));
  process.exit(1);
}
for (const path of files) {
  const data = await readFile(path, 'utf8');
  for (const pattern of forbidden) if (pattern.test(data)) throw new Error(`release pattern in ${relative(root, path)}: ${pattern}`);
}
console.log(`RELEASE_SCAN_LIMITED files=${files.length} unexpected=0 missing=0 pattern_hits=0`);
