# HUD modernization design

Date: 2026-10-07
Status: approved, awaiting implementation plan

## Goal

Replace the floating `+` / `-` / `Reset` toolbar and the debug overlay with a modern
HUD that matches the options popup's design, adds the most-expected viewer controls,
and can be placed anywhere along the edges of the window.

## Current state

- `src/js/toolbar.ts` builds three `div` "buttons" (`+`, `-`, `Reset`) bottom-right.
  `src/css/svgNavigator.css` styles them in Consolas at `xx-large`. There are no icons,
  no dark mode, no tooltips, no keyboard focus or ARIA, and no zoom readout. With
  auto-hide on, the toolbar fades after 5s and reappears only when its own spot is
  hovered.
- `maybePrintDebugInfo` in `src/js/svgNavigator.ts` draws a black, inline-styled box
  top-left with 12 lines of raw viewBox floats.
- `src/manifest.json` injects `css/svgNavigator.css` into every matched page, not
  just SVGs. Any website using `.toolbar`, `.toolbarbutton` and similar classes
  already picks up our styles. Going the other way, an SVG's own `<style>` can restyle
  the toolbar once the SVG is wrapped in HTML.

## Decisions

| Topic | Decision |
|---|---|
| Scope | Visual refresh, new controls, debug overlay redesign |
| Controls | Zoom out, zoom % readout (click resets), zoom in, background cycle, fullscreen, shortcuts help |
| Default layout | One pill, bottom-right |
| Positions | Configurable: 8 spots (4 corners, 4 edge centres) |
| Auto-hide | Wake on activity: fade after 2s idle, any activity brings it back |
| Background button | Temporary per-tab cycle; the saved setting stays the lasting default |
| Debug overlay | Restyled HUD card with View, Pointer, Document, Input, Environment and Build sections; Copy and minimize-to-chip |
| Style isolation | Shadow DOM; manifest `css` entry removed |

## 1. Settings

In `src/shared/settings.ts`:

- Keep the keys `toolbarEnabled` and `toolbarAutoHide`, so stored preferences carry
  over (renaming would silently reset users). `toolbarAutoHide` takes on the
  wake-on-activity meaning described in section 3.
- Add `toolbarPosition`:
  ```ts
  export type ToolbarPosition =
      | 'top-left' | 'top' | 'top-right'
      | 'left' | 'right'
      | 'bottom-left' | 'bottom' | 'bottom-right';
  ```
  It defaults to `'bottom-right'`. Its validator accepts exactly these eight strings,
  and anything else falls back to the default.

In the options popup (`src/options/`):

- Add a "Position" row to the toolbar settings card. The picker is a 3×3 grid drawn
  as a tiny screen, with the centre cell empty. It's a radio group, so arrow keys move
  the selection and each cell has an accessible name ("Top left", "Bottom", and so on).
- It's disabled when `toolbarEnabled` is off, matching how the auto-hide toggle
  behaves today.

## 2. Module layout

`src/js/toolbar.ts` is removed. The HUD lives in `src/js/hud/`:

| File | Kind | Responsibility |
|---|---|---|
| `layout.ts` | pure | `ToolbarPosition` → anchor edges, orientation (`horizontal` on top/bottom rows, `vertical` for `left`/`right`), the direction the shortcuts popover opens (toward the window interior), and the debug-card corner |
| `zoomLabel.ts` | pure | Zoom ratio → label. Below 10 000% it shows a whole-number percent (`340%`; below 1% use up to 2 significant figures, e.g. `0.5%`). At 10 000% and above it uses compact notation (`12K%`, `3.4M%`). |
| `backgroundCycle.ts` | pure | Next background state: `saved` → `checkerboard` → `dark` → `saved` |
| `visibility.ts` | pure | Visibility state model (section 3) |
| `styles.ts` | data | Shadow-root CSS as a string: tokens, light/dark, reduced motion |
| `icons.ts` | data | Inline SVG path data for the HUD icons (no icon font) |
| `hud.ts` | shell | Creates the shadow host and pill, wires buttons and listeners, runs the idle timer |
| `debugInfo.ts` | pure | `DebugInfo` type, row formatting and rounding, `describeElement`, `describeBrowser`, plain-text copy format |
| `debugCard.ts` | shell | Renders `DebugInfo` as the debug card, handles copy and minimize; moved out of `svgNavigator.ts` |

`svgNavigator.ts` uses the HUD through one interface:

```ts
interface HudHandle {
    setZoom(ratio: number): void;
    setToolbarEnabled(enabled: boolean): void;
    setPosition(position: ToolbarPosition): void;
    setAutoHide(autoHide: boolean): void;
    setSavedBackground(color: string): void;
    setDebugInfo(maybeInfo: DebugInfo | null): void; // null removes the card
    destroy(): void;
}

function mountHud(htmlDoc: Document, options: {
    actions: { zoomIn(): void; zoomOut(): void; reset(): void };
    clickAndDragBehavior: ClickAndDragBehavior; // for the shortcuts list
    toolbarEnabled: boolean;
    position: ToolbarPosition;
    autoHide: boolean;
    savedBackground: string;
}): HudHandle;
```

The pure modules are unit-tested. The CSS lives in a TS string so the build needs no
CSS loader and there is no flash of unstyled content from an async `<link>`.

Following the AGENTS.md rule, every element is created from the wrapper `htmlDoc`,
never `document.createElement`.

## 3. HUD component and behaviour

### Structure

- There's one shadow host, `<div data-svg-navigator-hud>`, appended to `body`, with an
  **open** shadow root (open so e2e tests can pierce it).
- The host style is `position: fixed; inset: 0; pointer-events: none;
  z-index: 2147483647`. Only the pill, the popover, the debug card header and the
  debug chip set `pointer-events: auto`.
- `pointerdown`, `mousedown`, `mouseup`, `click` and `wheel` events that start inside
  the HUD are stopped at the host. Clicking a button never starts a pan or zoom box,
  and scrolling over the pill never zooms.

### Pill

Horizontal order: `[−] [340%] [+] │ [background] [fullscreen] [?]`.
Vertical order (left/right positions): `[+] [340%] [−] ─ [background] [fullscreen] [?]`.

- Every control is a `<button type="button">` with an `aria-label` and a `title` that
  includes its shortcut:
  - "Zoom out (Ctrl −)"
  - "Reset to 100% (Esc)"
  - "Zoom in (Ctrl +)"
  - "Background: checkerboard" (names the *next* state)
  - "Enter full screen" / "Exit full screen"
  - "Keyboard and mouse shortcuts"
- The % readout uses `font-variant-numeric: tabular-nums` and a fixed minimum width,
  so the pill doesn't change size while zooming.
- The pill sits 16px from its edges, plus `env(safe-area-inset-*)`. Hit targets are
  32px, icons are 18px strokes, and the font is `system-ui`.

### Look

- It reuses the options popup's tokens (`src/options/options.css`): card surface,
  hairline border, text and muted colours, and accent `#1a73e8` for the
  `:focus-visible` ring. Light and dark follow `prefers-color-scheme`.
- A soft two-layer shadow separates the pill from any SVG colour behind it.
- There is no gradient, blur or glow.

### Shortcuts popover

- `?` toggles a popover that opens toward the window interior (from `layout.ts`).
- It lists the real bindings in `svgNavigator.ts`:
  - Scroll: zoom
  - Drag: pan, or draw a zoom box (whichever `clickAndDragBehavior` says)
  - Hold Space and move: pan
  - Tap Alt (shown as "Option" on macOS): zoom out
  - Ctrl + / Ctrl −: zoom in / out
  - Esc or Ctrl 0: reset
- It closes on Esc, on a click outside it, or on a second click on `?`.

### Keyboard isolation

The navigator's `keydown`/`keyup` listeners are on `document`. Without a guard,
pressing Space on a focused HUD button would both activate the button and start a
spacebar pan, and Esc in the popover would also reset the view. Each of these
handlers must return early when `event.composedPath()` includes the HUD host.

### Visibility (wake on activity)

`visibility.ts` is a pure model:

- Inputs:
  - `activity`, from `mousemove`, `wheel` or `keydown` anywhere on the page
  - `pointerEnter` / `pointerLeave` on the HUD
  - `focusIn` / `focusOut` within the HUD
  - `popoverOpen` / `popoverClose`
  - `idleElapsed`
  - `autoHideChanged`
- Output: `visible: boolean`.
- Rules:
  - The HUD is visible on mount and after any activity.
  - It hides when 2s pass with no activity, but only while auto-hide is on and nothing
    pins it. Pointer over the HUD, focus inside it, and an open popover each pin it.
  - With auto-hide off, it's always visible.
- `hud.ts` owns the single `setTimeout` and resets it on activity.
- Hidden means `opacity: 0` with a fade of about 200ms, plus `pointer-events: none`,
  so nothing invisible is clickable. `prefers-reduced-motion: reduce` removes the
  transition.

### Zoom readout

- `setViewBox()` already runs after every view change. It now calls
  `hud.setZoom(displayedZoom(...))`. The window `resize` handler also calls it.
- Add a pure `displayedZoom(original, current, aspect)` to `src/js/viewBox.ts`:
  `fitToAspectRatio(original, aspect).width / fitToAspectRatio(current, aspect).width`.
  This compares the views as displayed, because a zoom box can have any aspect ratio
  and the browser letterboxes it.
- Clicking the % runs the same reset as Esc (`resetViewBox`).

### Background cycle

- State is per tab, starting at `saved`, and is applied to `body`:
  - `saved`: `settings.svgBackgroundColor`
  - `checkerboard`: a CSS `conic-gradient` checkerboard, 16px squares, light/dark
    neutral greys
  - `dark`: `#1b1c1e`, the options popup's dark page colour
- If `svgBackgroundColor` changes in settings while the tab is mid-cycle, the cycle
  resets to `saved` and applies the new colour.

### Fullscreen

- The button toggles `document.documentElement.requestFullscreen()` /
  `document.exitFullscreen()`. The icon and label track `fullscreenchange`.
- When `document.fullscreenEnabled` is false (for example, the SVG is in an iframe),
  the button isn't rendered.

### Live settings

`svgNavigator.ts`'s `storage.onChanged` handling grows to cover:

- `toolbarEnabled`: `setToolbarEnabled`, which adds or removes the pill. The shadow
  host itself stays mounted for the page's lifetime so the debug card works on its
  own; see section 4. `destroy()` exists for tests and teardown only.
- `toolbarAutoHide`: `setAutoHide`
- `toolbarPosition`: `setPosition`, which re-anchors the pill, flips its orientation
  and moves the debug card
- `svgBackgroundColor`: `setSavedBackground` (replaces today's direct
  `applyBackgroundColor` call)

## 4. Debug card

- The debug card mounts in the HUD's shadow root and shares its surface, border,
  shadow and theme. If `toolbarEnabled` is off but `showDebugInfo` is on, the shadow
  host is still created and holds only the debug card.
- **Placement:** top-left, unless `toolbarPosition` is `top-left`, `top` or `left`, in
  which case it goes top-right. `layout.ts` owns this rule.
### Content

The card is a compact two-column grid (name, value) at 12px, grouped into sections.
Values are in `--font-mono` and names in the UI font. Numbers are rounded to 4
significant figures unless noted otherwise.

| Section | Rows | Updates |
|---|---|---|
| **View** | viewBox x, y, width, height; zoom (`zoomLabel`) | every `setViewBox()` |
| **Pointer** | client x, y (px); SVG x, y (user units under the pointer, via `clientToSvgPoint` against the root `<svg>`); element under pointer | `mousemove` |
| **Document** | original viewBox, labelled "authored" or "derived from size" when the SVG had no usable `viewBox`; authored `width`, `height` and `preserveAspectRatio` ("none" when absent); element count | once, at startup |
| **Input** | interaction state (`idle`, `panReady`, `panning`, `zoomBox`); last wheel `deltaY` and `deltaMode` (`pixel` / `line` / `page`); drag mode, scroll sensitivity, invert scroll | interaction changes, `wheel`, settings changes |
| **Environment** | browser and version; `devicePixelRatio`; window size (px) | startup, `resize` |
| **Build** | version, short commit (or "unavailable"), build time | once |

This replaces the `CurrentVBW/InitVBW` and `CurrentVBH/InitVBH` lines; the zoom row
carries the same information in a readable form.

Details:

- **Element under the pointer:** `document.elementFromPoint`, formatted by a pure
  `describeElement` as `tag#id.class1.class2` and truncated to 48 characters with an
  ellipsis. The HUD host is `pointer-events: none`, so it never reports itself. The
  zoom rectangle is skipped, so the element beneath it is reported instead.
- **Authored document facts** must be captured at the top of startup, *before*
  `svgNavigator.ts` strips `style` sizes, removes `preserveAspectRatio`, overwrites
  `width`/`height` with `100%` and inserts the zoom rectangle. The element count is
  `querySelectorAll('*').length` on the root `<svg>`, taken at the same moment, so it
  excludes the zoom rectangle.
- **Browser and version:** a pure `describeBrowser(userAgent, maybeBrands)` uses
  `navigator.userAgentData.brands` when present (Chromium). Otherwise it parses the
  user agent for Firefox, Safari, Edge and Chrome, falling back to "Unknown".
- **Interaction state** comes from the existing `interaction` tagged union, so it adds
  no new state.
- **The debug card only reads.** `svgNavigator.ts` builds a `DebugInfo` snapshot,
  and the card renders it. Formatting (rounding, labels, the copy text) lives in a
  pure `debugInfo.ts` so it can be unit-tested.

### Header actions

- **Copy:** copies every section as plain text, with one `Section` heading line
  followed by `Name: value` lines, and a blank line between sections. It's ready to
  paste into a GitHub issue. It uses `navigator.clipboard.writeText`. On success the
  icon becomes a check with the label "Copied" for about 1.5s. On failure (clipboard
  unavailable or permission denied) the label reads "Couldn't copy" for the same time,
  and the error is logged with `console.warn`.
- **Minimize:** collapses the card to a "Debug" chip in the same corner. Clicking the
  chip expands it. The state is per tab and starts expanded, and the setting stays on.

### Pointer behaviour

- The card body is `pointer-events: none`, so it never blocks panning. Only the header
  buttons and the chip accept clicks.
- Turning `showDebugInfo` off removes the card and its `mousemove` and `wheel`
  debug listeners, as today.

## 5. Manifest and stylesheet

- Remove `"css": ["css/svgNavigator.css"]` from `src/manifest.json` and delete
  `src/css/svgNavigator.css`.
- If the zoom box or other non-HUD styling depends on that file, move those rules
  into the shadow CSS or inline SVG attributes. (Today the file holds only toolbar
  rules.)

## 6. Testing

### Unit (`bun test`, Arrange/Act/Assert, one concern per test)

- `layout.ts`: for each of the 8 positions, the anchor edges, orientation, popover
  direction and debug corner
- `zoomLabel.ts`: `100%`, `340%`, `25%`, `0.5%`, the 10 000% compact threshold,
  `12K%`, `3.4M%`
- `backgroundCycle.ts`: cycle order, and the reset to `saved`
- `visibility.ts`: idle hides; hover, focus and the open popover each pin it;
  auto-hide off pins it; activity wakes it
- `viewBox.ts`: `displayedZoom` for a plain zoom and for a zoom box whose aspect
  differs from the window
- `settings.ts`: `toolbarPosition` default, valid values, invalid-value fallback
- `debugInfo.ts`:
  - 4-significant-figure rounding
  - `describeElement` with and without id or classes, plus truncation
  - `describeBrowser` for Chromium brands and for Firefox, Safari, Edge, Chrome and
    unknown user agents
  - the `deltaMode` names
  - the plain-text copy format

### E2E (Chrome and Firefox, `bun run test:e2e`)

- **Spike first:** confirm Puppeteer's `>>>` shadow-piercing selectors work under
  Firefox WebDriver BiDi. If they don't, add a `host.shadowRoot.querySelector` helper
  to `test/e2e/harness.ts` and comment the workaround next to the other BiDi notes.
- Port the existing toolbar tests:
  - The HUD is present.
  - + zooms in.
  - Reset (now the % button) restores the original view.
  - `toolbarEnabled: false` means no pill in the shadow root.
- New navigator tests:
  - The % readout changes after zooming.
  - Space with a HUD button focused doesn't pan.
  - Wheel over the pill doesn't change the viewBox.
  - Changing `toolbarPosition` moves the pill live, and it's vertical for `left` and
    `right`.
  - With auto-hide on, the HUD hides after idle and a `mousemove` wakes it.
  - The debug card minimizes to a chip and expands again.
  - The debug card's Document section reports "derived from size" for an SVG without
    a `viewBox`, and shows its authored `width` (not `100%`).
  - The debug card's Copy button puts text on the clipboard that contains the View and
    Build sections. Chrome only: Firefox BiDi clipboard permissions are a known gap,
    so skip that browser with a comment.
  - An SVG containing `<style>div, button { display: none !important }</style>` still
    shows the HUD.
  - An HTML page containing `<div class="toolbar">` keeps its own computed styles.
    This guards against the manifest stylesheet leak coming back.
- New options popup tests:
  - Choosing a position cell saves `toolbarPosition`.
  - The picker is disabled when the toolbar is off.

### Verification before done

- `bun run verify` passes (type check, ESLint, unit tests, Bright Builds checks).
- `bun run test:e2e` passes in Chrome and Firefox.
- `bun run screenshots:app-store` is regenerated. The images change on purpose; a
  second run must be byte-identical.

## 7. Docs and listings

Update text that names the old "+ / − / Reset toolbar":

- `README.md`: the feature list and the source map line for `src/js/toolbar.ts`
  (becomes `src/js/hud/`)
- `store/web-stores.md`, both listings
- `store/app-store/listing.md`. `test/unit/appStoreListing.test.ts` checks this file,
  so keep it passing.

No version bump; that happens at release time in `src/manifest.json`.

## Out of scope

- A HUD size or scale setting
- A configurable idle delay
- Touch and pinch gestures
- Renaming the `toolbar*` setting keys
- Dragging the pill to a free-form position
