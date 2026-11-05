#!/usr/bin/env node
import { loadCatalog } from '../lib/catalog.mjs';
import { startServer } from '../lib/server.mjs';

const [command = 'help', arg] = process.argv.slice(2);
const catalog = await loadCatalog();
switch (command) {
  case 'check':
    console.log(`CATALOG_VALID labs=${catalog.labs.length} relations=${catalog.relations.length} asOf=${catalog.asOf} scope=${catalog.scope}`);
    break;
  case 'list':
    for (const lab of catalog.labs) console.log(`${lab.id}\t${lab.kind}\t${lab.sourceState}\t${lab.name}`);
    break;
  case 'show': {
    const lab = catalog.labs.find(x => x.id === arg);
    if (!lab) { console.error(`Unknown lab: ${arg ?? ''}`); process.exitCode = 2; break; }
    console.log(JSON.stringify({ ...lab, relations: catalog.relations.filter(x => x.from === lab.id || x.to === lab.id) }, null, 2));
    break;
  }
  case 'relations':
    for (const edge of catalog.relations) console.log(`${edge.from} -> ${edge.to}\t${edge.status}\t${edge.type}`);
    break;
  case 'serve': {
    const port = arg === undefined ? 34276 : Number(arg);
    const server = await startServer(port);
    console.log(`HALVETH Bio-Universe: http://127.0.0.1:${server.address().port}/`);
    break;
  }
  default:
    console.log('Usage: node scripts/bio-universe.mjs check|list|show <lab-id>|relations|serve [port]');
    if (command !== 'help') process.exitCode = 2;
}
