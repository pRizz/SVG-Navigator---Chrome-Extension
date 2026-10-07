# Rust

This page translates the core standards into Rust-specific guidance.

## Prefer `foo.rs` Plus `foo/` Over `foo/mod.rs`

- Level: `must`
- Intent: Keep Rust module entry files easy to find by name and make multi-file module layouts more consistent to navigate.
- Rule: For new or touched multi-file Rust modules, prefer `foo.rs` plus `foo/` over `foo/mod.rs`. When a module has child files or submodules, the module entry file should normally live next to the module directory, not inside it. This rule applies to module entry files for multi-file modules, not crate roots such as `lib.rs`, `main.rs`, or `bin/*.rs`.
- Rationale: A module entry file named after the module is easier to find in code search, editor file search, and repository navigation than a directory full of `mod.rs` files. The `foo.rs` plus `foo/` shape also makes it more obvious which module a file belongs to without opening the directory first.
- Good example:

```text
src/
  payments.rs
  payments/
    retries.rs
    providers.rs
```

- Bad example:

```text
src/
  payments/
    mod.rs
    retries.rs
    providers.rs
```

- Exceptions or escape hatches: Do not require broad rename-only cleanup of stable existing `mod.rs` trees. Apply this rule when creating new modules or restructuring touched areas. Narrow exceptions are acceptable for generated code, external tooling or framework constraints, or a clearly documented local convention. If a repository intentionally keeps `mod.rs`, document the local reason rather than treating it as an unspoken preference.
- Review questions: Is this a new or already-touched multi-file module? Would naming the entry file after the module make it easier to find by filename? Is there a concrete generated-code or tooling constraint that blocks the preferred layout?
- Automation potential: Repository scans can flag `mod.rs` usage, but only review context can tell whether a module is newly introduced, already being restructured, or intentionally exempt.

## Use `let...else` for Guard-Style Extraction

- Level: `should`
- Intent: Keep Rust control flow shallow and make early exits obvious.
- Rule: When a function needs to extract from `Option`, `Result`, or pattern-matched input before proceeding, prefer `let...else` if it expresses the guard more directly than `match` or a split presence check.
- Rationale: Rust offers a concise construct for "continue only if this value fits the shape I need." Using it well reinforces the broader early-return rule and avoids scattered extraction logic.
- Good example:

```rust
fn load_customer_id(maybe_customer: Option<Customer>) -> Result<CustomerId, Error> {
    let Some(customer) = maybe_customer else {
        return Err(Error::NotFound);
    };

    Ok(customer.id)
}
```

- Bad example:

```rust
fn load_customer_id(maybe_customer: Option<Customer>) -> Result<CustomerId, Error> {
    if maybe_customer.is_none() {
        return Err(Error::NotFound);
    }

    Ok(maybe_customer.unwrap().id)
}
```

- Exceptions or escape hatches: Use `match` for true multi-branch logic or when the branch bodies are the point of the code. `let...else` is for the focused guard case.
- Review questions: Is extraction and guard logic split apart? Is there a later `unwrap` that should have been eliminated by a guard?
- Automation potential: Static analysis can catch obvious `is_none` plus `unwrap` sequences, but readable use still needs reviewer judgment.

## Prefix Optional Internal Names with `maybe_`

- Level: `should`
- Intent: Make optional flows visible before the caller has to inspect the signature closely.
- Rule: When an internal Rust name usually represents `Option<T>`, prefer a `maybe_` name such as `maybe_customer_id`, `maybe_profile`, or `maybe_config_path`. Apply the same idea to functions, locals, parameters, destructured bindings, and internal struct fields, plus async or success branches such as `impl Future<Output = Option<T>>` or `Result<Option<T>, E>`. A reusable alias like `MaybeCustomerId` is acceptable only when it materially clarifies a repeated optional surface. Do not apply this rule to plain `Result<T, E>` when success is still a definite value.
- Rationale: Rust makes optionality explicit in the type system, but call sites still read faster when names also signal that `Some` is not guaranteed.
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

```rust
type CustomerIdOrNone = Option<CustomerId>;

struct CustomerState {
    profile: Option<Profile>,
}

fn customer_id(customer: Option<Customer>) -> Option<CustomerId> {
    let Some(customer) = customer else {
        return None;
    };

    let id = Some(customer.id);
    id
}
```

- Exceptions or escape hatches: Rare trait, framework, serde, database, or public API contracts that already spell absence out explicitly may keep their required name. Treat that as a narrow boundary exception, not a reason to skip `maybe_` for ordinary helpers, locals, or fields. Do not introduce `MaybeX` aliases unless they clarify a repeated surface.
- Review questions: Do `Option<T>`-bearing functions, locals, params, and internal fields advertise that possibility in their names? Is the value actually optional absence, or is it just a fallible `Result`? Is a non-`maybe_` name truly forced by a contract, and is a `MaybeX` alias actually helping readability?
- Automation potential: Type-aware tooling can often match `Option` returns and bindings to names, but reviewers still need to judge whether a non-`maybe_` name or extra alias is justified.

## Encode Invariants with Newtypes and Enums

- Level: `must`
- Intent: Use Rust's type system to move business guarantees out of comments and into code.
- Rule: Prefer newtypes, enums, and fallible constructors for domain invariants. Parse raw values into richer domain types before they reach core business functions.
- Rationale: Rust gives strong affordances for making illegal states unrepresentable. Lean on them to prevent accidental misuse and to make function signatures communicate real guarantees.
- Good example:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
struct EmailAddress(String);

impl TryFrom<String> for EmailAddress {
    type Error = EmailError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        if !value.contains('@') {
            return Err(EmailError::Invalid);
        }

        Ok(Self(value))
    }
}

fn send_invite(email: EmailAddress) -> InviteJob {
    InviteJob { email }
}
```

- Bad example:

```rust
fn send_invite(email: String) -> Result<InviteJob, EmailError> {
    if !email.contains('@') {
        return Err(EmailError::Invalid);
    }

    Ok(InviteJob { email })
}
```

- Exceptions or escape hatches: Do not create wrappers with no semantic value. Introduce them when they clarify business meaning, guarantee an invariant, or prevent confusion between similar primitives.
- Review questions: Does a `String`, `Vec`, or `u64` stand in for a richer domain concept? Are invariants enforced once during parsing or re-checked throughout the workflow?
- Automation potential: Clippy cannot infer business meaning, so this remains primarily a design review rule.

## Keep Adapters Thin Around a Pure Core

- Level: `should`
- Intent: Preserve a clean split between Rust domain logic and infrastructure code.
- Rule: Organize Rust modules so domain decisions are pure where practical, while HTTP handlers, CLI entrypoints, database adapters, and background jobs remain thin imperative shells.
- Rationale: This structure makes Rust code faster to test and easier to evolve because the volatile framework layer does not own the core business decisions.
- Good example:

```text
src/
  domain/
    pricing.rs
    promotions.rs
  adapters/
    postgres.rs
    http.rs
  application/
    checkout.rs
```

- Bad example:

```text
src/
  checkout.rs
    // pricing logic
    // SQL
    // HTTP mapping
    // telemetry
```

- Exceptions or escape hatches: Small command-line utilities may live in a single file if the behavior is still obvious and effect-light. Even there, extract pure helpers once the logic becomes reusable or business-critical.
- Review questions: Can the pricing, validation, or state-transition logic run without an adapter present? Are modules grouped by framework instead of by business meaning?
- Automation potential: Module structure can be inspected mechanically, but architectural quality still needs human review.

## Testing Notes

Follow the shared testing standard in [../core/testing.md](../core/testing.md). In Rust, explicit Arrange/Act/Assert comments are the default for unit tests, especially once setup grows beyond a line or two.

## Verification Notes

Follow the shared verification standard in [../core/verification.md](../core/verification.md). In Rust repositories, common verification surfaces include `cargo fmt`, `cargo clippy`, `cargo build`, and `cargo test`, but treat those as examples rather than a mandatory universal sequence. Prefer the repo's own Rust-oriented verify/check entrypoint when it exists, and scope runs to the affected crate, package, or workspace when the repository supports that.
