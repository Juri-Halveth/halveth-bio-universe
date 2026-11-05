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
  exactKeys(manifest, ['schema', 'asOfUtc', 'software', 'truth', 'tracks', 'evidence'], 'private manifest');
  if (manifest.schema !== 'halveth.bio-universe.genome-private.v1' ||
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
  return manifest;
}

export async function loadPrivateGenomeStatus(privateRoot) {
  if (typeof privateRoot !== 'string' || !privateRoot.trim()) throw new Error('private root required');
  const root = await realpath(resolve(privateRoot));
  const manifest = validatePrivateManifest(JSON.parse((await boundedFile(root, statusName, 65536)).toString('utf8')));
  const states = new Map();
  for (const item of manifest.evidence) {
    try { states.set(item.id, digest(await boundedFile(root, item.relativePath, 1048576)) === item.sha256 ? 'BOUND_PRIVATE_FILE' : 'CHANGED'); }
    catch { states.set(item.id, 'UNAVAILABLE'); }
  }
  const testState = states.get(manifest.software.tests.evidenceId);
  const truthState = states.get(manifest.truth.evidenceId);
  return {
    schema: 'halveth.bio-universe.genome-status-projection.v1', configured: true, asOfUtc: manifest.asOfUtc,
    software: { version: manifest.software.version, tests: testState === 'BOUND_PRIVATE_FILE'
      ? { passed: manifest.software.tests.passed, skipped: manifest.software.tests.skipped, failed: manifest.software.tests.failed, evidenceState: testState }
      : { passed: null, skipped: null, failed: null, evidenceState: testState } },
    truth: { state: truthState === 'BOUND_PRIVATE_FILE' ? manifest.truth.state : 'UNKNOWN', evidenceState: truthState,
      coverage: 'Two selected roots; filename and filesystem metadata only' },
    tracks: manifest.tracks.map(track => ({ id: track.id, label: allowedTracks.get(track.id), evidenceId: track.evidenceId,
      evidenceState: states.get(track.evidenceId), state: states.get(track.evidenceId) === 'BOUND_PRIVATE_FILE' ? 'PRIVATE_RUN_RECORDED' : 'HOLD_EVIDENCE' })),
    evidenceSummary: { bound: [...states.values()].filter(x => x === 'BOUND_PRIVATE_FILE').length,
      changed: [...states.values()].filter(x => x === 'CHANGED').length,
      unavailable: [...states.values()].filter(x => x === 'UNAVAILABLE').length }
  };
}
