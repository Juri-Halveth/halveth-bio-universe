import { createHash } from 'node:crypto';
import { readFile, realpath, lstat, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const bindingUrl = new URL('../catalog/synthetic-source-bindings.json', import.meta.url);
export const resultUrl = new URL('../results/synthetic-nova-organism.json', import.meta.url);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export async function loadBindings() {
  const value = JSON.parse(await readFile(bindingUrl, 'utf8'));
  if (value.schema !== 'halveth.bio-universe.synthetic-bindings.v1' || value.files?.length !== 5) throw new Error('binding manifest invalid');
  const seen = new Set();
  for (const file of value.files) {
    if (typeof file.path !== 'string' || !/^[a-z0-9._/-]+$/.test(file.path) || file.path.includes('..') || file.path.startsWith('/') || seen.has(file.path)) throw new Error('unsafe or duplicate binding path');
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > 100000 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('binding size or digest invalid');
    seen.add(file.path);
  }
  return value;
}

export async function readBoundSources(sourceRoot, bindings) {
  bindings ??= await loadBindings();
  if (typeof sourceRoot !== 'string' || !sourceRoot.trim()) throw new Error('source root required');
  const root = await realpath(resolve(sourceRoot));
  const found = new Map();
  for (const file of bindings.files) {
    const path = resolve(root, file.path);
    const rel = relative(root, path);
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('source path escaped root');
    const meta = await lstat(path);
    if (!meta.isFile() || meta.isSymbolicLink() || meta.size !== file.bytes) throw new Error(`source size or type mismatch: ${file.path}`);
    const bytes = await readFile(path);
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`source digest mismatch: ${file.path}`);
    found.set(file.path, bytes);
  }
  return found;
}

function resultDigest(body) { return digest(Buffer.from(JSON.stringify(body), 'utf8')); }

export function validateResult(result, bindings) {
  if (result?.schema !== 'halveth.bio-universe.result.v1' || result.kind !== 'SYNTHETIC_LAB_RUN' || result.evidenceState !== 'OBSERVED_LOCAL_SYNTHETIC') throw new Error('result schema or type mismatch');
  if (result.relationId !== 'nova-organism' || result.transfer?.status !== 'RECORDED_MODEL_REFERENCE' || result.transfer?.eventChainValid !== true) throw new Error('result transfer mismatch');
  if (result.fixture?.scenario !== 'catalase' || result.fixture?.seed !== 127 || result.fixture?.checkpointStep !== 32 || result.fixture?.modelClock !== 'MODEL_STEP') throw new Error('result fixture mismatch');
  if (result.checkpoint?.validatedByOriginalNova !== true || !/^[a-f0-9]{64}$/.test(result.checkpoint?.packetDigest ?? '') || !/^[a-f0-9]{64}$/.test(result.checkpoint?.runDigest ?? '') || result.checkpoint?.sourceEventsWithinViewedStep !== 7) throw new Error('result checkpoint mismatch');
  if (result.transfer.entityCount !== 0 || result.transfer.resourceCount !== 0 || result.transfer.modelTimeMs !== 0 || result.transfer.materialTransfer !== 'NONE' || result.transfer.biologyClaim !== 'NONE' || result.transfer.eventCount !== 2) throw new Error('result model boundary mismatch');
  if (result.transfer.worldHead !== result.transfer.targetEventHash || !/^[a-f0-9]{64}$/.test(result.transfer.targetEventHash ?? '') || !/^event:[a-f0-9]{64}$/.test(result.transfer.targetEventId ?? '') || !/^nova-reference:[a-f0-9]{64}$/.test(result.transfer.bridgeId ?? '')) throw new Error('result event binding mismatch');
  if (result.sourceSet !== bindings.sourceSet || JSON.stringify(result.sourceDigests) !== JSON.stringify(Object.fromEntries(bindings.files.map(file => [file.path, file.sha256])))) throw new Error('result source binding mismatch');
  if (!/^[a-f0-9]{64}$/.test(result.resultDigest ?? '')) throw new Error('result digest invalid');
  const { resultDigest: claimed, ...body } = result;
  if (resultDigest(body) !== claimed) throw new Error('result digest mismatch');
  return result;
}

export async function runBoundSynthetic(sourceRoot) {
  const bindings = await loadBindings();
  const bytes = await readBoundSources(sourceRoot, bindings);
  const scratch = await mkdtemp(join(tmpdir(), 'halveth-bio-source-'));
  try {
    for (const [name, data] of bytes) {
      const target = join(scratch, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data, { flag: 'wx' });
    }
    const nova = await import(pathToFileURL(join(scratch, 'nova/engine.mjs')).href);
    const organism = await import(pathToFileURL(join(scratch, 'organism/src/open-world.mjs')).href);
    const bridge = await import(pathToFileURL(join(scratch, 'molecular_reference.mjs')).href);
    const sources = JSON.parse(bytes.get('nova/data/sources.json').toString('utf8'));
    const run = nova.createRun({ scenario: 'catalase', gate: 'open', seed: 127 }, sources,
      { runId: 'mol_' + 'a'.repeat(32), recordedAt: '2000-01-01T00:00:00.000Z' });
    const checkpoint = await nova.checkpoint(run, 32, sources);
    const audit = await nova.validateCheckpoint(checkpoint, sources);
    if (audit?.ok !== true) throw new Error('original NOVA verifier rejected checkpoint');
    const world = new organism.OpenWorld({ worldId: 'halveth:bio-universe-demo', instanceId: 'instance:bio-universe-demo' });
    const before = { events: world.events.length, entities: world.entities.size, resources: world.resources.size, timeMs: world.timeMs };
    const transfer = await bridge.importMolecularReference({ world, checkpoint, sources,
      validateCheckpoint: nova.validateCheckpoint,
      novaSourceSha256: bindings.files.find(file => file.path === 'nova/engine.mjs').sha256,
      organismSourceSha256: bindings.files.find(file => file.path === 'organism/src/open-world.mjs').sha256 });
    const event = world.events.at(-1);
    if (transfer.status !== 'RECORDED_MODEL_REFERENCE' || world.events.length !== before.events + 1 ||
        world.entities.size !== before.entities || world.resources.size !== before.resources || world.timeMs !== before.timeMs ||
        event.type !== 'MOLECULAR_MODEL_REFERENCE' || !organism.verifyEventChain(world.events, world.head)) throw new Error('target event or model boundary mismatch');
    const body = {
      schema: 'halveth.bio-universe.result.v1', id: 'nova-organism-synthetic-01',
      kind: 'SYNTHETIC_LAB_RUN', evidenceState: 'OBSERVED_LOCAL_SYNTHETIC', relationId: 'nova-organism',
      sourceSet: bindings.sourceSet, sourceDigests: Object.fromEntries(bindings.files.map(file => [file.path, file.sha256])),
      fixture: { scenario: 'catalase', seed: 127, checkpointStep: 32, modelClock: 'MODEL_STEP' },
      checkpoint: { validatedByOriginalNova: true, runDigest: checkpoint.runDigest,
        packetDigest: checkpoint.packetDigest, sourceEventsWithinViewedStep: transfer.sourceEventsWithinViewedStep },
      transfer: { status: transfer.status, bridgeId: transfer.bridgeId, targetEventId: transfer.targetEventId,
        targetEventHash: transfer.targetEventHash, worldHead: world.head, eventChainValid: true,
        eventCount: world.events.length, entityCount: world.entities.size, resourceCount: world.resources.size,
        modelTimeMs: world.timeMs, materialTransfer: 'NONE', biologyClaim: 'NONE' },
      claimCeiling: 'Synthetic model reference observed in a bound local run; no measured biology or trusted production bridge.'
    };
    return validateResult({ ...body, resultDigest: resultDigest(body) }, bindings);
  } finally {
    const tempRoot = await realpath(tmpdir());
    const actual = await realpath(scratch);
    const rel = relative(tempRoot, actual);
    if (basename(actual).startsWith('halveth-bio-source-') && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel)) await rm(actual, { recursive: true, force: true });
  }
}
