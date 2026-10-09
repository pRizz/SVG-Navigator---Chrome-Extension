# SVG Navigator

## Repo-Local Guidance

- Verify before committing with `bun run verify` (type check, ESLint, unit tests, Bright Builds checks). UI tests: `bun run test:e2e` builds `.build/`, then drives Chrome and Firefox through Puppeteer; they run locally, sandbox included.
- If every UI test fails at startup (a timeout waiting for `data-svg-navigator="ready"`, then "Target closed"), the content script threw while starting. Compare against a clean `HEAD` worktree before blaming the environment.
- `webextension-toolbox` exits 0 even when TypeScript reports errors; `bun run typecheck` is the real gate.
- Build locally with `bun run build:dev` (into `.build/`). `bun run build:*` re-zips into `packages/`, overwriting the release archives.
- TypeScript stays on `~6.0`: TypeScript 7 has no compiler API, which `ts-loader` and `typescript-eslint` need.
- Bump the version only in `src/manifest.json`. `bun run prebuild` generates `src/js/buildInfo.ts` (gitignored) and `safari/Version.xcconfig` from it.
- In a standalone SVG page, `document` is an XML document: build HTML UI from the wrapper `htmlDoc` in `src/js/svgNavigator.ts`, never `document.createElement`.
- Firefox runs through WebDriver BiDi, which has its own quirks; the workarounds are commented in `test/e2e/harness.ts` and `test/e2e/navigator.test.ts`.
- The HUD (`src/js/hud/`) lives in an open shadow root on `<svg-navigator-hud>`; E2E tests reach inside with the `hudElement` helpers in `test/e2e/harness.ts`, not `page.$`.
- `bun run start:firefox` runs web-ext on Node via `scripts/runFirefox.ts`: under Bun, web-ext's first refused connection to Firefox's debugger port escapes its retry loop and aborts. Inside Bun scripts, `node` is Bun's shim (`run.bun` in `bunfig.toml`).
- `tsconfig.node.json` uses bundler resolution because unit tests import extension modules whose relative imports omit file extensions.
- `bun run screenshots:app-store` regenerates `store/app-store/screenshots/` deterministically; an unrelated change should leave them byte-identical.
- Releases: push a `vX.Y` tag that matches `src/manifest.json`. See "Releasing" in `README.md`.
- `scripts/bright-builds-check.ts` is managed upstream and excluded from the type check and ESLint; do not edit it.

<!-- bright-builds-rules-managed:begin -->

# Bright Builds Rules

`AGENTS.md` is the entrypoint for repo-local instructions, not the complete Bright Builds Rules specification.

This managed block is owned upstream by `bright-builds-rules`. If this block needs a fix, open an upstream PR or issue instead of editing the managed text in a downstream repo. Keep downstream-specific instructions outside this managed block.

Before plan, review, implementation, or audit work:

1. Read the repo-local instructions in `AGENTS.md`, including any `## Repo-Local Guidance` section and any instructions outside this managed block.
1. Read `AGENTS.bright-builds.md`.
1. Read `standards-overrides.md` when present.
1. Read the local managed standards pages under `standards/` relevant to the task.
1. If you have not done that yet, stop and load those sources before continuing.

Use this routing map when deciding what to load next:

- For repo-specific commands, prerequisites, generated-file ownership, CI-only suites, or recurring workflow facts, use the local `AGENTS.md`, especially `## Repo-Local Guidance`.
- For the Bright Builds default workflow and high-signal cross-cutting rules used in most tasks, use `AGENTS.bright-builds.md`.
- For deliberate repo-specific exceptions to the Bright Builds defaults, use `standards-overrides.md`.
- To choose the right managed standards page, start with the local Bright Builds entrypoint `standards/index.md`.
- For business-logic structure, domain modeling, and functional-core versus imperative-shell decisions, use the managed standards page `standards/core/architecture.md`.
- For control flow, naming, function/file size, and readability rules, use the managed standards page `standards/core/code-shape.md`.
- For frontend visual defaults, theme defaults, and dark-mode decisions, use the managed standards page `standards/core/frontend-ui.md`.
- For sync, bootstrap, and pre-commit verification rules, use the managed standards page `standards/core/verification.md`.
- For the managed starter checks, run `bun scripts/bright-builds-check.ts all`; use its `--help` output for check-specific commands, exact-file exceptions, and trailing-slash `file-lengths` directory exceptions.
- For unit-test expectations, use the managed standards page `standards/core/testing.md`.
- For Rust or TypeScript/JavaScript-specific rules, use the matching managed standards page under `standards/languages/`.
- For TypeScript/JavaScript frontend framework and UI-library defaults, use `standards/languages/typescript-javascript.md`.
- Keep recurring repo-specific workflow facts, commands, and links in a `## Repo-Local Guidance` section elsewhere in this file.
- Record deliberate repo-specific exceptions and override decisions in `standards-overrides.md`.
- If instructions elsewhere in `AGENTS.md` conflict with `AGENTS.bright-builds.md`, follow the repo-local instructions and treat them as an explicit local exception.

<!-- bright-builds-rules-managed:end -->
