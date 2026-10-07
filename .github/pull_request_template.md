# Pull Request Template

<!-- bright-builds-rules-managed-file: .github/pull_request_template.md -->

This template is managed upstream by `bright-builds-rules`. If it needs a fix, open an upstream PR or issue instead of editing the downstream managed copy.

## Summary

Describe the behavior change and why it is needed.

## Standards impact

- [ ] Business logic still follows the intended functional core / imperative shell shape.
- [ ] New or changed pure/business logic has unit tests.
- [ ] Unit tests remain focused on one concern and use clear Arrange / Act / Assert structure.
- [ ] Any repo-specific exception has been recorded in `standards-overrides.md`.
- [ ] When plan, review, or audit work relied on Bright Builds Rules guidance, the summary briefly names the local guidance, sidecar, overrides, or standards pages that materially informed it.

## Verification

- [ ] Relevant repo-native verification ran and passed when applicable
- [ ] `bun scripts/bright-builds-check.ts all` ran and passed, or every intentional exact-file or trailing-slash directory exception has a reason in `.bright-builds-rules-checks.tsv`
- [ ] Any CI-only or hook-owned verification exception is documented
- [ ] Changed paths were validated manually when appropriate

## Risks

Document any residual risk, rollout concern, or follow-up work.
