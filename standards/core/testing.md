# Testing

This page defines the baseline expectations for unit tests around pure code and business logic.

## Unit Test Pure and Business Logic

- Level: `must`
- Intent: Make core business behavior cheap to verify and safe to refactor.
- Rule: Pure code and business logic must have unit tests. The default expectation is near-total unit coverage for those paths. If a pure or business-logic branch is intentionally left untested, document the reason close to the code or in the pull request.
- Rationale: The standards in this repository push business logic into a functional core precisely so it can be tested cheaply. Leaving that core untested gives up the main benefit of the architecture.
- Good example:

```rust
#[test]
fn applies_discount_for_returning_customers() {
    // Arrange
    let customer = Customer::returning();
    let cart = Cart::with_total(1_000);

    // Act
    let priced = price_cart(&customer, &cart);

    // Assert
    assert_eq!(priced.total_cents, 900);
}
```

- Bad example:

```rust
#[test]
fn checkout_flow_works() {
    let server = TestServer::boot();
    assert!(server.post("/checkout").status().is_success());
}
```

- Exceptions or escape hatches: Thin imperative shells may rely more on integration tests than unit tests. That exception does not apply to the pure decision logic inside those shells.
- Review questions: Is the changed behavior business logic or pure transformation code? If yes, where is the unit test that proves it?
- Automation potential: Coverage tools can measure trends, but they cannot reliably distinguish meaningful business logic from incidental code without reviewer context.

## Test One Concern Per Unit Test

- Level: `must`
- Intent: Keep failures specific so a broken test points at one behavior, not a bundle of unrelated assumptions.
- Rule: Each unit test should exercise one concept or concern. If a test needs many assertions, they should all describe the same behavior.
- Rationale: Multi-concern tests fail noisily and force maintainers to reverse-engineer which part of the setup actually matters. Small tests make intent clear and reduce accidental coupling.
- Good example:

```ts
it("rejects an empty team name", () => {
  // Arrange
  const input = { name: "" };

  // Act
  const result = TeamName.parse(input.name);

  // Assert
  expect(result.ok).toBe(false);
});
```

- Bad example:

```ts
it("creates a team", () => {
  // Arrange
  const input = { name: "alpha", ownerEmail: "owner@example.com" };

  // Act
  const result = createTeam(input);

  // Assert
  expect(result.team.name).toBe("alpha");
  expect(result.auditEvent.kind).toBe("team-created");
  expect(result.emailJobs).toHaveLength(1);
  expect(result.slug).toBe("alpha");
});
```

- Exceptions or escape hatches: Table-driven or parameterized tests may cover multiple input cases, but the single behavior under test should still be obvious.
- Review questions: What single behavior is this test proving? If the test failed, would the failure point to one idea or several?
- Automation potential: This is mostly a review and design rule; tooling can only approximate it.

## Delineate Arrange, Act, Assert

- Level: `must`
- Intent: Make the shape of the test obvious at a glance.
- Rule: Unit tests must clearly delineate Arrange, Act, and Assert. Comments are the default mechanism unless the structure is already unambiguous and the team has agreed on a lighter style.
- Rationale: Explicit test structure reduces scanning time, keeps setup from bleeding into assertions, and makes it easier for reviewers to verify that a test is focused.
- Good example:

```rust
#[test]
fn declines_duplicate_coupon_codes() {
    // Arrange
    let existing = CouponCode::parse("spring-sale").unwrap();

    // Act
    let result = CouponCode::parse("spring-sale");

    // Assert
    assert_eq!(result, Ok(existing));
}
```

- Bad example:

```rust
#[test]
fn declines_duplicate_coupon_codes() {
    let existing = CouponCode::parse("spring-sale").unwrap();
    let result = CouponCode::parse("spring-sale");
    assert_eq!(result, Ok(existing));
}
```

- Exceptions or escape hatches: Very small tests may omit the comments if the structure remains unmistakably Arrange, Act, Assert. If the test has enough setup or assertions that a reviewer has to hunt for the action, add the comments.
- Review questions: Can a reader immediately point to the setup, the single action, and the expected outcome? Is the test structure hidden by helper indirection?
- Automation potential: Linters can check for comment markers, but human review is needed to confirm the sections are meaningful.
