# Federal Civil Rules

A static, installable reading room for federal civil procedure and Connecticut local rules. No accounts, database, server API, analytics, hosted search, or runtime AI.

**Status: working release candidate, not a reviewed production publication.** The complete inventories from both supplied PDFs are included: 192 provisions and supporting entries across seven collections. Independent line-by-line editorial review and actual iOS verification remain open. See [the content review report](docs/CONTENT-REVIEW.md).

## Run locally

Use Node **24.19.0**. Runtime JavaScript has no third-party dependencies. Pinned development dependencies are in `package-lock.json`.

```sh
npm ci
npm run check
npm run dev
```

Open **http://127.0.0.1:4173/CivPro/**. The preview deliberately exercises a non-root Pages base path. The generated `dist/` directory can be served by any static host. Use HTTPS in production; localhost is permitted for PWA development.

For browser verification:

```sh
npx playwright install chromium
npm run test:browser
```

## Included collections

| Collection | Entries |
| --- | ---: |
| Federal Rules of Civil Procedure | 98 |
| Supplemental Admiralty / Asset Forfeiture | 7 |
| Supplemental Social Security | 8 |
| Federal abrogated appendix and publisher footnotes | 6 |
| Connecticut local civil rules | 62 |
| Connecticut magistrate rules | 3 |
| Connecticut civil forms and standing orders | 8 |

Reserved ranges remain grouped. Rule numbers are strings. Local provisions do not replace federal text. Four source-citation relationships have been checked and linked in both directions; the rest of the mapping review is explicitly incomplete. The criminal collection and criminal-only discovery order are excluded from civil navigation and search.

## Features

- Hierarchical federal contents, independent local browsing, decimal and lettered rule identifiers.
- Edition-pinned hash routes and subsection links; explicit shared district context takes precedence over saved preferences.
- Federal/local comparison panels with source evidence; source URLs and PDF page provenance.
- Local worker search: citations, phrases, keywords, AND/OR/NOT with parentheses; scope, collection, field and supporting-material filters.
- Device-local bookmarks, JSON export/import, recent reading, theme and text-size preferences.
- SHA-256-verified, staged offline packages; repair/removal, storage estimates and an explicit app update flow.
- Responsive desktop/mobile layout, keyboard focus, print styles, manifest and PNG install icons.

## Content pipeline

PDF replay uses Python **3.11.3** and `requirements.txt`. Original PDFs are committed as content-addressed files in `sources/snapshots/`; the manifest retains acquisition time, hashes, byte counts and official URLs. The build does not need Python or network access once canonical JSON is present.

```sh
python -m pip install -r requirements.txt
python scripts/ingest.py --sources sources/snapshots --output candidate/data
npm run diff -- data candidate/data candidate/corpus-diff
npm run validate
npm run check
```

Ingestion writes a candidate; it never overwrites `data/`. New PDF hashes are refused until the source-specific boundary profile has been reviewed. See [ingestion and maintenance](docs/INGESTION.md) for acquisition, offline import, review and promotion.

## Project guide

- [Architecture and reference assessment](ARCHITECTURE.md)
- [Actual verification and outstanding review](docs/CONTENT-REVIEW.md)
- [Deployment and rollback](docs/DEPLOYMENT.md)
- [District onboarding](docs/ADDING-A-DISTRICT.md)
- [Ingestion and source refresh](docs/INGESTION.md)

CGS was inspected as an architectural reference; its application and data were not changed. No CGS source code was copied. No license file was found in that reference checkout, so no permission to reuse its code was assumed. Court-publication attribution remains attached to the supplied text. This project has not assigned a license to the newly written application code.
