# Architecture

This page captures the default architectural style for business logic and domain modeling.

## Functional Core, Imperative Shell

- Level: `should`
- Intent: Keep business logic easy to reason about, easy to unit test, and easy to reuse across delivery mechanisms.
- Rule: Default to a functional core and imperative shell architecture. Business rules should live in pure, data-in/data-out functions. I/O, framework calls, storage access, clocks, randomness, and external side effects should stay in thin adapters around that core.
- Rationale: Separating pure logic from effects lowers test setup cost, reduces incidental coupling, and makes behavioral changes more local. It also makes the codebase friendlier to both human reviewers and AI agents because the business decisions are not buried inside infrastructure code.
- Good example:

```ts
type RenewalCandidate = {
  email: string;
  name: string;
  expiredAt: Date;
};

function expiredPaidUsers(
  users: RenewalCandidate[],
  asOf: Date,
): RenewalCandidate[] {
  return users.filter((user) => user.expiredAt <= asOf);
}

async function sendExpiryReminders(deps: {
  loadUsers: () => Promise<RenewalCandidate[]>;
  sendEmail: (email: string, message: string) => Promise<void>;
  now: () => Date;
}): Promise<void> {
  const users = await deps.loadUsers();
  const expiredUsers = expiredPaidUsers(users, deps.now());

  for (const user of expiredUsers) {
    await deps.sendEmail(user.email, `Your account has expired, ${user.name}.`);
  }
}
```

- Bad example:

```ts
async function sendExpiryReminders(db: Db, mailer: Mailer): Promise<void> {
  const users = await db.query("select * from users");

  for (const user of users) {
    if (user.expiredAt > Date.now()) {
      continue;
    }

    await mailer.send(user.email, `Your account has expired, ${user.name}.`);
  }
}
```

- Exceptions or escape hatches: Short glue code, framework entrypoints, and orchestration layers may remain imperative. If a workflow is inherently effect-heavy, isolate the pure decision points that still can be extracted instead of forcing artificial purity.
- Review questions: Is the business decision logic readable without mentally simulating I/O? Could the core behavior be unit tested without a database, network, file system, or framework runtime?
- Automation potential: Review tools can flag obvious infrastructure calls inside domain modules, but architectural separation still needs human judgment.

## Parse at Boundaries, Then Use Domain Types

- Level: `should`
- Intent: Move validation to the edges so the rest of the system can operate on trustworthy domain values.
- Rule: Parse raw input into domain types as early as practical. Avoid passing unchecked primitives deep into business logic when a richer type can prove the invariant once.
- Rationale: Repeated validation spreads checks across the system and increases the chance that one path forgets a guard. Parsing once at the boundary creates a clearer data flow and reduces "shotgun parsing" behavior.
- Good example:

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
struct NonEmptyName(String);

impl TryFrom<String> for NonEmptyName {
    type Error = &'static str;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return Err("name must not be empty");
        }

        Ok(Self(trimmed.to_owned()))
    }
}

fn rename_user(name: NonEmptyName) -> String {
    format!("updated {}", name.0)
}
```

- Bad example:

```rust
fn rename_user(name: String) -> Result<String, &'static str> {
    if name.trim().is_empty() {
        return Err("name must not be empty");
    }

    Ok(format!("updated {}", name))
}
```

- Exceptions or escape hatches: Not every primitive needs a dedicated wrapper. Use richer types when they eliminate real ambiguity, prevent bugs, or encode business meaning that reviewers would otherwise have to reconstruct from surrounding code.
- Review questions: Are raw strings, numbers, or maps leaking deep into the domain layer? Is the same invariant being re-checked in multiple places?
- Automation potential: Static checks can catch some primitive obsession patterns, but identifying the right domain type remains a design decision.

## Make Illegal States Unrepresentable

- Level: `must`
- Intent: Let the type system prevent invalid combinations of values whenever the language makes that practical.
- Rule: Prefer types, constructors, and state machines that rule out impossible states instead of relying on comments, sentinel values, or repeated runtime checks.
- Rationale: If the type can represent an invalid state, the burden shifts to every call site to remember the rules. If the type cannot represent it, entire categories of bugs disappear and refactors become safer.
- Good example:

```ts
type DraftOrder = {
  kind: "draft";
  items: NonEmptyArray<OrderItem>;
};

type SubmittedOrder = {
  kind: "submitted";
  items: NonEmptyArray<OrderItem>;
  submittedAt: Date;
};

type Order = DraftOrder | SubmittedOrder;
```

- Bad example:

```ts
type Order = {
  status: "draft" | "submitted";
  items: OrderItem[];
  submittedAt?: Date;
};
```

- Exceptions or escape hatches: External schemas and storage models may be looser than the in-memory domain model. Parse those looser shapes into stricter internal types instead of mirroring the looseness everywhere.
- Review questions: Could a caller create a value that is obviously invalid yet still type-checks? Are optional fields or sentinel values standing in for a proper sum type or newtype?
- Automation potential: Linters can catch some sentinel or optional-field smells, but meaningful illegal-state modeling is primarily a design review concern.

## Further Reading

- Scott Wlaschin functional core / imperative shell talk: `https://www.youtube.com/watch?v=P1vES9AgfC4`
- Google Testing Blog article: `https://testing.googleblog.com/2025/10/simplify-your-code-functional-core.html`
- Parse-don't-validate article: `https://www.harudagondi.space/blog/parse-dont-validate-and-type-driven-design-in-rust`
