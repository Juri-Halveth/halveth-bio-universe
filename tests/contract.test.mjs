import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog } from '../lib/catalog.mjs';
import { previewTransfer, validatePacket } from '../lib/contract.mjs';

const proof = {
  schema: 'halveth.bio-universe.packet.v1', id: 'synthetic-1',
  sourceLab: 'nova-molecular-lineage', sourceVersion: 'synthetic-fixture-v1',
  recordDigest: '0'.repeat(64), summary: 'Synthetic checkpoint reference',
  contentKind: 'SOFTWARE_PROOF', evidenceState: 'MODEL_OUTPUT', dataClass: 'PUBLIC'
};

test('synthetic proof can only preview the reported software edge', async () => {
  assert.deepEqual(previewTransfer(proof, 'nova-organism', await loadCatalog()), {
    status: 'PREVIEW_ONLY_EXTERNAL_ADAPTER_REQUIRED', edgeId: 'nova-organism', targetLab: 'open-organism'
  });
});

test('raw private data cannot pass a relation', async () => {
  const packet = { ...proof, dataClass: 'RESTRICTED_RAW' };
  assert.equal(previewTransfer(packet, 'nova-organism', await loadCatalog()).status, 'BLOCKED_PRIVATE_DATA');
});

test('candidate and hold relations cannot execute', async () => {
  const catalog = await loadCatalog();
  const model = { ...proof, sourceLab: 'open-organism', contentKind: 'SIMULATED_STATE' };
  assert.equal(previewTransfer(model, 'organism-weltkeimwerk', catalog).status, 'NO_ADAPTER');
  const dna = { ...proof, sourceLab: 'genome-origin', contentKind: 'REAL_MEASUREMENT', evidenceState: 'OBSERVED' };
  assert.equal(previewTransfer(dna, 'genome-biolock', catalog).status, 'BLOCKED_HOLD');
});

test('packet rejects extra payload and simulation presented as measurement', async () => {
  const catalog = await loadCatalog();
  assert.throws(() => validatePacket({ ...proof, rawBases: 'ACGT' }, catalog), /unrecognized field/);
  assert.throws(() => validatePacket({ ...proof, contentKind: 'REAL_MEASUREMENT' }, catalog), /cannot be real measurement/);
});
