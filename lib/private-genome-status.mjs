import { createHash } from 'node:crypto';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const statusName = 'BIO_UNIVERSE_STATUS/status.private.json';
const allowedTracks = new Map([
  ['quality-factor', 'CRAM-Qualität und Referenzkontext'],
  ['quality-origin', 'Basenqualitäts-Gegenprobe'],
  ['homopolymer', 'Homopolymer-Kontext'],
  ['platform-provenance', 'Sequenzierungsplattform-Metadaten']
]);
const idPattern = /^[A-Z][A-Z0-9-]{2,39}$/;
const shaPattern = /^[a-f0-9]{64}$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const resultId = 'homo-ref-discordance';

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) throw new Error(`${label} schema mismatch`);
}

function safeRelative(path) {
  return typeof path === 'string' && /^[A-Za-z0-9._/-]+$/.test(path) &&
    !path.startsWith('/') && !path.split('/').some(part => part === '..' || !part);
}

async function boundedFile(root, rel, maxBytes) {
  if (!safeRelative(rel)) throw new Error('private evidence path invalid');
  const path = resolve(root, rel);
  const gap = relative(root, path);
  if (gap === '..' || gap.startsWith('..' + sep) || isAbsolute(gap)) throw new Error('private evidence escaped root');
  const meta = await lstat(path);
  if (!meta.isFile() || meta.isSymbolicLink() || meta.size > maxBytes) throw new Error('private evidence size or type invalid');
  const actual = await realpath(path);
  const actualGap = relative(root, actual);
  if (actualGap === '..' || actualGap.startsWith('..' + sep) || isAbsolute(actualGap)) throw new Error('private evidence real path escaped root');
  const handle = await open(actual, 'r');
  try {
    const held = await handle.stat();
    if (!held.isFile() || held.size > maxBytes) throw new Error('private evidence size changed');
    const buffer = Buffer.alloc(maxBytes + 1);
    let count = 0;
    while (count < buffer.length) {
      const { bytesRead } = await handle.read(buffer, count, buffer.length - count, count);
      if (bytesRead === 0) break;
      count += bytesRead;
    }
    if (count > maxBytes) throw new Error('private evidence grew during read');
    return buffer.subarray(0, count);
  } finally { await handle.close(); }
}

export function validatePrivateManifest(manifest) {
  const withResult = manifest?.schema === 'halveth.bio-universe.genome-private.v2';
  exactKeys(manifest, withResult
    ? ['schema', 'asOfUtc', 'software', 'truth', 'tracks', 'evidence', 'result']
    : ['schema', 'asOfUtc', 'software', 'truth', 'tracks', 'evidence'], 'private manifest');
  if (!['halveth.bio-universe.genome-private.v1', 'halveth.bio-universe.genome-private.v2'].includes(manifest.schema) ||
      typeof manifest.asOfUtc !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(manifest.asOfUtc) ||
      !Number.isFinite(Date.parse(manifest.asOfUtc))) throw new Error('private manifest header invalid');
  exactKeys(manifest.software, ['version', 'tests'], 'software');
  if (manifest.software.version !== '0.6.8') throw new Error('unsupported Genome Origin version');
  exactKeys(manifest.software.tests, ['passed', 'skipped', 'failed', 'evidenceId'], 'tests');
  for (const key of ['passed', 'skipped', 'failed']) if (!Number.isSafeInteger(manifest.software.tests[key]) || manifest.software.tests[key] < 0 || manifest.software.tests[key] > 10000) throw new Error('test count invalid');
  exactKeys(manifest.truth, ['state', 'evidenceId'], 'truth');
  if (manifest.truth.state !== 'NO_ORTHOGONAL_REFERENCE_FOUND_IN_SCOPED_INVENTORY') throw new Error('truth state invalid');
  if (!Array.isArray(manifest.tracks) || !Array.isArray(manifest.evidence) || manifest.tracks.length < 1 || manifest.evidence.length < 2) throw new Error('tracks or evidence missing');
  const evidenceIds = new Set();
  for (const item of manifest.evidence) {
    exactKeys(item, ['id', 'relativePath', 'sha256'], 'evidence item');
    if (!idPattern.test(item.id) || evidenceIds.has(item.id) || !safeRelative(item.relativePath) || !shaPattern.test(item.sha256)) throw new Error('evidence item invalid');
    evidenceIds.add(item.id);
  }
  if (!evidenceIds.has(manifest.software.tests.evidenceId) || !evidenceIds.has(manifest.truth.evidenceId)) throw new Error('required evidence missing');
  const trackIds = new Set();
  for (const track of manifest.tracks) {
    exactKeys(track, ['id', 'evidenceId'], 'track');
    if (!allowedTracks.has(track.id) || trackIds.has(track.id) || !evidenceIds.has(track.evidenceId)) throw new Error('track invalid');
    trackIds.add(track.id);
  }
  if (withResult) {
    const keys = ['id', 'sourceEvidenceId', 'sensitivityEvidenceId', 'summaryEvidenceId', 'auditEvidenceId'];
    exactKeys(manifest.result, keys, 'result binding');
    const boundIds = keys.slice(1).map(key => manifest.result[key]);
    if (manifest.result.id !== resultId || new Set(boundIds).size !== boundIds.length ||
        boundIds.some(id => !evidenceIds.has(id))) throw new Error('result evidence binding invalid');
  }
  return manifest;
}

function boundedCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10000000) throw new Error(`${label} invalid`);
}

export function validatePrivateGenomeResult(result, auditDigest) {
  exactKeys(result, ['schema', 'selectedMarkers', 'exportMethod', 'groups', 'supplementaryExcluded',
    'chromosomeBootstrap95', 'sourceResultSha256', 'sensitivitySha256', 'auditSha256'], 'private result');
  if (result.schema !== 'halveth.bio-universe.genome-discordance-summary.v1' ||
      result.exportMethod !== 'Low-pass Whole Genome Sequencing' ||
      !shaPattern.test(result.sourceResultSha256) || !shaPattern.test(result.sensitivitySha256) ||
      result.auditSha256 !== auditDigest) throw new Error('private result provenance invalid');
  boundedCount(result.selectedMarkers, 'selected markers');
  exactKeys(result.groups, ['long', 'short'], 'result groups');
  exactKeys(result.supplementaryExcluded, ['long', 'short'], 'supplementary groups');
  for (const group of ['long', 'short']) {
    const row = result.groups[group];
    exactKeys(row, ['markers', 'q20Bases', 'q30Bases', 'q30Discordant', 'q20to29Discordant',
      'zeroDepthMarkers'], `${group} counts`);
    for (const [key, value] of Object.entries(row)) boundedCount(value, `${group} ${key}`);
    if (row.markers === 0 || row.q20Bases === 0 || row.q30Bases === 0 ||
        row.zeroDepthMarkers > row.markers || row.q30Bases > row.q20Bases ||
        row.q30Discordant > row.q30Bases || row.q20to29Discordant > row.q20Bases - row.q30Bases) {
      throw new Error(`${group} count relationship invalid`);
    }
    const filtered = result.supplementaryExcluded[group];
    exactKeys(filtered, ['q30Bases', 'q30Discordant'], `${group} supplementary counts`);
    for (const [key, value] of Object.entries(filtered)) boundedCount(value, `${group} ${key}`);
    if (filtered.q30Bases > row.q30Bases || filtered.q30Discordant > row.q30Discordant ||
        filtered.q30Discordant > filtered.q30Bases) throw new Error(`${group} supplementary relationship invalid`);
  }
  if (result.groups.long.markers + result.groups.short.markers !== result.selectedMarkers) {
    throw new Error('selected marker count mismatch');
  }
  if (!Array.isArray(result.chromosomeBootstrap95) || result.chromosomeBootstrap95.length !== 2 ||
      !result.chromosomeBootstrap95.every(x => typeof x === 'number' && Number.isFinite(x) && x >= -1 && x <= 1) ||
      result.chromosomeBootstrap95[0] > result.chromosomeBootstrap95[1]) throw new Error('bootstrap interval invalid');
  return result;
}

export async function loadPrivateGenomeStatus(privateRoot) {
  if (typeof privateRoot !== 'string' || !privateRoot.trim()) throw new Error('private root required');
  const root = await realpath(resolve(privateRoot));
  const manifest = validatePrivateManifest(JSON.parse((await boundedFile(root, statusName, 65536)).toString('utf8')));
  const states = new Map();
  for (const item of manifest.evidence) {
    const maxBytes = item.id === manifest.result?.sourceEvidenceId ? 4194304 : 1048576;
    try { states.set(item.id, digest(await boundedFile(root, item.relativePath, maxBytes)) === item.sha256 ? 'BOUND_PRIVATE_FILE' : 'CHANGED'); }
    catch { states.set(item.id, 'UNAVAILABLE'); }
  }
  const testState = states.get(manifest.software.tests.evidenceId);
  const truthState = states.get(manifest.truth.evidenceId);
  let result = { state: manifest.result ? 'HOLD_EVIDENCE' : 'NOT_CONFIGURED' };
  if (manifest.result) {
    const sourceItem = manifest.evidence.find(x => x.id === manifest.result.sourceEvidenceId);
    const sensitivityItem = manifest.evidence.find(x => x.id === manifest.result.sensitivityEvidenceId);
    const summaryItem = manifest.evidence.find(x => x.id === manifest.result.summaryEvidenceId);
    const auditItem = manifest.evidence.find(x => x.id === manifest.result.auditEvidenceId);
    if ([sourceItem, sensitivityItem, summaryItem, auditItem].every(item => states.get(item.id) === 'BOUND_PRIVATE_FILE')) {
      try {
        const raw = validatePrivateGenomeResult(
          JSON.parse((await boundedFile(root, summaryItem.relativePath, 1048576)).toString('utf8')),
          auditItem.sha256);
        if (raw.sourceResultSha256 !== sourceItem.sha256 ||
            raw.sensitivitySha256 !== sensitivityItem.sha256) throw new Error('result source binding differs');
        const long = raw.groups.long;
        const short = raw.groups.short;
        const primaryDifference = long.q30Discordant / long.q30Bases - short.q30Discordant / short.q30Bases;
        if (primaryDifference < raw.chromosomeBootstrap95[0] ||
            primaryDifference > raw.chromosomeBootstrap95[1]) throw new Error('primary contrast outside reported interval');
        const qualityDifference = long.q30Bases / long.q20Bases - short.q30Bases / short.q20Bases;
        result = { state: 'PRIVATE_MEASUREMENT_RECORDED',
          id: resultId, evidenceState: 'BOUND_PRIVATE_FILE', selectedMarkers: raw.selectedMarkers,
          exportMethod: 'LOW_PASS_WGS_SAME_PROVIDER',
          quality: { longQ30Fraction: long.q30Bases / long.q20Bases,
            shortQ30Fraction: short.q30Bases / short.q20Bases,
            state: qualityDifference === 0 ? 'NO_OBSERVED_DIFFERENCE' : 'OBSERVED_QUALITY_DIFFERENCE' },
          discordance: { long: { bases: long.q30Bases, discordant: long.q30Discordant },
            short: { bases: short.q30Bases, discordant: short.q30Discordant },
            longMinusShort: primaryDifference, chromosomeBootstrap95: raw.chromosomeBootstrap95,
            state: raw.chromosomeBootstrap95[0] <= 0 && raw.chromosomeBootstrap95[1] >= 0
              ? 'DISCORDANCE_INCONCLUSIVE' : 'REVIEW_REQUIRED' },
          supplementaryExcluded: {
            long: raw.supplementaryExcluded.long, short: raw.supplementaryExcluded.short },
          lowerQuality: { long: { bases: long.q20Bases - long.q30Bases,
            discordant: long.q20to29Discordant },
            short: { bases: short.q20Bases - short.q30Bases,
              discordant: short.q20to29Discordant } },
          zeroDepthMarkers: { long: long.zeroDepthMarkers, short: short.zeroDepthMarkers },
          truthState: truthState === 'BOUND_PRIVATE_FILE'
            ? 'ORTHOGONAL_TRUTH_MISSING_IN_SCOPED_INVENTORY' : 'UNKNOWN',
          claimCeiling: 'SAME_PROVIDER_DISCORDANCE_NOT_VALIDATED_ERROR_RATE' };
      } catch { result = { state: 'HOLD_EVIDENCE' }; }
    }
  }
  return {
    schema: 'halveth.bio-universe.genome-status-projection.v2', configured: true, asOfUtc: manifest.asOfUtc,
    software: { version: manifest.software.version, tests: testState === 'BOUND_PRIVATE_FILE'
      ? { passed: manifest.software.tests.passed, skipped: manifest.software.tests.skipped, failed: manifest.software.tests.failed, evidenceState: testState }
      : { passed: null, skipped: null, failed: null, evidenceState: testState } },
    truth: { state: truthState === 'BOUND_PRIVATE_FILE' ? manifest.truth.state : 'UNKNOWN', evidenceState: truthState,
      coverage: 'Two selected roots; filename and filesystem metadata only' },
    tracks: manifest.tracks.map(track => ({ id: track.id, label: allowedTracks.get(track.id), evidenceId: track.evidenceId,
      evidenceState: states.get(track.evidenceId), state: states.get(track.evidenceId) === 'BOUND_PRIVATE_FILE' ? 'PRIVATE_RUN_RECORDED' : 'HOLD_EVIDENCE' })),
    result,
    evidenceSummary: { bound: [...states.values()].filter(x => x === 'BOUND_PRIVATE_FILE').length,
      changed: [...states.values()].filter(x => x === 'CHANGED').length,
      unavailable: [...states.values()].filter(x => x === 'UNAVAILABLE').length }
  };
}
