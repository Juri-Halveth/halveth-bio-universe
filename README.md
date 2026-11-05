# HALVETH Bio-Universe · Foundation 0.1.3

A local, read-only research center for selected HALVETH biological software branches. The package contains new catalog, interface, validation and transfer-preview code. It does **not** bundle any older laboratory source, personal genome data, biometric records, device keys or private run artifacts.

## Run

Requires Node.js 20 or newer. No packages to install and no network connection is needed.

```sh
npm test
npm run check
node scripts/release-check.mjs
npm start
```

Open `http://127.0.0.1:34276/`. The server binds only to loopback. It exposes the bundled interface, catalog and one synthetic result through read-only APIs. Commands for compact terminal use:

```sh
node scripts/bio-universe.mjs list
node scripts/bio-universe.mjs show genome-origin
node scripts/bio-universe.mjs relations
node scripts/bio-universe.mjs result
```

The `plugin.json` and `skills/bio-universe/SKILL.md` form a personal Codex plugin candidate. Installation and updating the two existing personal plugins are separate steps.

## What the catalog means

The dated catalog is a **finite selected snapshot**. `PUBLIC_REPOSITORY` means the named GitHub source location was reachable in the 2026-11-05 inventory; it is not a per-file license clearance. `LOCAL_PRIVATE` and `PRIVATE_REPOSITORY` nodes have no public source link. `LOCAL_TESTED_LEGACY` denotes the isolated NOVA→Open-Organism Phase-3 adapter: its 11 tests passed again locally on 2026-11-05, including three tests that expose known trust gaps. `CANDIDATE` and `HOLD` relations are not runnable integrations.

The typed packet contract in `lib/contract.mjs` validates a metadata-only envelope. `previewTransfer()` never executes a source lab or sends data. It rejects private raw data. The separate local result generator binds the exact five source files listed in `catalog/synthetic-source-bindings.json`, copies those checked bytes into an isolated temporary module tree, executes the original NOVA checkpoint and verifier, then records one Open Organism reference event through the legacy adapter. The generator publishes only a minimized synthetic result. This does not turn the legacy adapter into a production trust chain.

To reproduce the bundled synthetic result, provide a local source tree with the listed exact bytes and run:

```sh
npm run result:local -- <isolated-source-root>
npm run check
```

The fixture's timestamp inside NOVA is fixed model input, not the wall-clock time of execution. The local execution time belongs in a separate run receipt. Re-running with the same bound bytes should recreate the same result digest.

## Source and rights boundary

This repository's new code is MIT-licensed. Links to NOVA, Open Organism and WELTKEIMWERK identify external source trees; their code is not included. Some older HALVETH paths use different license terms. A later code merge needs a path, version, dependency and license check for every copied file. The two installed personal plugins are neighboring tools, not bundled dependencies.

## Immediate research use

Use the dashboard to choose one lab and one concrete result. The first source-bound synthetic NOVA/Open Organism result is now displayed. The next priority is a new, independently checked Genome Origin biological result. The Phase 4.5 proof outbox remains infrastructure; its local 10,000-import result is reported but not re-executed by this package. BIO-LOCK's physical sensor and presence link remains open.

## Limitations

The release scanner is an allowlist and pattern check, not a complete privacy or malware proof. The package has no device access, clinical interpretation, automatic access to local research data or independent proof that the legacy adapter's old trust gaps are closed. The v0.1.2 candidate discussed in a separate local review was unavailable as code here; this v0.1.3 descends directly from the verified v0.1.1 repository and is not claimed byte-equivalent to that candidate.
