# Loading and structuring districts

All 94 districts are loaded. Connecticut retains its existing structured collections; the other 93 now have parsed draft local-rule collections. Original source documents remain accessible alongside every reader. See [parsed coverage](PARSED-DISTRICTS.md) for counts, selected ranges, and limitations, and [the source inventory](DISTRICT-SOURCES.md) for discovery evidence.

## Source documents

- `sources/district-catalog.json`: official discovery links, documents, retrieval evidence, and caveats.
- `sources/district-snapshots/`: hash-addressed original PDFs and HTML plus HTML acquisition metadata.
- `data/source-library.json` and `data/source-library/`: reader metadata and extracted text by physical PDF page or HTML section, including empty pages.
- `scripts/load-district-library.py`: verifies hashes and replays the source reader with pinned pypdf. It preserves existing district registrations and never alters `data/provisions.json`.

Install `requirements.txt`, then run `python scripts/load-district-library.py` for an offline replay. For initial acquisition, use `python scripts/verify-district-sources.py`, then `python scripts/load-district-library.py --acquire-html`. Stored HTML is converted to escaped text and never deployed as executable court HTML. Oregon uses its printable web edition; Western Michigan's stored prior web edition is the default, with the upcoming PDF separately selectable. Acquisition dates do not establish legal currency.

## Parsed draft collections

`sources/district-parse-profiles.json` binds each district to one stored document hash and specifies heading patterns, page bounds, and scope. `scripts/parse-districts.py` uses these profiles to select headings and preserve contiguous text slices from the selected range. Publisher bookmark destinations help distinguish headings from earlier references; Oregon's HTML headings constrain its extraction. These rules are extraction heuristics, not a completed table-of-contents reconciliation.

Use a separate Python 3.11 environment because the nationwide PDFium version differs from the original canonical adapter:

```sh
python -m venv tmp/structured-venv
tmp/structured-venv/Scripts/python -m pip install -r requirements-structured.txt
tmp/structured-venv/Scripts/python scripts/parse-districts.py
```

On POSIX systems, use `tmp/structured-venv/bin/python`. The default output is `candidate/parsed-districts/`. `--cached-pages` is a development shortcut and is not an independent replay. The regular path reads the retained snapshots without network access and enforces the PDFium and pypdf versions.

Each district JSON contains a collection, provisions, heading evidence, exact per-page slices and hashes, and explicit incomplete-review flags. `pages/` holds the supporting transcription; `index.json` summarizes counts and coverage. HTML page numbers are section positions. PDF page positions are physical, one-based in evidence and zero-based in provision metadata; extracted printed labels can be unreliable.

To validate a staged result:

```sh
node --input-type=module -e "import {validateParsedDistricts} from './scripts/validate-parsed-districts.mjs'; console.log((await validateParsedDistricts('candidate/parsed-districts')).length)"
```

Compare the staged records and source ranges before promotion. To promote an accepted draft extraction, run the parser with `--output data/parsed-districts`. Keep its collection registered in `data/districts.json` with `readerMode: "structured"`. All 93 registrations are already present. The build merges these drafts with the original corpus only in generated artifacts; it does not overwrite the original canonical provisions, collections, or inventory.

`npm run check` checks source hashes, schemas, exact text-slice preservation, no gaps or overlaps within selected ranges, package isolation, search behavior, and the complete build. `npm run test:browser` checks first/last rule navigation for all 93 added districts on desktop and mobile Chromium, plus source comparison, bookmarks, accessibility, and offline reading/search. Search indexes load only for the federal collections and selected district. Offline district packages contain their parsed reader and search data plus original source documents.

## Editorial promotion and source updates

1. Select the appropriate civil/general edition and review all supplements and amendment notices. For a changed snapshot hash, update the profile deliberately and inspect both ends of every selected range; parsing refuses an unrecognized hash.
2. Reconcile every rule and supporting entry against the source table of contents. Review duplicate headings, continuation pages, titles, exclusions, and grouped reserved ranges. A contiguous transcription proves preservation within a range, not completeness or correct rule boundaries.
3. Review text against rendered source pages, especially tables, discretionary hyphens, fonts, footnotes, and unresolved characters. Drafts retain embedded notes and headers; they do not infer paragraph hierarchies, separate note fields, or effective dates.
4. Implement reviewed source adapters and promote reconciled provisions through the canonical ingestion workflow. Preserve string rule numbers, independent collection namespaces, and source-page evidence. Keep original publications accessible.
5. Review federal/local relationships separately. Every established relationship needs source evidence, reviewer/date, relationship type, and both endpoint editions. Number equality is not sufficient.
6. Record editorial review and the applicable corpus hashes before an approved production build. Update draft labels and review flags only when the corresponding review is complete. See [deployment gates](DEPLOYMENT.md) and [canonical ingestion](INGESTION.md).

Combined general collections can also govern criminal practice; scope notes identify this. Separately published or out-of-range supplements remain available through the source reader. No nationwide currency review or completeness certification is claimed.
