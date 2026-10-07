# Standards Index

This repository uses a tiered rules model so preferences and hard requirements do not get flattened into the same voice.

## Rule levels

- `must`: mandatory unless a documented local exception exists
- `should`: default behavior; deviations need a deliberate reason
- `may`: optional guidance that is useful when it improves clarity or maintainability

## How to use this corpus

1. Start with the core standards.
1. Read any language-specific guidance that applies to the repository or task.
1. Use the downstream manager to install the local templates and managed standards corpus.
1. Capture recurring repo-local workflow facts in `AGENTS.md` under `## Repo-Local Guidance`.
1. Document repo-specific exceptions in `standards-overrides.md` instead of silently drifting.

## Core standards

- [Architecture](core/architecture.md)
- [Code Shape](core/code-shape.md)
- [Frontend UI](core/frontend-ui.md)
- [Operability](core/operability.md)
- [Local Guidance](core/local-guidance.md)
- [Verification](core/verification.md)
- [Testing](core/testing.md)

## Language-specific guidance

- [Rust](languages/rust.md)
- [TypeScript / JavaScript](languages/typescript-javascript.md)

## Downstream interfaces

The supported downstream interfaces for v1 are:

- this index page as the discovery entrypoint
- the rule-card format used by each standards page
- the templates in `templates/`
- the managed downstream starter-check CLI at `scripts/bright-builds-check.ts`
- the optional Codex skill in `skills/bright-builds-rules/`

## Review model

When reviewing or auditing code against these standards:

- treat `must` violations as findings unless a local override exists
- treat `should` violations as strong refactor recommendations
- use `may` guidance to improve clarity when the code is already otherwise sound
