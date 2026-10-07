# Frontend UI

This page captures default expectations for frontend visual experience choices.

## Default Frontend Experiences To Dark Mode

- Level: `should`
- Intent: Start new user-facing frontend surfaces from a comfortable, consistent baseline while still allowing product context to override the default.
- Rule: User-facing frontend experiences should default to a dark appearance. Use dark page backgrounds, darker panels or surfaces, clear borders, accessible text contrast, and enough accent-color variation that the UI does not become a one-note theme. Do not make a light-first default unless a documented brand, accessibility, embedding, legal, or product constraint makes that the better default. Existing light UIs may migrate opportunistically when touched, but new app or site surfaces should start dark.
- Rationale: Bright Builds products and utilities should feel cohesive, polished, and comfortable for sustained use. A dark default reduces visual glare for many app-like workflows and gives agents a concrete theme direction instead of leaving each frontend to drift.
- Good example:

```text
New media utility app
- charcoal app background
- dark panel surfaces with subtle borders
- high-contrast text and controls
- green success, amber warning, red error, and bright primary action states
```

- Good example:

```text
Existing light admin UI
- keeps its current light theme until the next design pass
- records a brand-system reason if new touched surfaces need to remain light
```

- Bad example:

```text
New standalone tool
- defaults to a white page and pale panels without a product reason
- uses only blue-purple gradients for every surface and action
- documents no exception
```

- Exceptions or escape hatches: A light default is acceptable when it is required by brand standards, accessibility research for the target audience, host-page embedding constraints, legal requirements, print-like product semantics, or another documented product constraint. Record durable repo-specific exceptions in `standards-overrides.md` when they affect future work.
- Review questions: Does the first loaded frontend experience default to dark mode? If it does not, is the reason documented and durable? Are contrast, surface separation, and state colors accessible and practical rather than decorative?
- Automation potential: Visual linting can detect color tokens or missing dark defaults in some stacks, but final theme quality and exception judgment require human review.

## Disclose Public Open-Source Project Identity In Product Chrome

- Level: `must`
- Intent: Make public open-source web projects transparent about source availability, licensing posture, and owner identity without turning the product UI into marketing clutter.
- Rule: Public open-source web apps and sites must expose a stable source link in normal product chrome such as a footer, About screen, Help panel, or settings surface. GitHub-hosted projects should use a GitHub logo, source icon, or similarly recognizable source affordance when the UI has room. Only describe the project as `free and open source` when the repository and license actually support that claim. When the repository owner normalizes to `pRizz`, `peterryszkiewicz`, or Peter Ryszkiewicz, the same disclosure surface should mention Peter Ryszkiewicz and link to `https://openlinks.us/`; use the OpenLinks logo when the layout can support an icon without crowding the host product brand.
- Rationale: Public open-source web projects benefit when users can quickly inspect the source, understand that the project is free/open, and find the maintainer's broader identity surface. Keeping this in stable footer or about chrome makes the disclosure discoverable without competing with the product's primary workflow.
- Good example:

```text
Public GitHub Pages utility
- footer includes a GitHub-logo link to the repository
- footer text says "Free and open source" because the repo has an open-source license
- footer includes "By Peter Ryszkiewicz" with an OpenLinks logo linking to https://openlinks.us/
- version and build provenance remain visible but separate
```

- Good example:

```text
Public open-source docs site owned by another organization
- About page links to the source repository
- footer says "Open source" only because the license is public and compatible with that claim
- no Peter/OpenLinks attribution because the repository is not Peter-owned
```

- Bad example:

```text
Public source-available web app
- no visible source link in the product UI
- README has a repository link, but normal users of the app cannot find it from the app itself
```

- Bad example:

```text
Private customer portal
- claims "free and open source" in the footer even though the source is private
- adds a maintainer identity link that is unrelated to the owning organization
```

- Exceptions or escape hatches: This rule applies to public open-source web apps and sites. It does not require proprietary, private, internal, or source-available-but-not-open-source products to claim open-source status. Products without a natural footer may use an About, Help, settings, or similar stable surface. If legal, brand, or security constraints prevent a source or maintainer disclosure, document the local exception in `standards-overrides.md`.
- Review questions: Can a normal user find the source repository from the product UI? Does any `free and open source` copy match the actual license and repository status? For GitHub-hosted projects, is the source affordance recognizable? For Peter-owned repos, does the product chrome mention Peter Ryszkiewicz and link to OpenLinks without overpowering the host product brand?
- Automation potential: Static checks can detect repository metadata, license files, and some footer links, but ownership, visual prominence, and truthful FOSS copy still need review judgment.
