# Deployment and rollback

## Preview now

`npm run check` validates the canonical corpus, runs unit tests and builds `dist/`. `npm run dev` serves it at `http://127.0.0.1:4173/CivPro/`. `npm run test:browser` exercises the built artifact on desktop and mobile Chromium. No hosting credentials are needed for local work.

To change the origin or repository path, set `FCR_SITE_URL` to the final HTTPS URL, with a trailing slash, before building. Set `FCR_BASE_PATH` to its pathname when using the local preview server. Defaults deliberately target `/CivPro/`; the default example origin must be replaced for a public release.

```powershell
$env:FCR_SITE_URL = 'https://YOUR-ORGANIZATION.github.io/CivPro/'
npm run build
npm run dev
```

All runtime links are relative or hash routes. Deploy the contents of `dist/`, including `.nojekyll`. Do not publish the repository root or development snapshots as an application shell.

## Production gate

The supplied brief requires reviewed legal content before production publication. The candidate is runnable, but its complete editorial review has not been performed. `npm run build -- --production` requires `data/review.json` to contain `status: "approved"` and a `corpusSha256` matching the exact bytes of `data/provisions.json`. Record reviewer, date and supporting report; do not set approval merely to bypass the gate. Re-review relationships whenever an endpoint edition changes.

Obtain the digest after completing review:

```sh
node --input-type=module -e "import {readFileSync} from 'node:fs'; import {createHash} from 'node:crypto'; console.log(createHash('sha256').update(readFileSync('data/provisions.json')).digest('hex'))"
```

Update the About-page review status and this report to match the actual completed review before publishing.

## GitHub Pages

1. Push the reviewed repository to the intended GitHub project. This task has not pushed or deployed anything.
2. Configure Settings → Pages → Source: GitHub Actions.
3. Set repository variable `FCR_SITE_URL` to the final HTTPS URL.
4. Run **Publish reviewed release** manually. It validates, tests, builds through the production gate, runs browser checks and deploys the same `dist/` artifact.
5. Verify the deployed non-root URL, shared paragraph links and installed PWA. Run actual iOS checks separately and record device, OS, installation route, offline restart and recovery observations.

For a different base path, also adjust the browser test baseURL and server URL together. The default deployment suite is configured for `/CivPro/`.

## Rollback

Retain each release's source PDFs, canonical JSON, relationship file and tested `dist/` artifact. Never overwrite a published edition package. To roll back, restore the prior reviewed commit and deploy its exact tested artifact. The service worker treats a changed shell fingerprint as an update; readers choose Update & reload. Existing bookmarks and preferences stay in localStorage. If a downloaded package needs repair, use Settings → Update / repair. The previous complete generation survives download/integrity failure.

The initial release stores only one edition per collection. Before publishing a second edition, implement and verify the archived-edition registry described in the architecture gaps; keep old artifacts accessible so existing edition-pinned bookmarks remain resolvable.
