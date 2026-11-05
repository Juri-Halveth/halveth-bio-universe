# HALVETH Bio-Universe · Foundation 0.1.0

A local, read-only research center for selected HALVETH biological software branches. The package contains new catalog, interface, validation and transfer-preview code. It does **not** bundle any older laboratory source, personal genome data, biometric records, device keys or private run artifacts.

## Run

Requires Node.js 20 or newer. No packages to install and no network connection is needed.

```sh
npm test
npm run check
node scripts/release-check.mjs
npm start
```

Open `http://127.0.0.1:34276/`. The server binds only to loopback. It exposes a bundled static interface and a read-only catalog API. Commands for compact terminal use:

```sh
node scripts/bio-universe.mjs list
node scripts/bio-universe.mjs show genome-origin
node scripts/bio-universe.mjs relations
```

The `plugin.json` and `skills/bio-universe/SKILL.md` form a personal Codex plugin candidate. Installation and updating the two existing personal plugins are separate steps.

## What the catalog means

The dated catalog is a **finite selected snapshot**. `PUBLIC_REPOSITORY` means the named GitHub source location was reachable in the 2026-11-05 inventory; it is not a per-file license clearance. `LOCAL_PRIVATE` and `PRIVATE_REPOSITORY` nodes have no public source link. `LOCAL_REPORTED` relations come from local research reports. `CANDIDATE` and `HOLD` relations are not runnable integrations.

The typed packet contract in `lib/contract.mjs` validates a metadata-only envelope. `previewTransfer()` never executes a source lab or sends data. It rejects private raw data and keeps the one locally reported synthetic adapter at `PREVIEW_ONLY_EXTERNAL_ADAPTER_REQUIRED` until its actual source and runtime are separately bound.

## Source and rights boundary

This repository's new code is MIT-licensed. Links to NOVA, Open Organism and WELTKEIMWERK identify external source trees; their code is not included. Some older HALVETH paths use different license terms. A later code merge needs a path, version, dependency and license check for every copied file. The two installed personal plugins are neighboring tools, not bundled dependencies.

## Immediate research use

Use the dashboard to choose one lab and one concrete result. The initial priority is a new, independently checked Genome Origin biological result or a source-bound synthetic NOVA/Open Organism run. The Phase 4.5 proof outbox remains infrastructure; its local 10,000-import result is reported but not re-executed by this package. BIO-LOCK's physical sensor and presence link remains open.

## Limitations

The release scanner is an allowlist and pattern check, not a complete privacy or malware proof. The package has no installer, device access, clinical interpretation, publication bridge or automatic access to local research data.
