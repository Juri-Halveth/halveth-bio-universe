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
  LOCAL_REPORTED: 'Lokal berichtet', CANDIDATE: 'Kandidat', HOLD: 'Ausgesetzt'
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
byId('snapshot').textContent = `Katalogstand ${catalog.asOf} · endlicher Ausschnitt`;
byId('search').addEventListener('input', renderLabs);
kindSelect.addEventListener('change', renderLabs);
renderLabs();
