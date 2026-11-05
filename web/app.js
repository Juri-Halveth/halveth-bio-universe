const byId = id => document.getElementById(id);
const make = (tag, className, value) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};

const label = {
  MEASUREMENT_SOFTWARE: 'Messsoftware', MOLECULAR_MODEL: 'Molekülmodell',
  LIFE_SIMULATION: 'Lebenssimulation', BIOLOGICAL_MODEL: 'Biomodell',
  SECURITY_PROTOTYPE: 'Sicherheitsprototyp', INFRASTRUCTURE: 'Infrastruktur',
  OPTIONAL_PLUGIN: 'Optionales Plugin'
};
const status = {
  LOCAL_TESTED_LEGACY: 'Lokal getesteter Altpfad', CANDIDATE: 'Kandidat', HOLD: 'Ausgesetzt'
};

const response = await fetch('/api/catalog');
if (!response.ok) throw new Error('Katalog nicht verfügbar');
const catalog = await response.json();
const byLab = new Map(catalog.labs.map(lab => [lab.id, lab]));
const publicCount = catalog.labs.filter(lab => lab.sourceState.startsWith('PUBLIC_REPOSITORY')).length;
const summary = byId('summary');
for (const [count, title] of [[catalog.labs.length, 'Zweige'], [catalog.relations.length, 'sichtbare Verbindungen'], [publicCount, 'öffentliche Quellorte']]) {
  const cell = make('div', 'stat');
  cell.append(make('strong', '', String(count)), make('span', '', title));
  summary.append(cell);
}

const kindSelect = byId('kind');
for (const kind of [...new Set(catalog.labs.map(lab => lab.kind))].sort()) {
  const option = make('option', '', label[kind]);
  option.value = kind;
  kindSelect.append(option);
}

function renderLabs() {
  const query = byId('search').value.trim().toLocaleLowerCase('de');
  const kind = kindSelect.value;
  const host = byId('labs');
  host.replaceChildren();
  const shown = catalog.labs.filter(lab => (!kind || lab.kind === kind) &&
    (!query || [lab.name, ...lab.functions, lab.nextOutcome].join(' ').toLocaleLowerCase('de').includes(query)));
  for (const lab of shown) {
    const card = make('article', 'lab-card');
    card.append(make('span', 'tag', label[lab.kind]), make('h3', '', lab.name));
    const list = make('ul', 'functions');
    for (const item of lab.functions) list.append(make('li', '', item));
    card.append(list);
    const facts = make('dl', 'facts');
    for (const [term, value] of [['Quelle', lab.sourceState.replaceAll('_', ' ')], ['Datenklasse', lab.dataClass], ['Aussagegrenze', lab.claimCeiling], ['Nächster Nutzen', lab.nextOutcome]]) {
      facts.append(make('dt', '', term), make('dd', '', value));
    }
    card.append(facts);
    if (lab.sourceUrl) {
      const link = make('a', 'source-link', 'Öffentlichen Quellort öffnen ↗');
      link.href = lab.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      card.append(link);
    }
    host.append(card);
  }
  if (!shown.length) host.append(make('p', 'empty', 'Keine Einträge für diesen Filter.'));
}

const relations = byId('relations');
for (const edge of catalog.relations) {
  const row = make('article', `relation ${edge.status.toLowerCase()}`);
  const line = make('div', 'relation-line');
  line.append(make('strong', '', byLab.get(edge.from).name), make('span', 'arrow', '→'), make('strong', '', byLab.get(edge.to).name));
  row.append(line, make('span', 'relation-status', status[edge.status]), make('p', '', edge.description), make('small', '', edge.evidence));
  relations.append(row);
}
const resultResponse = await fetch('/api/results');
if (!resultResponse.ok) throw new Error('Ergebnisse nicht verfügbar');
const results = await resultResponse.json();
for (const result of results) {
  const card = make('article', 'result-card');
  card.append(make('span', 'tag', 'SYNTHETISCHER MODELLLAUF'), make('h3', '', 'NOVA → Open Organism'));
  card.append(make('p', 'result-status', result.transfer.status));
  const facts = make('dl', 'facts');
  for (const [term, value] of [
    ['NOVA-Verifier', result.checkpoint.validatedByOriginalNova ? 'Originalfunktion ausgeführt' : 'Nicht ausgeführt'],
    ['Run-Digest', result.checkpoint.runDigest],
    ['Checkpoint', result.checkpoint.packetDigest],
    ['Quellereignisse', String(result.checkpoint.sourceEventsWithinViewedStep)],
    ['World-Ereignis', result.transfer.targetEventHash],
    ['Eventkette', result.transfer.eventChainValid ? 'Geprüft' : 'Offen'],
    ['Entitäten / Ressourcen', `${result.transfer.entityCount} / ${result.transfer.resourceCount}`],
    ['Modellzeit', `${result.transfer.modelTimeMs} ms`],
    ['Resultat-Digest', result.resultDigest]
  ]) facts.append(make('dt', '', term), make('dd', '', value));
  const sources = make('details', 'result-sources');
  sources.append(make('summary', '', 'Gebundene Quellbytes und SHA-256'));
  const sourceList = make('dl', 'facts');
  for (const [path, sha] of Object.entries(result.sourceDigests)) sourceList.append(make('dt', '', path), make('dd', '', sha));
  sources.append(sourceList);
  card.append(facts, sources, make('p', 'result-boundary', 'Aussagegrenze: Referenzereignis in einem synthetischen Modell. Keine biologische Messung und keine Materialübertragung.'));
  byId('results').append(card);
}
const genomeResponse = await fetch('/api/genome-status');
if (!genomeResponse.ok) throw new Error('Genomstatus nicht verfügbar');
const genome = await genomeResponse.json();
const genomeHost = byId('genome-status');
if (!genome.configured) {
  genomeHost.append(make('p', 'genome-unconfigured', 'Privater Status ist in diesem lokalen Serverlauf nicht eingebunden.'));
} else {
  const card = make('article', 'genome-card');
  card.append(make('span', 'tag', 'LOKAL GEBUNDENER STATUS'), make('h3', '', `Genome Origin ${genome.software.version}`));
  const tests = genome.software.tests;
  card.append(make('p', 'genome-testline', tests.evidenceState === 'BOUND_PRIVATE_FILE'
    ? `${tests.passed} Tests bestanden · ${tests.skipped} übersprungen · ${tests.failed} fehlgeschlagen`
    : 'Testbeleg derzeit nicht gebunden'));
  const truth = make('p', 'genome-truth', genome.truth.state === 'NO_ORTHOGONAL_REFERENCE_FOUND_IN_SCOPED_INVENTORY'
    ? 'Unabhängige Wahrheitsreferenz: in der begrenzten Dateinamen-Inventur nicht gefunden.'
    : 'Unabhängige Wahrheitsreferenz: Status offen.');
  card.append(truth, make('p', 'genome-coverage', `Suchumfang: ${genome.truth.coverage}.`));
  const tracks = make('ul', 'genome-tracks');
  for (const track of genome.tracks) {
    const item = make('li');
    item.append(make('strong', '', track.label), make('span', '', ` · ${track.state === 'PRIVATE_RUN_RECORDED' ? 'Privater Bericht gebunden' : 'Belegprüfung offen'} · ${track.evidenceId}`));
    tracks.append(item);
  }
  card.append(tracks, make('p', 'genome-coverage', `${genome.evidenceSummary.bound} private Belege gebunden · ${genome.evidenceSummary.changed} verändert · ${genome.evidenceSummary.unavailable} nicht verfügbar`));
  genomeHost.append(card);
  const measured = genome.result;
  if (measured.state === 'PRIVATE_MEASUREMENT_RECORDED') {
    const evidence = make('article', 'result-card');
    evidence.append(make('span', 'tag', 'PRIVATER MESSLAUF'),
      make('h3', '', 'Genome Origin · Diskordanzprobe'),
      make('p', 'result-status', `${measured.selectedMarkers} vorab gewählte Positionen · ${measured.discordance.state === 'DISCORDANCE_INCONCLUSIVE' ? 'Abweichungsunterschied nicht belegt' : 'Auswertung offen'}`));
    const facts = make('dl', 'facts');
    const percent = value => `${(100 * value).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`;
    for (const [term, value] of [
      ['Q30 unter BQ ≥ 20 · lang / kurz', `${percent(measured.quality.longQ30Fraction)} / ${percent(measured.quality.shortQ30Fraction)}`],
      ['Abweichende Q30-Basen · lang / kurz', `${measured.discordance.long.discordant}/${measured.discordance.long.bases} / ${measured.discordance.short.discordant}/${measured.discordance.short.bases}`],
      ['Differenz lang minus kurz', `${(100 * measured.discordance.longMinusShort).toLocaleString('de-DE', { maximumFractionDigits: 4 })} Prozentpunkte`],
      ['Chromosomen-Bootstrap 95 %', `${percent(measured.discordance.chromosomeBootstrap95[0])} bis ${percent(measured.discordance.chromosomeBootstrap95[1])}`],
      ['Ohne supplementäre Alignments · lang / kurz', `${measured.supplementaryExcluded.long.q30Discordant}/${measured.supplementaryExcluded.long.q30Bases} / ${measured.supplementaryExcluded.short.q30Discordant}/${measured.supplementaryExcluded.short.q30Bases}`],
      ['BQ20–29 · lang / kurz', `${measured.lowerQuality.long.discordant}/${measured.lowerQuality.long.bases} / ${measured.lowerQuality.short.discordant}/${measured.lowerQuality.short.bases}`],
      ['Nulltiefe · lang / kurz', `${measured.zeroDepthMarkers.long} / ${measured.zeroDepthMarkers.short}`]
    ]) facts.append(make('dt', '', term), make('dd', '', value));
    evidence.append(facts, make('p', 'result-boundary',
      'Export und CRAM stammen vom selben Anbieter. Diskordanz gegen Exportcalls ist keine unabhängig validierte Sequenzierungsfehlerrate; eine externe Wahrheitsreferenz fehlt im begrenzten Suchumfang.'));
    genomeHost.append(evidence);
  } else if (measured.state === 'HOLD_EVIDENCE') {
    genomeHost.append(make('p', 'genome-unconfigured', 'Messresultat: private Belegbindung offen.'));
  }
}
byId('snapshot').textContent = `Katalogstand ${catalog.asOf} · endlicher Ausschnitt`;
byId('search').addEventListener('input', renderLabs);
kindSelect.addEventListener('change', renderLabs);
renderLabs();
