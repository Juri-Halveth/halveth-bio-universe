---
name: bio-universe
description: Navigate the local HALVETH biological research catalog, show lab capabilities and provenance, and distinguish measured DNA, synthetic models, and proposed integrations.
---

# HALVETH Bio-Universe

Use `node scripts/bio-universe.mjs check` from the plugin root before relying on the catalog. Use `list`, `show <lab-id>` or `relations` for compact facts. Use `serve` for the local visual research center. The server binds to `127.0.0.1` and only serves the bundled, data-free catalog and interface.

Catalog records identify functions and source visibility; they do not install or execute the original labs. A `LOCAL_REPORTED` edge is evidence from a local research report, not independent reproduction. `CANDIDATE` and `HOLD` edges are not working integrations. Keep personal DNA, biometrics, secrets, private paths and run artifacts out of this package. Open source publication of a source lab requires a separate path/version rights check.

Rachel Auftragssystem and HALVETH Perspektivkorridor are optional neighboring plugins. This package does not update or invoke them automatically.
