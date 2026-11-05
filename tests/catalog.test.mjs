import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, validateCatalog } from '../lib/catalog.mjs';

const clone = value => structuredClone(value);

test('catalog contains typed labs and valid relations', async () => {
  const catalog = await loadCatalog();
  assert.equal(catalog.labs.length, 9);
  assert.equal(catalog.relations.length, 6);
  assert.equal(catalog.relations.filter(edge => edge.status === 'LOCAL_REPORTED').length, 1);
});

test('rejects duplicate lab and unknown relation endpoints', async () => {
  const source = await loadCatalog();
  const duplicate = clone(source);
  duplicate.labs.push(clone(duplicate.labs[0]));
  assert.throws(() => validateCatalog(duplicate), /duplicate lab/);
  const badEdge = clone(source);
  badEdge.relations[0].to = 'missing-lab';
  assert.throws(() => validateCatalog(badEdge), /invalid relation/);
});

test('nonpublic sources cannot carry source URLs', async () => {
  const catalog = clone(await loadCatalog());
  catalog.labs.find(lab => lab.id === 'genome-origin').sourceUrl = 'https://github.com/example/private';
  assert.throws(() => validateCatalog(catalog), /nonpublic source/);
});
