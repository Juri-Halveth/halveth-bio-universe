import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { loadCatalog } from './catalog.mjs';

const files = new Map([
  ['/', [new URL('../web/index.html', import.meta.url), 'text/html; charset=utf-8']],
  ['/app.js', [new URL('../web/app.js', import.meta.url), 'text/javascript; charset=utf-8']],
  ['/styles.css', [new URL('../web/styles.css', import.meta.url), 'text/css; charset=utf-8']],
  ['/icon.svg', [new URL('../assets/icon.svg', import.meta.url), 'image/svg+xml']]
]);

export async function startServer(port = 34276) {
  const catalog = await loadCatalog();
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('port must be 0..65535');
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'");
    if (req.method !== 'GET') { res.writeHead(405).end('Method Not Allowed'); return; }
    if (req.url === '/api/catalog') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(catalog));
      return;
    }
    const file = files.get(req.url);
    if (!file) { res.writeHead(404).end('Not Found'); return; }
    try { res.writeHead(200, { 'Content-Type': file[1] }).end(await readFile(file[0])); }
    catch { res.writeHead(500).end('Bundled file unavailable'); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}
