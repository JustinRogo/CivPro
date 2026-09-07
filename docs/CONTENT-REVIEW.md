# Content and verification report

Verification updated: September 7, 2026. **Release candidate.** This report does not certify the complete corpus as editorially approved.

## Source evidence

The official Federal Rules PDF has 142 pages. Its foreword says it is amended through December 1, 2025. The Connecticut combined PDF has 174 pages; its cover directs readers to individual rule pages for amendments after December 2009. The filename is not used as an effective date. Retrieval timestamps, SHA-256 and byte counts are in `sources/snapshots/manifest.json` and canonical `data/sources.json`.

Both original rule-heading sequences were reconciled against their independent front-matter tables of contents. Machine-readable coverage and exclusions are in `data/inventory.json`; original PDF page indices are zero-based there. Those collections retain 192 entries, including reserved/abrogated records and supporting material. The app additionally includes 6,313 parsed draft records from 93 other districts, for 6,505 total entries. The additional drafts have not received complete TOC reconciliation or editorial review. No missing legal wording was generated.

## Nationwide parsed drafts

All 94 districts now open a rule reader and retain their original source libraries. The 93 added district collections are separately stored as drafts with hash-bound heading profiles, source offsets, and per-page text-slice evidence. Validators check exact transcription preservation without gaps or overlaps inside each selected range. A fresh extraction reproduced all 186 saved JSON files byte for byte. This demonstrates replay consistency, not legal completeness.

Civil/general ranges were selected from the source publications, with separate criminal and supplemental sections excluded where the profile identifies them. Some general collections govern both civil and criminal practice, as their scope notes explain. Material outside selected ranges remains in the original source reader. Embedded notes, running headers, page labels, and forms can remain inside draft rule text. No new reviewed relationships or legal subsection anchors are inferred.

Representative visual checks compared Massachusetts Rule 56.1 (physical PDF page 76), Southern Alabama's first civil headings (page 35), and Idaho Rule 1.1 (page 5) with their source renderings. Desktop and mobile parsed-reader screenshots were inspected. These checks do not replace review of all pages; PDF font mappings can also make extracted printed page labels differ from their rendering, so source navigation uses physical page positions. See [per-district coverage](PARSED-DISTRICTS.md).

## Source checks performed

- Visually inspected federal printed pages 82–83 (Rule 56), page 41 (complex Rule 26), Connecticut pages 52 (Rule 56), 30–31 (discovery and scheduling), 125 (magistrate review), and 100 (planning-report form).
- Compared the complete extracted federal Rule 56 text against both substantive source pages. Checked Connecticut Rule 56's opening requirements, page-spanning paragraph, amendment label, and explicit federal citation.
- Verified four explicit citations in their source passages: local 56 → FRCP 56; local 26 → FRCP 26 and 16; magistrate 72.2 → FRCP 53. These are citation checks by Codex, not independent human editorial approval or applicability determinations.
- Confirmed new FRCP 16.1, decimal local 83.10, grouped reserved ranges, the local 72–73 referral to magistrate rules, abrogated FRCP 74–76 and 84, independent supplemental rule-number namespaces, and separately preserved publisher footnotes.
- Fixed extraction defects exposed during implementation: Connecticut amendment headings consuming rule text, page-number leakage, upper-case line-break hyphenation, and ambiguous top-level Roman-letter anchors. Discretionary line-wrap joining uses a source-bound preservation list.

## Software checks

The test suites cover collection counts and representative text, complex anchors, routes, Boolean/citation search, scope separation, bookmark imports, integrity corruption, interrupted downloads, quota failures, and promotion after complete verification. Desktop Chromium (1440×1000) and mobile Chromium emulation (390×844) cover navigation, source/reverse links, side-by-side comparison, search deep links, history, bookmarks, dark appearance, print styles, unsupported districts, complete offline reading/search, package removal and retained bookmarks.

Axe checks are applied to the home page, the reader with its comparison expanded, the parsed district reader, and dark Settings. Automated checks identified and drove fixes to muted-text contrast, unique landmark labels and keyboard access to scrollable comparison text. Screenshots are generated in ignored `test-results/` for visual inspection. All 22 unit tests and 22 desktop/mobile browser tests passed, including first/last parsed-rule navigation for all 93 added districts, source comparison, bookmarks, and offline district search. Earlier fresh extraction of the original PDFs reproduced all three canonical artifacts byte for byte; line endings are explicitly LF for cross-platform replay.

## Outstanding production gates and limitations

1. Independent line-by-line review of the entire corpus, including every discretionary hyphen, paragraph hierarchy, forms, source footnotes and complex page boundary. TOC reconciliation does not prove every body word is correct. There has been no nationwide or legal currency review.
2. Complete relationship review. Unreviewed mappings are not shown as established links; four explicit citations are a deliberate initial subset.
3. Real-device iOS installation/offline verification; Safari, Firefox, screen-reader and broader assistive-technology testing. Chromium mobile emulation is not iOS verification.
4. Multi-release update/rollback stress testing, real browser quota exhaustion and mid-transfer process termination. Failure injection covers the staging algorithm, but does not replace these platform checks.
5. Stored prior-edition ingestion and an edition browser. Current edition-pinned links work; unavailable historical editions show a clear error. No historical coverage is claimed.
6. A filing-quality form/table renderer. Supporting forms preserve extracted source text; official PDFs remain the filing reference.

`data/review.json` remains `candidate`. The production deployment command rejects this state. A maintainer must record the completed review, its reviewer/date and the exact corpus hash before publication. Routine preview builds remain available.
