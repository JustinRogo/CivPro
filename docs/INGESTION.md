# Ingestion and source maintenance

## Replay

Use Python 3.11.3 with the exact packages in `requirements.txt`. The source adapters use pdfplumber geometry to retain reading order, font differences and original page indices. Neither runtime PDF parsing nor OCR is used. Any source requiring OCR must receive a separate adapter and an explicit uncertainty review.

`python scripts/ingest.py --output candidate/data` re-extracts the committed source snapshots. It checks each digest against both its manifest and `sources/profile.json`, normalizes line wraps, preserves nested labels and separates history/footnotes, then reconciles rule identities to the PDF tables of contents. The output is staged. No approved file is replaced on validation failure.

The federal adapter detects font-weighted rule headings and collection boundaries, including the admiralty/social transition on a shared page. Connecticut has reviewed page boundaries for civil rules, eight civil appendix materials, and magistrate rules. Criminal material is explicitly inventoried and excluded. Those boundaries are bound to the source hashes; new bytes fail before parsing with the old profile.

## Acquisition and offline import

```sh
python scripts/acquire.py --output candidate/sources
python scripts/refresh-report.py
```

For a trusted, offline copy, put the two PDFs in a directory as `federal.pdf` and `ctd.pdf`, then run:

```sh
python scripts/acquire.py --import-dir /path/to/input --output candidate/sources
```

Acquisition records observed/imported bytes, hashes, sizes, official URLs and capture time. Import time is an acquisition timestamp, not evidence of legal currency. Never infer effective dates from filenames or HTTP timestamps.

## Reviewing a changed source

1. Inspect the candidate PDF and discovery report. If the official URL moved, update the source registration after checking the court's discovery page.
2. Compare source contents, edition wording, table of contents and substantive boundaries. Update the hash-bound adapter profile only after examining the changed source. Preserve old snapshots.
3. Ingest into a separate directory and generate a diff:

   ```sh
   python scripts/ingest.py --sources candidate/sources --output candidate/data
   npm run diff -- data candidate/data candidate/corpus-diff
   ```

4. Review wording, numbering, additions/deletions, dates, footnotes, form layout and anchors against the PDF. Corrections belong in source-bound adapter code/profile changes with exact before/after evidence in the review report. Never silently edit only generated JSON.
5. Re-review every relationship touching an altered endpoint. Set links to `needs-review` until their source passages and both editions are verified. Copy unchanged metadata only when still valid.
6. Promote only the explicitly reviewed canonical files and source snapshots. `scripts/prepare-initial.mjs` is a one-time initial-candidate helper, not a refresh command. Re-running it would restore the initial four mappings; do not use it to publish updates.
7. Run schema/content validation, tests, a deterministic replay comparison and browser checks. Complete the publication gate as documented separately.

## Automated review

**Review official source refresh** is manually dispatchable. It captures candidate PDFs and compares their bytes, also checking the Connecticut discovery page for moved links. All reports and snapshots are uploaded as review artifacts. It does not modify `data/`, open messages or publish a release. To enable weekly review, uncomment the `schedule` stanza in `.github/workflows/refresh.yml` after choosing maintainers to inspect its reports. A changed source deliberately requires adapter review before producing canonical text.

## Normalization boundaries

Original PDFs remain the replay authority. Source text is escaped on display. Only discretionary line-end hyphens are removed; reviewed compound breaks are retained by the source-bound `keepHyphens` list. Whitespace is normalized between extracted lines. Paragraph labels and capital headings are preserved; no wording is paraphrased. Some complex forms remain linear text and repeated labels may have disambiguated anchors. Complete editorial validation is outstanding and must check those cases.
