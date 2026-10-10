# Release checklist

Run this before pushing a `vX.Y.Z` tag. The automated suites cover most behavior. This checklist covers what they can't:
- real input devices;
- full screen;
- the clipboard in Firefox;
- Safari, which has no UI tests.

## 1. Automated checks

```bash
bun run verify && bun run test:e2e
```

Then run a dry run of the release pipeline: on GitHub, go to Actions → Release → Run workflow on `master`. It builds and tests the exact release files without publishing anything.

## 2. Load the build in each browser

- **Chrome:**
  1. Run `bun run build:dev`.
  2. Open `chrome://extensions`, turn on Developer mode, and choose Load unpacked → `.build/chrome`.
  3. Disable the store copy first.
  4. Turn on "Allow access to file URLs" if you want to test local files.
- **Firefox:** run `bun run start:firefox`. It needs Node.js on `PATH`; see `scripts/runFirefox.ts`.
- **Safari:**
  1. Run `bun run build:safari-app` (team-signed).
  2. Copy `.build/safari-app/Build/Products/Release/SVG Navigator.app` to `~/Applications` and open it once.
  3. Unregister the build-folder copy with `lsregister -u`, so Safari doesn't list the extension twice.
  4. Enable it in Safari → Settings → Extensions, and choose "Always Allow on Every Website".

In each browser, the popup footer should name the version and commit you're testing.

## 3. Manual pass (about 10 minutes per browser)

Test on [the Wikimedia world map](https://upload.wikimedia.org/wikipedia/commons/1/17/World.svg), on a local file from `examples/` (Chrome and Firefox only), and on an ordinary website.

- [ ] **Pill:** shows `100%`. Scrolling zooms and the readout follows; − and + work; clicking the readout resets.
- [ ] **Pan:** drag pans, Space + move pans, and Shift + drag pans.
- [ ] **Keyboard:** Esc resets, Ctrl `=` / `−` / `0` work, and tapping Alt (Option on macOS) zooms out.
- [ ] **Auto-hide:** the HUD fades after 2 s idle; any movement brings it back; hovering keeps it shown.
- [ ] **Background:** the button cycles checkerboard → dark → saved color.
- [ ] **Shortcuts (`?`):** the list matches the drag setting. Esc closes it without resetting the view; an outside click closes it.
- [ ] **Full screen:** enter and exit, and the icon flips. Note whether Esc in full screen also resets the view.
- [ ] **Settings:** with an SVG open, moving the position moves the pill live (upright on side edges). Toggling the controls and auto-hide applies live.
- [ ] **Debug overlay:** the card updates as you move. Copy works (paste it somewhere). Minimize and expand work.
- [ ] **Dark mode:** switching the OS theme switches the HUD, card, and popover.
- [ ] **Ordinary website:** no HUD appears and the page's styling is unchanged.
- [ ] **Anything new in this release:** its issue's acceptance criteria, checked by hand.

## 4. Release

1. Bump `version` in `src/manifest.json` and push.
2. Tag the release:
   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```
   The workflow re-tests and submits to the Chrome Web Store and Firefox Add-ons.
3. Update the store descriptions from `store/web-stores.md` if user-visible features changed. Chrome's dashboard has to be edited by hand.
4. **Safari:** archive and upload with `xcodebuild archive` and then `xcodebuild -exportArchive`, using an ExportOptions plist with method `app-store-connect`, destination `upload`, and team `2QYZ88DN8A`. Then, in App Store Connect:
   1. Attach the build to a new version.
   2. Upload `store/app-store/screenshots/` if it changed.
   3. Submit for review.
5. Once each store approves, install the store version and spot-check the pill and the settings.
