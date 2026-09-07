# Loading and structuring districts

Start with the [nationwide source inventory](DISTRICT-SOURCES.md) and [machine-readable catalog](../sources/district-catalog.json). These cover discovery for all 94 courts; PDF retrieval verification does not establish legal currency or readiness for ingestion. Review the flagged HTML and future-edition cases before choosing an adapter.

## Source document coverage

All 94 districts are registered and loaded. `readerMode: "source"` identifies the 93 additional districts; Connecticut retains structured navigation. Source-only support means readable, searchable original publications, not reviewed canonical provisions.

- `sources/district-catalog.json`: official discovery links, documents, retrieval evidence, and caveats.
- `sources/district-snapshots/`: hash-addressed original PDFs and HTML plus HTML acquisition metadata. Preserve these files for offline builds and replay.
- `data/source-library.json`: reader metadata and source-to-artifact paths.
- `data/source-library/`: extracted text by physical PDF page or HTML section. Empty PDF pages remain represented.
- `scripts/load-district-library.py`: verifies hashes, extracts with pinned pypdf, and registers source readers. It never alters `data/provisions.json`.

Replay the loaded snapshots with `python scripts/load-district-library.py`. For initial acquisition, run `python scripts/verify-district-sources.py` to acquire catalog PDFs into `candidate/district-pdfs`, then `python scripts/load-district-library.py --acquire-html`. Install `requirements.txt` first. The loader rejects a different pypdf version. Stored HTML is converted to escaped text and never deployed as executable court HTML. Oregon has a printable web edition; Western Michigan's prior web edition is the default, with its upcoming PDF separately selectable.

`npm run check` validates all 94 libraries, source hashes, physical page counts, and package isolation. The build copies only each document's extracted text and PDFs into runtime artifacts; per-district packages include only that district's documents and shared metadata. Builds require no network or Python.

Source navigation, full-text search, and bookmarks are available immediately. Civil-only filtering, exact rule citations, subsection anchors, and federal/local relationships require the structured onboarding below. Combined PDFs retain all their content and are labeled accordingly. Search does not include upcoming editions unless the reader explicitly selects one. HTML section numbers are reader navigation positions, not legal citations.

## Promoting a district to structured rules

1. Use the registered district's identifier, display name and official source/discovery URLs. Keep collection namespaces independent: for example `mad-civil`, `mad-magistrate`, `mad-support`. The generic reader resolves collections by those identifiers, not rule-number equality.
2. Add acquisition registration and implement a source adapter using the shared page-geometry interface. Different publishers need different heading, footnote and table rules. Bind the adapter to reviewed PDF hashes. Record deliberate exclusions and connectivity-only materials.
3. Reconcile all rules and supporting materials against the complete source table of contents. Preserve grouped reserved entries and string numbers. Retain dates only with source wording and page evidence. Keep the original PDFs in the snapshot store.
4. Register canonical collections and the district, then derive navigation/search from canonical provisions. Extend the package registry with a package containing all that district's text, search and relationship metadata.
5. Review explicit citations and topical relationships separately. Every verified relationship needs source evidence, type, reviewer/date and both endpoint editions. Unverified candidates must not appear as established reader links.
6. Set `readerMode` to `structured` and populate the district’s collection list only after its canonical content is ready. The selector and offline packages already include all 94 districts. Keep the source documents available alongside the structured reader.
7. Add adapter fixtures, source reconciliation checks, relationship checks, district switching/deep-link tests, and complete offline package tests. Run content review and publication gates before deployment.

The reader, related-panel labels, selector validation and offline packages use the district registry. Update the About-page structured coverage when promoting another district; source-only coverage must remain clearly distinguished.
