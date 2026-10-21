# Unit Testing: Jest, Vitest & React Testing Library

Practical patterns for unit and component-level tests. Vitest and Jest share most of their API — examples use `vi.*`/`vitest` style; the Jest equivalent is the same with `jest.*` (or omitted, since Jest's globals don't need an import).

---

## Test File Structure

Co-locate tests with code. `Button.tsx` ↔ `Button.test.tsx`. The test file mirrors the import path of the unit; reviewers shouldn't have to hunt.

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  // describe groups related tests; nest sparingly — deep nesting hides setup
  describe('when disabled', () => {
    it('does not call onClick when clicked', async () => {
      // Arrange
      const onClick = vi.fn();
      render(<Button disabled onClick={onClick}>Save</Button>);

      // Act
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      // Assert
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});
```

Rules of thumb:

- One behaviour per `it`. Multiple `expect` calls are fine if they assert the same conceptual thing (e.g., "the form submits with these three values").
- Test names describe **behaviour**, not implementation. `'submits the form'` not `'calls handleSubmit'`.
- Avoid `beforeAll` for state — it leaks between tests. `beforeEach` is the safe default.

---

## AAA: Arrange / Act / Assert

Every test has three phases. Use blank lines (or comments early on) to separate them. Tests that mix arrange and act are confusing; tests with multiple act/assert cycles are usually two tests stuck together.

```ts
it('formats currency in USD with two decimals', () => {
  // Arrange
  const amount = 1234.5;

  // Act
  const result = formatCurrency(amount, 'USD');

  // Assert
  expect(result).toBe('$1,234.50');
});
```

If you find yourself writing **act → assert → act → assert**, split into two tests. The exception is testing a state machine progression, which is one logical behaviour.

---

## Table-Driven Tests with `it.each`

For pure functions with many input/output pairs, this beats N copy-pasted `it` blocks. **Crucially**, include edge cases — empty, boundary, unicode, negative, zero.

```ts
describe('slugify', () => {
  it.each([
    // [input, expected, label]
    ['Hello World',          'hello-world',     'basic case'],
    ['  trim spaces  ',      'trim-spaces',     'leading/trailing whitespace'],
    ['Multiple   Spaces',    'multiple-spaces', 'collapses repeated whitespace'],
    ['Café',                 'cafe',            'strips diacritics'],
    ['émoji 🎉 here',        'emoji-here',      'strips emoji'],
    ['',                     '',                'empty string'],
    ['---',                  '',                'punctuation only'],
    ['UPPERCASE',            'uppercase',       'lowercases'],
    ['under_score',          'under-score',     'underscores → hyphens'],
    ["O'Brien",              'obrien',          'apostrophes'],
  ])('slugify(%j) → %j  (%s)', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
```

The label as a third tuple element makes failures readable in the runner output.

---

## Async Testing

```ts
// ✅ For functions that return a Promise
it('fetches the user', async () => {
  await expect(fetchUser('alice')).resolves.toEqual({ id: 'alice', name: 'Alice' });
});

it('throws on 404', async () => {
  await expect(fetchUser('ghost')).rejects.toThrow('User not found');
});

// ✅ For UI that updates after an async action
it('shows the user name after loading', async () => {
  render(<UserProfile id="alice" />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  expect(await screen.findByText('Alice')).toBeInTheDocument(); // findBy retries
});
```

**Anti-pattern**: `setTimeout` to "wait for" UI. Always use `findBy*`, `waitFor`, or `waitForElementToBeRemoved`. `setTimeout` makes tests slow and flaky.

```ts
// ❌ flaky
await new Promise((r) => setTimeout(r, 100));
expect(screen.getByText('Alice')).toBeInTheDocument();

// ✅ deterministic
expect(await screen.findByText('Alice')).toBeInTheDocument();
```

`waitFor` is for assertions that don't have a built-in retry. Keep callbacks small and only assert one thing — `waitFor` will keep calling them until they pass or time out:

```ts
await waitFor(() => {
  expect(mockAnalytics).toHaveBeenCalledWith('signup_complete');
});
```

---

## Fake Timers

Use when code calls `setTimeout`, `setInterval`, `Date.now()`, or `new Date()`. Otherwise tests are slow or non-deterministic.

```ts
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

it('debounces input by 300ms', async () => {
  const onChange = vi.fn();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<Search onChange={onChange} />);

  await user.type(screen.getByRole('searchbox'), 'hello');

  expect(onChange).not.toHaveBeenCalled();    // before debounce fires
  vi.advanceTimersByTime(300);
  expect(onChange).toHaveBeenCalledWith('hello');
});
```

**Critical**: when using `userEvent` with fake timers, pass `advanceTimers` to `userEvent.setup()` — otherwise `userEvent`'s internal delays hang the test. This is the #1 fake-timer footgun.

---

## Mocking with `vi.mock` / `jest.mock`

### The hoisting rule

`vi.mock()` / `jest.mock()` are hoisted to the top of the file by the test runner — **before imports run**. This means:

```ts
// ❌ Looks logical, but the variable is undefined when the mock runs
import { db } from './db';
const fakeDb = { getUser: vi.fn() };
vi.mock('./db', () => ({ db: fakeDb })); // ReferenceError at runtime
```

```ts
// ✅ Use vi.hoisted (Vitest) or define the mock inline
const { fakeDb } = vi.hoisted(() => ({
  fakeDb: { getUser: vi.fn() },
}));
vi.mock('./db', () => ({ db: fakeDb }));

// Now you can import and configure
import { fetchUserProfile } from './fetchUserProfile';

it('fetches via the db', async () => {
  fakeDb.getUser.mockResolvedValue({ id: '1', name: 'Alice' });
  await expect(fetchUserProfile('1')).resolves.toEqual({ id: '1', name: 'Alice' });
});
```

In Jest, the equivalent is to use a factory or to put the mock value inside the factory function (Jest's `babel-jest` plugin recognises variable names prefixed with `mock`):

```ts
// Jest: variables in vi.mock factory must be prefixed `mock`
const mockGetUser = jest.fn();
jest.mock('./db', () => ({ db: { getUser: mockGetUser } }));
```

### Module mocking patterns

```ts
// Mock everything from a module
vi.mock('@/lib/analytics');

// Partial mock — keep the real exports, override one
vi.mock('@/lib/analytics', async () => {
  const actual = await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics');
  return {
    ...actual,
    track: vi.fn(),
  };
});

// Spy on a method without replacing the module
import * as analytics from '@/lib/analytics';
const trackSpy = vi.spyOn(analytics, 'track').mockImplementation(() => {});
```

### When NOT to mock

- **Don't mock the thing under test.** If you mock `formatCurrency` while testing `formatCurrency`, you've just tested the mock.
- **Don't mock pure functions.** `Math.max` or `Array.prototype.slice` don't need mocking. Use real values.
- **Avoid mocking your own modules deeply.** If you have to mock five layers down, the design has too much coupling. Extract a seam.

The decision rule: **mock at the IO boundary** (`fetch`, `supabase.auth`, `localStorage`, `Date.now`, `crypto.randomUUID`). Use real implementations for everything inside that boundary.

---

## Spies vs. Mocks vs. Stubs

| Term  | Purpose                                                         | Example                                |
| ----- | --------------------------------------------------------------- | -------------------------------------- |
| Stub  | Returns a canned answer, no inspection                          | `vi.fn().mockReturnValue(42)`          |
| Spy   | Wraps a real function, records calls, doesn't change behaviour  | `vi.spyOn(obj, 'method')`              |
| Mock  | Records calls **and** replaces behaviour                        | `vi.fn().mockImplementation(...)`      |
| Fake  | A working alternative implementation (in-memory DB, etc.)       | An object you wrote that mimics the API |

In practice you'll mostly use mocks and spies. Fakes shine when the real dependency is heavy (database, third-party SDK) and a 30-line in-memory replacement gives you fast, realistic tests.

---

## React Testing Library Essentials

### `render` and `screen`

`screen` is preferred over destructuring `render`'s return — it's stable across re-renders and reads more like the user's view.

```ts
// ❌ destructured queries are scoped to the initial render only
const { getByRole } = render(<Component />);
getByRole('button');

// ✅ screen always queries the current document
render(<Component />);
screen.getByRole('button');
```

### Wrappers for context

If your component needs a Provider, write a `renderWithProviders` helper. Don't repeat the wrapping in every test.

```ts
// test-utils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';

export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }, // critical for tests
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
    options,
  );
}
```

`retry: false` for React Query is a must — otherwise rejected fetches retry 3 times and tests time out for the wrong reason.

### `userEvent.setup()`

Always set up `userEvent` once per test, not per call. The setup binds to a specific `document` and shares state.

```ts
it('submits on enter', async () => {
  const user = userEvent.setup();
  render(<SearchBox onSubmit={onSubmit} />);

  await user.type(screen.getByRole('searchbox'), 'hello{Enter}');

  expect(onSubmit).toHaveBeenCalledWith('hello');
});
```

### Custom matchers

Add `@testing-library/jest-dom` to extend `expect` with DOM-specific matchers. Set up once in `vitest.setup.ts` / `jest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'; // or '/jest' for Jest
```

Then you can use `toBeInTheDocument()`, `toHaveAttribute()`, `toHaveClass()`, `toBeDisabled()`, `toHaveValue()`, etc. These produce far better failure messages than raw assertions.

---

## Common Pitfalls

### Leaking state between tests

```ts
// ❌ shared mutable state
const items: Item[] = [];

beforeEach(() => {
  items.push({ id: '1' }); // Test 2 sees [item1, item1] not [item1]
});
```

Re-create state in each test, or assign:

```ts
let items: Item[];
beforeEach(() => {
  items = [{ id: '1' }];
});
```

### Forgetting to `await` user events

`userEvent` v14+ returns a Promise. Forgetting to `await` means the assertion runs before React commits.

```ts
// ❌
userEvent.click(button);
expect(onClick).toHaveBeenCalled(); // sometimes passes, sometimes fails

// ✅
await user.click(button);
expect(onClick).toHaveBeenCalled();
```

### `act()` warnings

If you see `Warning: An update to X inside a test was not wrapped in act(...)`, you have an async update happening outside a tracked operation. Almost always the fix is `findBy*` or `waitFor` — not wrapping in `act()` manually.

### Snapshot abuse

Snapshots are great for **stable, hand-reviewed** outputs (a parser AST, an ICS file, formatted HTML for a known input). They're terrible as a default for component rendering — the snapshot becomes a write-only ratchet that everyone clicks "update" on.

Rule: if a teammate updating the snapshot has to think for less than 5 seconds about whether the change is correct, the snapshot isn't earning its keep. Replace it with explicit assertions.

### Over-mocking the network

Don't mock `fetch` directly with `vi.fn()` — you lose request validation, headers, status codes, and method handling. Use **MSW** (Mock Service Worker), which intercepts at the network layer and matches what your app actually does.

```ts
// msw setup, src/test/server.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const server = setupServer(
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Alice' });
  }),
);

// vitest.setup.ts
import { server } from './src/test/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` is non-negotiable — it makes the test fail if your code makes an unexpected request, which catches real regressions.

---

## Coverage

Coverage targets are a smell when treated as a goal ("we need 80%"). They're useful as a **floor with exemptions**:

- 100% on pure utility / domain logic.
- ~80% on components (the last 20% is usually error fallbacks worth E2E-ing instead).
- 0% target on generated code, types, config files.

Watch the **branch coverage** number, not just lines. Line coverage of 100% with branch coverage of 60% means half your `if`s only have one path tested.

```bash
vitest run --coverage --reporter=verbose
# or
jest --coverage
```

---

## Test Naming Cheatsheet

```ts
// ❌ implementation-coupled
it('calls setState with true when clicked')

// ✅ behaviour
it('shows the menu when the trigger is clicked')

// ❌ vague
it('handles errors')

// ✅ specific
it('shows "User not found" when the API returns 404')

// ❌ multiple behaviours in one
it('renders, fetches data, and shows the user')

// ✅ one behaviour per test
it('shows a loading state while the user fetches')
it('shows the user name once loaded')
it('shows an error if the fetch fails')
```

A good test name reads like a feature spec line. If it doesn't, the test is probably wrong.
