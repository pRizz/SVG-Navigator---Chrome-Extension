# Verification

This page defines the baseline expectations for workflow preparation and pre-commit verification without forcing every repository into the same toolchain shape.

## Sync Repository State and Prepare Dependencies Before Substantive Work

- Level: `should`
- Intent: Reduce avoidable merge conflicts, stale-checkout mistakes, and local environment drift before substantive implementation begins.
- Rule: Before you start substantive implementation or other repo-changing work, sync first: refresh local repository state and prepare the local environment using the repository's documented workflow. Check repo-local guidance first, then prefer a repo-owned sync or bootstrap command when one exists. If the repository has a remote, fetch remote refs first. If the current branch tracks an upstream and the worktree is clean, prefer rebasing the local branch onto the latest upstream or use the repo's equivalent documented sync path, such as `git pull --rebase` when that matches local guidance. If the checkout is a detached-HEAD worktree, treat the repo's default branch as the assumed sync base unless repo-local guidance or the remote default branch indicates another target; in many repositories that means `main`. Resolve any rebase or merge conflicts before starting substantive work. Do not start implementation on an outdated branch or with unresolved conflicts. After sync, run the repository's normal install, bootstrap, or dependency-sync step when the repo expects a prepared local environment, and rerun it when the synced revision, changed lockfiles or manifests, toolchain files, generated dependency metadata, or command failures show that dependencies or tools are stale or missing.
- Rationale: Agents and humans often start from a fresh worktree, an old local clone, or a branch that fell behind upstream. A clear sync-first default, with fetch plus rebase by default or a repo-owned equivalent such as `git pull --rebase` when the repo documents that path, reduces stale-base work and lowers merge-conflict risk later by surfacing branch drift before new changes pile on top. Detached worktrees also need a practical default sync base, and the repo's default branch is usually the least surprising assumption when no stronger local guidance exists. Resolving sync conflicts before substantive work keeps the branch coherent while the change context is still small. Following the repository's own bootstrap or dependency-sync path keeps the local environment aligned with the checked-out revision and avoids guessing the wrong cross-language install commands.
- Good example:

```text
Current branch tracks origin/main and the worktree is clean
- fetch remote refs
- run the repo's documented rebase-first sync command, such as `git pull --rebase`, or an equivalent rebase workflow
- run the repo's normal bootstrap step because the synced revision changed the lockfile
- start implementation on the refreshed checkout
```

- Good example:

```text
Current worktree starts detached and the repo uses a documented bootstrap command
- fetch first
- infer the sync base from the repo's default branch and use `main` here because that is the actual default
- rebase or otherwise align the detached worktree against that default branch before implementation
- run the documented bootstrap command because local guidance says the repo expects prepared tools before implementation
- proceed without guessing language-specific install commands by hand
```

- Bad example:

```text
Fresh worktree created from an old commit
- skip fetch and start editing immediately
- discover later that upstream moved and the branch now conflicts
- rebuild context and rework the branch after the fact
```

- Bad example:

```text
Dirty worktree with local commits and no documented sync command
- start implementation without first rebasing onto the latest upstream
- defer the resulting conflict resolution until after substantive code changes have already been made
- start debugging install failures without running the repo's normal bootstrap step
```

- Exceptions or escape hatches: If there is no remote, no upstream, no clear default branch for a detached-HEAD worktree, a dirty worktree, offline or credential constraints, or a deliberate pinned-commit workflow, stop and ask or follow documented local guidance instead of forcing a sync. If rebasing or merging raises conflicts, resolve them before substantive work when the resolution is mechanically clear; if resolution would require non-obvious semantic choices or local workflow judgment, stop and ask. Do not invent a bootstrap step for repositories that do not need one, and do not guess language-specific commands when the repository already documents a preferred entrypoint. Commands such as `bun install`, `pnpm install`, `npm install`, `cargo fetch`, `cargo check`, or `uv sync` are examples only; use the repo's normal path when it exists.
- Review questions: Was remote state fetched before substantive work when a remote exists? Was the local branch rebased onto the latest upstream or synced through the repo's documented equivalent before implementation began? If the checkout was a detached-HEAD worktree, was the repo's default branch inferred correctly? Were sync conflicts resolved before new work started? Does the repository expect a bootstrap or dependency-sync step before implementation? Did the synced revision or a command failure indicate stale dependencies or tools?
- Automation potential: Tooling can detect clean worktrees, upstream tracking, and some stale dependency signals, but deciding whether a sync is safe and which bootstrap path is canonical still depends on repository context.

## Honor Markdown Dialects and Formatter Contracts

- Level: `must`
- Intent: Prevent a generic Markdown formatter from corrupting repository-specific syntax such as YAML frontmatter, GFM tables, or parser-owned marker elements.
- Rule: Before formatting Markdown, inspect repo-local guidance and formatter configuration and use the repository's documented formatter contract. Do not fall back to bare `mdformat` or another generic formatter when the repository requires syntax extensions or plugins that are unavailable. Preserve existing formatter configuration, use repository-owned setup or migration commands before broad formatting when they exist, and run the formatter in check mode before write mode. Scope write-mode formatting to files the task is authorized to change; do not format arbitrary repository Markdown as a side effect of installing or updating unrelated tooling.
- Rationale: Markdown repositories commonly contain extension syntax that is valid only when the formatter loads the matching parser plugin. Treating that content as plain CommonMark can rewrite frontmatter delimiters, damage YAML, escape marker elements, or create broad unrelated diffs. The repository's own configuration and migration tooling define the safe dialect boundary.
- Good example:

```text
Repository contains `.mdformat.toml` with GFM and frontmatter extensions
- inspect the config and local guidance
- confirm the required plugins are installed
- run the repo-owned check command
- use the repo-owned migration command before a requested broad normalization
- format only the intended files after the check succeeds
```

- Bad example:

```text
Repository contains YAML frontmatter and parser-owned marker elements
- find bare `mdformat` on PATH
- ignore the repository config and missing plugins
- format every Markdown file during an unrelated installer update
- discover later that frontmatter and marker syntax changed
```

- Exceptions or escape hatches: If the repository has no formatter contract and its Markdown uses only syntax supported by an available formatter, a targeted check-mode invocation remains acceptable. If required extensions are missing, report the exact repo-documented installation or setup command and leave Markdown unchanged. Do not invent a migration for repository-owned syntax; defer to that repository's tooling or maintainers.
- Review questions: What Markdown dialect does this repository declare? Are all required extensions available? Does the repository own a setup or migration command? Is write mode authorized and scoped to intended files? Will existing formatter configuration and unrelated Markdown remain unchanged?
- Automation potential: CI can pin formatter and extension versions, probe required syntax support, and enforce check mode. Determining whether a broad migration is authorized remains a repository-level decision.

## Run Relevant Repo-Native Verification Before Commit

- Level: `must`
- Intent: Catch regressions before they land while keeping the verification burden proportional to the actual change.
- Rule: Before committing, run the repository's relevant verification steps for the changed paths and do not commit if those checks fail. When the managed `scripts/bright-builds-check.ts` exists, include `bun scripts/bright-builds-check.ts all`; intentional findings require reasoned exact-file entries or trailing-slash `file-lengths` directory entries in the optional user-owned `.bright-builds-rules-checks.tsv`, not edits to the managed checker. Determine the remaining verification surface in this order: repo-local guidance first, then a repo-owned aggregate command such as `verify`, `check`, `validate`, or `ci`, then framework-native commands, then individual tool commands only when needed. Scope the run to the affected files, packages, workspaces, or services when the repository supports that. If a change spans multiple language or runtime surfaces, run the relevant verification for each affected surface. For changed Markdown or shell-script paths, treat a locally available formatter check as part of the relevant surface when the repository does not already define a clearer formatter workflow. Only use tools that are already available on `PATH` or through the repository's normal runner or dependencies, honor the Markdown dialect and formatter contract above, scope checks to the changed Markdown or shell paths, and use check, diff, or list modes instead of write-in-place modes.
- Rationale: Requiring passed verification before commit catches common regressions early, but a durable standard also has to respect monorepos, mixed-language repositories, and ecosystems with different default tooling. Using the repository's own verification entrypoints preserves local intent and avoids turning policy into guesswork, while conditional formatter checks cover common documentation and script surfaces without turning the standard into a hidden install requirement.
- Good example:

```text
Change: docs, one shell script, and one Rust crate
- run the repo's docs check for the changed Markdown
- run the configured `mdformat --check` or `prettier --check` command for the changed Markdown when its required plugins are available and local docs do not define a clearer path
- run `shfmt -l -d` or `beautysh --check` for the changed shell script when that formatter is already available and local docs do not define a clearer path
- run the crate-scoped Rust verify/check command used by the repo
- skip unrelated frontend or end-to-end suites
```

- Bad example:

```text
Change: one package in a monorepo plus one Markdown file
- invent a hand-rolled command list even though the repo already has `pnpm verify --filter ...`
- install a new formatter locally just to satisfy the policy
- skip the available package-scoped checks and commit anyway after a failing typecheck
```

- Exceptions or escape hatches: Do not invent missing verification categories. A repository that has tests but no linter, or a build step but no typecheck, should run what it actually has. Do not install new tooling just to satisfy this rule, and do not treat adjacent rewrite or hardening tools as mandatory formatters. Acceptable targeted formatter checks include a repository-compatible `mdformat --check`, `prettier --check`, and `dprint check` for Markdown, plus `shfmt -l -d`, `beautysh --check`, and `prettier --check` when `prettier-plugin-sh` is already part of the available setup for shell paths. If Markdown formatting already relies on `mdformat`, `mdformat-shfmt` is also a valid example for shell code fences embedded in Markdown. `shellharden` is not part of this core formatter rule because it is a transforming hardening tool, not a plain formatting check. Heavy integration, browser, end-to-end, or external-service suites may remain pre-push or CI-only when the repo's local guidance says so. If local verification is blocked by missing syntax extensions, secrets, required services, containers, browsers, network access, or similar prerequisites, stop and ask or document a local exception instead of silently skipping the check.
- Review questions: What are the repo's documented verification entrypoints for these changed paths? Is there an affected-package or changed-path mode that avoids whole-repo work? For changed Markdown or shell paths, is there already a repo-defined formatter workflow or a locally available check-mode formatter that should be used? Does the change touch more than one verification surface?
- Automation potential: Scripts and CI can enforce parts of this rule, but judging what is relevant still depends on changed-path and repository context.

## Prefer Repo-Owned Verification Entry Points

- Level: `should`
- Intent: Keep verification consistent with the repository's own workflow instead of reconstructing it from tool fragments.
- Rule: Prefer a repo-owned verification entrypoint such as `make verify`, `just check`, `bin/verify`, `cargo xtask`, `nx affected`, or `turbo` over manually chaining low-level tool commands when that entrypoint already captures the intended local workflow.
- Rationale: Repositories often encode subtle local knowledge in aggregate commands, including ordering, filtering, environment setup, and tool flags. Rebuilding that knowledge ad hoc is brittle and easy to get wrong.
- Good example:

```bash
just check changed=packages/billing
```

- Bad example:

```bash
eslint packages/billing
tsc --noEmit
vitest packages/billing
```

- Exceptions or escape hatches: If the repo-owned command is unavailable, undocumented, or clearly broader than necessary for the change, fall back to the next best repo-native or framework-native command set. When using auto-fix commands is the repo norm, rerun the relevant checks after the fixes and avoid pulling unrelated rewrites into the commit.
- Review questions: Does the repository already define a single command that expresses the intended verification workflow? Are low-level tool invocations drifting away from the documented local contract?
- Automation potential: Tooling can detect common aggregate entrypoints, but choosing the narrowest correct one still needs context.

## Coordinate With Existing Hook-Based Verification

- Level: `should`
- Intent: Avoid silently duplicating verification that may already be enforced by local commit automation.
- Rule: If the repository shows likely hook-managed verification signals such as `.husky/`, `lefthook.yml`, `.pre-commit-config.yaml`, `.pre-commit-config.yml`, `.git/hooks/`, or `lint-staged`-style configuration, do not assume manual duplication is required. When repo-local guidance does not already define the workflow, ask the user whether to rely on hooks, run the checks manually now, or do both.
- Rationale: Existing hook automation may already run the relevant checks, but those signals are heuristics, not proof that the hook is installed, active, or comprehensive. Coordinating explicitly avoids wasted time and conflicting assumptions.
- Good example:

```text
Detected `.husky/pre-commit` and `lint-staged` in package.json.
Local docs do not say whether manual verification is still expected.
Ask which path the repo prefers before duplicating the same checks.
```

- Bad example:

```text
Detect hook config, ignore it, run the same lint/test suite manually, and let the commit trigger the same work again without warning.
```

- Exceptions or escape hatches: If repo-local guidance already says that hooks are advisory, mandatory, or intentionally incomplete, follow that documented workflow instead of asking again.
- Review questions: Is there already hook-based verification here? Is it documented clearly enough to avoid a user question? Are the hook signals only partial, local-machine specific, or obviously stale?
- Automation potential: Repositories can be scanned for common hook files, but their presence alone cannot prove runtime behavior.
