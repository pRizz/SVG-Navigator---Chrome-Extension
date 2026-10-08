# HUD Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the floating `+` / `-` / `Reset` toolbar and the debug overlay with a modern HUD. It sits in a shadow root, can be pinned to 8 positions, shows a zoom readout, has background, fullscreen and shortcut controls, hides after idle and wakes on activity, and includes a richer debug card that can be copied.

**Architecture:** Pure, unit-tested modules (`layout`, `zoomLabel`, `visibility`, `backgroundCycle`, `debugInfo`, `shortcutRows`, `displayedZoom`) feed a thin DOM shell (`src/js/hud/hud.ts`). The shell mounts one `<svg-navigator-hud>` element with an open shadow root. `src/js/svgNavigator.ts` talks to the HUD only through the `HudHandle` interface returned by `mountHud`. The manifest stops injecting a global stylesheet.

**Tech Stack:** TypeScript 6.0 (no TS 7), Bun (package manager, runtime, `bun test` with `node:test` + `node:assert/strict`), webextension-toolbox (webpack + ts-loader), Puppeteer E2E in Chrome and Firefox (WebDriver BiDi).

**Spec:** `docs/superpowers/specs/2026-10-07-hud-modernization-design.md`

## Global Constraints

- Package manager and runtime: **Bun**. Never use npm/pnpm/yarn.
- Gate before every commit: `bun run verify`. It runs the type check, ESLint with `--max-warnings 0`, unit tests and the Bright Builds checks. Tasks that touch UI also run `bun run test:e2e`.
- `webextension-toolbox` exits 0 even when TypeScript fails; `bun run typecheck` is the real gate.
- TypeScript stays on `~6.0`.
- No source file may exceed **628 lines** (Bright Builds `file-lengths` check).
- In a standalone SVG page, `document` is an XML document. Build every HTML element from the wrapper `htmlDoc`, never `document.createElement`.
- Do not edit `scripts/bright-builds-check.ts`.
- Never run `bun run build:chrome|firefox|safari|all` (they overwrite `packages/`). Use `bun run build:dev`.
- Unit tests: one concern per test, Arrange / Act / Assert with `// Arrange`, `// Act`, `// Assert` comments (omit only when the structure is trivially obvious). Import source with an explicit `.ts` extension, for example `'../../src/js/viewBox.ts'`.
- Naming: nullable or optional values get a `maybe` prefix (`maybeIdleTimer`, `maybeElement`).
- Comments explain *why*, not *what*. Public functions get a short doc comment.
- Commit messages: imperative sentence subject (no `feat:` prefixes), a short body, and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work happens on `master`; push once at the end (Task 14).
- Setting keys `toolbarEnabled` / `toolbarAutoHide` are **not** renamed.
- Defaults: `toolbarPosition` = `'bottom-right'`; idle hide = **2000 ms**; dark background = `#1b1c1e`; copy feedback = **1500 ms**; element label max = **48** chars; significant figures = **4**; compact zoom label from **10 000 %**; exponent label from **1e15 %**.
- Shortcut labels must match the real bindings in `svgNavigator.ts` and the options popup's Information tab: **Ctrl =** zooms in, **Ctrl −** zooms out, **Ctrl 0** or **Esc** resets, **Alt** (shown as **Option** on macOS) zooms out.

## Deliberate refinements of the spec

These come from reading the code while planning. Each one keeps the spec's intent.

1. **Host element** is the custom tag `<svg-navigator-hud>`, not `<div data-svg-navigator-hud>`. Its inline styles are set with `!important`, so a hostile SVG `<style>` such as `div { display: none !important }` can't hide it. Inline `!important` outranks stylesheet `!important`, and custom element names may host a shadow root without being registered.
2. **Keyboard isolation** happens inside the HUD, not in each navigator handler:
   - The shadow root stops `keydown` of Space on a HUD button, so it can't start a spacebar pan.
   - A capture-phase `keyup` listener on `document` swallows Escape only while the shortcuts popover is open.
   
   With a `composedPath` guard in every navigator handler, Esc would stop resetting the view after the user clicks + with the mouse, because the click leaves focus on the button.
3. **Pointer and wheel events are not stopped at the host.** The navigator's `mousedown` and `wheel` listeners sit on the `<svg>`, which isn't an ancestor of the HUD, so they never see HUD events. Stopping `mouseup` at the host could leave a pan stuck. The dock only calls `preventDefault()` on `wheel`, so the page doesn't scroll.
4. **`layout.ts`** returns orientation, popover direction and debug corner. Anchoring is done in CSS with `[data-position]` selectors, which avoids duplicating it in TypeScript.
5. **The debug pointer listener** is always attached but only refreshes the card while `showDebugInfo` is on. Turning debug off still removes the card.
6. **Keyboard focus pins the HUD**, but focus from a mouse click doesn't. Only focus that matches `:focus-visible` counts, so clicking + doesn't keep the HUD visible forever.
7. **`tsconfig.node.json` switches to bundler resolution** (Task 3). Unit tests now import extension modules that import each other without file extensions, which NodeNext rejects (verified with a probe; bundler resolution passes typecheck and lint).

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `src/shared/settings.ts` | modify | Add `TOOLBAR_POSITIONS`, `ToolbarPosition`, the `toolbarPosition` setting |
| `src/shared/provenance.ts` | modify | Export `SHORT_COMMIT_LENGTH` |
| `src/js/viewBox.ts` | modify | Add `displayedZoom` |
| `src/js/hud/zoomLabel.ts` | create | Zoom ratio → `340%` / `12K%` / `1.2e20%` |
| `src/js/hud/layout.ts` | create | Position → orientation, popover direction, debug corner |
| `src/js/hud/backgroundCycle.ts` | create | `saved → checkerboard → dark` cycle, CSS, button title |
| `src/js/hud/visibility.ts` | create | Wake-on-activity state model |
| `src/js/hud/debugInfo.ts` | create | `DebugInfo` type, formatting, sections, copy text |
| `src/js/hud/shortcuts.ts` | create | `shortcutRows` (pure) + popover DOM |
| `src/js/hud/icons.ts` | create | Inline SVG icons |
| `src/js/hud/dom.ts` | create | `button` / `iconButton` builders |
| `src/js/hud/styles.ts` | create | Shadow-root CSS string |
| `src/js/hud/shadowHost.ts` | create | `<svg-navigator-hud>` host + style adoption |
| `src/js/hud/pill.ts` | create | The pill's buttons |
| `src/js/hud/debugCard.ts` | create | Debug card + chip, copy, minimize |
| `src/js/hud/hud.ts` | create | `mountHud` → `HudHandle`; wires everything |
| `src/js/svgNavigator.ts` | modify | Use `HudHandle`; collect `DebugInfo`; drop old toolbar/debug code |
| `src/js/toolbar.ts`, `src/css/svgNavigator.css` | delete | Replaced by `src/js/hud/` |
| `src/manifest.json` | modify | Remove the `css` content-script entry |
| `src/options/index.html`, `options.ts`, `options.css` | modify | Position picker, copy updates |
| `tsconfig.node.json` | modify | Bundler resolution |
| `test/unit/*.test.ts` | create/modify | Unit tests for every pure module |
| `test/e2e/suite.ts` | create | Shared per-browser lifecycle |
| `test/e2e/harness.ts` | modify | HUD helpers, fixture routes with headers |
| `test/e2e/navigator.test.ts` | modify | Navigator-only tests on the shared suite |
| `test/e2e/options.test.ts` | create | Options popup tests (moved + new) |
| `test/e2e/hud.test.ts` | create | HUD tests |
| `test/e2e/fixtures/hostile-style.svg`, `styled-page.html` | create | Isolation fixtures |
| `README.md`, `store/web-stores.md`, `store/app-store/listing.md`, `standards-overrides.md`, `AGENTS.md` | modify | Docs |
| `store/app-store/screenshots/*.png` | regenerate | New HUD look |

---

### Task 1: The `toolbarPosition` setting

**Files:**
- Modify: `src/shared/settings.ts`
- Test: `test/unit/settings.test.ts`

**Interfaces:**
- Produces: `export const TOOLBAR_POSITIONS: readonly ['top-left','top','top-right','left','right','bottom-left','bottom','bottom-right']`, `export type ToolbarPosition`, `Settings.toolbarPosition: ToolbarPosition`, default `'bottom-right'`.

- [ ] **Step 1: Write the failing tests.** Append to `test/unit/settings.test.ts`, and change its import line to `import { DEFAULT_SETTINGS, TOOLBAR_POSITIONS, parseSetting, parseSettings } from '../../src/shared/settings.ts';`

```ts
describe('toolbarPosition', () => {
    test('defaults to the bottom-right corner', () => {
        assert.equal(parseSettings({}).toolbarPosition, 'bottom-right');
    });

    test('accepts every position the picker offers', () => {
        // Act
        const parsed = TOOLBAR_POSITIONS.map((position) => parseSetting('toolbarPosition', position));

        // Assert
        assert.deepEqual(parsed, [...TOOLBAR_POSITIONS]);
    });

    test('falls back to the default for an unknown position', () => {
        assert.equal(parseSetting('toolbarPosition', 'center'), 'bottom-right');
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `bun test test/unit/settings.test.ts`
Expected: FAIL. `TOOLBAR_POSITIONS` is undefined, or the import is missing.

- [ ] **Step 3: Implement.** In `src/shared/settings.ts`, below `export type ClickAndDragBehavior = 'pan' | 'zoomBox';`, add:

```ts
/** Where the HUD sits: the four corners and the middle of each edge. */
export const TOOLBAR_POSITIONS = [
    'top-left', 'top', 'top-right',
    'left', 'right',
    'bottom-left', 'bottom', 'bottom-right',
] as const;

export type ToolbarPosition = typeof TOOLBAR_POSITIONS[number];
```

Add `toolbarPosition: ToolbarPosition;` to `Settings` after `toolbarEnabled: boolean;`. Add `toolbarPosition: 'bottom-right',` to `DEFAULT_SETTINGS` after `toolbarEnabled: true,`. Add this to `VALIDATORS` after `toolbarEnabled: isBoolean,`:

```ts
    toolbarPosition: (value): value is ToolbarPosition =>
        typeof value === 'string' && (TOOLBAR_POSITIONS as readonly string[]).includes(value),
```

- [ ] **Step 4: Run the tests and confirm they pass.**

Run: `bun test test/unit/settings.test.ts`
Expected: PASS, with all `parseSettings`, `parseSetting` and `toolbarPosition` tests green.

- [ ] **Step 5: Verify and commit.**

Run: `bun run verify`. Expected: every step passes, ending `SUMMARY all findings=0`.

```bash
git add src/shared/settings.ts test/unit/settings.test.ts
git commit -F - <<'EOF'
Add a toolbar position setting

Eight positions (corners and edge midpoints), defaulting to bottom-right
so existing users see no change. Unknown stored values fall back to the
default like every other setting.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Displayed zoom and its label

**Files:**
- Modify: `src/js/viewBox.ts`
- Create: `src/js/hud/zoomLabel.ts`
- Test: `test/unit/viewBox.test.ts`, `test/unit/zoomLabel.test.ts`

**Interfaces:**
- Produces: `displayedZoom(original: ViewBox, current: ViewBox, aspectRatio: number): number` (1 = original view, 2 = twice as close). Also `zoomLabel(ratio: number): string`.

- [ ] **Step 1: Write the failing tests.** Add `displayedZoom` to the import list in `test/unit/viewBox.test.ts` and append:

```ts
describe('displayedZoom', () => {
    const ORIGINAL = { x: 0, y: 0, width: 800, height: 600 };

    test('is 1 for the original view', () => {
        assert.equal(displayedZoom(ORIGINAL, ORIGINAL, 4 / 3), 1);
    });

    test('is 2 when the view is half as wide', () => {
        // Arrange
        const current = zoomAroundCenter(ORIGINAL, 0.5);

        // Act
        const zoom = displayedZoom(ORIGINAL, current, 4 / 3);

        // Assert
        assert.equal(zoom, 2);
    });

    test('measures a zoom box by its displayed size, not its raw width', () => {
        // Arrange: a tall box the browser letterboxes to 400 units wide in a 4:3 window
        const tallBox = { x: 0, y: 0, width: 100, height: 300 };

        // Act
        const zoom = displayedZoom(ORIGINAL, tallBox, 4 / 3);

        // Assert
        assert.equal(zoom, 2);
    });
});
```

Create `test/unit/zoomLabel.test.ts`:

```ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { zoomLabel } from '../../src/js/hud/zoomLabel.ts';

describe('zoomLabel', () => {
    test('shows the original view as 100%', () => {
        assert.equal(zoomLabel(1), '100%');
    });

    test('rounds to a whole percent', () => {
        assert.equal(zoomLabel(3.4012), '340%');
    });

    test('shows a zoomed-out view as a whole percent', () => {
        assert.equal(zoomLabel(0.25), '25%');
    });

    test('keeps two significant figures below 1%', () => {
        assert.equal(zoomLabel(0.005), '0.5%');
    });

    test('switches to compact notation at 10,000%', () => {
        assert.equal(zoomLabel(100), '10K%');
    });

    test('uses compact notation for thousands', () => {
        assert.equal(zoomLabel(120), '12K%');
    });

    test('uses compact notation for millions', () => {
        assert.equal(zoomLabel(34_000), '3.4M%');
    });

    test('uses an exponent beyond compact notation', () => {
        assert.equal(zoomLabel(1.2e18), '1.2e20%');
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `bun test test/unit/viewBox.test.ts test/unit/zoomLabel.test.ts`
Expected: FAIL. `displayedZoom` is not exported, and `zoomLabel.ts` can't be found.

- [ ] **Step 3: Implement.** Append to `src/js/viewBox.ts`:

```ts
/**
 * How far `current` is zoomed relative to `original` as the browser displays both in
 * a window of `aspectRatio` (width / height): 2 means twice as close. Both are fitted
 * to the window first, because a zoom box of any shape is letterboxed on screen.
 */
export function displayedZoom(original: ViewBox, current: ViewBox, aspectRatio: number): number {
    return fitToAspectRatio(original, aspectRatio).width / fitToAspectRatio(current, aspectRatio).width;
}
```

Create `src/js/hud/zoomLabel.ts`:

```ts
/**
 * The HUD's zoom readout. Zoom is unbounded, so the label stays short at any level:
 * whole percents, then compact notation (`12K%`), then an exponent (`1.2e20%`).
 */

const COMPACT_FROM_PERCENT = 10_000;
const EXPONENT_FROM_PERCENT = 1e15;

// A fixed locale keeps the label (and the App Store screenshots) identical everywhere.
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** Formats a zoom ratio (1 = the original view) as a percentage. */
export function zoomLabel(ratio: number): string {
    const percent = ratio * 100;
    if (percent < 1) {
        return `${Number(percent.toPrecision(2))}%`;
    }
    if (percent < COMPACT_FROM_PERCENT) {
        return `${Math.round(percent)}%`;
    }
    if (percent < EXPONENT_FROM_PERCENT) {
        return `${compactFormat.format(percent)}%`;
    }
    const [mantissa = '', exponent = ''] = percent.toExponential(1).split('e+');
    return `${mantissa}e${exponent}%`;
}
```

- [ ] **Step 4: Run the tests and confirm they pass.**

Run: `bun test test/unit/viewBox.test.ts test/unit/zoomLabel.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit.**

Run: `bun run verify`. Expected: all green.

```bash
git add src/js/viewBox.ts src/js/hud/zoomLabel.ts test/unit/viewBox.test.ts test/unit/zoomLabel.test.ts
git commit -F - <<'EOF'
Compute the displayed zoom and format it for the HUD

displayedZoom compares views as the browser shows them, so a zoom box of
any shape reads correctly. zoomLabel keeps the readout short however far
the infinite zoom goes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: HUD layout per position (and bundler resolution for tests)

**Files:**
- Modify: `tsconfig.node.json`
- Create: `src/js/hud/layout.ts`
- Test: `test/unit/layout.test.ts`

**Interfaces:**
- Consumes: `ToolbarPosition`, `TOOLBAR_POSITIONS` (Task 1).
- Produces: `type Orientation = 'horizontal' | 'vertical'`, `type PopoverDirection = 'top' | 'bottom' | 'left' | 'right'`, `type DebugCorner = 'top-left' | 'top-right'`, `interface HudLayout { orientation; popoverDirection; debugCorner }`, and `hudLayout(position: ToolbarPosition): HudLayout`.

- [ ] **Step 1: Switch `tsconfig.node.json` to bundler resolution.** Unit tests are about to import extension modules whose relative imports omit file extensions (webpack resolves those). NodeNext rejects them with TS2835. Replace the leading comment and the two module lines:

```jsonc
{
    // Build/release scripts and tests. Bun runs these .ts files directly; only
    // erasable syntax is allowed and nothing is emitted. They use Node APIs, which
    // Bun implements. Bundler resolution, because tests import extension modules
    // whose relative imports omit file extensions; scripts and tests themselves
    // still write explicit `.ts` extensions.
    // DOM and chrome types are included because Puppeteer `evaluate` callbacks
    // in the E2E tests run inside pages.
    "compilerOptions": {
        "target": "ES2023",
        "module": "Preserve",
        "moduleResolution": "bundler",
```

Leave every other option unchanged.

- [ ] **Step 2: Write the failing test.** Create `test/unit/layout.test.ts`:

```ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hudLayout } from '../../src/js/hud/layout.ts';
import { TOOLBAR_POSITIONS } from '../../src/shared/settings.ts';

/** `pick` of every position's layout, keyed by position. */
function layoutsBy<T>(pick: (position: typeof TOOLBAR_POSITIONS[number]) => T): Record<string, T> {
    return Object.fromEntries(TOOLBAR_POSITIONS.map((position) => [position, pick(position)]));
}

describe('hudLayout', () => {
    test('is vertical only on the left and right edges', () => {
        // Act
        const orientations = layoutsBy((position) => hudLayout(position).orientation);

        // Assert
        assert.deepEqual(orientations, {
            'top-left': 'horizontal', 'top': 'horizontal', 'top-right': 'horizontal',
            'left': 'vertical', 'right': 'vertical',
            'bottom-left': 'horizontal', 'bottom': 'horizontal', 'bottom-right': 'horizontal',
        });
    });

    test('opens the popover toward the window interior', () => {
        // Act
        const directions = layoutsBy((position) => hudLayout(position).popoverDirection);

        // Assert
        assert.deepEqual(directions, {
            'top-left': 'bottom', 'top': 'bottom', 'top-right': 'bottom',
            'left': 'right', 'right': 'left',
            'bottom-left': 'top', 'bottom': 'top', 'bottom-right': 'top',
        });
    });

    test('moves the debug card top-right only when the HUD is on the top-left, top, or left', () => {
        // Act
        const corners = layoutsBy((position) => hudLayout(position).debugCorner);

        // Assert
        assert.deepEqual(corners, {
            'top-left': 'top-right', 'top': 'top-right', 'top-right': 'top-left',
            'left': 'top-right', 'right': 'top-left',
            'bottom-left': 'top-left', 'bottom': 'top-left', 'bottom-right': 'top-left',
        });
    });
});
```

- [ ] **Step 3: Run the test and confirm it fails.**

Run: `bun test test/unit/layout.test.ts`
Expected: FAIL, because `layout.ts` can't be found.

- [ ] **Step 4: Implement.** Create `src/js/hud/layout.ts`:

```ts
/**
 * How the HUD arranges itself for each toolbar position. Anchoring to the window
 * edges is CSS (`[data-position]` in `styles.ts`); this decides the rest.
 */

import type { ToolbarPosition } from '../../shared/settings';

export type Orientation = 'horizontal' | 'vertical';
/** The side of the pill the shortcuts popover opens on: always toward the window's interior. */
export type PopoverDirection = 'top' | 'bottom' | 'left' | 'right';
/** The debug card stays at the top, on whichever side the pill leaves free. */
export type DebugCorner = 'top-left' | 'top-right';

export interface HudLayout {
    orientation: Orientation;
    popoverDirection: PopoverDirection;
    debugCorner: DebugCorner;
}

const LAYOUTS: Readonly<Record<ToolbarPosition, HudLayout>> = {
    'top-left': { orientation: 'horizontal', popoverDirection: 'bottom', debugCorner: 'top-right' },
    'top': { orientation: 'horizontal', popoverDirection: 'bottom', debugCorner: 'top-right' },
    'top-right': { orientation: 'horizontal', popoverDirection: 'bottom', debugCorner: 'top-left' },
    'left': { orientation: 'vertical', popoverDirection: 'right', debugCorner: 'top-right' },
    'right': { orientation: 'vertical', popoverDirection: 'left', debugCorner: 'top-left' },
    'bottom-left': { orientation: 'horizontal', popoverDirection: 'top', debugCorner: 'top-left' },
    'bottom': { orientation: 'horizontal', popoverDirection: 'top', debugCorner: 'top-left' },
    'bottom-right': { orientation: 'horizontal', popoverDirection: 'top', debugCorner: 'top-left' },
};

export function hudLayout(position: ToolbarPosition): HudLayout {
    return LAYOUTS[position];
}
```

- [ ] **Step 5: Run the test, then verify and commit.**

Run: `bun test test/unit/layout.test.ts`. Expected: PASS.
Run: `bun run verify`. Expected: all green. This proves the tsconfig change type-checks `layout.ts`'s extensionless import.

```bash
git add tsconfig.node.json src/js/hud/layout.ts test/unit/layout.test.ts
git commit -F - <<'EOF'
Decide the HUD layout for each toolbar position

Orientation, popover direction, and debug-card corner per position.
tsconfig.node.json moves to bundler resolution because unit tests now
import extension modules whose relative imports omit extensions.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Background cycle

**Files:**
- Create: `src/js/hud/backgroundCycle.ts`
- Test: `test/unit/backgroundCycle.test.ts`

**Interfaces:**
- Produces: `type BackgroundState = 'saved' | 'checkerboard' | 'dark'`, `DARK_BACKGROUND`, `CHECKERBOARD_BACKGROUND`, `nextBackground(state): BackgroundState`, `backgroundCss(state, savedColor: string): string`, `backgroundButtonTitle(state): string`.

- [ ] **Step 1: Write the failing tests.** Create `test/unit/backgroundCycle.test.ts`:

```ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    CHECKERBOARD_BACKGROUND,
    DARK_BACKGROUND,
    backgroundButtonTitle,
    backgroundCss,
    nextBackground,
} from '../../src/js/hud/backgroundCycle.ts';

describe('nextBackground', () => {
    test('cycles saved, checkerboard, dark, and back to saved', () => {
        // Act
        const sequence = [nextBackground('saved'), nextBackground('checkerboard'), nextBackground('dark')];

        // Assert
        assert.deepEqual(sequence, ['checkerboard', 'dark', 'saved']);
    });
});

describe('backgroundCss', () => {
    test('uses the saved color for the saved state', () => {
        assert.equal(backgroundCss('saved', 'rgb(1, 2, 3)'), 'rgb(1, 2, 3)');
    });

    test('uses the checkerboard pattern for the checkerboard state', () => {
        assert.equal(backgroundCss('checkerboard', 'white'), CHECKERBOARD_BACKGROUND);
    });

    test('uses the dark color for the dark state', () => {
        assert.equal(backgroundCss('dark', 'white'), DARK_BACKGROUND);
    });
});

describe('backgroundButtonTitle', () => {
    test('names the background a click switches to', () => {
        assert.equal(backgroundButtonTitle('dark'), 'Background: saved color');
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `bun test test/unit/backgroundCycle.test.ts`
Expected: FAIL, because the module can't be found.

- [ ] **Step 3: Implement.** Create `src/js/hud/backgroundCycle.ts`:

```ts
/**
 * The HUD's background button: cycles the page background for this tab only. The
 * color in settings stays the lasting default and is where every cycle starts.
 */

export type BackgroundState = 'saved' | 'checkerboard' | 'dark';

const CYCLE: readonly BackgroundState[] = ['saved', 'checkerboard', 'dark'];

/** The options popup's dark page color, so "dark" matches the extension's own dark theme. */
export const DARK_BACKGROUND = '#1b1c1e';

/** 16px squares in two neutral grays: the usual pattern behind transparent artwork. */
export const CHECKERBOARD_BACKGROUND = 'repeating-conic-gradient(#d4d4d4 0 25%, #f4f4f4 0 50%) 0 0 / 32px 32px';

const LABELS: Readonly<Record<BackgroundState, string>> = {
    saved: 'saved color',
    checkerboard: 'checkerboard',
    dark: 'dark',
};

export function nextBackground(state: BackgroundState): BackgroundState {
    return CYCLE[(CYCLE.indexOf(state) + 1) % CYCLE.length] ?? 'saved';
}

/** The CSS `background` for `state`; `saved` is the color from settings. */
export function backgroundCss(state: BackgroundState, savedColor: string): string {
    switch (state) {
        case 'saved':
            return savedColor;
        case 'checkerboard':
            return CHECKERBOARD_BACKGROUND;
        case 'dark':
            return DARK_BACKGROUND;
    }
}

/** The button's tooltip, which names what a click switches to. */
export function backgroundButtonTitle(state: BackgroundState): string {
    return `Background: ${LABELS[nextBackground(state)]}`;
}
```

- [ ] **Step 4: Run the tests and confirm they pass.**

Run: `bun test test/unit/backgroundCycle.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit.**

Run: `bun run verify`. Expected: all green.

```bash
git add src/js/hud/backgroundCycle.ts test/unit/backgroundCycle.test.ts
git commit -F - <<'EOF'
Add the HUD's per-tab background cycle

Saved color, transparency checkerboard, dark, and back. The button's
tooltip names the next background.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Wake-on-activity visibility model

**Files:**
- Create: `src/js/hud/visibility.ts`
- Test: `test/unit/visibility.test.ts`

**Interfaces:**
- Produces: `IDLE_HIDE_MS = 2_000`, `interface VisibilityState`, `type VisibilityEvent = 'activity' | 'idleElapsed' | 'pointerEnter' | 'pointerLeave' | 'focusIn' | 'focusOut' | 'popoverOpen' | 'popoverClose'`, `initialVisibility(autoHide: boolean)`, `reduceVisibility(state, event)`, `withAutoHide(state, autoHide)`, `isVisible(state): boolean`.

- [ ] **Step 1: Write the failing tests.** Create `test/unit/visibility.test.ts`:

```ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    initialVisibility,
    isVisible,
    reduceVisibility,
    withAutoHide,
    type VisibilityEvent,
    type VisibilityState,
} from '../../src/js/hud/visibility.ts';

function after(state: VisibilityState, ...events: VisibilityEvent[]): VisibilityState {
    return events.reduce(reduceVisibility, state);
}

describe('HUD visibility', () => {
    test('is visible when mounted', () => {
        assert.equal(isVisible(initialVisibility(true)), true);
    });

    test('hides once the idle time passes', () => {
        // Act
        const state = after(initialVisibility(true), 'idleElapsed');

        // Assert
        assert.equal(isVisible(state), false);
    });

    test('wakes on activity', () => {
        // Act
        const state = after(initialVisibility(true), 'idleElapsed', 'activity');

        // Assert
        assert.equal(isVisible(state), true);
    });

    test('stays visible while the pointer is over it', () => {
        // Act
        const state = after(initialVisibility(true), 'pointerEnter', 'idleElapsed');

        // Assert
        assert.equal(isVisible(state), true);
    });

    test('hides when the pointer leaves after the idle time passed', () => {
        // Act
        const state = after(initialVisibility(true), 'pointerEnter', 'idleElapsed', 'pointerLeave');

        // Assert
        assert.equal(isVisible(state), false);
    });

    test('stays visible while keyboard focus is inside', () => {
        // Act
        const state = after(initialVisibility(true), 'focusIn', 'idleElapsed');

        // Assert
        assert.equal(isVisible(state), true);
    });

    test('stays visible while the shortcuts popover is open', () => {
        // Act
        const state = after(initialVisibility(true), 'popoverOpen', 'idleElapsed');

        // Assert
        assert.equal(isVisible(state), true);
    });

    test('never hides with auto-hide off', () => {
        // Act
        const state = after(initialVisibility(false), 'idleElapsed');

        // Assert
        assert.equal(isVisible(state), true);
    });

    test('turning auto-hide back on shows the HUD until the next idle spell', () => {
        // Act
        const state = withAutoHide(after(initialVisibility(true), 'idleElapsed'), true);

        // Assert
        assert.equal(isVisible(state), true);
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `bun test test/unit/visibility.test.ts`
Expected: FAIL, because the module can't be found.

- [ ] **Step 3: Implement.** Create `src/js/hud/visibility.ts`:

```ts
/**
 * When the HUD shows, with auto-hide on: any activity wakes it, a quiet spell fades
 * it, and it stays up while the pointer is over it, keyboard focus is in it, or the
 * shortcuts popover is open. Pure; `hud.ts` owns the timer and the DOM.
 */

export const IDLE_HIDE_MS = 2_000;

export interface VisibilityState {
    autoHide: boolean;
    idle: boolean;
    hovered: boolean;
    focused: boolean;
    popoverOpen: boolean;
}

export type VisibilityEvent =
    | 'activity'
    | 'idleElapsed'
    | 'pointerEnter'
    | 'pointerLeave'
    | 'focusIn'
    | 'focusOut'
    | 'popoverOpen'
    | 'popoverClose';

export function initialVisibility(autoHide: boolean): VisibilityState {
    return { autoHide, idle: false, hovered: false, focused: false, popoverOpen: false };
}

export function reduceVisibility(state: VisibilityState, event: VisibilityEvent): VisibilityState {
    switch (event) {
        case 'activity':
            return { ...state, idle: false };
        case 'idleElapsed':
            return { ...state, idle: true };
        case 'pointerEnter':
            return { ...state, hovered: true };
        case 'pointerLeave':
            return { ...state, hovered: false };
        case 'focusIn':
            return { ...state, focused: true };
        case 'focusOut':
            return { ...state, focused: false };
        case 'popoverOpen':
            return { ...state, popoverOpen: true };
        case 'popoverClose':
            return { ...state, popoverOpen: false };
    }
}

/** Changing the setting counts as activity, so the HUD shows right away either way. */
export function withAutoHide(state: VisibilityState, autoHide: boolean): VisibilityState {
    return { ...state, autoHide, idle: false };
}

export function isVisible(state: VisibilityState): boolean {
    return !state.autoHide || !state.idle || state.hovered || state.focused || state.popoverOpen;
}
```

- [ ] **Step 4: Run the tests and confirm they pass.**

Run: `bun test test/unit/visibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit.**

Run: `bun run verify`. Expected: all green.

```bash
git add src/js/hud/visibility.ts test/unit/visibility.test.ts
git commit -F - <<'EOF'
Model the HUD's wake-on-activity visibility

A pure reducer: idle hides, activity wakes, and hover, keyboard focus,
or an open popover keep the HUD up. With auto-hide off it never hides.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Debug info formatting

**Files:**
- Modify: `src/shared/provenance.ts` (export `SHORT_COMMIT_LENGTH`)
- Create: `src/js/hud/debugInfo.ts`
- Test: `test/unit/debugInfo.test.ts`

**Interfaces:**
- Consumes: `zoomLabel` (Task 2), `UNAVAILABLE`, `formatBuildTime`, `SHORT_COMMIT_LENGTH` (provenance), `ClickAndDragBehavior` (settings), `Point`, `ViewBox` (viewBox).
- Produces (all exported from `src/js/hud/debugInfo.ts`):
  - `type InteractionKind = 'idle' | 'zoomBox' | 'panReady' | 'panning'`
  - `interface ElementSummary { localName: string; id: string; classNames: readonly string[] }`
  - `interface WheelSample { deltaY: number; deltaMode: number }`
  - `interface UaBrand { brand: string; version: string }`
  - `interface DocumentFacts { viewBox: ViewBox; viewBoxSource: 'authored' | 'derivedFromSize'; authoredWidth: string | null; authoredHeight: string | null; authoredPreserveAspectRatio: string | null; elementCount: number }`
  - `interface DebugInfo { viewBox; zoomRatio; pointer: { client: Point; svg: Point; maybeElement: ElementSummary | null }; document: DocumentFacts; input: { interaction: InteractionKind; maybeLastWheel: WheelSample | null; clickAndDragBehavior; scrollSensitivity: number; invertScroll: boolean }; environment: { browser: string; devicePixelRatio: number; windowWidth: number; windowHeight: number }; build: { version: string; maybeCommit: string | null; timestamp: string } }`
  - `interface DebugSection { title: string; rows: readonly (readonly [name: string, value: string])[] }`
  - Functions: `formatNumber(value: number): string`, `describeElement(summary): string`, `describeBrowser(userAgent: string, maybeBrands: readonly UaBrand[] | null): string`, `debugSections(info): DebugSection[]`, `debugText(sections): string`

- [ ] **Step 1: Export the short-commit length.** In `src/shared/provenance.ts`, change `const SHORT_COMMIT_LENGTH = 7;` to:

```ts
/** How many characters of the commit hash to show. */
export const SHORT_COMMIT_LENGTH = 7;
```

- [ ] **Step 2: Write the failing tests.** Create `test/unit/debugInfo.test.ts`:

```ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    debugSections,
    debugText,
    describeBrowser,
    describeElement,
    formatNumber,
    type DebugInfo,
} from '../../src/js/hud/debugInfo.ts';

const SAMPLE: DebugInfo = {
    viewBox: { x: 12.345678, y: -0.000001, width: 800, height: 600 },
    zoomRatio: 2,
    pointer: { client: { x: 100.4, y: 50.6 }, svg: { x: 10.123456, y: 20 }, maybeElement: null },
    document: {
        viewBox: { x: 0, y: 0, width: 400, height: 300 },
        viewBoxSource: 'derivedFromSize',
        authoredWidth: '400',
        authoredHeight: '300',
        authoredPreserveAspectRatio: null,
        elementCount: 2,
    },
    input: { interaction: 'idle', maybeLastWheel: null, clickAndDragBehavior: 'pan', scrollSensitivity: 7, invertScroll: false },
    environment: { browser: 'Firefox 140.0', devicePixelRatio: 2, windowWidth: 800, windowHeight: 600 },
    build: { version: '2.14', maybeCommit: '0123456789abcdef', timestamp: '2026-10-07T18:21:11.089Z' },
};

/** The value of `name` in the section titled `title`. */
function row(info: DebugInfo, title: string, name: string): string | undefined {
    return debugSections(info).find((section) => section.title === title)?.rows.find(([rowName]) => rowName === name)?.[1];
}

describe('formatNumber', () => {
    test('rounds to four significant figures', () => {
        assert.equal(formatNumber(12.345678), '12.35');
    });

    test('shows negative zero as 0', () => {
        assert.equal(formatNumber(-0.00000001 * 0), '0');
    });

    test('keeps large numbers whole', () => {
        assert.equal(formatNumber(123456), '123500');
    });
});

describe('describeElement', () => {
    test('joins the tag, id, and classes like a CSS selector', () => {
        assert.equal(describeElement({ localName: 'path', id: 'coast', classNames: ['border', 'eu'] }), 'path#coast.border.eu');
    });

    test('omits a missing id', () => {
        assert.equal(describeElement({ localName: 'g', id: '', classNames: ['layer'] }), 'g.layer');
    });

    test('truncates long labels to 48 characters', () => {
        // Act
        const label = describeElement({ localName: 'path', id: 'x'.repeat(60), classNames: [] });

        // Assert
        assert.equal(label.length, 48);
        assert.ok(label.endsWith('…'));
    });
});

describe('describeBrowser', () => {
    const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

    test('prefers the named brand from client hints', () => {
        // Arrange
        const brands = [{ brand: 'Not)A;Brand', version: '8' }, { brand: 'Chromium', version: '140' }, { brand: 'Google Chrome', version: '140' }];

        // Act
        const browser = describeBrowser(CHROME_UA, brands);

        // Assert
        assert.equal(browser, 'Google Chrome 140');
    });

    test('reads Firefox from the user agent', () => {
        assert.equal(describeBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0', null), 'Firefox 140.0');
    });

    test('reads Edge before Chrome from the user agent', () => {
        assert.equal(describeBrowser(`${CHROME_UA} Edg/140.0.3485.54`, null), 'Microsoft Edge 140.0.3485.54');
    });

    test('reads Chrome from the user agent', () => {
        assert.equal(describeBrowser(CHROME_UA, null), 'Chrome 140.0.0.0');
    });

    test('reads Safari from the user agent', () => {
        assert.equal(describeBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', null), 'Safari 26.0');
    });

    test('falls back to Unknown', () => {
        assert.equal(describeBrowser('curl/8.0', null), 'Unknown');
    });
});

describe('debugSections', () => {
    test('labels a viewBox the navigator made from the size', () => {
        assert.equal(row(SAMPLE, 'Document', 'viewBox'), '0 0 400 300 (derived from size)');
    });

    test('shows the short commit', () => {
        assert.equal(row(SAMPLE, 'Build', 'Commit'), '0123456');
    });

    test('shows Unavailable for a build without a commit', () => {
        // Arrange
        const info = { ...SAMPLE, build: { ...SAMPLE.build, maybeCommit: null } };

        // Act
        const commit = row(info, 'Build', 'Commit');

        // Assert
        assert.equal(commit, 'Unavailable');
    });

    test('names the wheel delta mode', () => {
        // Arrange
        const info = { ...SAMPLE, input: { ...SAMPLE.input, maybeLastWheel: { deltaY: -120, deltaMode: 1 } } };

        // Act
        const wheel = row(info, 'Input', 'Last wheel');

        // Assert
        assert.equal(wheel, 'deltaY -120 (line)');
    });

    test('shows the zoom with the HUD label', () => {
        assert.equal(row(SAMPLE, 'View', 'Zoom'), '200%');
    });
});

describe('debugText', () => {
    test('writes one heading per section and name: value lines, separated by blank lines', () => {
        // Arrange
        const sections = [
            { title: 'View', rows: [['X', '1'], ['Y', '2']] as const },
            { title: 'Build', rows: [['Version', '2.14']] as const },
        ];

        // Act
        const text = debugText(sections);

        // Assert
        assert.equal(text, 'View\nX: 1\nY: 2\n\nBuild\nVersion: 2.14');
    });
});
```

- [ ] **Step 3: Run the tests and confirm they fail.**

Run: `bun test test/unit/debugInfo.test.ts`
Expected: FAIL, because the module can't be found.

- [ ] **Step 4: Implement.** Create `src/js/hud/debugInfo.ts`:

```ts
/**
 * What the debug card shows, and how: a snapshot type that `svgNavigator.ts` fills
 * in, plus pure formatting into titled sections and the plain text that Copy writes.
 */

import { SHORT_COMMIT_LENGTH, UNAVAILABLE, formatBuildTime } from '../../shared/provenance';
import type { ClickAndDragBehavior } from '../../shared/settings';
import type { Point, ViewBox } from '../viewBox';
import { zoomLabel } from './zoomLabel';

export type InteractionKind = 'idle' | 'zoomBox' | 'panReady' | 'panning';

export interface ElementSummary {
    localName: string;
    id: string;
    classNames: readonly string[];
}

export interface WheelSample {
    deltaY: number;
    deltaMode: number;
}

/** One entry of `navigator.userAgentData.brands` (Chromium only). */
export interface UaBrand {
    brand: string;
    version: string;
}

/** The SVG as authored, read before the navigator rewrites its size attributes. */
export interface DocumentFacts {
    viewBox: ViewBox;
    viewBoxSource: 'authored' | 'derivedFromSize';
    authoredWidth: string | null;
    authoredHeight: string | null;
    authoredPreserveAspectRatio: string | null;
    elementCount: number;
}

export interface DebugInfo {
    viewBox: ViewBox;
    zoomRatio: number;
    pointer: { client: Point, svg: Point, maybeElement: ElementSummary | null };
    document: DocumentFacts;
    input: {
        interaction: InteractionKind,
        maybeLastWheel: WheelSample | null,
        clickAndDragBehavior: ClickAndDragBehavior,
        scrollSensitivity: number,
        invertScroll: boolean,
    };
    environment: { browser: string, devicePixelRatio: number, windowWidth: number, windowHeight: number };
    build: { version: string, maybeCommit: string | null, timestamp: string };
}

export interface DebugSection {
    title: string;
    rows: readonly (readonly [name: string, value: string])[];
}

const SIGNIFICANT_DIGITS = 4;
const MAX_ELEMENT_LABEL = 48;
const DELTA_MODES = ['pixel', 'line', 'page'] as const;
// Chromium also lists its engine and a GREASE brand; the product name is the useful one.
const PREFERRED_BRANDS = ['Microsoft Edge', 'Opera', 'Brave', 'Google Chrome', 'Chromium'];
// Order matters: Edge and Opera user agents also say Chrome, and Chrome's also says Safari.
const USER_AGENT_PATTERNS: readonly (readonly [RegExp, string])[] = [
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Edg\/([\d.]+)/, 'Microsoft Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari\//, 'Safari'],
];

/** Four significant figures, without exponent noise like `-0`. */
export function formatNumber(value: number): string {
    const rounded = Number(value.toPrecision(SIGNIFICANT_DIGITS));
    return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** A CSS-selector-like label, `path#coast.border`, at most 48 characters. */
export function describeElement({ localName, id, classNames }: ElementSummary): string {
    const label = `${localName}${id ? `#${id}` : ''}${classNames.map((name) => `.${name}`).join('')}`;
    return label.length <= MAX_ELEMENT_LABEL ? label : `${label.slice(0, MAX_ELEMENT_LABEL - 1)}…`;
}

export function describeBrowser(userAgent: string, maybeBrands: readonly UaBrand[] | null): string {
    const maybeBrand = maybeBrands === null
        ? undefined
        : PREFERRED_BRANDS.map((name) => maybeBrands.find(({ brand }) => brand === name)).find((brand) => brand !== undefined);
    if (maybeBrand) {
        return `${maybeBrand.brand} ${maybeBrand.version}`;
    }
    for (const [pattern, name] of USER_AGENT_PATTERNS) {
        const maybeVersion = pattern.exec(userAgent)?.[1];
        if (maybeVersion) {
            return `${name} ${maybeVersion}`;
        }
    }
    return 'Unknown';
}

function formatViewBoxNumbers({ x, y, width, height }: ViewBox): string {
    return [x, y, width, height].map(formatNumber).join(' ');
}

function describeWheel(maybeWheel: WheelSample | null): string {
    if (maybeWheel === null) {
        return 'none';
    }
    const mode = DELTA_MODES[maybeWheel.deltaMode] ?? String(maybeWheel.deltaMode);
    return `deltaY ${formatNumber(maybeWheel.deltaY)} (${mode})`;
}

/** The card's sections, in display order. */
export function debugSections(info: DebugInfo): DebugSection[] {
    const { viewBox, pointer, document: facts, input, environment, build } = info;
    return [
        {
            title: 'View',
            rows: [
                ['X', formatNumber(viewBox.x)],
                ['Y', formatNumber(viewBox.y)],
                ['Width', formatNumber(viewBox.width)],
                ['Height', formatNumber(viewBox.height)],
                ['Zoom', zoomLabel(info.zoomRatio)],
            ],
        },
        {
            title: 'Pointer',
            rows: [
                ['Client', `${Math.round(pointer.client.x)}, ${Math.round(pointer.client.y)} px`],
                ['SVG', `${formatNumber(pointer.svg.x)}, ${formatNumber(pointer.svg.y)}`],
                ['Element', pointer.maybeElement ? describeElement(pointer.maybeElement) : 'none'],
            ],
        },
        {
            title: 'Document',
            rows: [
                ['viewBox', `${formatViewBoxNumbers(facts.viewBox)} (${facts.viewBoxSource === 'authored' ? 'authored' : 'derived from size'})`],
                ['Authored width', facts.authoredWidth ?? 'none'],
                ['Authored height', facts.authoredHeight ?? 'none'],
                ['preserveAspectRatio', facts.authoredPreserveAspectRatio ?? 'none'],
                ['Elements', String(facts.elementCount)],
            ],
        },
        {
            title: 'Input',
            rows: [
                ['Interaction', input.interaction],
                ['Last wheel', describeWheel(input.maybeLastWheel)],
                ['Drag', input.clickAndDragBehavior === 'pan' ? 'pan' : 'zoom box'],
                ['Scroll sensitivity', formatNumber(input.scrollSensitivity)],
                ['Invert scroll', input.invertScroll ? 'yes' : 'no'],
            ],
        },
        {
            title: 'Environment',
            rows: [
                ['Browser', environment.browser],
                ['Pixel ratio', formatNumber(environment.devicePixelRatio)],
                ['Window', `${environment.windowWidth} × ${environment.windowHeight} px`],
            ],
        },
        {
            title: 'Build',
            rows: [
                ['Version', build.version],
                ['Commit', build.maybeCommit?.slice(0, SHORT_COMMIT_LENGTH) ?? UNAVAILABLE],
                ['Built', formatBuildTime(build.timestamp)],
            ],
        },
    ];
}

/** Plain text for a bug report: a heading per section, `Name: value` lines, blank lines between. */
export function debugText(sections: readonly DebugSection[]): string {
    return sections
        .map(({ title, rows }) => [title, ...rows.map(([name, value]) => `${name}: ${value}`)].join('\n'))
        .join('\n\n');
}
```

- [ ] **Step 5: Run the tests and confirm they pass.**

Run: `bun test test/unit/debugInfo.test.ts test/unit/provenance.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify and commit.**

Run: `bun run verify`. Expected: all green.

```bash
git add src/shared/provenance.ts src/js/hud/debugInfo.ts test/unit/debugInfo.test.ts
git commit -F - <<'EOF'
Format the debug card's sections and copy text

View, pointer, document, input, environment, and build, with rounded
numbers, a selector-like element label, a browser name from client hints
or the user agent, and plain text ready for a bug report.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Shortcut rows

**Files:**
- Create: `src/js/hud/shortcuts.ts` (pure part only for now)
- Test: `test/unit/shortcuts.test.ts`

**Interfaces:**
- Consumes: `ClickAndDragBehavior`.
- Produces: `type ShortcutRow = readonly [action: string, keys: string]`, `shortcutRows(clickAndDragBehavior: ClickAndDragBehavior, isMac: boolean): ShortcutRow[]`. Task 11 adds the popover DOM builder to this file.

- [ ] **Step 1: Write the failing tests.** Create `test/unit/shortcuts.test.ts`:

```ts
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutRows } from '../../src/js/hud/shortcuts.ts';

/** The keys listed for `action`. */
function keysFor(rows: ReturnType<typeof shortcutRows>, action: string): string | undefined {
    return rows.find(([rowAction]) => rowAction === action)?.[1];
}

describe('shortcutRows', () => {
    test('lists drag as a pan in pan mode', () => {
        assert.equal(keysFor(shortcutRows('pan', false), 'Pan'), 'Drag, or hold Space and move');
    });

    test('lists drag as a zoom box in zoom box mode', () => {
        assert.equal(keysFor(shortcutRows('zoomBox', false), 'Zoom to an area'), 'Drag');
    });

    test('still lists Space panning in zoom box mode', () => {
        assert.equal(keysFor(shortcutRows('zoomBox', false), 'Pan'), 'Hold Space and move');
    });

    test('calls Alt Option on macOS', () => {
        assert.equal(keysFor(shortcutRows('pan', true), 'Zoom out'), 'Tap Option');
    });

    test('calls Alt Alt elsewhere', () => {
        assert.equal(keysFor(shortcutRows('pan', false), 'Zoom out'), 'Tap Alt');
    });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**

Run: `bun test test/unit/shortcuts.test.ts`
Expected: FAIL, because the module can't be found.

- [ ] **Step 3: Implement.** Create `src/js/hud/shortcuts.ts`:

```ts
/**
 * The `?` popover: the mouse and keyboard bindings that `svgNavigator.ts` listens for.
 * Keep these rows in step with the handlers there and the popup's Information tab.
 */

import type { ClickAndDragBehavior } from '../../shared/settings';

export type ShortcutRow = readonly [action: string, keys: string];

export function shortcutRows(clickAndDragBehavior: ClickAndDragBehavior, isMac: boolean): ShortcutRow[] {
    const dragRows: ShortcutRow[] = clickAndDragBehavior === 'pan'
        ? [['Pan', 'Drag, or hold Space and move']]
        : [['Zoom to an area', 'Drag'], ['Pan', 'Hold Space and move']];
    return [
        ['Zoom at the pointer', 'Scroll'],
        ...dragRows,
        ['Zoom in / out', 'Ctrl = / Ctrl −'],
        ['Zoom out', isMac ? 'Tap Option' : 'Tap Alt'],
        ['Reset view', 'Esc or Ctrl 0'],
    ];
}
```

- [ ] **Step 4: Run the tests and confirm they pass.**

Run: `bun test test/unit/shortcuts.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit.**

Run: `bun run verify`. Expected: all green.

```bash
git add src/js/hud/shortcuts.ts test/unit/shortcuts.test.ts
git commit -F - <<'EOF'
List the navigator's shortcuts for the HUD popover

The drag rows follow the click-and-drag setting, and Alt reads as
Option on macOS.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Shared E2E suite; split options tests out

This task is a pure refactor with no behavior change. It makes room under the 628-line limit for the HUD tests.

**Files:**
- Create: `test/e2e/suite.ts`, `test/e2e/options.test.ts`
- Modify: `test/e2e/navigator.test.ts` (rewritten onto the suite; options tests removed)

**Interfaces:**
- Produces: `class ExtensionSuite` with `browserName`, `page` (get and set; the setter resets `pageErrors` and listens for page errors), `pageErrors: string[]`, `launched(): Browser`, `fixtureOrigin(): string`, `extensionOrigin(): string`, `openSvg(fixturePath = '/simple.svg'): Promise<void>`, `setSettings(settings: Record<string, unknown>): Promise<void>`. Also `useExtensionSuite(browserName: string): ExtensionSuite`, which registers `before`/`after`/`beforeEach`/`afterEach` and must be called inside `describe`.

- [ ] **Step 1: Create `test/e2e/suite.ts`.**

```ts
/**
 * The per-browser test lifecycle every E2E file shares: one fixture server and one
 * browser per `describe`, a fresh page per test, a screenshot of every failure, and
 * settings cleared after each test.
 */

import { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'puppeteer';
import { evaluateInExtension, launchWithExtension, startFixtureServer, waitForNavigator } from './harness.ts';

const screenshotDir = fileURLToPath(new URL('../../test-results/e2e-screenshots/', import.meta.url));

export class ExtensionSuite {
    readonly browserName: string;
    pageErrors: string[] = [];
    #maybeServer: Awaited<ReturnType<typeof startFixtureServer>> | undefined;
    #maybeBrowser: Browser | undefined;
    #maybeExtensionOrigin: string | undefined;
    #maybePage: Page | undefined;

    constructor(browserName: string) {
        this.browserName = browserName;
    }

    /** The current test's page; only valid inside tests and per-test hooks. */
    get page(): Page {
        assert.ok(this.#maybePage, 'no page outside a test');
        return this.#maybePage;
    }

    /** Replaces the current page, e.g. after a test closes it on purpose. */
    set page(page: Page) {
        this.#maybePage = page;
        this.pageErrors = [];
        page.on('pageerror', (error) => this.pageErrors.push(error instanceof Error ? error.message : String(error)));
    }

    launched(): Browser {
        assert.ok(this.#maybeBrowser, `${this.browserName} failed to launch`);
        return this.#maybeBrowser;
    }

    fixtureOrigin(): string {
        assert.ok(this.#maybeServer, 'fixture server failed to start');
        return this.#maybeServer.origin;
    }

    extensionOrigin(): string {
        assert.ok(this.#maybeExtensionOrigin, `${this.browserName} has no extension origin`);
        return this.#maybeExtensionOrigin;
    }

    async openSvg(fixturePath = '/simple.svg'): Promise<void> {
        await this.page.goto(`${this.fixtureOrigin()}${fixturePath}`);
        await waitForNavigator(this.page);
    }

    /** Writes settings to sync storage, as the options popup would. */
    async setSettings(settings: Record<string, unknown>): Promise<void> {
        await evaluateInExtension(
            this.launched(),
            this.extensionOrigin(),
            (stored: Record<string, unknown>) => chrome.storage.sync.set(stored),
            settings,
        );
    }

    async setUp(): Promise<void> {
        this.#maybeServer = await startFixtureServer();
        const { browser, extensionOrigin } = await launchWithExtension(this.browserName);
        this.#maybeBrowser = browser;
        this.#maybeExtensionOrigin = extensionOrigin;
    }

    async tearDown(): Promise<void> {
        await this.#maybeBrowser?.close();
        await this.#maybeServer?.close();
    }

    async beforeTest(): Promise<void> {
        this.page = await this.launched().newPage();
    }

    async afterTest(t: { name: string }): Promise<void> {
        // `passed` exists at runtime (Bun's node:test, Node >= 20.12) but is missing from @types/node 22.
        if (!('passed' in t && t.passed === true)) {
            await mkdir(screenshotDir, { recursive: true });
            const name = `${this.browserName}-${t.name}`.replace(/[^a-z0-9-]+/gi, '_');
            await this.page.screenshot({ path: path.join(screenshotDir, `${name}.png`) });
        }
        await this.page.close();
        await evaluateInExtension(this.launched(), this.extensionOrigin(), () => chrome.storage.sync.clear());
    }
}

/** Registers the suite's hooks in the enclosing `describe` and returns it. */
export function useExtensionSuite(browserName: string): ExtensionSuite {
    const suite = new ExtensionSuite(browserName);
    before(() => suite.setUp());
    after(() => suite.tearDown());
    beforeEach(() => suite.beforeTest());
    afterEach((t) => suite.afterTest(t));
    return suite;
}
```

- [ ] **Step 2: Rewrite `test/e2e/navigator.test.ts` onto the suite.** Replace the whole file with:

```ts
/**
 * Cross-browser UI tests for navigation itself: drive the built extension with real
 * mouse and keyboard input and assert on what the user would see.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BROWSERS, getViewBox, waitForViewBoxChange } from './harness.ts';
import { useExtensionSuite } from './suite.ts';

for (const browserName of BROWSERS) {
    describe(browserName, () => {
        const suite = useExtensionSuite(browserName);

        test('wraps the SVG in an HTML page and shows the toolbar', async () => {
            // Act
            await suite.openSvg();

            // Assert
            assert.equal(await suite.page.$eval('svg', (svg) => svg.parentElement?.localName), 'body');
            assert.ok(await suite.page.$('.toolbarcontainer'), 'toolbar should be present');
        });

        test('scrolling the wheel up zooms in', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);
            await suite.page.mouse.move(400, 300);

            // Act
            await suite.page.mouse.wheel({ deltaY: -200 });

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(after.width < before.width, `width ${after.width} should be < ${before.width}`);
        });

        test('dragging with the mouse pans without zooming', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);

            // Act
            await suite.page.mouse.move(400, 300);
            await suite.page.mouse.down();
            await suite.page.mouse.move(300, 250, { steps: 5 });
            await suite.page.mouse.up();

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(after.x > before.x, 'dragging left should move the view right');
            assert.ok(after.y > before.y, 'dragging up should move the view down');
            assert.equal(after.width, before.width);
            assert.equal(after.height, before.height);
        });

        test('holding Space while moving the mouse pans without zooming', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);
            await suite.page.mouse.move(400, 300);

            // Act
            await suite.page.keyboard.down(' '); // Firefox's BiDi driver has no 'Space' key name
            await suite.page.mouse.move(300, 250, { steps: 5 });
            await suite.page.keyboard.up(' ');

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(after.x > before.x, 'moving left should move the view right');
            assert.ok(after.y > before.y, 'moving up should move the view down');
            assert.equal(after.width, before.width);
        });

        test('dragging in Zoom box mode zooms in to the dragged area', async () => {
            // Arrange
            await suite.setSettings({ clickAndDragBehavior: 'zoomBox' });
            await suite.openSvg();
            const before = await getViewBox(suite.page);

            // Act
            await suite.page.mouse.move(200, 150);
            await suite.page.mouse.down();
            await suite.page.mouse.move(400, 300, { steps: 5 });
            await suite.page.mouse.up();

            // Assert
            const after = await waitForViewBoxChange(suite.page, before);
            assert.ok(after.width < before.width, `width ${after.width} should be < ${before.width}`);
        });

        test('pressing Escape restores the original view', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);
            await suite.page.mouse.move(400, 300);
            await suite.page.mouse.wheel({ deltaY: -200 });
            const zoomed = await waitForViewBoxChange(suite.page, original);

            // Act
            await suite.page.keyboard.press('Escape');

            // Assert
            assert.deepEqual(await waitForViewBoxChange(suite.page, zoomed), original);
        });

        test('toolbar + zooms in and Reset restores the original view', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);

            // Act
            await suite.page.click('.toolbar > .toolbarbutton:nth-child(1)');
            const zoomed = await waitForViewBoxChange(suite.page, original);
            await suite.page.click('.toolbar > .toolbarbutton:nth-child(3)');
            const reset = await waitForViewBoxChange(suite.page, zoomed);

            // Assert
            assert.ok(zoomed.width < original.width, 'plus button should zoom in');
            assert.deepEqual(reset, original);
        });

        test('adds a viewBox to an SVG that lacks one', async () => {
            // Act
            await suite.openSvg('/no-viewbox.svg');

            // Assert
            const viewBox = await getViewBox(suite.page);
            assert.ok(viewBox.width > 0 && viewBox.height > 0, `unexpected viewBox ${JSON.stringify(viewBox)}`);
        });

        test('handles an SVG served from a URL without an .svg extension', async () => {
            // Act
            await suite.openSvg('/diagram');

            // Assert
            assert.ok(await suite.page.$('.toolbarcontainer'), 'toolbar should be present');
        });

        test('leaves HTML pages with inline SVG untouched', async () => {
            // Arrange
            const markerTimeoutMs = 1_000;

            // Act
            await suite.page.goto(`${suite.fixtureOrigin()}/inline.html`);
            const maybeReady = await suite.page
                .waitForSelector('html[data-svg-navigator]', { timeout: markerTimeoutMs })
                .catch(() => null);

            // Assert
            assert.equal(maybeReady, null, 'extension should not activate on HTML pages');
            assert.equal(await suite.page.$('.toolbarcontainer'), null);
            assert.equal(await suite.page.$eval('svg', (svg) => svg.getAttribute('viewBox')), '0 0 100 100');
        });

        test('loads without page errors', async () => {
            // Act
            await suite.openSvg();

            // Assert
            assert.deepEqual(suite.pageErrors, []);
        });

        test('applies a background color change to an open SVG', async () => {
            // Arrange
            await suite.openSvg();

            // Act
            await suite.setSettings({ svgBackgroundColor: 'rgb(255, 0, 0)' });

            // Assert
            await suite.page.waitForFunction(() => document.body.style.backgroundColor === 'rgb(255, 0, 0)', { timeout: 5_000 });
        });

        test('respects the toolbarEnabled setting', async () => {
            // Arrange
            await suite.setSettings({ toolbarEnabled: false });

            // Act
            await suite.openSvg();

            // Assert
            assert.equal(await suite.page.$('.toolbarcontainer'), null);
        });
    });
}
```

- [ ] **Step 3: Create `test/e2e/options.test.ts`** with the popup tests moved over unchanged in meaning:

```ts
/**
 * Cross-browser UI tests for the options popup: it shows stored settings and saves
 * every change to sync storage.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BROWSERS, clickInExtensionPage, openOptionsPage, waitForStoredSetting } from './harness.ts';
import { useExtensionSuite } from './suite.ts';

for (const browserName of BROWSERS) {
    describe(browserName, () => {
        const suite = useExtensionSuite(browserName);

        test('options popup renders its settings', async () => {
            // Act
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Assert
            const text = await suite.page.$eval('body', (body) => (body as HTMLElement).innerText);
            assert.match(text, /Click and drag/);
            assert.match(text, /Scroll sensitivity/);
            assert.match(text, /Background color/);
            assert.deepEqual(suite.pageErrors, []);
        });

        test('options popup footer shows the version, commit, and build time', async () => {
            // Act
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Assert
            const text = await suite.page.$eval('#versionInfo', (footer) => footer.textContent);
            assert.match(text, /^Version [\d.]+ · Commit ([0-9a-f]{7}|Unavailable) · Built \d{4}-\d\d-\d\d \d\d:\d\d UTC$/);
        });

        test('options popup footer links to the source in a new tab', async () => {
            // Act
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Assert
            const link = await suite.page.$eval('.footer-links a[href^="https://github.com/"]', (anchor) => ({ target: anchor.target, rel: anchor.rel }));
            assert.deepEqual(link, { target: '_blank', rel: 'noopener noreferrer' });
        });

        test('options popup shows the stored settings', async () => {
            // Arrange
            await suite.setSettings({
                clickAndDragBehavior: 'zoomBox',
                scrollSensitivity: 3.5,
                toolbarEnabled: false,
                svgBackgroundColor: 'black',
            });

            // Act
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Assert
            const shown = await suite.page.evaluate(() => ({
                clickAndDrag: document.querySelector<HTMLInputElement>('input[name="clickAndDragBehavior"]:checked')?.value,
                sensitivity: document.querySelector<HTMLInputElement>('#scrollSensitivity')?.value,
                toolbarEnabled: document.querySelector<HTMLInputElement>('#toolbarEnabled')?.checked,
                toolbarAutoHide: document.querySelector<HTMLInputElement>('#toolbarAutoHide')?.checked,
                toolbarAutoHideDisabled: document.querySelector<HTMLInputElement>('#toolbarAutoHide')?.disabled,
                background: document.querySelector<HTMLInputElement>('#svgBackgroundColor')?.value,
            }));
            assert.deepEqual(shown, {
                clickAndDrag: 'zoomBox',
                sensitivity: '3.5',
                toolbarEnabled: false,
                toolbarAutoHide: true,
                toolbarAutoHideDisabled: true,
                background: 'black',
            });
        });

        test('options popup saves a toggled setting', async () => {
            // Arrange
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act
            await clickInExtensionPage(suite.page, '#toolbarEnabled');

            // Assert
            await waitForStoredSetting(suite.page, 'toolbarEnabled', false);
        });

        test('options popup saves a typed background color even when closed right away', async () => {
            // Arrange
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act: type, then close the popup before the save delay elapses.
            await suite.page.evaluate(() => {
                const input = document.querySelector<HTMLInputElement>('#svgBackgroundColor');
                if (!input) { throw new Error('missing #svgBackgroundColor'); }
                input.value = 'black';
                input.dispatchEvent(new Event('input'));
            });
            await suite.page.close();
            suite.page = await suite.launched().newPage();

            // Assert
            await openOptionsPage(suite.page, suite.extensionOrigin());
            await waitForStoredSetting(suite.page, 'svgBackgroundColor', 'black');
        });

        test('options popup saves the clicked color preset', async () => {
            // Arrange
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act
            await clickInExtensionPage(suite.page, '.preset[data-color="black"]');

            // Assert
            await waitForStoredSetting(suite.page, 'svgBackgroundColor', 'black');
            assert.equal(await suite.page.$eval('#svgBackgroundColor', (input) => (input as HTMLInputElement).value), 'black');
        });

        test('options popup resets every setting after a confirming second click', async () => {
            // Arrange
            await suite.setSettings({ scrollSensitivity: 2, toolbarEnabled: false, svgBackgroundColor: 'black' });
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act
            await clickInExtensionPage(suite.page, '#resetAll');
            await clickInExtensionPage(suite.page, '#resetAll');

            // Assert
            await waitForStoredSetting(suite.page, 'scrollSensitivity', 7);
            await waitForStoredSetting(suite.page, 'toolbarEnabled', true);
            await waitForStoredSetting(suite.page, 'svgBackgroundColor', 'white');
            assert.equal(await suite.page.$eval('#scrollSensitivity', (input) => (input as HTMLInputElement).value), '7');
        });

        test('options popup does not reset on a single click', async () => {
            // Arrange
            await suite.setSettings({ scrollSensitivity: 2 });
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act
            await clickInExtensionPage(suite.page, '#resetAll');

            // Assert
            await waitForStoredSetting(suite.page, 'scrollSensitivity', 2);
            assert.match(await suite.page.$eval('#resetAll', (button) => button.textContent ?? ''), /Click again/);
        });
    });
}
```

- [ ] **Step 4: Run the E2E suite and confirm nothing changed.**

Run: `bun run test:e2e`
Expected: PASS, with the same tests as before (now in two files) green in Chrome and Firefox. If anything fails, compare against a clean `HEAD` worktree before blaming the environment (AGENTS.md).

- [ ] **Step 5: Verify and commit.**

Run: `bun run verify`. Expected: all green.

```bash
git add test/e2e/suite.ts test/e2e/navigator.test.ts test/e2e/options.test.ts
git commit -F - <<'EOF'
Share the E2E browser lifecycle and split out the options tests

useExtensionSuite owns the fixture server, browser, per-test page,
failure screenshots, and settings cleanup, so new test files don't copy
it. The options popup tests move to their own file, keeping each under
the line limit as the HUD tests arrive.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: Shadow-DOM HUD with the zoom pill (replaces the old toolbar)

**Files:**
- Create: `src/js/hud/icons.ts`, `src/js/hud/dom.ts`, `src/js/hud/styles.ts`, `src/js/hud/shadowHost.ts`, `src/js/hud/pill.ts`, `src/js/hud/hud.ts`
- Create: `test/e2e/hud.test.ts`, `test/e2e/fixtures/hostile-style.svg`, `test/e2e/fixtures/styled-page.html`
- Modify: `src/js/svgNavigator.ts`, `src/manifest.json`, `test/e2e/harness.ts`, `test/e2e/navigator.test.ts`
- Delete: `src/js/toolbar.ts`, `src/css/svgNavigator.css`

**Interfaces:**
- Consumes: `hudLayout` (Task 3), `zoomLabel` (Task 2), `displayedZoom` (Task 2), `ToolbarPosition` (Task 1).
- Produces:
  - `HUD_HOST_TAG = 'svg-navigator-hud'` (shadowHost.ts)
  - `mountHud(htmlDoc: Document, options: HudOptions): HudHandle`, with `HudOptions = { actions: HudActions; toolbarEnabled: boolean; position: ToolbarPosition }`, `HudActions = { zoomIn: () => void; zoomOut: () => void; reset: () => void }` and `HudHandle = { setZoom(ratio: number): void; setToolbarEnabled(enabled: boolean): void; setPosition(position: ToolbarPosition): void; destroy(): void }`
  - DOM classes the tests use: `.dock[data-position]`, `.pill[data-orientation]`, `.zoom-out`, `.zoom-label`, `.zoom-in`
  - Harness exports: `HUD_HOST`, `maybeHudElement`, `hudElement`, `hudText`, `hudComputedStyle`, `waitForHudElement`, `waitForHudAttribute`
  - Fixture route `/csp.svg`, which serves `simple.svg` with `content-security-policy: default-src 'none'`

- [ ] **Step 1: Add HUD helpers and header-carrying routes to `test/e2e/harness.ts`.**

Change the Puppeteer import to `import puppeteer, { type Browser, type ElementHandle, type EvaluateFunc, type Page } from 'puppeteer';`.

Replace the `EXTENSIONLESS_ROUTES` constant with:

```ts
// Paths served from another file, or with extra headers, to exercise edge cases.
const ROUTES: Record<string, { file: string, headers: Record<string, string> }> = {
    // No file extension: exercises content-based SVG detection.
    '/diagram': { file: 'simple.svg', headers: {} },
    // The strictest policy a page can send: the HUD must still be styled.
    '/csp.svg': { file: 'simple.svg', headers: { 'content-security-policy': "default-src 'none'" } },
};
```

In `startFixtureServer`, replace the first two lines of the request handler and the `writeHead(200, …)` call:

```ts
        const { pathname } = new URL(request.url ?? '/', 'http://localhost');
        const maybeRoute = ROUTES[pathname];
        const fileName = maybeRoute?.file ?? path.basename(decodeURIComponent(pathname));
        readFile(path.join(dir, fileName)).then(
            (body) => {
                response.writeHead(200, { 'content-type': CONTENT_TYPES[path.extname(fileName)], ...maybeRoute?.headers });
                response.end(body);
            },
```

Append the HUD helpers to the end of the file:

```ts
/** The HUD's shadow host tag; matches `HUD_HOST_TAG` in `src/js/hud/shadowHost.ts`. */
export const HUD_HOST = 'svg-navigator-hud';

/**
 * Finds `selector` inside the HUD's open shadow root, or returns null. Evaluated in
 * the page, which sees the content script's shadow root because it is open.
 */
export async function maybeHudElement(page: Page, selector: string): Promise<ElementHandle<Element> | null> {
    const handle = await page.evaluateHandle(
        (host: string, target: string) => document.querySelector(host)?.shadowRoot?.querySelector(target) ?? null,
        HUD_HOST,
        selector,
    );
    const maybeElement = handle.asElement();
    if (maybeElement === null) {
        await handle.dispose();
    }
    return maybeElement as ElementHandle<Element> | null;
}

export async function hudElement(page: Page, selector: string): Promise<ElementHandle<Element>> {
    const maybeElement = await maybeHudElement(page, selector);
    if (maybeElement === null) {
        throw new Error(`No HUD element matches ${selector}`);
    }
    return maybeElement;
}

export async function hudText(page: Page, selector: string): Promise<string | null> {
    return page.evaluate(
        (host: string, target: string) => document.querySelector(host)?.shadowRoot?.querySelector(target)?.textContent ?? null,
        HUD_HOST,
        selector,
    );
}

/** A computed style property of a HUD element, or null when the element is missing. */
export async function hudComputedStyle(page: Page, selector: string, property: string): Promise<string | null> {
    return page.evaluate(
        (host: string, target: string, name: string) => {
            const maybeElement = document.querySelector(host)?.shadowRoot?.querySelector(target);
            return maybeElement ? getComputedStyle(maybeElement).getPropertyValue(name) : null;
        },
        HUD_HOST,
        selector,
        property,
    );
}

/** Waits until a HUD element matching `selector` exists (or, with `present: false`, doesn't). */
export async function waitForHudElement(page: Page, selector: string, present: boolean): Promise<void> {
    await page.waitForFunction(
        (host: string, target: string, shouldExist: boolean) =>
            Boolean(document.querySelector(host)?.shadowRoot?.querySelector(target)) === shouldExist,
        { timeout: 5_000 },
        HUD_HOST,
        selector,
        present,
    );
}

/** Waits until a HUD element's `attribute` equals `expected`; null means the attribute is absent. */
export async function waitForHudAttribute(page: Page, selector: string, attribute: string, expected: string | null): Promise<void> {
    await page.waitForFunction(
        (host: string, target: string, name: string, value: string | null) =>
            document.querySelector(host)?.shadowRoot?.querySelector(target)?.getAttribute(name) === value,
        { timeout: 5_000 },
        HUD_HOST,
        selector,
        attribute,
        expected,
    );
}

export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
```

If `bun run typecheck` flags the `as ElementHandle<Element> | null` cast as unnecessary, delete the cast and keep the declared return type.

- [ ] **Step 2: Add the isolation fixtures.**

`test/e2e/fixtures/hostile-style.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <!-- Once wrapped in HTML, an SVG's own stylesheet applies to the whole page. -->
    <style>svg-navigator-hud, div, button { display: none !important; opacity: 0 !important; }</style>
    <rect x="0" y="0" width="800" height="600" fill="#eef"/>
</svg>
```

`test/e2e/fixtures/styled-page.html`:

```html
<!DOCTYPE html>
<html>
    <head><meta charset="utf-8"><title>Toolbar class names</title></head>
    <body>
        <p>A page whose own markup uses the class names the old toolbar stylesheet targeted.</p>
        <div class="toolbarcontainer"><div class="toolbar"><span class="toolbarbutton">Page button</span></div></div>
    </body>
</html>
```

- [ ] **Step 3: Write the failing HUD E2E tests.** Create `test/e2e/hud.test.ts`:

```ts
/**
 * Cross-browser UI tests for the HUD: the control pill in its shadow root, how it
 * follows the view and the settings, and that pages and the HUD can't restyle each other.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    BROWSERS,
    HUD_HOST,
    delay,
    getViewBox,
    hudComputedStyle,
    hudElement,
    hudText,
    maybeHudElement,
    waitForHudAttribute,
    waitForHudElement,
    waitForViewBoxChange,
} from './harness.ts';
import { useExtensionSuite } from './suite.ts';

/** Long enough for a stray pan or zoom to have landed. */
const SETTLE_MS = 300;

for (const browserName of BROWSERS) {
    describe(browserName, () => {
        const suite = useExtensionSuite(browserName);

        test('shows the pill over a wrapped SVG', async () => {
            // Act
            await suite.openSvg();

            // Assert
            assert.ok(await maybeHudElement(suite.page, '.pill'), 'pill should be present');
        });

        test('+ zooms in and the readout follows', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);

            // Act
            await (await hudElement(suite.page, '.zoom-in')).click();

            // Assert
            const zoomed = await waitForViewBoxChange(suite.page, original);
            assert.ok(zoomed.width < original.width, 'plus should zoom in');
            assert.equal(await hudText(suite.page, '.zoom-label'), '125%');
        });

        test('clicking the readout restores the original view', async () => {
            // Arrange
            await suite.openSvg();
            const original = await getViewBox(suite.page);
            await (await hudElement(suite.page, '.zoom-in')).click();
            const zoomed = await waitForViewBoxChange(suite.page, original);

            // Act
            await (await hudElement(suite.page, '.zoom-label')).click();

            // Assert
            assert.deepEqual(await waitForViewBoxChange(suite.page, zoomed), original);
            assert.equal(await hudText(suite.page, '.zoom-label'), '100%');
        });

        test('scrolling over the pill leaves the view alone', async () => {
            // Arrange
            await suite.openSvg();
            const before = await getViewBox(suite.page);
            const box = await (await hudElement(suite.page, '.pill')).boundingBox();
            assert.ok(box, 'pill should have a box');
            await suite.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

            // Act
            await suite.page.mouse.wheel({ deltaY: -200 });
            await delay(SETTLE_MS);

            // Assert
            assert.deepEqual(await getViewBox(suite.page), before);
        });

        test('Space on a focused HUD button does not start a pan', async () => {
            // Arrange: the readout resets, which changes nothing at the original view.
            await suite.openSvg();
            const before = await getViewBox(suite.page);
            await (await hudElement(suite.page, '.zoom-label')).focus();
            await suite.page.mouse.move(400, 300);

            // Act
            await suite.page.keyboard.down(' '); // Firefox's BiDi driver has no 'Space' key name
            await suite.page.mouse.move(300, 250, { steps: 5 });
            await suite.page.keyboard.up(' ');
            await delay(SETTLE_MS);

            // Assert
            assert.deepEqual(await getViewBox(suite.page), before);
        });

        test('respects the toolbarEnabled setting', async () => {
            // Arrange
            await suite.setSettings({ toolbarEnabled: false });

            // Act
            await suite.openSvg();

            // Assert
            assert.equal(await maybeHudElement(suite.page, '.pill'), null);
        });

        test('removes the pill live when the toolbar is turned off', async () => {
            // Arrange
            await suite.openSvg();

            // Act
            await suite.setSettings({ toolbarEnabled: false });

            // Assert
            await waitForHudElement(suite.page, '.pill', false);
        });

        test('moves the pill live when the position changes, upright on a side edge', async () => {
            // Arrange
            await suite.openSvg();

            // Act
            await suite.setSettings({ toolbarPosition: 'left' });

            // Assert
            await waitForHudAttribute(suite.page, '.dock', 'data-position', 'left');
            const box = await (await hudElement(suite.page, '.pill')).boundingBox();
            assert.ok(box, 'pill should have a box');
            assert.ok(box.x < 100, `pill should hug the left edge, got x=${box.x}`);
            assert.ok(box.height > box.width, 'pill should be vertical on a side edge');
        });

        test('is styled under a strict Content-Security-Policy', async () => {
            // Act
            await suite.openSvg('/csp.svg');

            // Assert
            assert.equal(await hudComputedStyle(suite.page, '.dock', 'position'), 'fixed');
        });

        test('cannot be hidden by the SVG\'s own stylesheet', async () => {
            // Act
            await suite.openSvg('/hostile-style.svg');

            // Assert
            const box = await (await hudElement(suite.page, '.pill')).boundingBox();
            assert.ok(box && box.width > 0 && box.height > 0, 'pill should still be laid out');
            assert.equal(await suite.page.$eval(HUD_HOST, (host) => getComputedStyle(host).display), 'block');
        });

        test('leaves the styling of HTML pages alone', async () => {
            // Act
            await suite.page.goto(`${suite.fixtureOrigin()}/styled-page.html`);

            // Assert
            assert.equal(await suite.page.$eval('.toolbarcontainer', (element) => getComputedStyle(element).opacity), '1');
        });
    });
}
```

- [ ] **Step 4: Run the HUD tests and confirm they fail.**

Run: `bun run build:dev && bun test test/e2e/hud.test.ts`
Expected: FAIL. The pill and HUD lookups throw `No HUD element matches .pill`, and "leaves the styling of HTML pages alone" fails with opacity `0`, which proves the current stylesheet leak.

- [ ] **Step 5: Create `src/js/hud/icons.ts`.**

```ts
/** The HUD's icons: 24×24 stroked paths drawn inline, so there's no icon font to load. */

const SVG_NS = 'http://www.w3.org/2000/svg';

const PATHS = {
    minus: 'M5 12h14',
    plus: 'M12 5v14M5 12h14',
    background: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 3v18M12 8h7M12 12h9M12 16h7',
    maximize: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    minimize: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
    help: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
    copy: 'M8 8h11v11H8zM5 16V5h11',
    check: 'M5 12l4 4 10-10',
} as const;

export type IconName = keyof typeof PATHS;

/** A decorative icon; its button carries the accessible name. */
export function icon(htmlDoc: Document, name: IconName): SVGSVGElement {
    const svg = htmlDoc.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = htmlDoc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', PATHS[name]);
    svg.append(path);
    return svg;
}
```

- [ ] **Step 6: Create `src/js/hud/dom.ts`.**

```ts
/** Button builders for the HUD. `htmlDoc` makes real HTML elements even in an XML page. */

import { icon, type IconName } from './icons';

export interface ButtonSpec {
    className: string;
    /** The accessible name. */
    label: string;
    /** The hover tooltip; include the keyboard shortcut when there is one. */
    title: string;
    onClick: () => void;
}

export function button(htmlDoc: Document, { className, label, title, onClick }: ButtonSpec): HTMLButtonElement {
    const element = htmlDoc.createElement('button');
    element.type = 'button';
    element.className = className;
    element.setAttribute('aria-label', label);
    element.title = title;
    element.addEventListener('click', () => onClick());
    return element;
}

export function iconButton(htmlDoc: Document, iconName: IconName, spec: ButtonSpec): HTMLButtonElement {
    const element = button(htmlDoc, spec);
    element.append(icon(htmlDoc, iconName));
    return element;
}
```

- [ ] **Step 7: Create `src/js/hud/styles.ts`.** It holds the complete stylesheet, including rules the popover and debug card use in later tasks:

```ts
/**
 * The HUD's stylesheet, adopted inside its shadow root. Colors follow the options
 * popup (`src/options/options.css`), light or dark by the OS setting.
 */
export const HUD_CSS = `
:host {
    all: initial;
    --surface: #fff;
    --text: #1f2328;
    --muted: #656d76;
    --border: #e1e4e8;
    --hover: rgb(0 0 0 / 6%);
    --active: rgb(0 0 0 / 12%);
    --accent: #1a73e8;
    --shadow: 0 1px 2px rgb(0 0 0 / 8%), 0 4px 12px rgb(0 0 0 / 10%);
    --edge: 16px;
    --radius: 10px;
    --mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    color-scheme: light dark;
    color: var(--text);
    font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
}

@media (prefers-color-scheme: dark) {
    :host {
        --surface: #26282b;
        --text: #e8eaed;
        --muted: #9aa0a6;
        --border: #3c4043;
        --hover: rgb(255 255 255 / 8%);
        --active: rgb(255 255 255 / 16%);
        --accent: #8ab4f8;
        --shadow: 0 1px 2px rgb(0 0 0 / 30%), 0 4px 12px rgb(0 0 0 / 35%);
    }
}

*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
button { font: inherit; color: inherit; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.icon {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}

/* The dock holds the pill and its popover, pinned to an edge or corner. */
.dock { position: fixed; pointer-events: auto; transition: opacity 200ms ease; }
.dock[data-hidden] { opacity: 0; pointer-events: none; }
.dock[data-position^="top"] { top: calc(var(--edge) + env(safe-area-inset-top, 0px)); }
.dock[data-position^="bottom"] { bottom: calc(var(--edge) + env(safe-area-inset-bottom, 0px)); }
.dock[data-position$="left"] { left: calc(var(--edge) + env(safe-area-inset-left, 0px)); }
.dock[data-position$="right"] { right: calc(var(--edge) + env(safe-area-inset-right, 0px)); }
.dock:is([data-position="top"], [data-position="bottom"]) { left: 50%; transform: translateX(-50%); }
.dock:is([data-position="left"], [data-position="right"]) { top: 50%; transform: translateY(-50%); }

.pill {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow);
}
.pill[data-orientation="vertical"] { flex-direction: column; }
.pill button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--muted);
    cursor: pointer;
}
.pill button:hover { background: var(--hover); color: var(--text); }
.pill button:active { background: var(--active); }
.pill .zoom-label {
    min-width: 56px;
    padding: 0 8px;
    color: var(--text);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}
.separator { flex: none; width: 1px; height: 18px; margin: 0 3px; background: var(--border); }
.pill[data-orientation="vertical"] .separator { width: 18px; height: 1px; margin: 3px 0; }
.pill[data-orientation="vertical"] .zoom-in { order: 1; }
.pill[data-orientation="vertical"] .zoom-label { order: 2; min-width: 32px; height: 28px; padding: 0 2px; font-size: 11px; }
.pill[data-orientation="vertical"] .zoom-out { order: 3; }
.pill[data-orientation="vertical"] :is(.separator, .utility) { order: 4; }

.popover {
    position: absolute;
    width: max-content;
    max-width: 300px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
}
.popover[data-direction="top"] { bottom: calc(100% + 8px); }
.popover[data-direction="bottom"] { top: calc(100% + 8px); }
.popover[data-direction="left"] { right: calc(100% + 8px); top: 50%; transform: translateY(-50%); }
.popover[data-direction="right"] { left: calc(100% + 8px); top: 50%; transform: translateY(-50%); }
.dock:is([data-position="top-left"], [data-position="bottom-left"]) .popover { left: 0; }
.dock:is([data-position="top-right"], [data-position="bottom-right"]) .popover { right: 0; }
.dock:is([data-position="top"], [data-position="bottom"]) .popover { left: 50%; transform: translateX(-50%); }
.popover h2 {
    margin: 0 0 6px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}
.popover dl { display: grid; grid-template-columns: auto auto; gap: 4px 16px; margin: 0; }
.popover dd { margin: 0; color: var(--muted); text-align: right; }

.debug, .debug-chip { position: fixed; top: calc(var(--edge) + env(safe-area-inset-top, 0px)); }
:is(.debug, .debug-chip)[data-corner="top-left"] { left: calc(var(--edge) + env(safe-area-inset-left, 0px)); }
:is(.debug, .debug-chip)[data-corner="top-right"] { right: calc(var(--edge) + env(safe-area-inset-right, 0px)); }
.debug {
    width: 300px;
    max-height: calc(100vh - 2 * var(--edge));
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    font-size: 12px;
}
.debug-header {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 4px 4px 10px;
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    pointer-events: auto;
}
.debug-header span { margin-right: auto; }
.debug-header button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--muted);
    cursor: pointer;
}
.debug-header button:hover { background: var(--hover); color: var(--text); }
.debug-header .icon { width: 15px; height: 15px; }
/* The body never takes the pointer, so the card never blocks panning underneath. */
.debug-body { padding: 4px 10px 8px; pointer-events: none; }
.debug-body h3 {
    margin: 6px 0 2px;
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}
.debug-body dl { display: grid; grid-template-columns: max-content 1fr; gap: 1px 10px; margin: 0; }
.debug-body dt { color: var(--muted); }
.debug-body dd { margin: 0; font: 12px/1.4 var(--mono); overflow-wrap: anywhere; }
.debug-chip {
    padding: 4px 12px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
    .dock { transition: none; }
}
`;
```

- [ ] **Step 8: Create `src/js/hud/shadowHost.ts`.**

```ts
/** The HUD's shadow host: one element whose page-facing styles the page can't override. */

export const HUD_HOST_TAG = 'svg-navigator-hud';

// Inline `!important` outranks every page stylesheet rule, `!important` ones included,
// so even an SVG's own `<style>` can't hide or move the host.
const HOST_STYLE: Readonly<Record<string, string>> = {
    'display': 'block',
    'position': 'fixed',
    'inset': '0',
    'margin': '0',
    'padding': '0',
    'border': 'none',
    'background': 'none',
    'opacity': '1',
    'visibility': 'visible',
    'transform': 'none',
    'filter': 'none',
    'clip-path': 'none',
    // The host covers the window; only the HUD's own controls take the pointer.
    'pointer-events': 'none',
    'z-index': '2147483647',
};

export function createShadowHost(htmlDoc: Document, parent: HTMLElement, css: string): { host: HTMLElement, root: ShadowRoot } {
    // A custom element name: allowed to host a shadow root without being registered.
    const host = htmlDoc.createElement(HUD_HOST_TAG);
    for (const [property, value] of Object.entries(HOST_STYLE)) {
        host.style.setProperty(property, value, 'important');
    }
    // Open, so E2E tests can reach inside; the HUD holds nothing the page shouldn't see.
    const root = host.attachShadow({ mode: 'open' });
    adoptStyles(htmlDoc, root, css);
    parent.append(host);
    return { host, root };
}

/**
 * Prefers a constructed stylesheet, which no page Content-Security-Policy can block.
 * An engine that rejects a sheet built in the content script's world for a page's
 * shadow root gets a `<style>` element instead.
 */
function adoptStyles(htmlDoc: Document, root: ShadowRoot, css: string): void {
    try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = [sheet];
    } catch (error) {
        console.debug('SVG Navigator: constructed stylesheet rejected; using a <style> element', error);
        const style = htmlDoc.createElement('style');
        style.textContent = css;
        root.prepend(style);
    }
}
```

- [ ] **Step 9: Create `src/js/hud/pill.ts`** (the zoom group only for now):

```ts
/** The pill of HUD buttons. Builds DOM only; `hud.ts` wires placement and behavior. */

import { button, iconButton } from './dom';

export interface PillActions {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
}

export interface Pill {
    element: HTMLDivElement;
    setZoomLabel: (text: string) => void;
}

export function createPill(htmlDoc: Document, actions: PillActions): Pill {
    const element = htmlDoc.createElement('div');
    element.className = 'pill';
    element.setAttribute('role', 'toolbar');
    element.setAttribute('aria-label', 'SVG Navigator');

    const zoomLabelButton = button(htmlDoc, {
        className: 'zoom-label',
        label: 'Reset zoom',
        title: 'Reset to 100% (Esc)',
        onClick: actions.reset,
    });
    element.append(
        iconButton(htmlDoc, 'minus', { className: 'zoom-out', label: 'Zoom out', title: 'Zoom out (Ctrl −)', onClick: actions.zoomOut }),
        zoomLabelButton,
        iconButton(htmlDoc, 'plus', { className: 'zoom-in', label: 'Zoom in', title: 'Zoom in (Ctrl =)', onClick: actions.zoomIn }),
    );

    const setZoomLabel = (text: string): void => {
        zoomLabelButton.textContent = text;
        zoomLabelButton.setAttribute('aria-label', `Zoom ${text}, reset to 100%`);
    };
    setZoomLabel('100%');
    return { element, setZoomLabel };
}
```

- [ ] **Step 10: Create `src/js/hud/hud.ts`.**

```ts
/**
 * The heads-up display over a navigated SVG: a control pill pinned to a window edge or
 * corner, inside one shadow root so page styles can't reach it and its styles can't
 * reach the page. `svgNavigator.ts` drives it through the returned `HudHandle`.
 */

import type { ToolbarPosition } from '../../shared/settings';
import { hudLayout } from './layout';
import { createPill } from './pill';
import { createShadowHost } from './shadowHost';
import { HUD_CSS } from './styles';
import { zoomLabel } from './zoomLabel';

export interface HudActions {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
}

export interface HudOptions {
    actions: HudActions;
    toolbarEnabled: boolean;
    position: ToolbarPosition;
}

export interface HudHandle {
    setZoom: (ratio: number) => void;
    setToolbarEnabled: (enabled: boolean) => void;
    setPosition: (position: ToolbarPosition) => void;
    destroy: () => void;
}

/**
 * Mounts the HUD on `document.body`. `htmlDoc` creates the elements: in a standalone
 * SVG page `document` is an XML document whose `createElement` makes unstyled elements.
 */
export function mountHud(htmlDoc: Document, options: HudOptions): HudHandle {
    const { host, root } = createShadowHost(htmlDoc, document.body, HUD_CSS);
    const listeners = new AbortController();
    const { signal } = listeners;

    const pill = createPill(htmlDoc, options.actions);
    const dock = htmlDoc.createElement('div');
    dock.className = 'dock';
    dock.append(pill.element);

    function setPosition(position: ToolbarPosition): void {
        dock.dataset.position = position;
        pill.element.dataset.orientation = hudLayout(position).orientation;
    }

    function setToolbarEnabled(enabled: boolean): void {
        if (enabled) {
            root.append(dock);
        } else {
            dock.remove();
        }
    }

    // A focused button activates on Space; the navigator must not also start a spacebar pan.
    root.addEventListener('keydown', (event) => {
        if (event instanceof KeyboardEvent && event.key === ' ' && isButton(event.composedPath()[0])) {
            event.stopPropagation();
        }
    }, { signal });
    // The navigator only zooms on wheel events over the SVG; this stops the page scrolling.
    dock.addEventListener('wheel', (event) => event.preventDefault(), { passive: false, signal });

    setPosition(options.position);
    setToolbarEnabled(options.toolbarEnabled);

    return {
        setZoom: (ratio) => pill.setZoomLabel(zoomLabel(ratio)),
        setToolbarEnabled,
        setPosition,
        destroy: () => {
            listeners.abort();
            host.remove();
        },
    };
}

function isButton(maybeTarget: EventTarget | undefined): boolean {
    return maybeTarget instanceof Element && maybeTarget.localName === 'button';
}
```

- [ ] **Step 11: Wire the HUD into `src/js/svgNavigator.ts`.**

1. Replace `import { addToolbar } from './toolbar';` with `import { mountHud, type HudHandle } from './hud/hud';`. Add `displayedZoom,` to the `./viewBox` import list (alphabetical, before `fitToAspectRatio`). Add `type SettingKey,` to the settings import list (before `type Settings`).
2. Below `let zoomRectangle: SVGRectElement;`, add:

```ts
// mounted in main() before any listener that zooms is attached
let hud: HudHandle;
```

3. In `main()`, replace `maybeAddToolbar();` with:

```ts
    hud = mountHud(htmlDoc, {
        actions: { zoomIn: () => zoomBy(0.8), zoomOut: () => zoomBy(1.25), reset: resetViewBox },
        toolbarEnabled: settings.toolbarEnabled,
        position: settings.toolbarPosition,
    });
```

   Move `addEventListeners();` so it comes *after* the `mountHud` call. Keep `applyBackgroundColor();` and `maybePrintDebugInfo();` after it, then add `hud.setZoom(currentZoom());`. The block now reads:

```ts
    settings = await loadSettingsOrDefaults();
    hud = mountHud(htmlDoc, {
        actions: { zoomIn: () => zoomBy(0.8), zoomOut: () => zoomBy(1.25), reset: resetViewBox },
        toolbarEnabled: settings.toolbarEnabled,
        position: settings.toolbarPosition,
    });
    addEventListeners();
    applyBackgroundColor();
    maybePrintDebugInfo();
    hud.setZoom(currentZoom());
```

4. Delete the whole `maybeAddToolbar()` function.
5. Replace `onSettingsChanged` with this version and the new `applySetting`:

```ts
function onSettingsChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): void {
    if(areaName !== 'sync') { return; }
    for (const [key, { newValue }] of Object.entries(changes)) {
        if(!isSettingKey(key)) { continue; }
        settings = parseSettings({ ...settings, [key]: newValue });
        applySetting(key);
    }
}

// Settings without a case here take effect on the next page load.
function applySetting(key: SettingKey): void {
    switch(key) {
        case 'showDebugInfo':
            maybePrintDebugInfo();
            if(settings.showDebugInfo) {
                document.addEventListener('mousemove', trackMouseForDebugInfo, false);
            }
            break;
        case 'svgBackgroundColor':
            applyBackgroundColor();
            break;
        case 'toolbarEnabled':
            hud.setToolbarEnabled(settings.toolbarEnabled);
            break;
        case 'toolbarPosition':
            hud.setPosition(settings.toolbarPosition);
            break;
        default:
            break;
    }
}
```

6. In `addEventListeners()`, after the `wheel` listener line, add:

```ts
    // The readout compares views as displayed, which depends on the window's shape.
    window.addEventListener('resize', () => hud.setZoom(currentZoom()));
```

7. The `true` overloads of `zoomOut` and `zoomOriginal` existed only for the old toolbar. Replace both functions:

```ts
// zoom out when the user taps the Alt key
function zoomOut(evt: KeyboardEvent): void {
    if(!isZoomingOrPanning() && evt.type === 'keyup' && keyCodeOf(evt) === 18) {
        zoomBy(1.25);
    }
}
```

```ts
// zoom back to the original view when Escape is released
function zoomOriginal(evt: KeyboardEvent): void {
    if(isZoomingOrPanning()) { return; }
    if(evt.type === 'keyup' && keyCodeOf(evt) === 27) {
        resetViewBox();
    }
}
```

8. Update the comment above `let originalViewBox` from `// the view that Escape, Ctrl+0, and Reset return to` to `// the view that Escape, Ctrl+0, and the HUD's zoom readout return to`.
9. Replace `setViewBox()` and add `currentZoom()` right after it:

```ts
function setViewBox(): void {
    svgDocument.setAttribute('viewBox', formatViewBox(viewBox));
    hud.setZoom(currentZoom());
    maybePrintDebugInfo();
}

function currentZoom(): number {
    return displayedZoom(originalViewBox, viewBox, getWidth()/getHeight());
}
```

- [ ] **Step 12: Delete the old toolbar and its global stylesheet.**

```bash
git rm src/js/toolbar.ts src/css/svgNavigator.css
```

In `src/manifest.json`, delete the line `"css": ["css/svgNavigator.css"]` and the trailing comma after `"js": ["js/svgNavigator.js"]`, so the content script entry ends with `"js": ["js/svgNavigator.js"]`.

- [ ] **Step 13: Point the navigator tests at the HUD host.** In `test/e2e/navigator.test.ts`:
   - Rename the first test to `'wraps the SVG in an HTML page and mounts the HUD'`, and change its second assertion to `assert.ok(await suite.page.$('svg-navigator-hud'), 'HUD should be present');`.
   - In `'handles an SVG served from a URL without an .svg extension'`, change the assertion to `assert.ok(await suite.page.$('svg-navigator-hud'), 'HUD should be present');`.
   - In `'leaves HTML pages with inline SVG untouched'`, change `assert.equal(await suite.page.$('.toolbarcontainer'), null);` to `assert.equal(await suite.page.$('svg-navigator-hud'), null);`.
   - Delete `'toolbar + zooms in and Reset restores the original view'` and `'respects the toolbarEnabled setting'`, which `hud.test.ts` now covers.

- [ ] **Step 14: Run the type check, then the HUD tests.**

Run: `bun run typecheck`. Expected: exit 0. This is the real gate, because the toolbox exits 0 on TS errors.
Run: `bun run build:dev && bun test test/e2e/hud.test.ts`
Expected: PASS in Chrome and Firefox.

If "is styled under a strict Content-Security-Policy" fails in one browser, temporarily add `console.log` in `adoptStyles` and check which path that browser takes. If it's the `<style>` fallback and the policy blocks it, stop and report: that browser needs another delivery method. Don't weaken the test. Once green, update the `adoptStyles` doc comment to name which browser uses the fallback, if either does (check the console with `bun run start:firefox`, or with `page.on('console')` in a scratch run).

- [ ] **Step 15: Run everything.**

Run: `bun run verify && bun run test:e2e`
Expected: all green.

- [ ] **Step 16: Commit.**

```bash
git add src/js/hud src/js/svgNavigator.ts src/manifest.json test/e2e
git commit -F - <<'EOF'
Replace the toolbar with a shadow-DOM HUD pill

The pill (zoom out, zoom readout, zoom in) lives in an open shadow root
on <svg-navigator-hud>, so an SVG's own stylesheet can't hide or restyle
it, and the manifest no longer injects a stylesheet into every website.
The readout shows the displayed zoom; clicking it resets the view. The
position and toolbar settings now apply live, Space on a focused HUD
button no longer starts a pan, and scrolling over the pill doesn't
scroll the page.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 10: Auto-hide that wakes on activity

**Files:**
- Modify: `src/js/hud/hud.ts`, `src/js/svgNavigator.ts`, `src/options/index.html`, `test/e2e/hud.test.ts`

**Interfaces:**
- Consumes: `visibility.ts` (Task 5).
- Produces: `HudOptions.autoHide: boolean` and `HudHandle.setAutoHide(autoHide: boolean): void`. The dock gets the `data-hidden` attribute while hidden.

- [ ] **Step 1: Write the failing E2E test.** Append inside the `describe` in `test/e2e/hud.test.ts`:

```ts
        test('fades after a quiet spell and wakes on mouse movement', async () => {
            // Arrange
            await suite.openSvg();

            // Act
            await waitForHudAttribute(suite.page, '.dock', 'data-hidden', '');
            await suite.page.mouse.move(200, 200);

            // Assert
            await waitForHudAttribute(suite.page, '.dock', 'data-hidden', null);
        });

        test('stays visible with auto-hide off', async () => {
            // Arrange
            await suite.setSettings({ toolbarAutoHide: false });
            await suite.openSvg();

            // Act
            await delay(2_500);

            // Assert
            assert.equal(await suite.page.evaluate(
                (host: string) => document.querySelector(host)?.shadowRoot?.querySelector('.dock')?.hasAttribute('data-hidden'),
                HUD_HOST,
            ), false);
        });
```

- [ ] **Step 2: Run them and confirm they fail.**

Run: `bun run build:dev && bun test test/e2e/hud.test.ts -t "quiet spell"`
Expected: FAIL. The wait for `data-hidden` times out after 5 s.

- [ ] **Step 3: Implement in `src/js/hud/hud.ts`.**

Add the import:

```ts
import { IDLE_HIDE_MS, initialVisibility, isVisible, reduceVisibility, withAutoHide, type VisibilityEvent } from './visibility';
```

Add `autoHide: boolean;` to `HudOptions` and `setAutoHide: (autoHide: boolean) => void;` to `HudHandle`.

Inside `mountHud`, after `dock.append(pill.element);`, add:

```ts
    let visibility = initialVisibility(options.autoHide);
    let maybeIdleTimer: ReturnType<typeof setTimeout> | undefined;

    function dispatch(event: VisibilityEvent): void {
        visibility = reduceVisibility(visibility, event);
        renderVisibility();
    }

    function renderVisibility(): void {
        dock.toggleAttribute('data-hidden', !isVisible(visibility));
    }

    function restartIdleTimer(): void {
        clearTimeout(maybeIdleTimer);
        maybeIdleTimer = setTimeout(() => dispatch('idleElapsed'), IDLE_HIDE_MS);
    }

    function onActivity(): void {
        dispatch('activity');
        restartIdleTimer();
    }
```

After the `wheel` listener, add:

```ts
    for (const type of ['mousemove', 'wheel', 'keydown'] as const) {
        document.addEventListener(type, onActivity, { passive: true, signal });
    }
    dock.addEventListener('pointerenter', () => dispatch('pointerEnter'), { signal });
    dock.addEventListener('pointerleave', () => dispatch('pointerLeave'), { signal });
    // Only keyboard focus pins the HUD: a mouse click also focuses its button, and that
    // must not keep the HUD up once the pointer leaves.
    root.addEventListener('focusin', (event) => {
        const maybeTarget = event.composedPath()[0];
        if (maybeTarget instanceof Element && maybeTarget.matches(':focus-visible')) {
            dispatch('focusIn');
        }
    }, { signal });
    root.addEventListener('focusout', (event) => {
        const maybeNext = event instanceof FocusEvent ? event.relatedTarget : null;
        if (!(maybeNext instanceof Node && dock.contains(maybeNext))) {
            dispatch('focusOut');
        }
    }, { signal });
```

After `setToolbarEnabled(options.toolbarEnabled);`, add:

```ts
    renderVisibility();
    restartIdleTimer();
```

In the returned object, add `setAutoHide`, and clear the timer in `destroy`:

```ts
        setAutoHide: (autoHide) => {
            visibility = withAutoHide(visibility, autoHide);
            renderVisibility();
            restartIdleTimer();
        },
        destroy: () => {
            listeners.abort();
            clearTimeout(maybeIdleTimer);
            host.remove();
        },
```

- [ ] **Step 4: Pass the setting from `src/js/svgNavigator.ts`.** Add `autoHide: settings.toolbarAutoHide,` to the `mountHud` options (after `position`). Add this case to `applySetting` before `default:`:

```ts
        case 'toolbarAutoHide':
            hud.setAutoHide(settings.toolbarAutoHide);
            break;
```

- [ ] **Step 5: Update the popup hint.** In `src/options/index.html`, change `<span class="row-hint">Fades out after 5 seconds; hover to bring it back</span>` to `<span class="row-hint">Fades out after 2 seconds without activity; any movement brings it back</span>`.

- [ ] **Step 6: Run the tests.**

Run: `bun run build:dev && bun test test/e2e/hud.test.ts`
Expected: PASS.
Run: `bun run verify && bun run test:e2e`
Expected: all green.

- [ ] **Step 7: Commit.**

```bash
git add src/js/hud/hud.ts src/js/svgNavigator.ts src/options/index.html test/e2e/hud.test.ts
git commit -F - <<'EOF'
Hide the HUD after idle and wake it on any activity

Two seconds without mouse movement, scrolling, or keys fades the pill;
any of them brings it back, wherever the pointer is. Hover, keyboard
focus, and an open popover keep it up. The auto-hide setting applies
live.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 11: Background, fullscreen, and shortcuts controls

**Files:**
- Modify: `src/js/hud/shortcuts.ts`, `src/js/hud/pill.ts`, `src/js/hud/hud.ts`, `src/js/svgNavigator.ts`, `test/e2e/hud.test.ts`

**Interfaces:**
- Consumes: `backgroundCycle.ts` (Task 4) and `shortcutRows` (Task 7).
- Produces:
  - `createShortcutsPopover(htmlDoc, rows): ShortcutsPopover`, where `ShortcutsPopover = { element: HTMLDivElement; isOpen(): boolean; setOpen(open: boolean): void }`.
  - Pill classes `.background`, `.fullscreen`, `.shortcuts` (each also `.utility`) and `.separator`. The popover is `.popover#shortcuts`.
  - New `HudOptions` fields: `savedBackground: string` and `clickAndDragBehavior: ClickAndDragBehavior`. New handle method: `HudHandle.setSavedBackground(color: string)`.
  - The HUD now owns `document.body`'s background.

- [ ] **Step 1: Write the failing E2E tests.** Append inside the `describe` in `test/e2e/hud.test.ts`:

```ts
        test('the background button switches to a checkerboard', async () => {
            // Arrange
            await suite.openSvg();

            // Act
            await (await hudElement(suite.page, '.background')).click();

            // Assert
            await suite.page.waitForFunction(
                () => getComputedStyle(document.body).backgroundImage.includes('conic-gradient'),
                { timeout: 5_000 },
            );
        });

        test('a background color change mid-cycle shows the new color', async () => {
            // Arrange
            await suite.openSvg();
            await (await hudElement(suite.page, '.background')).click();

            // Act
            await suite.setSettings({ svgBackgroundColor: 'rgb(255, 0, 0)' });

            // Assert
            await suite.page.waitForFunction(() => document.body.style.backgroundColor === 'rgb(255, 0, 0)', { timeout: 5_000 });
        });

        test('? lists the shortcuts, and Escape closes the list without resetting the view', async () => {
            // Arrange
            await suite.openSvg();
            await suite.page.mouse.move(400, 300);
            const original = await getViewBox(suite.page);
            await suite.page.mouse.wheel({ deltaY: -200 });
            const zoomed = await waitForViewBoxChange(suite.page, original);
            await (await hudElement(suite.page, '.shortcuts')).click();
            await waitForHudAttribute(suite.page, '.popover', 'hidden', null);
            assert.match(await hudText(suite.page, '.popover') ?? '', /hold Space and move/i);

            // Act
            await suite.page.keyboard.press('Escape');

            // Assert
            await waitForHudAttribute(suite.page, '.popover', 'hidden', '');
            await delay(SETTLE_MS);
            assert.deepEqual(await getViewBox(suite.page), zoomed);
        });
```

- [ ] **Step 2: Run them and confirm they fail.**

Run: `bun run build:dev && bun test test/e2e/hud.test.ts -t "background|shortcuts"`
Expected: FAIL with `No HUD element matches .background` / `.shortcuts`.

- [ ] **Step 3: Add the popover builder.** Append to `src/js/hud/shortcuts.ts`:

```ts
export interface ShortcutsPopover {
    element: HTMLDivElement;
    isOpen: () => boolean;
    setOpen: (open: boolean) => void;
}

export function createShortcutsPopover(htmlDoc: Document, rows: readonly ShortcutRow[]): ShortcutsPopover {
    const element = htmlDoc.createElement('div');
    element.className = 'popover';
    element.id = 'shortcuts';
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-label', 'Shortcuts');
    element.hidden = true;

    const heading = htmlDoc.createElement('h2');
    heading.textContent = 'Shortcuts';
    const list = htmlDoc.createElement('dl');
    for (const [action, keys] of rows) {
        const term = htmlDoc.createElement('dt');
        term.textContent = action;
        const detail = htmlDoc.createElement('dd');
        detail.textContent = keys;
        list.append(term, detail);
    }
    element.append(heading, list);

    return {
        element,
        isOpen: () => !element.hidden,
        setOpen: (open) => {
            element.hidden = !open;
        },
    };
}
```

- [ ] **Step 4: Replace `src/js/hud/pill.ts`** with the full pill:

```ts
/** The pill of HUD buttons. Builds DOM only; `hud.ts` wires placement and behavior. */

import { button, iconButton } from './dom';
import { icon } from './icons';

export interface PillActions {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    cycleBackground: () => void;
    toggleFullscreen: () => void;
    toggleShortcuts: () => void;
}

export interface Pill {
    element: HTMLDivElement;
    shortcutsButton: HTMLButtonElement;
    setZoomLabel: (text: string) => void;
    setBackgroundTitle: (title: string) => void;
    setFullscreen: (isFullscreen: boolean) => void;
    setShortcutsExpanded: (expanded: boolean) => void;
}

export function createPill(htmlDoc: Document, actions: PillActions, { fullscreenEnabled }: { fullscreenEnabled: boolean }): Pill {
    const element = htmlDoc.createElement('div');
    element.className = 'pill';
    element.setAttribute('role', 'toolbar');
    element.setAttribute('aria-label', 'SVG Navigator');

    const zoomLabelButton = button(htmlDoc, {
        className: 'zoom-label',
        label: 'Reset zoom',
        title: 'Reset to 100% (Esc)',
        onClick: actions.reset,
    });
    const separator = htmlDoc.createElement('span');
    separator.className = 'separator';
    separator.setAttribute('aria-hidden', 'true');
    const background = iconButton(htmlDoc, 'background', {
        className: 'utility background',
        label: 'Change background',
        title: 'Change background',
        onClick: actions.cycleBackground,
    });
    const fullscreen = iconButton(htmlDoc, 'maximize', {
        className: 'utility fullscreen',
        label: 'Enter full screen',
        title: 'Enter full screen',
        onClick: actions.toggleFullscreen,
    });
    const shortcuts = iconButton(htmlDoc, 'help', {
        className: 'utility shortcuts',
        label: 'Shortcuts',
        title: 'Keyboard and mouse shortcuts',
        onClick: actions.toggleShortcuts,
    });
    shortcuts.setAttribute('aria-haspopup', 'dialog');
    shortcuts.setAttribute('aria-controls', 'shortcuts');
    shortcuts.setAttribute('aria-expanded', 'false');

    element.append(
        iconButton(htmlDoc, 'minus', { className: 'zoom-out', label: 'Zoom out', title: 'Zoom out (Ctrl −)', onClick: actions.zoomOut }),
        zoomLabelButton,
        iconButton(htmlDoc, 'plus', { className: 'zoom-in', label: 'Zoom in', title: 'Zoom in (Ctrl =)', onClick: actions.zoomIn }),
        separator,
        background,
        // Inside an iframe that disallows it, full screen can't work, so don't offer it.
        ...(fullscreenEnabled ? [fullscreen] : []),
        shortcuts,
    );

    const setZoomLabel = (text: string): void => {
        zoomLabelButton.textContent = text;
        zoomLabelButton.setAttribute('aria-label', `Zoom ${text}, reset to 100%`);
    };
    setZoomLabel('100%');

    return {
        element,
        shortcutsButton: shortcuts,
        setZoomLabel,
        setBackgroundTitle: (title) => {
            background.title = title;
        },
        setFullscreen: (isFullscreen) => {
            const label = isFullscreen ? 'Exit full screen' : 'Enter full screen';
            fullscreen.replaceChildren(icon(htmlDoc, isFullscreen ? 'minimize' : 'maximize'));
            fullscreen.setAttribute('aria-label', label);
            fullscreen.title = label;
        },
        setShortcutsExpanded: (expanded) => {
            shortcuts.setAttribute('aria-expanded', String(expanded));
        },
    };
}
```

- [ ] **Step 5: Replace `src/js/hud/hud.ts`** with the full version. It contains everything from Tasks 9–10 plus the background, fullscreen and shortcuts wiring:

```ts
/**
 * The heads-up display over a navigated SVG: a control pill pinned to a window edge or
 * corner, its shortcuts popover, and the per-tab background cycle, all inside one
 * shadow root so page styles can't reach them and their styles can't reach the page.
 * `svgNavigator.ts` drives it through the returned `HudHandle`.
 */

import type { ClickAndDragBehavior, ToolbarPosition } from '../../shared/settings';
import { backgroundButtonTitle, backgroundCss, nextBackground, type BackgroundState } from './backgroundCycle';
import { hudLayout } from './layout';
import { createPill } from './pill';
import { createShadowHost } from './shadowHost';
import { createShortcutsPopover, shortcutRows } from './shortcuts';
import { HUD_CSS } from './styles';
import { IDLE_HIDE_MS, initialVisibility, isVisible, reduceVisibility, withAutoHide, type VisibilityEvent } from './visibility';
import { zoomLabel } from './zoomLabel';

export interface HudActions {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
}

export interface HudOptions {
    actions: HudActions;
    toolbarEnabled: boolean;
    position: ToolbarPosition;
    autoHide: boolean;
    savedBackground: string;
    /** Fixed for the page's lifetime: the navigator binds drag behavior once, at load. */
    clickAndDragBehavior: ClickAndDragBehavior;
}

export interface HudHandle {
    setZoom: (ratio: number) => void;
    setToolbarEnabled: (enabled: boolean) => void;
    setPosition: (position: ToolbarPosition) => void;
    setAutoHide: (autoHide: boolean) => void;
    setSavedBackground: (color: string) => void;
    destroy: () => void;
}

/**
 * Mounts the HUD on `document.body`. `htmlDoc` creates the elements: in a standalone
 * SVG page `document` is an XML document whose `createElement` makes unstyled elements.
 */
export function mountHud(htmlDoc: Document, options: HudOptions): HudHandle {
    const { host, root } = createShadowHost(htmlDoc, document.body, HUD_CSS);
    const listeners = new AbortController();
    const { signal } = listeners;

    let background: BackgroundState = 'saved';
    let savedBackground = options.savedBackground;
    let visibility = initialVisibility(options.autoHide);
    let maybeIdleTimer: ReturnType<typeof setTimeout> | undefined;

    const popover = createShortcutsPopover(htmlDoc, shortcutRows(options.clickAndDragBehavior, navigator.userAgent.includes('Mac')));
    const pill = createPill(htmlDoc, {
        ...options.actions,
        cycleBackground: () => {
            background = nextBackground(background);
            applyBackground();
        },
        toggleFullscreen,
        toggleShortcuts: () => setShortcutsOpen(!popover.isOpen()),
    }, { fullscreenEnabled: document.fullscreenEnabled });
    const dock = htmlDoc.createElement('div');
    dock.className = 'dock';
    dock.append(pill.element, popover.element);

    function applyBackground(): void {
        document.body.style.background = backgroundCss(background, savedBackground);
        pill.setBackgroundTitle(backgroundButtonTitle(background));
    }

    function toggleFullscreen(): void {
        const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        request.catch((error: unknown) => {
            console.warn('SVG Navigator: full screen request failed', error);
        });
    }

    function setShortcutsOpen(open: boolean): void {
        popover.setOpen(open);
        pill.setShortcutsExpanded(open);
        dispatch(open ? 'popoverOpen' : 'popoverClose');
    }

    function dispatch(event: VisibilityEvent): void {
        visibility = reduceVisibility(visibility, event);
        renderVisibility();
    }

    function renderVisibility(): void {
        dock.toggleAttribute('data-hidden', !isVisible(visibility));
    }

    function restartIdleTimer(): void {
        clearTimeout(maybeIdleTimer);
        maybeIdleTimer = setTimeout(() => dispatch('idleElapsed'), IDLE_HIDE_MS);
    }

    function onActivity(): void {
        dispatch('activity');
        restartIdleTimer();
    }

    function setPosition(position: ToolbarPosition): void {
        const layout = hudLayout(position);
        dock.dataset.position = position;
        pill.element.dataset.orientation = layout.orientation;
        popover.element.dataset.direction = layout.popoverDirection;
    }

    function setToolbarEnabled(enabled: boolean): void {
        if (enabled) {
            root.append(dock);
            return;
        }
        if (popover.isOpen()) {
            setShortcutsOpen(false);
        }
        dock.remove();
    }

    // A focused button activates on Space; the navigator must not also start a spacebar pan.
    root.addEventListener('keydown', (event) => {
        if (event instanceof KeyboardEvent && event.key === ' ' && isButton(event.composedPath()[0])) {
            event.stopPropagation();
        }
    }, { signal });
    // Capture phase, so an Escape that closes the popover never reaches the navigator's
    // own Escape (reset the view), whichever element has focus.
    document.addEventListener('keyup', (event) => {
        if (event.key !== 'Escape' || !popover.isOpen()) { return; }
        event.stopPropagation();
        setShortcutsOpen(false);
        pill.shortcutsButton.focus();
    }, { capture: true, signal });
    document.addEventListener('pointerdown', (event) => {
        if (popover.isOpen() && !event.composedPath().includes(dock)) {
            setShortcutsOpen(false);
        }
    }, { capture: true, signal });
    document.addEventListener('fullscreenchange', () => pill.setFullscreen(document.fullscreenElement !== null), { signal });
    // The navigator only zooms on wheel events over the SVG; this stops the page scrolling.
    dock.addEventListener('wheel', (event) => event.preventDefault(), { passive: false, signal });

    for (const type of ['mousemove', 'wheel', 'keydown'] as const) {
        document.addEventListener(type, onActivity, { passive: true, signal });
    }
    dock.addEventListener('pointerenter', () => dispatch('pointerEnter'), { signal });
    dock.addEventListener('pointerleave', () => dispatch('pointerLeave'), { signal });
    // Only keyboard focus pins the HUD: a mouse click also focuses its button, and that
    // must not keep the HUD up once the pointer leaves.
    root.addEventListener('focusin', (event) => {
        const maybeTarget = event.composedPath()[0];
        if (maybeTarget instanceof Element && maybeTarget.matches(':focus-visible')) {
            dispatch('focusIn');
        }
    }, { signal });
    root.addEventListener('focusout', (event) => {
        const maybeNext = event instanceof FocusEvent ? event.relatedTarget : null;
        if (!(maybeNext instanceof Node && dock.contains(maybeNext))) {
            dispatch('focusOut');
        }
    }, { signal });

    setPosition(options.position);
    setToolbarEnabled(options.toolbarEnabled);
    applyBackground();
    renderVisibility();
    restartIdleTimer();

    return {
        setZoom: (ratio) => pill.setZoomLabel(zoomLabel(ratio)),
        setToolbarEnabled,
        setPosition,
        setAutoHide: (autoHide) => {
            visibility = withAutoHide(visibility, autoHide);
            renderVisibility();
            restartIdleTimer();
        },
        setSavedBackground: (color) => {
            savedBackground = color;
            background = 'saved';
            applyBackground();
        },
        destroy: () => {
            listeners.abort();
            clearTimeout(maybeIdleTimer);
            host.remove();
        },
    };
}

function isButton(maybeTarget: EventTarget | undefined): boolean {
    return maybeTarget instanceof Element && maybeTarget.localName === 'button';
}
```

- [ ] **Step 6: Hand the background to the HUD in `src/js/svgNavigator.ts`.**
   - Add `savedBackground: settings.svgBackgroundColor,` and `clickAndDragBehavior: settings.clickAndDragBehavior,` to the `mountHud` options.
   - Delete the `applyBackgroundColor();` call in `main()` and delete the `applyBackgroundColor()` function.
   - In `applySetting`, change the `'svgBackgroundColor'` case body to `hud.setSavedBackground(settings.svgBackgroundColor);`.

- [ ] **Step 7: Run the tests.**

Run: `bun run build:dev && bun test test/e2e/hud.test.ts test/e2e/navigator.test.ts`
Expected: PASS. Note that `navigator.test.ts`'s "applies a background color change" still passes, because the shorthand sets `backgroundColor`.
Run: `bun run verify && bun run test:e2e`
Expected: all green.

- [ ] **Step 8: Commit.**

```bash
git add src/js/hud src/js/svgNavigator.ts test/e2e/hud.test.ts
git commit -F - <<'EOF'
Add background, full screen, and shortcuts to the HUD

The background button cycles saved color, checkerboard, and dark for
this tab; a settings change snaps back to the saved color. Full screen
is offered only where the page allows it. The ? popover lists the real
bindings, opens toward the window's interior, and closes on Escape
without resetting the view.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 12: The debug card

**Files:**
- Create: `src/js/hud/debugCard.ts`
- Modify: `src/js/hud/hud.ts`, `src/js/svgNavigator.ts`, `src/options/index.html`, `test/e2e/hud.test.ts`

**Interfaces:**
- Consumes: `debugInfo.ts` (Task 6), `DebugCorner` / `hudLayout` (Task 3), `icon` / `button` / `iconButton`.
- Produces:
  - `mountDebugCard(htmlDoc, root: ShadowRoot, corner: DebugCorner): DebugCard`, where `DebugCard = { render(info: DebugInfo): void; setCorner(corner: DebugCorner): void; remove(): void }`
  - `HudHandle.setDebugInfo(maybeInfo: DebugInfo | null): void`
  - DOM classes `.debug`, `.debug-header`, `.debug-copy`, `.debug-minimize`, `.debug-body`, `.debug-chip`

- [ ] **Step 1: Write the failing E2E tests.** Append inside the `describe` in `test/e2e/hud.test.ts`:

```ts
        test('the debug card reports a viewBox derived from the size, and the authored width', async () => {
            // Arrange
            await suite.setSettings({ showDebugInfo: true });

            // Act
            await suite.openSvg('/no-viewbox.svg');

            // Assert
            const text = await hudText(suite.page, '.debug-body') ?? '';
            assert.match(text, /derived from size/);
            assert.match(text, /Authored width\s*400/);
        });

        test('the debug card minimizes to a chip and expands again', async () => {
            // Arrange
            await suite.setSettings({ showDebugInfo: true });
            await suite.openSvg();

            // Act
            await (await hudElement(suite.page, '.debug-minimize')).click();
            await waitForHudAttribute(suite.page, '.debug', 'hidden', '');
            await (await hudElement(suite.page, '.debug-chip')).click();

            // Assert
            await waitForHudAttribute(suite.page, '.debug', 'hidden', null);
            await waitForHudAttribute(suite.page, '.debug-chip', 'hidden', '');
        });

        // Firefox's WebDriver BiDi offers no clipboard permission override, so only Chrome can read it back.
        if (browserName === 'chrome') {
            test('Copy puts the debug info on the clipboard', async () => {
                // Arrange
                await suite.launched().defaultBrowserContext().overridePermissions(suite.fixtureOrigin(), ['clipboard-read', 'clipboard-sanitized-write']);
                await suite.setSettings({ showDebugInfo: true });
                await suite.openSvg();
                await suite.page.bringToFront();

                // Act
                await (await hudElement(suite.page, '.debug-copy')).click();
                await waitForHudAttribute(suite.page, '.debug-copy', 'aria-label', 'Copied');

                // Assert
                const copied = await suite.page.evaluate(() => navigator.clipboard.readText());
                assert.match(copied, /^View\nX: /);
                assert.match(copied, /\n\nBuild\nVersion: /);
            });
        }
```

- [ ] **Step 2: Run them and confirm they fail.**

Run: `bun run build:dev && bun test test/e2e/hud.test.ts -t "debug|Copy"`
Expected: FAIL, because there's no `.debug-body` or `.debug-minimize` in the shadow root.

- [ ] **Step 3: Create `src/js/hud/debugCard.ts`.**

```ts
/**
 * The debug card: a read-only snapshot of the view, pointer, document, input,
 * environment, and build. Copy puts it on the clipboard for a bug report; minimize
 * folds it into a chip in the same corner.
 */

import { debugSections, debugText, type DebugInfo, type DebugSection } from './debugInfo';
import { button, iconButton } from './dom';
import { icon } from './icons';
import type { DebugCorner } from './layout';

const COPY_FEEDBACK_MS = 1_500;
const COPY_LABEL = 'Copy debug info';

export interface DebugCard {
    render: (info: DebugInfo) => void;
    setCorner: (corner: DebugCorner) => void;
    remove: () => void;
}

export function mountDebugCard(htmlDoc: Document, root: ShadowRoot, corner: DebugCorner): DebugCard {
    let maybeLatest: DebugInfo | null = null;
    let maybeFeedbackTimer: ReturnType<typeof setTimeout> | undefined;

    const card = htmlDoc.createElement('section');
    card.className = 'debug';
    card.setAttribute('aria-label', 'Debug info');
    const header = htmlDoc.createElement('div');
    header.className = 'debug-header';
    const title = htmlDoc.createElement('span');
    title.textContent = 'Debug';
    const copyButton = iconButton(htmlDoc, 'copy', { className: 'debug-copy', label: COPY_LABEL, title: COPY_LABEL, onClick: copy });
    const minimizeButton = iconButton(htmlDoc, 'minus', {
        className: 'debug-minimize',
        label: 'Minimize debug info',
        title: 'Minimize',
        onClick: () => setMinimized(true),
    });
    const body = htmlDoc.createElement('div');
    body.className = 'debug-body';
    const chip = button(htmlDoc, { className: 'debug-chip', label: 'Show debug info', title: 'Show debug info', onClick: () => setMinimized(false) });
    chip.textContent = 'Debug';
    chip.hidden = true;

    header.append(title, copyButton, minimizeButton);
    card.append(header, body);
    root.append(card, chip);

    function setCopyButton(iconName: 'copy' | 'check', label: string): void {
        copyButton.replaceChildren(icon(htmlDoc, iconName));
        copyButton.setAttribute('aria-label', label);
        copyButton.title = label;
    }

    function flashCopyResult(iconName: 'copy' | 'check', label: string): void {
        setCopyButton(iconName, label);
        clearTimeout(maybeFeedbackTimer);
        maybeFeedbackTimer = setTimeout(() => setCopyButton('copy', COPY_LABEL), COPY_FEEDBACK_MS);
    }

    function copy(): void {
        if (maybeLatest === null) { return; }
        const text = debugText(debugSections(maybeLatest));
        // Wrapped so a missing clipboard (an insecure page) rejects instead of throwing.
        Promise.resolve()
            .then(() => navigator.clipboard.writeText(text))
            .then(
                () => flashCopyResult('check', 'Copied'),
                (error: unknown) => {
                    console.warn('SVG Navigator: could not copy debug info', error);
                    flashCopyResult('copy', "Couldn't copy");
                },
            );
    }

    function setMinimized(minimized: boolean): void {
        card.hidden = minimized;
        chip.hidden = !minimized;
        if (!minimized && maybeLatest !== null) {
            renderBody(maybeLatest);
        }
        (minimized ? chip : minimizeButton).focus();
    }

    function renderBody(info: DebugInfo): void {
        body.replaceChildren(...debugSections(info).map((section) => sectionElement(htmlDoc, section)));
    }

    function setCorner(next: DebugCorner): void {
        card.dataset.corner = next;
        chip.dataset.corner = next;
    }
    setCorner(corner);

    return {
        render: (info) => {
            maybeLatest = info;
            if (!card.hidden) {
                renderBody(info);
            }
        },
        setCorner,
        remove: () => {
            clearTimeout(maybeFeedbackTimer);
            card.remove();
            chip.remove();
        },
    };
}

function sectionElement(htmlDoc: Document, { title, rows }: DebugSection): DocumentFragment {
    const heading = htmlDoc.createElement('h3');
    heading.textContent = title;
    const list = htmlDoc.createElement('dl');
    for (const [name, value] of rows) {
        const term = htmlDoc.createElement('dt');
        term.textContent = name;
        const detail = htmlDoc.createElement('dd');
        detail.textContent = value;
        list.append(term, detail);
    }
    const fragment = htmlDoc.createDocumentFragment();
    fragment.append(heading, list);
    return fragment;
}
```

- [ ] **Step 4: Mount it from `src/js/hud/hud.ts`.**
   - Add imports: `import { mountDebugCard, type DebugCard } from './debugCard';` and `import type { DebugInfo } from './debugInfo';`.
   - Add `setDebugInfo: (maybeInfo: DebugInfo | null) => void;` to `HudHandle`.
   - After `let maybeIdleTimer…`, add `let position = options.position;` and `let maybeDebugCard: DebugCard | null = null;`.
   - In `setPosition`, add `position = next;` and `maybeDebugCard?.setCorner(layout.debugCorner);`. Rename the parameter to `next`:

```ts
    function setPosition(next: ToolbarPosition): void {
        const layout = hudLayout(next);
        position = next;
        dock.dataset.position = next;
        pill.element.dataset.orientation = layout.orientation;
        popover.element.dataset.direction = layout.popoverDirection;
        maybeDebugCard?.setCorner(layout.debugCorner);
    }
```

   - Add this to the returned object:

```ts
        setDebugInfo: (maybeInfo) => {
            if (maybeInfo === null) {
                maybeDebugCard?.remove();
                maybeDebugCard = null;
                return;
            }
            maybeDebugCard ??= mountDebugCard(htmlDoc, root, hudLayout(position).debugCorner);
            maybeDebugCard.render(maybeInfo);
        },
```

- [ ] **Step 5: Feed it from `src/js/svgNavigator.ts`.** Every step below is required.
   1. Imports: delete `import { UNAVAILABLE } from '../shared/provenance';`. Add:

```ts
import { HUD_HOST_TAG } from './hud/shadowHost';
import {
    describeBrowser,
    type DebugInfo,
    type DocumentFacts,
    type ElementSummary,
    type UaBrand,
    type WheelSample,
} from './hud/debugInfo';
```

   2. Replace the `// for debugging` globals block (`maybeDebugTextElement`, `debugChildren`, `debugMouseEvent`) with:

```ts
// for the debug card
let lastPointer: Point = { x: 0, y: 0 };
let maybeLastWheel: WheelSample | null = null;
// the SVG as authored, captured in main() before its size attributes are rewritten
let documentFacts: DocumentFacts;
```

   3. In `main()`, immediately after `svgDocument = maybeSvgDocument;`, add:

```ts
    // Read before the code below strips sizes and inserts the zoom rectangle.
    const authored = readAuthoredFacts(svgDocument);
```

   Then, immediately after the line `const authoredViewBox = maybeAuthoredViewBox ?? { … };`, add:

```ts
    documentFacts = {
        ...authored,
        viewBox: authoredViewBox,
        viewBoxSource: maybeAuthoredViewBox ? 'authored' : 'derivedFromSize',
    };
```

   4. In `main()`, replace the lines `maybePrintDebugInfo();` and `hud.setZoom(currentZoom());` with a single `refreshHud();`.
   5. In `addEventListeners()`, replace the block `if(settings.showDebugInfo) { document.addEventListener('mousemove', trackMouseForDebugInfo, false); }` with `document.addEventListener('mousemove', trackPointer, false);`. Change the resize listener to `window.addEventListener('resize', refreshHud);`.
   6. Replace `trackMouseForDebugInfo` with:

```ts
function trackPointer(evt: MouseEvent): void {
    lastPointer = { x: evt.clientX, y: evt.clientY };
    if(settings.showDebugInfo) { refreshHud(); }
}
```

   7. In `applySetting`, replace the `'showDebugInfo'` case and add the input settings shown on the card:

```ts
        case 'showDebugInfo':
        case 'clickAndDragBehavior':
        case 'scrollSensitivity':
        case 'invertScroll':
            refreshHud();
            break;
```

   8. Add `setInteraction` near `isZoomingOrPanning`, and replace **every** assignment `interaction = …` in the file with `setInteraction(…)`. There are five: in `zoomMouseDown`, `zoomMouseUp`, `panBegin`, `panMove` and `panEnd`. The `let interaction` declaration keeps its initializer.

```ts
function setInteraction(next: Interaction): void {
    interaction = next;
    if(settings.showDebugInfo) { refreshHud(); }
}
```

   9. In `doScroll`, make the first statement `maybeLastWheel = { deltaY: evt.deltaY, deltaMode: evt.deltaMode };`, before the `isZoomingOrPanning` early return.
   10. Replace `setViewBox()` and delete `maybePrintDebugInfo()` entirely:

```ts
function setViewBox(): void {
    svgDocument.setAttribute('viewBox', formatViewBox(viewBox));
    refreshHud();
}

function refreshHud(): void {
    hud.setZoom(currentZoom());
    hud.setDebugInfo(settings.showDebugInfo ? collectDebugInfo() : null);
}
```

   11. Add these helpers at the end of the file, before `getVersion()`:

```ts
function readAuthoredFacts(svg: SVGSVGElement): Omit<DocumentFacts, 'viewBox' | 'viewBoxSource'> {
    return {
        authoredWidth: svg.getAttribute('width'),
        authoredHeight: svg.getAttribute('height'),
        authoredPreserveAspectRatio: svg.getAttribute('preserveAspectRatio'),
        elementCount: svg.querySelectorAll('*').length,
    };
}

function collectDebugInfo(): DebugInfo {
    const svgPoint = clientToSvgPoint(lastPointer.x, lastPointer.y, svgDocument);
    return {
        viewBox,
        zoomRatio: currentZoom(),
        pointer: { client: lastPointer, svg: { x: svgPoint.x, y: svgPoint.y }, maybeElement: summarizeElementAt(lastPointer) },
        document: documentFacts,
        input: {
            interaction: interaction.kind,
            maybeLastWheel,
            clickAndDragBehavior: settings.clickAndDragBehavior,
            scrollSensitivity: settings.scrollSensitivity,
            invertScroll: settings.invertScroll,
        },
        environment: {
            browser: describeBrowser(navigator.userAgent, maybeUserAgentBrands()),
            devicePixelRatio: window.devicePixelRatio,
            windowWidth: getWidth(),
            windowHeight: getHeight(),
        },
        build: { version: getVersion(), maybeCommit: BUILD_INFO.maybeCommit, timestamp: BUILD_INFO.timestamp },
    };
}

// The zoom rectangle and the HUD sit over the artwork; report what's beneath them.
function summarizeElementAt({ x, y }: Point): ElementSummary | null {
    const maybeElement = document.elementsFromPoint(x, y)
        .find((element) => element !== zoomRectangle && element.localName !== HUD_HOST_TAG);
    if(!maybeElement) { return null; }
    return { localName: maybeElement.localName, id: maybeElement.id, classNames: [...maybeElement.classList] };
}

// Client hints exist only in Chromium, and TypeScript's DOM types don't include them yet.
function maybeUserAgentBrands(): readonly UaBrand[] | null {
    const maybeData = (navigator as Navigator & { userAgentData?: { brands: readonly UaBrand[] } }).userAgentData;
    return maybeData?.brands ?? null;
}
```

   12. Run `grep -n "maybePrintDebugInfo\|debugChildren\|debugMouseEvent\|trackMouseForDebugInfo\|UNAVAILABLE" src/js/svgNavigator.ts`. Expected: no output.

- [ ] **Step 6: Update the popup hint.** In `src/options/index.html`, change `<span class="row-hint">Shows the view box and cursor position</span>` to `<span class="row-hint">Shows the view, pointer, document, input, and build details</span>`.

- [ ] **Step 7: Run the tests.**

Run: `bun run typecheck && wc -l src/js/svgNavigator.ts`
Expected: exit 0, and a line count well under 628.
Run: `bun run build:dev && bun test test/e2e/hud.test.ts`
Expected: PASS (the Copy test runs in Chrome only).
Run: `bun run verify && bun run test:e2e`
Expected: all green.

- [ ] **Step 8: Commit.**

```bash
git add src/js/hud src/js/svgNavigator.ts src/options/index.html test/e2e/hud.test.ts
git commit -F - <<'EOF'
Rebuild the debug overlay as a HUD card

The card matches the HUD and reports the view, the pointer in screen and
SVG coordinates with the element beneath it, the SVG as authored (read
before the navigator rewrites its size), the interaction and last wheel
event, the browser, and the build. Copy puts it on the clipboard as
plain text; minimize folds it into a chip.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 13: Position picker in the options popup

**Files:**
- Modify: `src/options/index.html`, `src/options/options.ts`, `src/options/options.css`, `test/e2e/options.test.ts`

**Interfaces:**
- Consumes: `TOOLBAR_POSITIONS`, `parseSetting('toolbarPosition', …)` (Task 1).
- Produces: radio inputs `input[name="toolbarPosition"][value=<position>]`, disabled while the toolbar is off.

- [ ] **Step 1: Write the failing E2E tests.** Append inside the `describe` in `test/e2e/options.test.ts`:

```ts
        test('options popup saves the chosen toolbar position', async () => {
            // Arrange
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Act
            await clickInExtensionPage(suite.page, 'input[name="toolbarPosition"][value="left"]');

            // Assert
            await waitForStoredSetting(suite.page, 'toolbarPosition', 'left');
        });

        test('options popup disables the position picker while the toolbar is off', async () => {
            // Arrange
            await suite.setSettings({ toolbarEnabled: false });

            // Act
            await openOptionsPage(suite.page, suite.extensionOrigin());

            // Assert
            const allDisabled = await suite.page.evaluate(() =>
                [...document.querySelectorAll<HTMLInputElement>('input[name="toolbarPosition"]')].every((input) => input.disabled),
            );
            assert.equal(allDisabled, true);
        });
```

- [ ] **Step 2: Run them and confirm they fail.**

Run: `bun run build:dev && bun test test/e2e/options.test.ts -t "position"`
Expected: FAIL with `No element matches input[name="toolbarPosition"][value="left"]`.

- [ ] **Step 3: Add the markup.** In `src/options/index.html`, rename the toolbar card's first row label from `Show zoom toolbar` to `Show on-screen controls`. After the auto-hide `<label class="row">…</label>`, still inside the Toolbar card, add:

```html
                    <div class="row">
                        <span class="row-label" id="toolbarPositionLabel">Position</span>
                        <div class="position-picker" role="radiogroup" aria-labelledby="toolbarPositionLabel">
                            <label title="Top left"><input type="radio" name="toolbarPosition" value="top-left" aria-label="Top left"></label>
                            <label title="Top"><input type="radio" name="toolbarPosition" value="top" aria-label="Top"></label>
                            <label title="Top right"><input type="radio" name="toolbarPosition" value="top-right" aria-label="Top right"></label>
                            <label title="Left"><input type="radio" name="toolbarPosition" value="left" aria-label="Left"></label>
                            <span aria-hidden="true"></span>
                            <label title="Right"><input type="radio" name="toolbarPosition" value="right" aria-label="Right"></label>
                            <label title="Bottom left"><input type="radio" name="toolbarPosition" value="bottom-left" aria-label="Bottom left"></label>
                            <label title="Bottom"><input type="radio" name="toolbarPosition" value="bottom" aria-label="Bottom"></label>
                            <label title="Bottom right"><input type="radio" name="toolbarPosition" value="bottom-right" aria-label="Bottom right"></label>
                        </div>
                    </div>
```

- [ ] **Step 4: Style it.** In `src/options/options.css`, after the `/* Slider */` block, add:

```css
/* Toolbar position: a 3×3 grid drawn as a tiny screen; the middle cell stays empty. */

.position-picker {
    display: grid;
    flex: none;
    grid-template-columns: repeat(3, 18px);
    grid-template-rows: repeat(3, 12px);
    gap: 3px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--page);
}

.position-picker label {
    display: flex;
    cursor: pointer;
}

.position-picker input {
    appearance: none;
    width: 100%;
    height: 100%;
    margin: 0;
    border-radius: 3px;
    background: var(--control);
    cursor: inherit;
}

.position-picker input:checked {
    background: var(--accent);
}

.position-picker input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}
```

- [ ] **Step 5: Wire it in `src/options/options.ts`.**
   - In `controls`, after `clickAndDragOptions`, add `toolbarPositionOptions: [...document.querySelectorAll<HTMLInputElement>('input[name="toolbarPosition"]')],`.
   - In `render`, after the `clickAndDragOptions` loop, add:

```ts
    for (const option of controls.toolbarPositionOptions) {
        option.checked = option.value === settings.toolbarPosition;
    }
```

   - Replace `renderToolbarDependencies`:

```ts
// Auto-hide and position only matter while the toolbar is shown.
function renderToolbarDependencies(): void {
    const isToolbarOff = !controls.switches.toolbarEnabled.checked;
    controls.switches.toolbarAutoHide.disabled = isToolbarOff;
    for (const option of controls.toolbarPositionOptions) {
        option.disabled = isToolbarOff;
    }
}
```

   - In `addEventListeners`, after the `clickAndDragOptions` loop, add:

```ts
    for (const option of controls.toolbarPositionOptions) {
        option.addEventListener('change', () => {
            save('toolbarPosition', parseSetting('toolbarPosition', option.value));
        });
    }
```

- [ ] **Step 6: Run the tests.**

Run: `bun run build:dev && bun test test/e2e/options.test.ts`
Expected: PASS.
Run: `bun run verify && bun run test:e2e`
Expected: all green.

- [ ] **Step 7: Commit.**

```bash
git add src/options test/e2e/options.test.ts
git commit -F - <<'EOF'
Let the popup choose where the HUD sits

A 3×3 picker drawn as a tiny screen sets the position; native radios
give arrow-key navigation. It's disabled while the controls are off,
like auto-hide.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 14: Docs, listings, screenshots, final verification

**Files:**
- Modify: `README.md`, `store/web-stores.md`, `store/app-store/listing.md`, `standards-overrides.md`, `AGENTS.md`
- Regenerate: `store/app-store/screenshots/*.png`

- [ ] **Step 1: README.** In `## Usage`, after `- Reset zoom: press escape`, add:

```markdown
- On-screen controls: zoom out, the zoom level (click it to reset), zoom in, background, full screen, and a
  shortcuts list; choose their corner or edge, or turn them off, in the settings
```

In `### Source layout`, replace the `src/js/toolbar.ts` line with:

```markdown
- `src/js/hud/`: the on-screen controls and debug card, in a shadow root on `<svg-navigator-hud>`; the pure
  parts (`layout`, `zoomLabel`, `visibility`, `backgroundCycle`, `debugInfo`, `shortcuts`) are unit tested
```

- [ ] **Step 2: Store listings.**
   - In `store/web-stores.md`, in **both** listings:
     - Replace `Use the + / − / Reset toolbar in the corner of the page` with `Use the on-screen controls to zoom, reset, switch the background, or go full screen`.
     - Replace `show or auto-hide the zoom toolbar` with `show, auto-hide, or reposition the on-screen controls`.
   - In `store/app-store/listing.md`:
     - Replace `• Use the + / − / Reset toolbar in the corner of the page` with `• Use the on-screen controls to zoom, reset, switch the background, or go full screen`.
     - Replace `• Show or hide the zoom toolbar, and let it fade out when you don't need it` with `• Show, hide, or move the on-screen controls, and let them fade out when you don't need them`.

Run: `bun test test/unit/appStoreListing.test.ts`. Expected: PASS (length limits).

- [ ] **Step 3: Record the theme exception.** Add a row to the table in `standards-overrides.md`:

```markdown
| `core/frontend-ui.md`: Default Frontend Experiences To Dark Mode | The on-page HUD and debug card follow the OS color scheme (`prefers-color-scheme`) instead of defaulting to dark. | They float over someone else's artwork beside the browser's own chrome; matching the user's theme keeps them consistent with the settings popup, and dark users already get the dark theme. | Peter Ryszkiewicz | 2027-04-07 |
```

- [ ] **Step 4: Add repo-local guidance.** In `AGENTS.md`, under `## Repo-Local Guidance` (outside the managed block), add after the Firefox BiDi bullet:

```markdown
- The HUD (`src/js/hud/`) lives in an open shadow root on `<svg-navigator-hud>`; E2E tests reach inside with the `hudElement` helpers in `test/e2e/harness.ts`, not `page.$`.
- `tsconfig.node.json` uses bundler resolution because unit tests import extension modules whose relative imports omit file extensions.
```

- [ ] **Step 5: Regenerate the App Store screenshots, and check that they're deterministic.**

```bash
bun run screenshots:app-store
```

```bash
shasum store/app-store/screenshots/*.png > /tmp/claude-screenshots-1.txt
```

```bash
bun run screenshots:app-store
```

```bash
shasum store/app-store/screenshots/*.png | diff /tmp/claude-screenshots-1.txt -
```

Expected: the first run changes the images (the new pill appears), and the `diff` prints nothing. Open `store/app-store/screenshots/02-scroll-to-zoom.png` and check that the pill sits bottom-right, shows the zoom %, and looks right in the light theme.

- [ ] **Step 6: Final verification.**

Run: `bun run verify`. Expected: all green, `SUMMARY all findings=0`.
Run: `bun run test:e2e`. Expected: all green in Chrome and Firefox.
Run: `git diff --stat HEAD~13` and skim the changes for anything unintended (stray debug logs, leftover `toolbar` references).
Run: `grep -rn "toolbarcontainer\|toolbar\.ts\|svgNavigator\.css" src test README.md store`. Expected: only the deliberate `.toolbarcontainer` in `test/e2e/fixtures/styled-page.html` and `hud.test.ts`.

Manual smoke test: `bun run start:chrome`, then open `https://upload.wikimedia.org/wikipedia/commons/1/17/World.svg`. Check that:
- The pill shows and the readout updates while scrolling.
- The background cycles.
- `?` opens the shortcuts list and Esc closes it.
- Full screen toggles.
- Setting the position to "Left" in the popup moves the pill live.
- Turning on the debug overlay shows the card, and Copy works.

- [ ] **Step 7: Commit and push.**

```bash
git add README.md store standards-overrides.md AGENTS.md
git commit -F - <<'EOF'
Document the new HUD and refresh the App Store screenshots

README, store listings, and AGENTS.md describe the on-screen controls;
standards-overrides.md records that the HUD follows the OS color scheme.
Screenshots regenerate deterministically with the new pill.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git push origin master
```

---

## Self-review

**Spec coverage**

- §1 Settings: Task 1 adds the setting and Task 13 the popup picker. Live updates come in Tasks 9 and 10.
- §2 Modules: all listed files are created. `icons.ts` and `dom.ts` are added helpers. Anchoring is in CSS (refinement 4).
- §3 Structure: the host is Task 9 (refinements 1 and 3), and keyboard isolation is in Tasks 9 and 11 (refinement 2).
- §3 Pill: Tasks 9 and 11 build it, with titles carrying shortcuts and a tabular readout.
- §3 Look: Task 9 `styles.ts`, with the override recorded in Task 14.
- §3 Popover: Tasks 7 and 11.
- §3 Visibility: Tasks 5 and 10, with `:focus-visible` pinning (refinement 6) and reduced motion in `styles.ts`.
- §3 Zoom readout: Tasks 2 and 9 (resize listener included).
- §3 Background: Tasks 4 and 11.
- §3 Fullscreen: Task 11. It's verified manually because headless fullscreen isn't reliable, as noted in Task 14.
- §3 Live settings: Tasks 9, 10, 11 and 12.
- §4 Debug card: Tasks 6 and 12. Placement uses `layout.debugCorner`; content covers all six sections; authored facts are captured before mutation; Copy and Minimize are in place; the body is click-through. Refinement 5 covers the listener.
- §5 Manifest: Task 9.
- §6 Unit tests: Tasks 1–7. E2E tests: Tasks 8–13. The spec's `>>>` spike was replaced by `evaluateHandle` helpers that work in both browsers.
- §7 Docs: Task 14.

**Type consistency**

- `HudHandle` grows in step: Task 9 has `setZoom`, `setToolbarEnabled`, `setPosition` and `destroy`. Task 10 adds `setAutoHide`, Task 11 adds `setSavedBackground`, and Task 12 adds `setDebugInfo`.
- `HudOptions` grows in step: `autoHide` (Task 10), then `savedBackground` and `clickAndDragBehavior` (Task 11).
- The `createPill` signature changes in Task 11; `hud.ts` is replaced in the same task.
- `DebugCorner`, `hudLayout`, `zoomLabel`, `displayedZoom`, `shortcutRows` and `createShortcutsPopover` are named the same everywhere.
- The E2E classes match the DOM: `.dock`, `.pill`, `.zoom-in`, `.zoom-label`, `.zoom-out`, `.background`, `.shortcuts`, `.popover`, `.debug`, `.debug-body`, `.debug-copy`, `.debug-minimize` and `.debug-chip`.

**Known risks** (each has a check in the plan)

- **CSP styling in Firefox:** Task 9 Step 14 has an explicit stop-and-report.
- **Puppeteer handle typing:** a fallback is noted in Task 9 Step 1.
- **Clipboard test:** runs in Chrome only, with the reason commented.
