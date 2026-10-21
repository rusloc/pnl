# General Test Patterns

Framework-agnostic patterns for organising tests, generating data, choosing test doubles, and avoiding common smells. Use alongside the framework-specific files (`unit-testing.md`, `nextjs-react-testing.md`, etc.).

---

## AAA: Arrange / Act / Assert

The default structure. Three phases, separated by blank lines or comments:

```ts
it('refunds the full amount on a clean cancellation', () => {
  // Arrange
  const order = makeOrder({ total: 100, status: 'paid' });

  // Act
  const refund = cancel(order);

  // Assert
  expect(refund.amount).toBe(100);
  expect(refund.fee).toBe(0);
});
```

If you can't draw a clear line between Arrange and Act, your test probably has too much setup logic in-line. Extract it.

If you have **act → assert → act → assert**, you have two tests. Split.

---

## Given / When / Then

Same idea as AAA, with a behaviour-driven flavour. Useful when the test is part of a feature spec or BDD-style suite, or when the behaviour involves a precondition that's complex to articulate as "Arrange":

```ts
it('reactivates a soft-deleted account', () => {
  // Given a soft-deleted account
  const account = makeAccount({ deletedAt: new Date('2024-01-01') });

  // When the user signs in within the grace period
  const session = signIn(account, { now: new Date('2024-01-15') });

  // Then the account is reactivated
  expect(account.deletedAt).toBeNull();
  expect(session.user.id).toBe(account.id);
});
```

Don't religiously add `// Given`/`// When`/`// Then` comments to every test. It's noise on simple tests and clarity on complex ones.

---

## Table-Driven Tests

For a function with many input/output pairs — formatters, validators, parsers, pure transformations — table-driven is far more compact and easier to extend than N copy-pasted `it` blocks.

```ts
describe('parseDuration', () => {
  it.each<[string, number | null, string]>([
    // [input, expected ms, label]
    ['1s',          1000,           'seconds'],
    ['1m',          60_000,         'minutes'],
    ['1h',          3_600_000,      'hours'],
    ['1d',          86_400_000,     'days'],
    ['1.5h',        5_400_000,      'fractional hours'],
    ['90m',         5_400_000,      'minutes that exceed an hour'],
    ['0',           0,              'zero'],
    ['-1s',         null,           'negative duration rejected'],
    ['',            null,           'empty string rejected'],
    ['abc',         null,           'garbage rejected'],
    ['1y',          null,           'unsupported unit rejected'],
    ['1s2s',        null,           'concatenated unsupported'],
    ['  1s  ',      1000,           'whitespace tolerated'],
  ])('parseDuration(%j) → %j  (%s)', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
});
```

The third column is the test label that shows up in failure output. Without it, "test 7 failed" is harder to reason about than "negative duration rejected failed".

**Tip:** when you find a bug, add a row to the table. The table accumulates the suite's institutional memory.

---

## Test Data Builders

For complex objects (a User, an Order, a session), copy-pasting object literals across tests creates duplication that ages badly when the schema changes.

A **builder** centralises construction with sensible defaults and per-test overrides:

```ts
// test/builders.ts
export const makeUser = (overrides: Partial<User> = {}): User => ({
  id: crypto.randomUUID(),
  email: 'user@test.com',
  name: 'Test User',
  emailVerified: true,
  createdAt: new Date('2025-01-01'),
  ...overrides,
});

export const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: crypto.randomUUID(),
  userId: makeUser().id,
  items: [],
  total: 0,
  status: 'pending',
  createdAt: new Date('2025-01-01'),
  ...overrides,
});
```

Use:

```ts
it('rejects unverified emails', () => {
  const user = makeUser({ emailVerified: false });
  expect(() => sendInvoice(user)).toThrow();
});
```

When the schema changes (a new required field added), you update the builder once instead of N tests.

**Antipatterns:**
- `makeUser()` returning the same `id` every time → cross-test contamination. Use a generator.
- Builder defaults that match a "happy" case so well that tests don't realise they depend on the default. Make the defaults **boring**, not *valid in every test*.

---

## Object Mother

A variant of the builder that exposes named scenarios:

```ts
export const Users = {
  newSignup: () => makeUser({ emailVerified: false, createdAt: new Date() }),
  longTime: () => makeUser({ emailVerified: true, createdAt: new Date('2020-01-01') }),
  banned: () => makeUser({ status: 'banned' }),
  admin: () => makeUser({ role: 'admin' }),
};
```

Tests read like prose:

```ts
it('blocks login for banned users', () => {
  const banned = Users.banned();
  expect(() => signIn(banned, 'pw')).toThrow(/banned/i);
});
```

Use Object Mother when there are recurring "kinds" of entities. Use Builder when each test wants an arbitrary tweak.

---

## Fakes vs Mocks vs Stubs vs Spies

| Term  | Behaviour                                                     | When                                          |
| ----- | ------------------------------------------------------------- | --------------------------------------------- |
| Stub  | Returns a fixed answer. No verification.                      | Inputs your code reads from but doesn't care about how the dependency works |
| Spy   | Records calls on a real function/object.                      | "Did we call analytics.track? With what args?" |
| Mock  | Replaces behaviour AND records calls.                         | "Don't actually charge the card; record the attempt." |
| Fake  | A working alternative implementation (in-memory DB, etc.)     | The real thing is heavy/slow/external; the fake gives realistic behaviour. |

**Rule of thumb:**

- For pure inputs (config, current time, random seed): **stub**.
- For collaborators whose call patterns matter (`logger.error`, `metrics.increment`): **spy** or **mock**.
- For external services with complex behaviour (Postgres, Stripe): **fake** if it exists, else **mock + integration test**.

**The over-mocking trap:**

```ts
// 🚩 Smell: every dependency mocked
vi.mock('./db');
vi.mock('./stripe');
vi.mock('./email');
vi.mock('./logger');
vi.mock('./auth');
vi.mock('./featureFlags');
vi.mock('./metrics');

it('creates an order', async () => {
  // This test passes when nothing is wired up correctly.
});
```

When you mock everything, the test verifies nothing real. Pull back: replace `./logger`, `./metrics`, `./featureFlags` with simple no-op fakes. Mock only the IO boundary.

---

## Fixtures

Use real example payloads instead of synthesised ones for parsers, deserializers, file processors:

```
test/
└── fixtures/
    ├── stripe-payment-succeeded.json
    ├── stripe-payment-failed.json
    ├── github-webhook-push.json
    ├── csv-with-bom.csv
    └── photo-with-exif.jpg
```

```ts
import paymentSucceeded from './fixtures/stripe-payment-succeeded.json';

it('processes a payment.succeeded event', () => {
  const result = handleStripeEvent(paymentSucceeded);
  expect(result.charged).toBe(true);
});
```

Real payloads catch real bugs that hand-written fixtures miss (extra fields, unexpected nulls, snake_case vs camelCase quirks).

**Lifecycle:** treat fixtures like code. Refactor them, version them, document where they came from in a comment. Stale fixtures are landmines.

---

## Snapshot Testing

Useful **only** when the output is deterministic, structured, and the diff is meaningful for a reviewer.

**Good uses:**
- Generated SQL from an ORM query for a fixed input.
- Compiled output of a parser/AST.
- ICS file for a known event.
- Static HTML email from a known template.

**Bad uses:**
- Whole-component DOM trees. Trivial CSS class changes blow up snapshots; nobody actually reviews the diff.
- Long object trees that include random IDs / timestamps without normalization.

**The 5-second rule**: if a teammate updating the snapshot has to think for less than 5 seconds about whether the change is correct, the snapshot isn't earning its keep. Replace with explicit assertions on the parts you care about:

```ts
// 🚩 Smell
expect(component).toMatchSnapshot();

// ✅ Better
expect(screen.getByRole('heading')).toHaveTextContent('Welcome, Alice');
expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
```

When using snapshots, normalize variable parts:

```ts
expect(result).toMatchSnapshot({
  id: expect.any(String),
  createdAt: expect.any(Date),
  signature: expect.stringMatching(/^[a-f0-9]{64}$/),
});
```

---

## Contract Tests

When two components/services share a schema (e.g., a Server Action is called by a Client Component, or your app calls Stripe), it's worth having a **contract test** — a test that pins the shape of the interaction so neither side breaks the other silently.

```ts
// Both sides import the same Zod schema or TS type.
const CreatePostInput = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
});

// Client side asserts the form produces a valid input
it('form output matches the server contract', () => {
  const formData = collectFormFields(/* ... */);
  expect(() => CreatePostInput.parse(formData)).not.toThrow();
});

// Server side asserts it accepts the contract
it('action accepts a valid contract input', async () => {
  const valid = { title: 't', body: 'b' };
  await expect(createPost(valid)).resolves.toBeDefined();
});
```

For external APIs (Stripe, Supabase), record-and-replay tools like **Polly.js** or **VCR**-equivalents help here, but they're a bigger commitment. Start with the schema-pinning approach.

---

## Test Smells (and what they mean)

### Eager Test
The test asserts more than one behaviour, so when it fails, you don't know which.

```ts
// 🚩 Smell
it('handles users', () => {
  expect(createUser({ name: 'A' }).id).toBeDefined();
  expect(updateUser('id', { name: 'B' }).name).toBe('B');
  expect(deleteUser('id')).toBe(true);
});

// ✅ Three tests, named for behaviours
it('creates a user with a generated id', () => { ... });
it('updates the name on an existing user', () => { ... });
it('returns true when deleting an existing user', () => { ... });
```

### Mystery Guest
The test reads a fixture / shared state that's not visible from the test body, so the reader can't tell why the assertion is what it is.

```ts
// 🚩 Smell
it('returns active users', () => {
  expect(getActiveUsers()).toHaveLength(3); // why 3?
});

// ✅ Make the precondition visible
it('returns active users', () => {
  await db.users.insertMany([
    makeUser({ active: true }),
    makeUser({ active: true }),
    makeUser({ active: false }),
  ]);
  expect(await getActiveUsers()).toHaveLength(2);
});
```

### Fragile Test (over-coupling to implementation)
The test asserts internal state ("did setX get called?") instead of observable behaviour ("did the UI update?").

```ts
// 🚩 Smell — coupled to React internals
expect(setStateMock).toHaveBeenCalledWith(true);

// ✅ Behaviour
expect(screen.getByRole('dialog')).toBeVisible();
```

### Slow Test
A unit test that takes >100ms is a smell. The usual culprits are real timers, real network, or unbounded retries. Inspect first; rewrite second.

### Test Code Duplication
If three tests have the same 10 lines of setup, extract to a builder or `beforeEach`. But also consider that maybe the three tests are testing the same behaviour and could be one parameterised test.

### Conditional Test
The test contains an `if`. Almost always wrong — either the branches should be separate tests, or the condition reflects a precondition you should make explicit.

```ts
// 🚩 Smell
it('handles input', () => {
  const result = process(input);
  if (result.kind === 'success') {
    expect(result.data).toBeDefined();
  } else {
    expect(result.error).toBe('something');
  }
});

// ✅ Two tests
it('returns success.data on valid input', () => { ... });
it('returns error="something" on invalid input', () => { ... });
```

### Time-Dependent Test
Uses `new Date()` or `Date.now()` without controlling the clock. Will fail on Feb 29, on DST changes, on timezone differences in CI.

```ts
// 🚩 Smell
it('expires after 1 hour', () => {
  const session = createSession();
  expect(isExpired(session, new Date(Date.now() + 3600_000 + 1))).toBe(true);
});

// ✅ Fix the clock
beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2025-01-15T12:00:00Z')));
```

### Test Order Dependency
Tests pass when run together but fail in isolation, or vice versa. Means there's shared mutable state. Almost always: a module-scoped variable, a singleton, or a database not being reset.

Easy detector: run the suite with `vitest --shuffle` (or Jest's `--randomize`). If anything breaks, you have an order dependency.

### Comment-Driven Test
```ts
// TODO: this test is flaky, retrying solves it
it.retry(3)('does the thing', () => { ... });
```
Retries hide the bug. The flakiness is often a race condition in the code, not the test. Investigate; don't silence.

---

## How many tests is enough?

Two heuristics, in order of importance:

1. **For every "bug" the user could file, there's at least one test that would catch it.** This is the goal — and the test-writing process is the act of imagining all the bugs an unhappy user could file.

2. **Branch coverage > 80% on critical code, with the gap being explicitly examined.** Lines of code covered isn't the goal. *Cases* covered is the goal.

If your test count is mostly happy-path tests with a few edge cases, you're under-tested. If your suite is mostly happy-path tests but coverage is high, your code has too few branches and your tests are passing for the wrong reason.

---

## A tester's mantra

When reviewing a piece of code, ask in this order:

1. **What does this do?** Read the code first.
2. **What's the trust boundary?** Where does untrusted data enter?
3. **What inputs would break it?** Walk the picky-QA checklist.
4. **What's the worst-case behaviour?** Data loss, security breach, infinite loop, silent failure.
5. **What's the test that would have caught the worst case?** Write it first.

Then, and only then, write the happy-path tests.
