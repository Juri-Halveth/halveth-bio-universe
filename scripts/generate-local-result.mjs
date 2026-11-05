#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resultUrl, runBoundSynthetic } from '../lib/local-result.mjs';

if (process.argv.length !== 3) {
  console.error('Usage: node scripts/generate-local-result.mjs <isolated-source-root>');
  process.exit(2);
}
const result = await runBoundSynthetic(process.argv[2]);
const output = fileURLToPath(resultUrl);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(`LOCAL_SYNTHETIC_RESULT status=${result.transfer.status} digest=${result.resultDigest}`);
