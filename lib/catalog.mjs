import { readFile } from 'node:fs/promises';

export const catalogUrl = new URL('../catalog/labs.json', import.meta.url);
const kinds = new Set(['MEASUREMENT_SOFTWARE', 'MOLECULAR_MODEL', 'LIFE_SIMULATION', 'BIOLOGICAL_MODEL', 'SECURITY_PROTOTYPE', 'INFRASTRUCTURE', 'OPTIONAL_PLUGIN']);
const states = new Set(['PUBLIC_REPOSITORY', 'PUBLIC_REPOSITORY_RIGHTS_REVIEW', 'PRIVATE_REPOSITORY', 'LOCAL_PRIVATE', 'INSTALLED_PERSONAL_PLUGIN']);
const relationStates = new Set(['LOCAL_REPORTED', 'CANDIDATE', 'HOLD']);

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be nonempty text`);
}

export function validateCatalog(catalog) {
  if (!catalog || catalog.schema !== 'halveth.bio-universe.catalog.v1') throw new Error('catalog schema mismatch');
  requireText(catalog.asOf, 'asOf');
  if (!Array.isArray(catalog.labs) || !Array.isArray(catalog.relations)) throw new Error('labs and relations must be arrays');
  const ids = new Set();
  for (const lab of catalog.labs) {
    for (const key of ['id', 'name', 'dataClass', 'claimCeiling', 'nextOutcome']) requireText(lab[key], `lab.${key}`);
    if (!/^[a-z][a-z0-9-]*$/.test(lab.id) || ids.has(lab.id)) throw new Error(`invalid or duplicate lab id: ${lab.id}`);
    ids.add(lab.id);
    if (!kinds.has(lab.kind) || !states.has(lab.sourceState)) throw new Error(`invalid lab type or source state: ${lab.id}`);
    if (!Array.isArray(lab.functions) || !lab.functions.length || lab.functions.some(x => typeof x !== 'string' || !x.trim())) throw new Error(`invalid functions: ${lab.id}`);
    if (lab.sourceState.startsWith('PUBLIC_REPOSITORY')) {
      if (typeof lab.sourceUrl !== 'string' || !/^https:\/\/github\.com\/Juri-Halveth\//.test(lab.sourceUrl)) throw new Error(`public source URL required: ${lab.id}`);
    } else if (lab.sourceUrl !== null) {
      throw new Error(`nonpublic source must have null URL: ${lab.id}`);
    }
  }
  const edgeIds = new Set();
  for (const edge of catalog.relations) {
    for (const key of ['id', 'type', 'evidence', 'description']) requireText(edge[key], `relation.${key}`);
    if (edgeIds.has(edge.id) || !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) throw new Error(`invalid relation endpoints or id: ${edge.id}`);
    edgeIds.add(edge.id);
    if (!relationStates.has(edge.status)) throw new Error(`invalid relation status: ${edge.id}`);
  }
  return catalog;
}

export async function loadCatalog() {
  return validateCatalog(JSON.parse(await readFile(catalogUrl, 'utf8')));
}
