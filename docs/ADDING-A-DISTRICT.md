# Adding a district

1. Register the district's identifier, display name and official source/discovery URLs. Keep collection namespaces independent: for example `mad-civil`, `mad-magistrate`, `mad-support`. The generic reader resolves collections by those identifiers, not rule-number equality.
2. Add acquisition registration and implement a source adapter using the shared page-geometry interface. Different publishers need different heading, footnote and table rules. Bind the adapter to reviewed PDF hashes. Record deliberate exclusions and connectivity-only materials.
3. Reconcile all rules and supporting materials against the complete source table of contents. Preserve grouped reserved entries and string numbers. Retain dates only with source wording and page evidence. Keep the original PDFs in the snapshot store.
4. Register canonical collections and the district, then derive navigation/search from canonical provisions. Extend the package registry with a package containing all that district's text, search and relationship metadata.
5. Review explicit citations and topical relationships separately. Every verified relationship needs source evidence, type, reviewer/date and both endpoint editions. Unverified candidates must not appear as established reader links.
6. Mark the district supported in the registry only after its content is ready. The selector, shared-context validation and offline package list derive from that registry. The initial registry deliberately offers only Connecticut and Federal-only mode; do not add empty choices.
7. Add adapter fixtures, source reconciliation checks, relationship checks, district switching/deep-link tests, and complete offline package tests. Run content review and publication gates before deployment.

The reader, related-panel labels, selector validation and offline packages use the district registry. Update the About-page source coverage and initial landing-page descriptive copy when adding material outside the current federal/Connecticut scope.
