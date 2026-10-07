# Code Shape

This page covers the default expectations for local code structure and readability.

## Prefer Early Returns Over Nesting

- Level: `should`
- Intent: Keep control flow shallow so the main path remains obvious.
- Rule: Prefer guard clauses and early returns over nested conditionals. Exit invalid or boring paths first and keep the main behavior at the left margin.
- Rationale: Deep nesting hides the core behavior, makes refactors riskier, and increases the amount of state a reader has to carry through the function.
- Good example:

```rust
fn send_receipt(maybe_order: Option<Order>) -> Result<(), Error> {
    let Some(order) = maybe_order else {
        return Ok(());
    };

    if !order.is_paid {
        return Ok(());
    }

    deliver(order)
}
```

- Bad example:

```rust
fn send_receipt(maybe_order: Option<Order>) -> Result<(), Error> {
    if let Some(order) = maybe_order {
        if order.is_paid {
            deliver(order)?;
        }
    }

    Ok(())
}
```

- Exceptions or escape hatches: A small amount of nesting is acceptable when it matches the shape of the problem better than a sequence of guard clauses. The goal is clarity, not mechanical flattening.
- Review questions: Can the unhappy path exit sooner? Is the main behavior indented because guards were left inline?
- Automation potential: Linters can catch some unnecessary nesting patterns, but readability still needs reviewer judgment.

## Use Language-Native Guard Constructs

- Level: `should`
- Intent: Express guard-style exits with the clearest construct each language offers.
- Rule: When a language has dedicated guard constructs, prefer them over more indirect control flow. In Rust, use `let...else` when destructuring or extracting values for an early exit makes the function easier to read.
- Rationale: Guard constructs communicate intent directly and reduce ceremony around the "continue only when this value is present or valid" pattern.
- Good example:

```rust
fn issue_refund(maybe_payment: Option<Payment>) -> Result<(), Error> {
    let Some(payment) = maybe_payment else {
        return Ok(());
    };

    if !payment.is_refundable() {
        return Ok(());
    }

    process_refund(payment)
}
```

- Bad example:

```rust
fn issue_refund(maybe_payment: Option<Payment>) -> Result<(), Error> {
    if maybe_payment.is_none() {
        return Ok(());
    }

    let payment = maybe_payment.unwrap();

    if !payment.is_refundable() {
        return Ok(());
    }

    process_refund(payment)
}
```

- Exceptions or escape hatches: If `match`, `if let`, or another form is genuinely clearer for multiple branches, use it. This rule is about clarity, not forcing every extraction through the same syntax.
- Review questions: Is the guard expression direct, or is the function split between a presence check and a later extraction? Does the code use the clearest language feature for the shape of the control flow?
- Automation potential: Rust-specific linting or review tooling can flag some `let...else` opportunities, but not all cases are equally readable.

## Prefix Nullable Internal Names with `maybe`

- Level: `should`
- Intent: Make "this value may be absent" obvious before the reader has to inspect a type annotation, implementation, or distant schema.
- Rule: When an internal name represents a value that may legitimately be nullish or optional, use the language's normal `maybe` form in that name. Apply this to functions returning absence-like success values, to locals, parameters, destructured bindings, and internal fields or properties with those shapes, and to reusable wrapper or alias types only when such a type materially clarifies a repeated nullable surface. Across languages this covers shapes such as `T | null`, `T | undefined`, `T?`, `Option<T>`, `Maybe<T>`, `nil`, `None`, and promise or future-wrapped equivalents such as `Promise<T | null>` or `Future<Option<T>>`. Use `MaybeX`-style type names only when the alias or wrapper adds real clarity; do not invent one-off aliases when the raw type is already obvious. This rule is about absence-like success values, not error channels: plain `Result<T, E>`, thrown exceptions, or similar failure paths do not trigger `maybe` unless the success branch itself is nullable or optional. Ordinary empty collections, maps, slices, or strings also do not trigger this rule when emptiness is still a normal successful result rather than "no value."
- Rationale: Call sites and local flows are easier to read when absence is advertised in names instead of being hidden in a distant type annotation or implementation detail. A visible `maybe` marker makes nullish paths harder to miss during review, reduces surprise at the use site, and nudges callers to handle the unhappy path explicitly.
- Good example:

```text
Internal session flow
  - `type MaybeSession = Session | null` because the alias is reused across multiple interfaces
  - `async function maybeLoadSession(maybeToken: string): Promise<MaybeSession>`
  - `const maybeSession = await maybeLoadSession(maybeToken)`
  - `const { profile: maybeProfile } = payload`
  - `const state = { maybeConfigPath: maybeSession?.configPath }`
```

- Good example:

```rust
type MaybeCustomerId = Option<CustomerId>;

struct CustomerState {
    maybe_profile: Option<Profile>,
}

fn maybe_customer_id(maybe_customer: Option<Customer>) -> MaybeCustomerId {
    let Some(customer) = maybe_customer else {
        return None;
    };

    let maybe_id = Some(customer.id);
    maybe_id
}
```

- Bad example:

```text
Internal session flow
  - `type SessionOrNull = Session | null` for a one-off local use
  - `async function loadSession(token: string | null): Promise<Session | null>`
  - `const session = await loadSession(token)`
  - `const { profile } = payload`
  - `const state = { configPath: session?.configPath }`
```

- Exception example:

```text
External or framework-owned contract
  - JSON field stays `profile` because the wire format is stable
  - GraphQL schema keeps `user` as a nullable field
  - adapter maps those into internal `maybeProfile` or `maybeUser` names after the boundary
```

- Exceptions or escape hatches: Keep exceptions rare. Public or external contract names, framework-required names, trait or interface requirements, wire fields, DB columns, GraphQL schema fields, and third-party integration surfaces may keep their established names when renaming would fight a stable contract. Map those names into internal `maybe` names after the boundary when helpful. Do not treat "find", "lookup", or "try" by themselves as automatic exemptions, and do not invent `MaybeX` aliases unless they clarify a repeated surface.
- Review questions: Does the internal name warn the reader that a normal use may yield no value? Is the value actually nullish or optional absence, or merely an empty collection or an error channel? If the name skips `maybe`, is the alternate absence signal truly explicit and contract-driven? Does a `MaybeX` alias add clarity, or is it just wrapping a one-off type expression?
- Automation potential: Static analysis can often pair nullable or optional types with names, but deciding whether an alternate name or alias is a justified exception still needs reviewer judgment.

## Split Large Functions Into Named Pieces

- Level: `should`
- Intent: Keep functions small enough that a reader can understand one concern at a time.
- Rule: When a function grows beyond roughly 161 lines, treat that as a refactor trigger. Use `floor(100 * phi)` as a mnemonic for the threshold, not as a hard cap, and break the function into sensible helpers, steps, or sub-workflows with names that reveal intent.
- Rationale: Oversized functions usually mix responsibilities, bury important transitions, and make testing harder because the seams are implicit instead of named.
- Good example:

```text
handleCheckout()
  -> parseRequest()
  -> priceCart()
  -> reserveInventory()
  -> buildResponse()
```

- Bad example:

```text
handleCheckout()
  // 300+ lines that parse input, calculate discounts, mutate stock,
  // call payment APIs, map errors, log metrics, and build the response
```

- Exceptions or escape hatches: Generated code and intentionally linear scripts may exceed the threshold. If a larger function is still the clearest representation, leave a short note explaining why splitting it would hurt clarity.
- Review questions: Does the function still represent a single concern? Could named helpers reveal the workflow better than comments or blank lines?
- Automation potential: Length checks are easy to automate, but whether the split is sensible still requires review.

## Do Not Hide Foreign Code Inside Strings

- Level: `should`
- Intent: Keep each language in a surface where it can be named, reviewed, linted, tested, reused, and run with the right tooling.
- Rule: Do not embed substantial code from one language inside another via string literals, heredocs, multiline inline blocks, or generated command strings. Keep orchestration and host-language code focused on orchestration, and move foreign-language logic into checked-in scripts, query files, templates, modules, or other language-aware artifacts. This applies across source files, scripts, config, CI or automation YAML, templates, and generated command assembly. If one surface must invoke another language, call a file or native entrypoint instead of pasting that language inline.
- Rationale: Foreign-language logic hidden inside strings loses syntax-aware tooling, blurs the boundary between orchestration and implementation, and is awkward to run or debug locally. It also increases quoting and escaping mistakes, encourages copy-pasted mini-programs, and makes review harder because the real logic is hiding in a host-language string.
- Good example:

```yaml
- name: Verify docs
  run: ./scripts/verify-docs.sh
```

- Good example:

```bash
#!/usr/bin/env bash
set -euo pipefail

node ./tools/check-config.mjs
```

- Good example:

```text
queries/find_stale_accounts.sql
  - checked in next to the code that owns it
  - loaded by the host language or replaced with a language-aware query abstraction
```

- Bad example:

```yaml
- name: Verify docs
  run: |
    set -euo pipefail
    changed=0
    for path in README.md standards/**/*.md templates/**/*.md; do
      if [[ ! -f "$path" ]]; then
        continue
      fi
      npx markdownlint-cli2 "$path"
      if grep -q "TODO" "$path"; then
        changed=1
      fi
    done

    if [[ "$changed" -eq 1 ]]; then
      bun scripts/check-links.ts --strict
    else
      bun scripts/check-links.ts
    fi
```

- Bad example:

```bash
#!/usr/bin/env bash
set -euo pipefail

bash -c '
  node -e "
    const config = JSON.parse(require(\"node:fs\").readFileSync(\"config.json\", \"utf8\"));
    if (!config.enabled) {
      process.exit(1);
    }
  "
'
```

- Bad example:

```typescript
const findStaleAccounts = `
  select id, email
  from users
  where deleted_at is null
    and last_seen_at < now() - interval '90 days'
  order by last_seen_at asc
`;
```

- Exceptions or escape hatches: Keep exceptions rare. Truly trivial host-required glue may stay inline, such as an obvious one-liner, a short invocation of an existing tool, or a tiny literal that is genuinely clearer in place than in a separate artifact. Once the embedded code carries its own logic, quoting complexity, reusable behavior, or independent change pressure, extract it. If a reusable composite action, framework-native abstraction, or third-party integration is clearer than a local file, prefer the clearer abstraction.
- Review questions: Is this surface still orchestration or host-language logic, or is real foreign-language behavior hiding inside a string? Would a checked-in script, query file, template, or language-aware abstraction make the logic easier to review, lint, test, reuse, or run locally? Is the remaining inline case truly trivial, or did convenience quietly turn it into a second program?
- Automation potential: Linters can flag large multiline `run:` blocks, heredocs, `bash -c`, `node -e`, `python -c`, and oversized embedded query strings, but deciding when an inline snippet is still genuinely trivial still needs reviewer judgment.

## Make Scripts Safe To Re-Run And Easy To Diagnose

- Level: `should`
- Intent: Make repo-owned scripts safer to retry and easier to debug after unattended or partial runs.
- Rule: For checked-in scripts and automation entrypoints such as shell, Python, Node, maintenance, CI helper, and ops scripts, prefer idempotent-safe behavior when the task allows. Design repeated or partial reruns to converge instead of duplicating work, corrupting state, or surprising an operator. When true idempotence is not appropriate, make that explicit through guards, naming, or documentation. Emit breadcrumb-heavy progress logs during execution and persist a concise final summary plus detailed logs to a repo-defined gitignored path.
- Rationale: Scripts often run under CI, cron, or incident pressure, where retries are common and the original operator may not be available. Rerunnable behavior lowers recovery risk, while persisted breadcrumbs and run summaries make async debugging and auditability much easier.
- Good example:

```text
scripts/sync-config.sh
  - checks whether each target already matches before rewriting
  - logs major decisions, skips, and retries as it runs
  - writes a final changed/skipped/failed summary and detailed logs to a repo-local gitignored path
```

- Bad example:

```text
scripts/bootstrap.sh
  - blindly appends the same block on every run
  - prints only "starting" and "done"
  - leaves no persisted logs or run summary after CI or cron finishes
```

- Exceptions or escape hatches: Trivial one-liners, intentionally one-shot or destructive scripts, and scripts whose job is to create unique resources may not be idempotent. In those cases, make the non-idempotent behavior obvious and log enough context to understand what happened where practical.
- Review questions: Can this script be safely rerun after a partial failure, or is the non-idempotence made explicit? Could someone diagnose a failed unattended run from the persisted breadcrumbs and summary without reproducing it live? Is the log destination intentionally gitignored and locally documented by the repo?
- Automation potential: Tests and linters can catch some duplicate-output or append-every-time patterns, but rerun safety and useful operational logging still require reviewer judgment.

## Split Oversized Files Into Modules

- Level: `should`
- Intent: Keep file boundaries aligned with coherent responsibilities instead of turning one file into a dumping ground.
- Rule: When a source file grows beyond roughly 628 lines of code, treat that as a refactor trigger. Use `floor(100 * tau)` as a mnemonic for the threshold, not as a hard cap, and split the file into smaller modules organized around clear responsibilities.
- Rationale: Very large files slow navigation, hide architectural seams, and often signal that unrelated concerns have accumulated in one place.
- Good example:

```text
checkout/
  pricing.rs
  validation.rs
  orchestration.rs
  tests.rs
```

- Bad example:

```text
checkout.rs
  // request parsing
  // pricing rules
  // tax logic
  // API adapter
  // persistence
  // error mapping
  // tests
```

- Exceptions or escape hatches: Some files act as intentionally central registries or protocol definitions. Keep those rare, obvious, and documented.
- Review questions: Does the file contain multiple clusters of logic that would be easier to navigate as separate modules? Are tests, adapters, and domain rules all mixed together?
- Automation potential: The managed downstream command `bun scripts/bright-builds-check.ts file-lengths` fails at 629 physical lines for common tracked source-file extensions while excluding conventional dependency and build directories. A reasoned exact-file entry in the optional user-owned `.bright-builds-rules-checks.tsv` preserves an intentional file exception; a trailing-slash directory entry can recursively exclude a non-standard third-party source tree. Good module boundaries still require review.
