<!-- bright-builds-rules-readme-badges:begin -->

<!-- Managed upstream by bright-builds-rules. If this badge block needs a fix, open an upstream PR or issue instead of editing the downstream managed block. Keep repo-local README content outside this managed badge block. -->

[![GitHub Stars](https://img.shields.io/github/stars/pRizz/SVG-Navigator---Chrome-Extension)](https://github.com/pRizz/SVG-Navigator---Chrome-Extension)
[![CI](https://img.shields.io/github/actions/workflow/status/pRizz/SVG-Navigator---Chrome-Extension/ci.yml?style=flat-square&logo=github&label=CI)](https://github.com/pRizz/SVG-Navigator---Chrome-Extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/pRizz/SVG-Navigator---Chrome-Extension?style=flat-square)](./LICENSE.txt)
[![TypeScript 6.0.3](https://img.shields.io/badge/TypeScript-6.0.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bright Builds: Rules](https://raw.githubusercontent.com/bright-builds-llc/bright-builds-rules/main/public/badges/bright-builds-rules-flat.svg)](https://github.com/bright-builds-llc/bright-builds-rules)
[![OpenLinks profile](https://img.shields.io/badge/OpenLinks-profile-0F172A)](https://openlinks.us/)

<!-- bright-builds-rules-readme-badges:end -->

SVG Navigator
====================

[![GitHub Stars](https://img.shields.io/github/stars/pRizz/SVG-Navigator---Chrome-Extension)](https://github.com/pRizz/SVG-Navigator---Chrome-Extension)

Description
--------------------------------
SVG Navigator is a browser extension that adds infinite zoom and panning to existing SVG files on the web.

Note
--------------------------------
In Chrome, you can access file URLs by going to the extension settings and checking "Allow access to file URLs".
Safari doesn't run extensions on file URLs.

In Safari, allow SVG Navigator on every website (click its toolbar icon and choose "Always Allow on Every Website")
so it can run on the SVG files you open.

Usage
--------------------------------
Go to a website with an SVG file. The extension begins working on the SVG graphic and you may:
* Pan: click and drag or hold the space bar and drag the cursor to pan around the image
* Zoom in infinitely, or back out: use the mouse scroll wheel
* Zoom: click and drag a zoom box of the desired area if enabled
* Zoom out: tap alt key
* Reset zoom: press escape

SVGs are vector graphics, so they stay sharp however far you zoom in. SVG Navigator has no zoom
limit; only the browser's numeric precision stops it, many millions of times in.
Trying to pan on an SVG by shift click and dragging currently causes undesirable panning; possibly a Google Chrome bug/feature.
If you want to view local files with this extension, you must enable "Allow access to file URLs" in Chrome's Extensions view.

Try Testing Out These SVGs
---------------------------------
* Vector vs Raster: http://upload.wikimedia.org/wikipedia/commons/6/6b/Bitmap_VS_SVG.svg
* World Map: http://upload.wikimedia.org/wikipedia/commons/1/17/World.svg
* Map of the United States of America: http://upload.wikimedia.org/wikipedia/commons/d/dc/USA_orthographic.svg
* Constellation Orion: http://upload.wikimedia.org/wikipedia/commons/f/ff/Orion_IAU.svg
* Bertrand's Chords: http://upload.wikimedia.org/wikipedia/commons/9/91/Bertrand3-chords.svg
* P and N type Silicon: http://upload.wikimedia.org/wikipedia/commons/2/20/CellStructure-SiCrystal-eng-vect.svg
* Diagram of Zeta Potential and Slipping Plane: http://upload.wikimedia.org/wikipedia/commons/6/62/Diagram_of_zeta_potential_and_slipping_plane.svg
* Earth Color Trace: http://upload.wikimedia.org/wikipedia/commons/4/4e/Earth_Color_Trace.svg
* Magnetic Moment: http://upload.wikimedia.org/wikipedia/commons/4/4c/Magnetic_moment.svg
* Simple Mandelbrot: http://upload.wikimedia.org/wikipedia/commons/3/3c/Mandelbrot_Components.svg
* Animated Digitial Clock: http://www.bogotobogo.com/svg_source/SVGDigitalClock.svg

No `svg` extension pages (e.g. GitHub and PlantUML)

* https://img.plantuml.biz/plantuml/svg/SoWkIImgAStDuNBAJrBGjLDmpCbCJbMmKiX8pSd9vt98pKi1IW80

Useful Links
------------------------------
* SVG 1.1 Second Edition Specifications: http://www.w3.org/TR/SVG11/
* Official Google Chrome extension page: https://chrome.google.com/webstore/detail/svg-navigator/pefngfjmidahdaahgehodmfodhhhofkl
* Github Repository: https://github.com/pRizz/SVG-Navigator---Chrome-Extension

Extension Store Links
------------------------------
* Chrome Web Store: https://chromewebstore.google.com/detail/svg-navigator/pefngfjmidahdaahgehodmfodhhhofkl
* Firefox Add-ons: https://addons.mozilla.org/en-US/firefox/addon/svg-navigator/

Acknowledgements
-----------------------------
Concept originally created by Asad Akram, Ryan Oblenida aka Mr. O, and Peter Ryszkiewicz at the Illinois Institute of Technology.
Adapted as a Google Chrome extension by Peter Ryszkiewicz. Work was inspired by Kevin Lindsey at http://www.kevlindev.com/index.htm.
Illustrations by Cara Stemo.

Build Instructions
--------------------------------
### Requirements
- Operating System: Windows, macOS, or Linux
- [Bun](https://bun.sh) 1.4 or later (package manager and runtime; Node.js is not needed)

### Installation
1. Install Bun (see [bun.sh](https://bun.sh) for other options):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
2. Clone the repository:
   ```bash
   git clone https://github.com/pRizz/SVG-Navigator---Chrome-Extension.git
   cd SVG-Navigator---Chrome-Extension
   ```
3. Install dependencies:
    ```bash
    bun install
    ```

   This also downloads the Chrome and Firefox builds used by the UI tests. To only build the
   extension, skip that download with `PUPPETEER_SKIP_DOWNLOAD=true bun install`.

### Building

1. Build the extension:
   ```bash
   bun run build:all
   ```

The built extensions will be available in:
- Chrome: `dist/chrome/`
- Firefox: `dist/firefox/`
- Safari: `dist/safari/`

The packaged extensions will be available in:
- Chrome: `packages/svg-navigator...chrome.zip`
- Firefox: `packages/svg-navigator...firefox.xpi`
- Safari: `packages/svg-navigator...safari.zip`

### Safari app

Safari extensions ship inside a macOS app. Its Xcode project is in `safari/` and needs Xcode and
an Apple Developer account signed in under Xcode → Settings → Accounts.

```bash
bun run build:safari-app
```

This builds `dist/safari` and then the app. The Xcode project's "Web Extension" group references
the top-level entries of `dist/safari` rather than copies of them, so a new top-level file or
folder in `src/` has to be added to that group (a unit test checks this). The app's version
comes from `src/manifest.json` through `safari/Version.xcconfig`, which every build generates.
To build from Xcode instead, run `bun run build:safari` first.

To try it in Safari, copy the built `.build/safari-app/Build/Products/Release/SVG Navigator.app`
to `~/Applications`, open it once, then enable SVG Navigator in Safari → Settings → Extensions.
Keep the project's development team signing: an ad-hoc signed build didn't show up in Safari's
extension list, even with "Allow unsigned extensions" on.

### App Store listing

`store/app-store/listing.md` holds the Mac App Store text (description, keywords, review
notes, privacy answers); a unit test checks it against App Store Connect's length limits.
The privacy policy is [PRIVACY.md](PRIVACY.md).

The screenshots in `store/app-store/screenshots/` are generated:

```bash
bun run screenshots:app-store
```

This drives the built extension in Puppeteer's Chrome with real mouse input on
`examples/` SVGs and frames each capture in a Safari-style window at 2880×1800. Every
input is fixed, so a rerun on the same Mac produces byte-identical files and `git status`
only shows screenshots whose content really changed. Edit the scenes in
`scripts/appStoreScreenshots.ts`.

### Development

For development with hot-reload:

- Chrome:
  ```bash
  bun run start:chrome
  ```

- Firefox:
  ```bash
  bun run start:firefox
  ```

- Safari:
  ```bash
  bun run start:safari
  ```

These commands will build the extension and start a development server that watches for changes.
For Firefox, `web-ext run` loads the bundled build in `.build/firefox`; run `bun run build:dev` after
editing `src/` and Firefox reloads the extension automatically.

### Source layout

The extension is written in TypeScript:

- `src/js/svgNavigator.ts`: the content script that adds infinite zoom and panning to SVG documents
- `src/js/viewBox.ts`: the pure viewBox geometry (parsing, fitting, zooming) the content script uses, unit tested
- `src/js/toolbar.ts`: the floating +, -, and Reset toolbar
- `src/options/`: the toolbar popup with the settings (`index.html`, `options.ts`, `options.css`)
- `src/shared/settings.ts`: the settings, their defaults, and their storage in `chrome.storage.sync`
- `src/shared/provenance.ts`: the version, commit, and build time shown in the popup footer; `bun run prebuild`
  generates them into `src/js/buildInfo.ts`, linking the build time to its CI run when built in GitHub Actions

`webextension-toolbox` compiles each `.ts` file in `src/` to a `.js` file of the same name.
Bun runs everything else directly, TypeScript included: the scripts in `scripts/`, the tests
(`bun test`, which runs the `node:test` suites), and the build tools themselves, because
`bunfig.toml` makes `bun run` use Bun even for tools whose shebang asks for Node.

### Type Checking and Linting

```bash
bun run typecheck
bun run lint
```

`bun run typecheck` checks the extension (`tsconfig.json`) and the scripts and tests
(`tsconfig.node.json`). The extension build also reports type errors, but its exit code stays 0,
so run `bun run typecheck` to catch them.

### UI Tests

End-to-end tests load the built extension into headless Chrome and Firefox (via
[Puppeteer](https://pptr.dev)) and drive it with real mouse and keyboard input. `bun install`
downloads both test browsers.

```bash
bun run test:e2e
```

- Run one browser only: `E2E_BROWSERS=firefox bun run test:e2e`
- Test a specific unpacked build, e.g. a release package before uploading it:
  `E2E_CHROME_EXT=path/to/unzipped-chrome E2E_FIREFOX_EXT=path/to/unzipped-xpi bun test test/e2e`
  (versions up to 2.11 predate the readiness marker the tests wait for, so they always time out)
- Screenshots of failing tests are saved to `test-results/e2e-screenshots/`

CI runs these tests on every push and pull request.

### Releasing

Releases are published by the [Release workflow](.github/workflows/release.yml):

1. Bump `version` in `src/manifest.json` (both stores reject a version that isn't higher
   than the published one) and push to `master`.
2. Tag the commit and push the tag:
   ```bash
   git tag v2.12 && git push origin v2.12
   ```

The workflow checks that the tag matches the manifest version, builds the release files, runs
the type check, lint, unit, and UI tests against the exact files it will upload, then submits them to the
Chrome Web Store and Firefox Add-ons. Both stores review a submission before users get it.
Running the workflow manually (Actions → Release → Run workflow) is a dry run that builds and
tests the release files and checks the Chrome Web Store credentials (read-only), without
publishing.

#### One-time credential setup

Add these as repository secrets (Settings → Secrets and variables → Actions) or as secrets of
the `release` environment, which the publish jobs use:

| Secret | Where it comes from |
|---|---|
| `CWS_SERVICE_ACCOUNT_KEY` | In [Google Cloud Console](https://console.cloud.google.com): enable the *Chrome Web Store API*, [create a service account](https://console.cloud.google.com/iam-admin/serviceaccounts) (no roles needed), and create a JSON key for it. Paste the whole JSON file. Then add the service account's email under **Account** in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one service account per publisher). |
| `CWS_PUBLISHER_ID` | Developer Dashboard → **Publisher** → **Settings**. |
| `AMO_JWT_ISSUER` | [AMO API keys page](https://addons.mozilla.org/developers/addon/api/key/): the *JWT issuer*. |
| `AMO_JWT_SECRET` | Same page: the *JWT secret*. |

With the [GitHub CLI](https://cli.github.com), for example:
```bash
gh secret set CWS_SERVICE_ACCOUNT_KEY < path/to/service-account-key.json
```

Firefox requires source code for bundled add-ons, so the workflow uploads `bun run zip:source`'s
archive with each version. Reviewers can rebuild with
`PUPPETEER_SKIP_DOWNLOAD=true bun install && bun run build:firefox` (output in `dist/firefox`).
