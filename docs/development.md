# Development

Everything for working on SVG Navigator: setup, builds, checks, the Safari app, and the test SVG
generator. Releasing has its own guide, [releasing.md](releasing.md).

- [Setup](#setup)
- [Build](#build)
- [Run with hot reload](#run-with-hot-reload)
- [Checks](#checks)
- [UI tests](#ui-tests)
- [Source layout](#source-layout)
- [Safari app](#safari-app)
- [Store listings and images](#store-listings-and-images)
- [Mandelbrot test SVGs](#mandelbrot-test-svgs)

## Setup

Requirements: Windows, macOS, or Linux, and [Bun](https://bun.sh) 1.4 or later (package manager and
runtime; Node.js is only needed for `start:firefox`).

```bash
curl -fsSL https://bun.sh/install | bash
git clone https://github.com/pRizz/SVG-Navigator---Chrome-Extension.git
cd SVG-Navigator---Chrome-Extension
bun install
```

`bun install` also downloads the Chrome and Firefox builds used by the UI tests. To only build the
extension, skip that download with `PUPPETEER_SKIP_DOWNLOAD=true bun install`.

## Build

For day-to-day work, build unpacked Chrome and Firefox extensions into `.build/`:

```bash
bun run build:dev
```

Load `.build/chrome` from `chrome://extensions` (Developer mode → Load unpacked), or
`.build/firefox` from `about:debugging` → This Firefox → Load Temporary Add-on.

To build the release files:

```bash
bun run build:all
```

| Browser | Unpacked       | Packaged                             |
| ------- | -------------- | ------------------------------------ |
| Chrome  | `dist/chrome`  | `packages/svg-navigator…chrome.zip`  |
| Firefox | `dist/firefox` | `packages/svg-navigator…firefox.xpi` |
| Safari  | `dist/safari`  | `packages/svg-navigator…safari.zip`  |

> [!WARNING]
> Every `bun run build:*` command re-zips into `packages/`, overwriting the release archives there.

## Run with hot reload

```bash
bun run start:chrome
bun run start:firefox
bun run start:safari
```

Each builds the extension and watches for changes. For Firefox, `web-ext run` loads the bundled
build in `.build/firefox`; run `bun run build:dev` after editing `src/` and Firefox reloads the
extension automatically. `start:firefox` needs Node.js on `PATH` as well as Bun:
`scripts/runFirefox.ts` runs web-ext on Node, because under Bun it can't connect to Firefox.

## Checks

```bash
bun run verify
```

`verify` runs everything CI checks except the build and UI tests: the type check, ESLint, the unit
tests, and the Bright Builds checks (`bun scripts/bright-builds-check.ts all`). Each also runs on
its own (`bun run typecheck`, `bun run lint`, `bun run test:unit`).

`bun run typecheck` checks the extension (`tsconfig.json`) and the scripts and tests
(`tsconfig.node.json`). The extension build also reports type errors, but its exit code stays 0,
so `typecheck` is the real gate.

## UI tests

End-to-end tests load the built extension into headless Chrome and Firefox (via
[Puppeteer](https://pptr.dev)) and drive it with real mouse and keyboard input. CI runs them on
every push and pull request.

```bash
bun run test:e2e
```

- Run one browser only: `E2E_BROWSERS=firefox bun run test:e2e`
- Test a specific unpacked build, e.g. a release package before uploading it:
  `E2E_CHROME_EXT=path/to/unzipped-chrome E2E_FIREFOX_EXT=path/to/unzipped-xpi bun test test/e2e`
  (versions up to 2.11 predate the readiness marker the tests wait for, so they always time out)
- Screenshots of failing tests are saved to `test-results/e2e-screenshots/`

## Source layout

The extension is written in TypeScript:

| Path                       | What it is                                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/js/svgNavigator.ts`   | The content script that adds infinite zoom and panning to SVG documents                                                                                     |
| `src/js/viewBox.ts`        | The pure viewBox geometry (parsing, fitting, zooming) the content script uses, unit tested                                                                  |
| `src/js/input/`            | Pointer, wheel, double-click, keyboard, momentum, and text-selection input                                                                                  |
| `src/js/hud/`              | The on-screen controls, minimap, export menu, and debug card, in a shadow root on `<svg-navigator-hud>`; the pure parts are unit tested                     |
| `src/js/export/`           | PNG and SVG export                                                                                                                                          |
| `src/options/`             | The toolbar popup with the settings (`index.html`, `options.ts`, `options.css`)                                                                             |
| `src/shared/settings.ts`   | The settings, their defaults, and their storage in `chrome.storage.sync`                                                                                    |
| `src/shared/shortcuts.ts`  | The shortcut list shown in the HUD's `?` popover and the popup                                                                                              |
| `src/shared/provenance.ts` | The version, commit, and build time shown in the popup footer; `bun run prebuild` generates them into `src/js/buildInfo.ts`, linking CI builds to their run |
| `scripts/`                 | Build helpers, the App Store and README image generators, and the Mandelbrot generator                                                                      |
| `test/unit/`, `test/e2e/`  | Unit tests and Puppeteer UI tests                                                                                                                           |
| `safari/`                  | The Xcode project for the Safari app                                                                                                                        |

`webextension-toolbox` compiles each `.ts` file in `src/` to a `.js` file of the same name.
Bun runs everything else directly, TypeScript included: the scripts in `scripts/`, the tests
(`bun test`, which runs the `node:test` suites), and the build tools themselves, because
`bunfig.toml` makes `bun run` use Bun even for tools whose shebang asks for Node.

## Safari app

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

> [!IMPORTANT]
> Keep the project's development team signing: an ad-hoc signed build doesn't show up in
> Safari's extension list, even with "Allow unsigned extensions" on.

## Store listings and images

[`store/app-store/listing.md`](../store/app-store/listing.md) holds the Mac App Store text
(description, keywords, review notes, privacy answers); a unit test checks it against App Store
Connect's length limits. The privacy policy is [PRIVACY.md](../PRIVACY.md). The Chrome Web Store
and Firefox Add-ons descriptions are in [`store/web-stores.md`](../store/web-stores.md).

The screenshots in `store/app-store/screenshots/` are generated:

```bash
bun run screenshots:app-store
```

This drives the built extension in Puppeteer's Chrome with real mouse input on `examples/` SVGs
and frames each capture in a Safari-style window at 2880×1800. Every input is fixed, so a rerun
on the same Mac produces byte-identical files and `git status` only shows screenshots whose
content really changed. Edit the scenes in `scripts/appStoreScreenshots.ts` and the frame in
`scripts/appStoreScreenshotFrame.html`.

The README's main image, `docs/images/readme-hero.png`, comes from the same pipeline in a
browser-neutral window, so it doesn't favor one browser:

```bash
bun run screenshots:readme
```

Edit it in `scripts/readmeHero.ts` and `scripts/readmeHeroFrame.html`; the capture steps both
generators share are in `scripts/screenshotCapture.ts`.

## Mandelbrot test SVGs

For a heavy, endlessly zoomable drawing to try the extension on, generate the Mandelbrot set:

```bash
bun run mandelbrot:gallery
```

This writes one SVG per preset (`full`, `seahorse`, `elephant`, `spiral`, `minibrot`) to the
gitignored `generated/mandelbrot/` and prints each file's `file://` URL to open in the browser.
`bun run mandelbrot` renders a single image and takes options for the view, detail, and colors:

```bash
bun run mandelbrot --preset seahorse --width 1800 --height 1200 --palette fire
```

`bun run mandelbrot --help` lists them all; a center with a negative part needs the `=` form, as
in `--center=-0.75,0.1`.

**Pixels (default).** Each pixel of the `--width`×`--height` grid becomes part of a rectangle in
one `<path>` per color band, so a larger grid adds detail (and file size) without adding
elements. `--resolution <n>` multiplies the sample count by `n` (each side by √n) and names the
file `<name>-<n>x.svg`; `bun run mandelbrot:gallery:hires` renders every preset at 10× and 100×.
At 100× the files run from 37 MB (`full`) to 320 MB (`spiral`): Chrome takes about a minute to
open the largest, and Firefox about 20 seconds.

**Curves.** `--style curves` draws the bands as smooth ribbons instead of pixels, so they stay
smooth however far you zoom; `bun run mandelbrot:gallery:curves` renders every preset that way,
to `<name>-curves.svg`, and `bun run mandelbrot:gallery:curves:hires` at 10× and 100× (about five
minutes, up to 13 GB of memory, and files up to 860 MB, which Chrome can't open in five minutes).
Marching squares traces each band's edges through the sampled escape times, and each band
becomes one filled path of quadratic curves. Right at the set's edge, where the escape time
climbs too steeply for that, the climb is capped: `--curve-detail <n>` (default 4) allows `n`
band edges between neighboring samples, so a higher value keeps more of the filaments and makes
a larger file.

The generator lives in `scripts/mandelbrot.ts` (pixels), `scripts/mandelbrotCurves.ts`
(curves), `scripts/mandelbrotSvg.ts`, and `scripts/mandelbrotOptions.ts`.
