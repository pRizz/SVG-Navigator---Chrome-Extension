# Releasing

Releases to the Chrome Web Store and Firefox Add-ons are published by the
[Release workflow](../.github/workflows/release.yml). Before tagging, go through the
[release checklist](release-checklist.md).

## Cut a release

1. Bump `version` in `src/manifest.json` (both stores reject a version that isn't higher than
   the published one) and push to `master`. The manifest is the only place the version lives;
   `bun run prebuild` copies it into the build info and the Safari app.

1. Tag the commit with `v` plus the exact manifest version and push the tag:

   ```bash
   git tag v3.1.0 && git push origin v3.1.0
   ```

The workflow checks that the tag matches the manifest version, builds the release files, runs
the type check, lint, unit, and UI tests against the exact files it will upload, then submits
them to the Chrome Web Store and Firefox Add-ons. Both stores review a submission before users
get it.

> [!TIP]
> Running the workflow manually (Actions → Release → Run workflow) is a dry run: it builds and
> tests the release files and checks the Chrome Web Store credentials (read-only), without
> publishing.

The Safari app isn't part of the workflow: build it with `bun run build:safari-app` and upload
it to App Store Connect from Xcode (see [development.md](development.md#safari-app)).

## Firefox source review

Firefox requires source code for bundled add-ons, so the workflow uploads `bun run zip:source`'s
archive with each version. Reviewers can rebuild with
`PUPPETEER_SKIP_DOWNLOAD=true bun install && bun run build:firefox` (output in `dist/firefox`);
the README's "Build from source" section, which ships in that archive, says the same.

## One-time credential setup

Add these as repository secrets (Settings → Secrets and variables → Actions) or as secrets of
the `release` environment, which the publish jobs use:

| Secret                    | Where it comes from                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CWS_SERVICE_ACCOUNT_KEY` | In [Google Cloud Console](https://console.cloud.google.com): enable the *Chrome Web Store API*, [create a service account](https://console.cloud.google.com/iam-admin/serviceaccounts) (no roles needed), and create a JSON key for it. Paste the whole JSON file. Then add the service account's email under **Account** in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one service account per publisher). |
| `CWS_PUBLISHER_ID`        | Developer Dashboard → **Publisher** → **Settings**.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `AMO_JWT_ISSUER`          | [AMO API keys page](https://addons.mozilla.org/developers/addon/api/key/): the *JWT issuer*.                                                                                                                                                                                                                                                                                                                                                                |
| `AMO_JWT_SECRET`          | Same page: the *JWT secret*.                                                                                                                                                                                                                                                                                                                                                                                                                                |

With the [GitHub CLI](https://cli.github.com), for example:

```bash
gh secret set CWS_SERVICE_ACCOUNT_KEY < path/to/service-account-key.json
```
