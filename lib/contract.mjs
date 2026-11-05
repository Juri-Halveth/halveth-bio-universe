import { validateCatalog } from './catalog.mjs';

const contentKinds = new Set(['REAL_MEASUREMENT', 'SIMULATED_STATE', 'SOFTWARE_PROOF', 'TASK', 'VISUAL_SCENE']);
const evidenceStates = new Set(['OBSERVED', 'LOCAL_REPORTED', 'MODEL_OUTPUT', 'HYPOTHESIS']);
const dataClasses = new Set(['PUBLIC', 'LOCAL_ONLY', 'RESTRICTED_RAW']);

export function validatePacket(packet, catalog) {
  validateCatalog(catalog);
  if (!packet || packet.schema !== 'halveth.bio-universe.packet.v1') throw new Error('packet schema mismatch');
  for (const field of ['id', 'sourceLab', 'sourceVersion', 'recordDigest', 'summary']) {
    if (typeof packet[field] !== 'string' || !packet[field].trim()) throw new Error(`invalid packet ${field}`);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(packet.id)) throw new Error('packet id must be ASCII-safe');
  if (!/^[a-f0-9]{64}$/.test(packet.recordDigest)) throw new Error('packet digest must be sha256 hex');
  if (!catalog.labs.some(lab => lab.id === packet.sourceLab)) throw new Error('unknown source lab');
  if (!contentKinds.has(packet.contentKind) || !evidenceStates.has(packet.evidenceState) || !dataClasses.has(packet.dataClass)) throw new Error('invalid packet classification');
  if (packet.contentKind === 'REAL_MEASUREMENT' && packet.evidenceState === 'MODEL_OUTPUT') throw new Error('model output cannot be real measurement');
  if (Object.keys(packet).some(key => !['schema', 'id', 'sourceLab', 'sourceVersion', 'recordDigest', 'summary', 'contentKind', 'evidenceState', 'dataClass'].includes(key))) throw new Error('packet contains unrecognized field');
  return packet;
}

export function previewTransfer(packet, edgeId, catalog) {
  validatePacket(packet, catalog);
  const edge = catalog.relations.find(item => item.id === edgeId && item.from === packet.sourceLab);
  if (!edge) throw new Error('relation does not start at packet source');
  if (packet.dataClass === 'RESTRICTED_RAW') return { status: 'BLOCKED_PRIVATE_DATA', edgeId };
  if (edge.status === 'HOLD') return { status: 'BLOCKED_HOLD', edgeId };
  if (edge.status === 'CANDIDATE') return { status: 'NO_ADAPTER', edgeId };
  if (edge.type !== 'SYNTHETIC_SOFTWARE_ADAPTER' || packet.contentKind !== 'SOFTWARE_PROOF') return { status: 'TYPE_MISMATCH', edgeId };
  return { status: 'PREVIEW_ONLY_EXTERNAL_ADAPTER_REQUIRED', edgeId, targetLab: edge.to };
}
