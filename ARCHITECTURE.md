# Architecture

The application is a static graph of immutable content artifacts. `data/provisions.json` is the canonical input; a build derives collection packages, search documents and the navigation catalog. Federal and local text remain independent. Relationships are evidence-bearing edges, never overlays or replacement instructions.

## Plan and implementation milestones

1. Establish an independent static project and source schemas; verify Rule 56 as a vertical slice.
2. Acquire replayable PDF snapshots, implement source-specific geometry adapters and reconcile all collections to both tables of contents.
3. Build reader, routes, source context, district selection, explicit relationships, search and device state.
4. Add complete offline packages with transactional promotion, integrity verification and update controls.
5. Exercise desktop/mobile accessibility and integration, document reproducibility and prepare a Pages artifact. Keep production publication behind the unfinished editorial review.

## Reference assessment

The neighboring CGS README, architecture notes, route and reader modules, search worker, device preferences, offline integrity verifier, service worker, secondary PDF acquisition/ingestion, and build pipeline were inspected. Its useful patterns are static JSON, hash routes, device-local preferences, derived search indexes, and staged verified cache generations. No reference code was copied; no license was present. Annual-supplement overlay semantics are intentionally absent because a district rule is not an amendment replacing federal text.

## Data flow and contracts

```text
official court PDFs -> sources/snapshots/<name>-<sha256>.pdf
  -> shared PDF geometry extraction -> source-specific adapters
  -> candidate/data + inventory -> review and explicit corrections
  -> canonical data/ -> schema/reference/integrity validation
  -> dist/data/editions/<collection>/<edition>/{provisions,search}.json
  -> catalog, source metadata, reviewed relationships, release manifest
```

JSON Schema Draft 7 contracts cover districts, collections, source documents, editions, provisions, relationships, catalogs, search indexes and release manifests. `scripts/schema.mjs` reproduces the checked-in schemas. Ajv validates the data contract; semantic checks reject duplicate identities, broken source references, page spans, stale link editions, missing evidence, duplicate anchors and incomplete inventories. Search data and reverse links are derived at build time and carry no independent authority.

Stable identity is `<collection>:<number>`. An edition uses the collection and source digest. A future parser correction to already published content must receive a new edition identifier and preserve the original package; never mutate a published path. This initial, unpublished candidate is the only stored edition per collection. Adding prior editions to the build registry and a reader edition selector is still outstanding; unrecognized pinned editions fail visibly rather than resolving to newer text.

Body blocks retain order, original text, paragraph paths, parent references and PDF page indices. Amendment history and publisher footnotes have separate fields. Geometry and marker patterns identify subsection structure; repeated labels receive unique anchors. Forms retain text and field lines rather than being reconstructed into fillable forms. Dates are populated only from explicit source wording, with evidence; federal amendment history remains verbatim without a speculative effective-date parser.

## Runtime

`app.js` renders escaped source text into a semantic shell. `routes.js` is shared by reading, search, history, bookmarks and paragraph links. Requests for canonical packages verify manifest hashes before parsing. Route epochs and search request IDs prevent stale results from replacing a newer page. Search executes in an ES module worker, with a main-thread fallback, and renders 30-result batches. All collections together are small enough to index in memory.

Bookmarks use provision plus edition identity, and exported links retain district context. Browser storage failures do not prevent reading. No data leaves the device except ordinary requests to the static host and explicitly opened official source URLs.

## Offline model

The service worker precaches the versioned shell, catalog, sources, relationships and release manifest. Immutable content is fetched by collection and cached when visited. Settings can explicitly stage federal and Connecticut packages. Every artifact's byte length and SHA-256 is checked before it is written. A single control-cache record promotes a completely staged package; errors delete only the staging generation. Package operations are serialized. Removal also clears matching visited content, but never personal localStorage. Status checks detect missing cache entries; readers recheck hashes before use.

A waiting application worker activates only through the update/reload action. The previous shell and content generation remain available during staging. Shell caches are conservatively retained so an older open tab does not lose its code. Automatic old-shell garbage collection, cross-tab cache pinning, and long-running download resumption are future work. A worker terminated mid-download can leave an unpromoted cache, but cannot advertise it as installed.

## Hosting

Build-time `FCR_SITE_URL` controls the manifest's origin/base scope. Internal assets use relative URLs; routes use hashes. The built artifact is tested under `/CivPro/`. The deployment workflow publishes that same tested directory. Source refresh has read-only repository permissions and only uploads review candidates.
