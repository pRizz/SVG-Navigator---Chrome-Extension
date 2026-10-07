# Operability

This page captures default expectations for operational visibility in shipped user-facing products.

## Display Runtime Provenance In User-Facing Product UI

- Level: `must`
- Intent: Make it easy for users, support, and engineers to identify the exact running build during debugging without relying on source access, devtools, or guesswork.
- Rule: For user-facing, app-like websites and apps, display runtime provenance in a stable user-visible surface such as a footer, About screen, Settings page, or Help panel. At minimum, expose app version, source commit, and build identifier or build time. The visible UI should default to a short commit hash, usually 7-12 characters, for readability. When the source repository is public GitHub and the commit URL is known, link the short hash to the full commit page. When a stable CI run URL is available, link the build time or build identifier to the run that produced the build; exact job-page URLs are optional because common CI defaults, including GitHub Actions, expose workflow run URLs more directly than job URLs. In web UIs, external source and CI provenance links should open in a new tab or window and use safe link attributes such as `rel="noopener noreferrer"` when the framework exposes raw anchor attributes. A concise copyable one-line summary that includes the exact commit when available is useful but optional; add it when it materially helps support workflows without adding unnecessary product chrome. If any required field is unavailable, render `Unavailable` for that field instead of hiding the provenance surface or omitting the field. Do not make this information depend on devtools, hidden gestures, or non-production-only modes. A separate diagnostics endpoint is optional, not required by this rule.
- Rationale: Support and debugging are slower when the running build has to be inferred from screenshots, release notes, CI logs, or a developer's memory. Visible provenance shortens incident triage, reduces ambiguity between staged and deployed artifacts, and gives non-engineers a reliable way to report what they are actually using.
- Good example:

```text
Admin dashboard footer
- Version 2.4.1
- Commit a1b2c3d links to https://github.com/example/admin/commit/a1b2c3d4e5f678901234567890abcdef1234567 in a new tab
- Build 2026-03-25T14:10Z links to https://github.com/example/admin/actions/runs/123456789 in a new tab
- optional "Copy build info" copies: version=2.4.1 commit=a1b2c3d4e5f678901234567890abcdef1234567 build=2026-03-25T14:10Z
```

- Good example:

```text
Desktop app About screen
- Version 5.8.0
- Commit Unavailable
- Build 2026.03.25.2
- missing commit stays visible as `Unavailable`
- no source or build links because the source repository or CI run URL is not public or known
```

- Bad example:

```text
Production customer portal
- footer and settings show no build details
- staging shows a version badge, but production hides it
- support has to ask engineering which commit was deployed
```

- Bad example:

```text
Internal tool
- commit is only visible in browser devtools
- build number appears only after a hidden keyboard shortcut
- missing fields disappear entirely instead of showing `Unavailable`
```

- Exceptions or escape hatches: This rule applies to interactive, app-like websites and apps, including internal or admin UIs. It does not apply by default to background services, CLIs, workers, or simple brochure, marketing, or landing sites. Products without a natural footer may use an About, Settings, Help, or similar stable navigation surface instead. If a repository has a documented security, contractual, or product reason not to expose a specific field, record that decision in `standards-overrides.md` rather than silently omitting the provenance behavior.
- Review questions: Can a normal user or support person identify the running version, commit, and build from the product UI in production? Is the visible commit shortened to a readable hash by default? For public GitHub repos, does the short hash link to the full commit page when the URL is known? Does the build time or build identifier link to the CI workflow run when a stable run URL is available? In web UIs, do external commit and build links open in a new tab or window with safe link attributes? Do missing fields render as `Unavailable` instead of disappearing? Is the provenance shown in stable product chrome rather than devtools, hidden gestures, or environment-specific debug modes? Would a copy affordance help support, or would it add low-value chrome?
- Automation potential: Build pipelines and static checks can verify some metadata wiring and CI run URL construction, but visibility, placement, optional copy affordances, and scope judgment still require human review.
