import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../lib/server.mjs';

test('local server serves only bundled routes and refuses mutation', async () => {
  const server = await startServer(0);
  try {
    assert.equal(server.address().address, '127.0.0.1');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const page = await fetch(origin + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Bio-Universe/);
    assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
    const api = await fetch(origin + '/api/catalog');
    assert.equal((await api.json()).labs.length, 9);
    assert.equal((await fetch(origin + '/../../secret')).status, 404);
    assert.equal((await fetch(origin + '/api/catalog', { method: 'POST' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
