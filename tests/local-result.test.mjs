import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename, relative, isAbsolute, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { loadBindings, readBoundSources, resultUrl, validateResult } from '../lib/local-result.mjs';

test('committed synthetic run has bound source digests and stable result digest', async () => {
  const bindings = await loadBindings();
  const result = JSON.parse(await readFile(resultUrl, 'utf8'));
  assert.equal(validateResult(result, bindings), result);
  assert.equal(result.checkpoint.validatedByOriginalNova, true);
  assert.equal(result.transfer.eventCount, 2);
});

test('result tampering is detected', async () => {
  const bindings = await loadBindings();
  const result = JSON.parse(await readFile(resultUrl, 'utf8'));
  result.claimCeiling = 'Changed after generation';
  assert.throws(() => validateResult(result, bindings), /digest mismatch/);
});

test('self-consistent digest cannot bypass event invariants', async () => {
  const bindings = await loadBindings();
  const result = JSON.parse(await readFile(resultUrl, 'utf8'));
  result.transfer.worldHead = 'f'.repeat(64);
  const { resultDigest, ...body } = result;
  result.resultDigest = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  assert.throws(() => validateResult(result, bindings), /event binding mismatch/);
});

test('source byte mismatch stops before any model import', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'halveth-bindings-test-'));
  try {
    await mkdir(join(dir, 'nova'));
    await writeFile(join(dir, 'nova', 'engine.mjs'), Buffer.alloc(11076, 65));
    await assert.rejects(() => readBoundSources(dir), /source digest mismatch/);
  } finally {
    const root = await realpath(tmpdir());
    const actual = await realpath(dir);
    const rel = relative(root, actual);
    if (basename(actual).startsWith('halveth-bindings-test-') && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)) await rm(actual, { recursive: true, force: true });
  }
});
