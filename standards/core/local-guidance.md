# Local Guidance

This page defines how repositories should capture recurring local knowledge without turning every local pattern into a canonical standard or an override.

## Document Recurring Repo-Local Knowledge

- Level: `should`
- Intent: Keep recurring repo-specific workflow knowledge easy to find for new humans and agents without promoting it into a cross-repo rule prematurely.
- Rule: When you observe a repo-specific pattern or repetitive action that is likely to recur and is not already obvious from code, scripts, or existing docs, document it or propose documenting it in `AGENTS.md` under `## Repo-Local Guidance`. Treat the trigger as met after either two observations of the same local pattern or one confirmed confusion, verification failure, or onboarding miss that is clearly likely to recur. Use this section for recurring local facts such as verification entrypoints, hook behavior, CI-only suites, local service prerequisites, codegen expectations, generated-file ownership, recurring path or layout conventions, release or deploy quirks, and other non-obvious "we always do X here" workflow rules.
- Rationale: Repeated repo-specific clarifications are expensive when they live only in chat history, reviewer memory, or old pull requests. A small, stable local guidance surface helps newcomers and agents get local behavior right faster while preserving the distinction between global standards and local practice.
- Good example:

```text
## Repo-Local Guidance

- Verify changed packages with `pnpm turbo run check --filter=web`.
- `.husky/pre-commit` is advisory here; manual verification is still expected before commit.
- Browser E2E stays CI-only because local browser setup is intentionally optional.
- `apps/web/src/routeTree.gen.ts` is generated; edit the route definitions instead.
```

- Bad example:

```text
- Keep the hook behavior, generated-file ownership, and CI-only suite expectations undocumented.
- Repeat the same clarification in review comments and onboarding chats every few weeks.
- Record a recurring local workflow rule only in a one-off issue or pull request.
```

- Exceptions or escape hatches: Do not put secrets, temporary incidents, transient outages, one-off tickets, or personal preferences in `Repo-Local Guidance`. If the item is a deliberate deviation from a canonical standard, record it in `standards-overrides.md` instead. If the pattern is broadly useful across many repositories, upstream it into the canonical standards rather than copying it repo by repo.
- Review questions: Is there recurring local behavior that a newcomer would likely miss? Has the same clarification already been repeated or already caused a failure? Does this belong in `Repo-Local Guidance`, `standards-overrides.md`, or the canonical standards corpus?
- Automation potential: Repeated review comments, onboarding notes, or audit findings can suggest candidates, but deciding whether a pattern is durable and truly repo-local still needs judgment.

## Keep Shared Task and Lesson Trackers Merge-Safe

- Level: `should`
- Intent: Reduce avoidable merge conflicts and stale status churn when a repository chooses to track work in versioned task or lesson files.
- Rule: If a repository keeps shared tracked task or lesson files such as `tasks/todo.md`, `tasks/lessons.md`, `.codex/tasks/todo.md`, or `.codex/tasks/lessons.md`, structure them as append-only blocks with stable IDs and timestamps in the heading. Append new blocks at the end of the file, update only the targeted task or lesson block when recording progress or completion, and avoid top-of-file status tables, hot counters, or whole-file rewrites when a localized edit is sufficient.
- Rationale: Shared tracker files often become merge-conflict hotspots because multiple branches touch the same "current" sections, counters, or summary lines. Stable per-block anchors plus localized edits keep concurrent changes mechanically separate and reduce semantic drift between the tracker and the underlying work.
- Good example:

```text
# Todo

## task-managed-file-markers | 2026-03-23 14:05 | Tighten managed-file drift handling

- [x] Add visible whole-file managed markers to fully managed outputs
- [x] Extend integration coverage for drift blocking

## Completion Review

- Verification: `./scripts/verify-docs.sh`, `./scripts/verify-managed-shells.sh`, `bash scripts/test-manage-downstream.sh`
- Residual risk: Legacy exact-match installs still need migration coverage
```

- Bad example:

```text
# Todo

## Current task

- [x] Current work item A
- [ ] Current work item B

## Current verification

- [x] Latest checks

## Current completion review

Completed on 2026-03-23.
```

- Exceptions or escape hatches: Repositories that keep task tracking unversioned, local-only, or in one-file-per-task layouts do not need this exact shape. Very small single-writer repositories may accept simpler trackers temporarily, but once concurrent branches or multiple agents touch the same file, migrate to stable block-local updates. If a repository intentionally keeps a generated summary, derive it from the task blocks or source files instead of hand-editing it on every change.
- Review questions: Does the repository track tasks or lessons in shared versioned files? Are multiple changes likely to touch the same "current status" lines? Can the same information be represented as stable per-task blocks or derived summaries instead of hot shared counters?
- Automation potential: Linters or helper scripts can enforce heading shapes and append-only ordering, but judging whether a summary is truly derived or whether a block-local edit was possible still needs context.

## Load And Maintain Active Lessons Within A Bounded Context Budget

- Level: `should`
- Intent: Make repository-owned lessons available early enough to prevent repeated mistakes without allowing an unbounded ledger to crowd out the task itself.
- Rule: Apply this rule when a repository contains `tasks/lessons.md`, `.codex/tasks/lessons.md`, or names another active repository-owned lesson source in local guidance. Before the first substantive plan, review, implementation, or audit action, measure every existing active source and read it in full when the combined size is at most 24,000 bytes and the summed conservative estimate `ceil(file_bytes / 3)` is at most 8,000 tokens. Do not load lesson archives during normal startup. If either budget is exceeded, inventory every lesson heading, then load complete unsplit blocks in this order: safety, privacy, security, authorization, and evidence-integrity lessons; lessons relevant to the current task; lessons from the previous 90 days; then as many remaining blocks as fit. Stop only at lesson-block boundaries, disclose which blocks were omitted, and flag a scoped lesson audit instead of claiming the full ledger was read.
- Rationale: Small active ledgers are cheap, high-value startup context. A deterministic ceiling and whole-block fallback keep larger ledgers useful and honest while reserving context for current evidence and implementation.
- Good example:

```text
Active lesson sources:
- .codex/tasks/lessons.md: 14,400 bytes, ceil(14,400 / 3) = 4,800 tokens

The active set is within both defaults, so read it in full before planning.
```

```text
The active set exceeds the default budget. Inventory every heading, load whole
priority blocks up to the budget, disclose omitted IDs, and record that an audit
is due.
```

- Bad example:

```text
- Load an archive at startup because it contains older context.
- Read only the first 24,000 bytes and split the final lesson mid-block.
- Say "all lessons reviewed" after silently omitting over-budget blocks.
- Archive the oldest lessons solely because they are old.
```

- Exceptions or escape hatches: A repository may choose a different byte or token budget only as a documented local exception, normally in `standards-overrides.md`. Audit active lessons when no audit baseline exists; when the active set first crosses 75% of either budget after the latest below-threshold baseline; when 90 days have elapsed and active lesson content changed; when 10 active lessons have been added since the prior audit; or before an append projected to exceed either full budget. A completed audit above 75% establishes a new baseline and must not recursively retrigger solely because the set remains above that threshold. Consolidate only lessons with the same durable cause, preventive rule, and trigger, keeping the clearest stable ID active and preserving superseded IDs as provenance. Archive only obsolete, duplicated, or fully superseded lessons; age and size are review signals, never sufficient reasons. Do not weaken or archive safety, privacy, security, authorization, or evidence-integrity guardrails unless an equally strong current rule replaces them. Keep audit records append-only. Create an archive only when a lesson is actually archived, preserving its stable ID, original four fields, archive date, reason, and canonical replacement when applicable. Installers and update tools must not create or edit downstream lesson, audit, or archive files merely to distribute this standard.
- Review questions: Which repository-owned files are active lesson sources? Are both default budgets satisfied? If not, were all headings inventoried, whole blocks selected in the required order, and omissions disclosed? Has one of the five audit triggers fired? Does any proposed consolidation or archival preserve provenance and an equally strong active rule?
- Automation potential: The managed downstream command `bun scripts/bright-builds-check.ts lessons` measures both conventional active sources, computes `ceil(file_bytes / 3)` per source, validates stable IDs and four-field blocks, and reports 75% or full-budget states without failing solely for budget size. A reasoned exact-file entry in the optional user-owned `.bright-builds-rules-checks.tsv` can preserve a temporary structural exception; directory exceptions are intentionally unavailable for lesson sources. Relevance, equivalence, obsolescence, audit triggers, and the strength of replacement guardrails still require review judgment.

## Keep Repo-Local Guidance Concise and Durable

- Level: `should`
- Intent: Keep local AGENTS guidance fast to scan, stable enough to trust, and clearly separated from runbooks or historical notes.
- Rule: Keep `## Repo-Local Guidance` high signal: prefer short bullets, direct commands, and links to repo-owned runbooks or deeper docs when more detail is needed. If an item becomes long, volatile, or procedural, summarize the stable invariant in `AGENTS.md` and link to the deeper repo-owned document instead of copying long onboarding docs, full playbooks, or incident history into the section.
- Rationale: `AGENTS.md` works best as a quick-entry local map. When it accumulates long procedures or narrative history, readers stop trusting it as the fast path and the highest-value guidance gets buried.
- Good example:

```text
## Repo-Local Guidance

- Release flow: run `just release-dry-run` first. Full playbook: `docs/release.md`.
- Local Postgres is required for `bin/verify api`; seed data lives in `docs/dev-db.md`.
- `scripts/sync-schema.sh` is the supported codegen entrypoint; do not edit generated snapshots by hand.
```

- Bad example:

```text
## Repo-Local Guidance

- Paste a 70-line release checklist directly into `AGENTS.md`.
- Copy a long onboarding guide, old incident timeline, and step-by-step deploy playbook into the same section.
- Link to ephemeral chat threads instead of repo-owned documents.
```

- Exceptions or escape hatches: Very small repositories may keep all local guidance directly in `AGENTS.md` if it stays short and stable. If a deeper runbook does not exist yet, keep the local bullet concise until there is a real need to split it out.
- Review questions: Can a newcomer act on the item quickly? Is `AGENTS.md` collecting procedural detail that belongs in a repo-owned runbook? Are the linked details stable and checked into the repository?
- Automation potential: Simple length checks can flag drift, but signal-to-noise and long-term durability still require review judgment.
