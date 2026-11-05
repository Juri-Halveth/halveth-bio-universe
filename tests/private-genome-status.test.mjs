import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, sep } from 'node:path';
import { loadPrivateGenomeStatus, validatePrivateManifest } from '../lib/private-genome-status.mjs';
import { startServer } from '../lib/server.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');

async function fixture(root) {
  const files = [
    ['GO-TEST', 'BIO_UNIVERSE_STATUS/test-receipt.md', 'synthetic test receipt'],
    ['GO-TRUTH', 'RUN_TRUTH/report.md', 'synthetic truth inventory'],
    ['GO-QUALITY', 'RUN_QUALITY/report.md', 'synthetic rs123 A/G data must stay private']
  ];
  for (const [, rel, content] of files) {
    const path = join(root, rel);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, content);
  }
  const manifest = {
    schema: 'halveth.bio-universe.genome-private.v1', asOfUtc: '2026-11-05T00:00:00Z',
    software: { version: '0.6.8', tests: { passed: 4, skipped: 1, failed: 0, evidenceId: 'GO-TEST' } },
    truth: { state: 'NO_ORTHOGONAL_REFERENCE_FOUND_IN_SCOPED_INVENTORY', evidenceId: 'GO-TRUTH' },
    tracks: [{ id: 'quality-factor', evidenceId: 'GO-QUALITY' }],
    evidence: files.map(([id, relativePath, content]) => ({ id, relativePath, sha256: sha(content) }))
  };
  await writeFile(join(root, 'BIO_UNIVERSE_STATUS', 'status.private.json'), JSON.stringify(manifest));
  return manifest;
}

test('private genome projection exposes only bounded status and holds changed evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'halveth-genome-status-test-'));
  let server;
  try {
    const manifest = await fixture(root);
    const status = await loadPrivateGenomeStatus(root);
    assert.equal(status.software.tests.passed, 4);
    assert.equal(status.truth.state, manifest.truth.state);
    assert.equal(status.tracks[0].state, 'PRIVATE_RUN_RECORDED');
    const serialized = JSON.stringify(status);
    assert.doesNotMatch(serialized, /relativePath|sha256|rs123|A\/G|RUN_QUALITY|status\.private\.json/);
    server = await startServer(0, { privateRoot: root });
    const api = await fetch(`http://127.0.0.1:${server.address().port}/api/genome-status`);
    assert.equal((await api.json()).evidenceSummary.bound, 3);
    assert.equal(api.headers.get('access-control-allow-origin'), null);
    await writeFile(join(root, 'RUN_QUALITY', 'report.md'), 'changed synthetic report');
    const changed = await loadPrivateGenomeStatus(root);
    assert.equal(changed.tracks[0].state, 'HOLD_EVIDENCE');
    assert.equal(changed.evidenceSummary.changed, 1);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    const base = await realpath(tmpdir());
    const actual = await realpath(root);
    const gap = relative(base, actual);
    if (basename(actual).startsWith('halveth-genome-status-test-') && gap !== '..' && !gap.startsWith('..' + sep) && !isAbsolute(gap)) await rm(actual, { recursive: true, force: true });
  }
});

test('manifest rejects unrecognized genomic detail and path escape', async () => {
  const root = await mkdtemp(join(tmpdir(), 'halveth-genome-status-test-'));
  try {
    const manifest = await fixture(root);
    assert.throws(() => validatePrivateManifest({ ...manifest, rawAlleles: 'A/G' }), /schema mismatch/);
    manifest.evidence[0].relativePath = '../secret.txt';
    assert.throws(() => validatePrivateManifest(manifest), /evidence item invalid/);
  } finally {
    const base = await realpath(tmpdir());
    const actual = await realpath(root);
    const gap = relative(base, actual);
    if (basename(actual).startsWith('halveth-genome-status-test-') && gap !== '..' && !gap.startsWith('..' + sep) && !isAbsolute(gap)) await rm(actual, { recursive: true, force: true });
  }
});
