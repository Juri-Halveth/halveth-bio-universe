import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, sep } from 'node:path';
import { loadPrivateGenomeStatus, validatePrivateManifest, validatePrivateGenomeResult } from '../lib/private-genome-status.mjs';
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

test('private discordance result is projected only while both evidence files match', async () => {
  const root = await mkdtemp(join(tmpdir(), 'halveth-genome-status-test-'));
  try {
    const manifest = await fixture(root);
    const audit = 'synthetic audit, no individual alleles';
    const source = 'synthetic private result';
    const sensitivity = 'synthetic private sensitivity';
    const summary = {
      schema: 'halveth.bio-universe.genome-discordance-summary.v1',
      selectedMarkers: 8, exportMethod: 'Low-pass Whole Genome Sequencing',
      groups: {
        long: { markers: 4, q20Bases: 40, q30Bases: 20, q30Discordant: 1,
          q20to29Discordant: 2, zeroDepthMarkers: 1 },
        short: { markers: 4, q20Bases: 50, q30Bases: 35, q30Discordant: 1,
          q20to29Discordant: 0, zeroDepthMarkers: 0 }
      },
      supplementaryExcluded: {
        long: { q30Bases: 19, q30Discordant: 1 },
        short: { q30Bases: 34, q30Discordant: 1 }
      },
      chromosomeBootstrap95: [-0.03, 0.08],
      sourceResultSha256: sha(source), sensitivitySha256: sha(sensitivity),
      auditSha256: sha(audit)
    };
    const sumText = JSON.stringify(summary);
    const auditPath = join(root, 'BIO_UNIVERSE_STATUS', 'discordance-audit.md');
    const summaryPath = join(root, 'BIO_UNIVERSE_STATUS', 'discordance-summary.private.json');
    const sourcePath = join(root, 'BIO_UNIVERSE_STATUS', 'discordance-source.private.json');
    const sensitivityPath = join(root, 'BIO_UNIVERSE_STATUS', 'discordance-sensitivity.private.json');
    await writeFile(auditPath, audit);
    await writeFile(summaryPath, sumText);
    await writeFile(sourcePath, source);
    await writeFile(sensitivityPath, sensitivity);
    manifest.schema = 'halveth.bio-universe.genome-private.v2';
    manifest.result = { id: 'homo-ref-discordance', sourceEvidenceId: 'GO-DISC-RESULT',
      sensitivityEvidenceId: 'GO-DISC-SENS', summaryEvidenceId: 'GO-DISC-SUM',
      auditEvidenceId: 'GO-DISC-AUDIT' };
    manifest.evidence.push(
      { id: 'GO-DISC-RESULT', relativePath: 'BIO_UNIVERSE_STATUS/discordance-source.private.json', sha256: sha(source) },
      { id: 'GO-DISC-SENS', relativePath: 'BIO_UNIVERSE_STATUS/discordance-sensitivity.private.json', sha256: sha(sensitivity) },
      { id: 'GO-DISC-AUDIT', relativePath: 'BIO_UNIVERSE_STATUS/discordance-audit.md', sha256: sha(audit) },
      { id: 'GO-DISC-SUM', relativePath: 'BIO_UNIVERSE_STATUS/discordance-summary.private.json', sha256: sha(sumText) }
    );
    await writeFile(join(root, 'BIO_UNIVERSE_STATUS', 'status.private.json'), JSON.stringify(manifest));
    const projected = await loadPrivateGenomeStatus(root);
    assert.equal(projected.result.state, 'PRIVATE_MEASUREMENT_RECORDED');
    assert.equal(projected.result.discordance.state, 'DISCORDANCE_INCONCLUSIVE');
    assert.equal(projected.result.lowerQuality.long.bases, 20);
    assert.equal(projected.result.supplementaryExcluded.long.q30Discordant, 1);
    assert.doesNotMatch(JSON.stringify(projected), /relativePath|sha256|private\.json|discordance-audit|synthetic result|[a-f0-9]{64}/);
    await writeFile(summaryPath, 'changed summary');
    const held = await loadPrivateGenomeStatus(root);
    assert.deepEqual(held.result, { state: 'HOLD_EVIDENCE' });
    assert.doesNotMatch(JSON.stringify(held), /q30Discordant|selectedMarkers/);
    await writeFile(summaryPath, sumText);
    await writeFile(sourcePath, 'tampered source');
    assert.deepEqual((await loadPrivateGenomeStatus(root)).result, { state: 'HOLD_EVIDENCE' });
    assert.throws(() => validatePrivateGenomeResult({ ...summary, rawAllele: 'A/G' }, sha(audit)), /schema mismatch/);
    assert.throws(() => validatePrivateGenomeResult({ ...summary, groups: { ...summary.groups,
      long: { ...summary.groups.long, q30Bases: 0 } } }, sha(audit)), /count relationship invalid/);
  } finally {
    const base = await realpath(tmpdir());
    const actual = await realpath(root);
    const gap = relative(base, actual);
    if (basename(actual).startsWith('halveth-genome-status-test-') && gap !== '..' && !gap.startsWith('..' + sep) && !isAbsolute(gap)) await rm(actual, { recursive: true, force: true });
  }
});
