# TypeScript Deep Reference

Patterns that hold up in real codebases. The goal: a type system that catches bugs at compile time, generates types from sources of truth, and stays out of your way the rest of the time.

## Sections

1. [`tsconfig` strict flags that matter](#1-tsconfig-strict-flags-that-matter)
2. [Type narrowing](#2-type-narrowing)
3. [Discriminated unions](#3-discriminated-unions)
4. [Generics](#4-generics)
5. [Conditional types & mapped types](#5-conditional-types--mapped-types)
6. [`as const` and `satisfies`](#6-as-const-and-satisfies)
7. [Branded types](#7-branded-types)
8. [Runtime validation with Zod](#8-runtime-validation-with-zod)
9. [Generating types from sources of truth](#9-generating-types-from-sources-of-truth)
10. [React-specific types](#10-react-specific-types)

---

## 1. `tsconfig` strict flags that matter

Beyond `"strict": true`, these flags catch real bugs.

```jsonc
{
  "compilerOptions": {
    // The basics — turn ALL of these on
    "strict": true,                          // umbrella for several flags

    // Critical extras (not in `strict`)
    "noUncheckedIndexedAccess": true,        // arr[0] is T | undefined, not T
    "noImplicitOverride": true,              // requires `override` keyword on overrides
    "noFallthroughCasesInSwitch": true,      // case clauses must break/return
    "noPropertyAccessFromIndexSignature": true,  // forces obj['key'] for index signatures
    "exactOptionalPropertyTypes": true,      // foo?: T means missing OR T, not T | undefined

    // Hygiene
    "noUnusedLocals": true,
    "noUnusedParameters": true,              // disable per-line with _-prefix
    "forceConsistentCasingInFileNames": true,

    // Module resolution (modern)
    "module": "ESNext",
    "moduleResolution": "Bundler",           // for Vite/Next/most modern setups
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "isolatedModules": true,                 // required for fast transpilers (esbuild, swc)
    "verbatimModuleSyntax": true,            // forces explicit `import type { ... }`

    // Output
    "skipLibCheck": true                     // skip checking node_modules .d.ts (faster)
  }
}
```

### `noUncheckedIndexedAccess` — the one you're probably missing

```ts
const arr = ['a', 'b', 'c'];
const first = arr[0];        // without flag: type 'string'. Lies — could be undefined.

const map: Record<string, number> = { x: 1 };
map.y.toFixed();             // without flag: passes. At runtime: TypeError.
```

With the flag enabled, both become `T | undefined` and the compiler forces you to handle it. **Catches a real category of bug.**

### `exactOptionalPropertyTypes` — surprises but worth it

```ts
interface User { name?: string }
const u: User = { name: undefined };   // without flag: ok. With flag: error.
```

Forces you to decide: do you mean "field is missing" or "field is explicitly undefined"? They're often different in serialization.

### `verbatimModuleSyntax` — explicit type imports

```ts
// Required with verbatimModuleSyntax
import type { User } from './types';
import { fetchUser, type UserId } from './api';
```

Type-only imports get erased; value imports stay. Helps tree-shakers and prevents accidental circular value imports.

---

## 2. Type narrowing

Narrowing = the compiler refining `T | U | V` down to one variant within a code branch.

### Type guards

```ts
function isUser(v: unknown): v is User {
  return typeof v === 'object'
    && v !== null
    && 'id' in v
    && typeof (v as User).id === 'string';
}

function handle(v: unknown) {
  if (isUser(v)) {
    v.id;   // narrowed to User
  }
}
```

### Built-in narrowing

```ts
function process(x: string | number | null) {
  if (x === null) return;
  if (typeof x === 'string') return x.toUpperCase();   // narrowed to string
  return x.toFixed(2);                                  // narrowed to number
}
```

### Discriminated unions narrow on the discriminator

```ts
type Result<T, E> = { kind: 'ok', value: T } | { kind: 'err', error: E };

function unwrap<T>(r: Result<T, Error>) {
  if (r.kind === 'ok') return r.value;     // narrowed to { kind: 'ok', value: T }
  throw r.error;                            // narrowed to { kind: 'err', error: Error }
}
```

### Assertion functions

```ts
function assertDefined<T>(x: T): asserts x is NonNullable<T> {
  if (x === null || x === undefined) throw new Error('expected defined');
}

function f(maybe: string | undefined) {
  assertDefined(maybe);
  maybe.toUpperCase();    // narrowed to string
}
```

Use sparingly — assertions throw, which can complicate testing. Prefer type guards + early return.

### Avoid casting

```ts
// ❌ Lies to the compiler
const u = data as User;
u.id;   // crashes if `data.id` is missing at runtime

// ✅ Narrow safely
if (isUser(data)) data.id;

// ✅ OR validate at the boundary (Zod)
const u = UserSchema.parse(data);
u.id;
```

---

## 3. Discriminated unions

The single most useful pattern for state and API responses.

### Reachable states only

```ts
// ❌ Boolean explosion — many illegal combinations
interface State {
  loading: boolean;
  error?: Error;
  data?: User;
}
// { loading: true, data: someUser, error: someError } — reachable, illegal

// ✅ Discriminated union — illegal states unrepresentable
type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error', error: Error }
  | { kind: 'ok', data: User };

function render(s: State) {
  switch (s.kind) {
    case 'idle': return null;
    case 'loading': return <Spinner />;
    case 'error': return <Error err={s.error} />;
    case 'ok': return <Profile user={s.data} />;
  }
}
```

The compiler enforces exhaustiveness — add a new case in the type and `switch` becomes incomplete.

### Exhaustiveness checking

```ts
function assertNever(x: never): never {
  throw new Error('Unreachable: ' + JSON.stringify(x));
}

function render(s: State) {
  switch (s.kind) {
    case 'idle': return null;
    case 'loading': return <Spinner />;
    case 'error': return <Error err={s.error} />;
    case 'ok': return <Profile user={s.data} />;
    default: return assertNever(s);   // compile error if a case is missed
  }
}
```

`assertNever` makes missed cases a build failure, not a silent runtime fall-through.

### Discriminator names

`kind`, `type`, `_tag`, `status` — pick one project-wide. Some teams prefer `type` (shorter); others avoid it because of conflicts with React props/event types. `kind` is the classic choice.

---

## 4. Generics

### Constraints — almost always with `extends`

```ts
// Unconstrained — can't do anything with T
function logId<T>(x: T) { console.log(x.id); }   // error: T has no .id

// Constrained
function logId<T extends { id: string }>(x: T) { console.log(x.id); }   // ok
```

### Inference + defaults

```ts
function mapById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map(i => [i.id, i]));
}

mapById([{ id: '1', name: 'a' }]);   // T inferred as { id: string, name: string }
```

The compiler picks the most specific type that satisfies the constraint. Don't pass type args explicitly unless inference fails.

### Generic constraints with `keyof`

```ts
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const k of keys) result[k] = obj[k];
  return result;
}
pick({ a: 1, b: 2, c: 3 }, ['a', 'b']);   // typed as { a: number, b: number }
```

### Generic React components

```tsx
type SelectProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
};

function Select<T>({ items, getKey, renderItem, onSelect }: SelectProps<T>) {
  return (
    <ul>
      {items.map(item => (
        <li key={getKey(item)} onClick={() => onSelect(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

// Usage:
<Select
  items={users}
  getKey={u => u.id}
  renderItem={u => u.name}
  onSelect={u => setUser(u)}     // u inferred as User
/>
```

### Avoid over-generic

A function that's generic in 5 type parameters and 3 conditions is hard to read, hard to use, and usually means the abstraction is wrong. Most app code needs zero or one type parameter.

---

## 5. Conditional types & mapped types

Library-author territory mostly — but some patterns appear in app code.

### Mapped types

```ts
// All keys optional
type Partial<T> = { [K in keyof T]?: T[K] };

// All keys required
type Required<T> = { [K in keyof T]-?: T[K] };

// Pick a subset
type Pick<T, K extends keyof T> = { [P in K]: T[P] };

// Exclude readonly
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
```

### Conditional types

```ts
type IsString<T> = T extends string ? true : false;
type A = IsString<'hello'>;   // true
type B = IsString<42>;         // false

// Distributive — applies to each member of a union
type ToArray<T> = T extends any ? T[] : never;
type Test = ToArray<string | number>;   // string[] | number[]
```

### `infer` — extracting types

```ts
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type ElementType<T> = T extends Array<infer U> ? U : never;

type Fn = () => string;
type R = ReturnType<Fn>;       // string

type Arr = Array<{ id: string }>;
type Item = ElementType<Arr>;  // { id: string }
```

### Common utility types you should know

```ts
Partial<T>        // all optional
Required<T>       // all required
Readonly<T>       // all readonly
Pick<T, K>        // subset of keys
Omit<T, K>        // T without keys K
Record<K, V>      // { [k in K]: V }
Exclude<T, U>     // T without members assignable to U
Extract<T, U>     // T members assignable to U
NonNullable<T>    // T without null/undefined
ReturnType<F>     // return type of function
Parameters<F>     // parameters tuple of function
Awaited<T>        // unwrap one Promise level
```

---

## 6. `as const` and `satisfies`

### `as const`

```ts
const colors = ['red', 'blue', 'green'];   // string[]
const colors = ['red', 'blue', 'green'] as const;   // readonly ['red', 'blue', 'green']

const config = { mode: 'dev', port: 3000 };   // { mode: string, port: number }
const config = { mode: 'dev', port: 3000 } as const;
//             readonly { mode: 'dev', port: 3000 }
```

Use for literal-shaped data — config, enums-as-objects, action types.

### `satisfies` — validate without losing inference

```ts
// ❌ Annotation widens the type
const sizes: Record<string, number> = { sm: 8, md: 16, lg: 24 };
sizes.sm.toFixed();   // ok at compile time, but `sizes['xl']` is also `number` (it's `undefined` at runtime)

// ✅ satisfies — type stays specific
const sizes = { sm: 8, md: 16, lg: 24 } satisfies Record<string, number>;
sizes.sm.toFixed();   // ok
sizes.xl;             // compile error (no 'xl')
```

`satisfies` is "verify this matches the type, but keep the most specific inferred type." Best of both worlds.

### Combined

```ts
const routes = {
  home: '/',
  dashboard: '/dashboard',
  login: '/login',
} as const satisfies Record<string, string>;

type RouteKey = keyof typeof routes;   // 'home' | 'dashboard' | 'login'
type RouteValue = typeof routes[RouteKey];   // '/' | '/dashboard' | '/login'
```

---

## 7. Branded types

A nominal-type pattern in a structurally-typed system. Use when you want to prevent passing a raw `string` where you expect a specific kind of string.

```ts
type Brand<T, B> = T & { __brand: B };

type UserId = Brand<string, 'UserId'>;
type Email = Brand<string, 'Email'>;

function asUserId(s: string): UserId {
  // optionally validate
  return s as UserId;
}
function asEmail(s: string): Email {
  if (!s.includes('@')) throw new Error('not an email');
  return s as Email;
}

function getUser(id: UserId) { /* ... */ }

const id: UserId = asUserId('abc');
const email: Email = asEmail('a@b.com');

getUser(id);              // ok
getUser(email);           // error: Email is not assignable to UserId
getUser('raw' as string); // error: string is not assignable to UserId
```

The `__brand` field doesn't exist at runtime — it's a phantom for the compiler.

Useful for: IDs (UserId vs PostId), validated values (Email, URL, NonEmpty), units (Meters vs Pixels).

---

## 8. Runtime validation with Zod

Types are erased at runtime. Anything coming from outside (API, form, env, localStorage) is `unknown` until validated.

### Schema as source of truth

```ts
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().nonnegative().optional(),
  role: z.enum(['admin', 'user']),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;   // type derived from schema
```

One source of truth: the schema validates AND defines the type. `z.infer` extracts the static type.

### Parsing

```ts
const result = UserSchema.safeParse(data);
if (!result.success) {
  console.error(result.error.flatten());
  return;
}
const user = result.data;   // typed as User, validated at runtime

// Or throwing version:
const user = UserSchema.parse(data);   // throws ZodError on invalid
```

### Where to validate

- **API responses** at the fetch boundary.
- **Form input** before passing to mutations.
- **Server Action / Route Handler input** — never trust the client.
- **Environment variables** at app startup (`process.env` is `string | undefined`).
- **localStorage / IndexedDB reads** (data may be stale, written by old code).
- **URL search params** before using.

### Env validation

```ts
// env.ts
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  STRIPE_SECRET: z.string().startsWith('sk_'),
  NEXT_PUBLIC_API_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
});

export const env = schema.parse(process.env);
// `env.DATABASE_URL` is typed and validated.
// Boots fail fast if env is misconfigured.
```

### Form schema reuse

```ts
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const FormSchema = UserSchema.omit({ id: true, createdAt: true });
type FormData = z.infer<typeof FormSchema>;

const { register, handleSubmit } = useForm<FormData>({
  resolver: zodResolver(FormSchema),
});
```

Schema is shared between form validation, server action validation, and database write — guaranteed to stay aligned.

### Alternatives

- **Valibot**: Zod-style, smaller bundle (~80% smaller), modular.
- **ArkType**: parsing strings as types, very fast, growing ecosystem.
- **Zod 4** (when stable): targeting smaller bundle and faster parse.

For new projects, all three are reasonable. Zod has the largest ecosystem.

---

## 9. Generating types from sources of truth

### Database → types

```bash
# Supabase
npx supabase gen types typescript --project-id "$ID" --schema public > types/database.types.ts

# Prisma — types generated automatically on `prisma generate`

# Drizzle — types are inferred from your schema definition
```

```ts
import type { Database } from '@/types/database.types';
type User = Database['public']['Tables']['users']['Row'];
```

The DB schema is the source of truth. If you change a column, types update on next generate. Never hand-write DB row types.

### OpenAPI / Swagger → types

```bash
# Generate TS types from OpenAPI spec
npx openapi-typescript ./openapi.yaml -o ./types/api.ts
```

For consuming external APIs that publish an OpenAPI spec.

### GraphQL → types

```bash
# Codegen with schema introspection
npx graphql-codegen
```

`@graphql-codegen/cli` generates fully-typed query hooks. The query string itself becomes typed.

### tRPC

If you control both ends and they're TS, tRPC removes the schema duplication entirely — server types flow to client through inference. No codegen step.

---

## 10. React-specific types

### Component props

```ts
type ButtonProps = {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
} & React.ComponentPropsWithoutRef<'button'>;   // extends native button props

function Button({ variant, size, loading, children, ...rest }: ButtonProps) {
  return <button {...rest}>{children}</button>;
}
```

`React.ComponentPropsWithoutRef<'button'>` extends ALL standard button attributes. Better than enumerating them.

### Polymorphic components

The `as` prop pattern (a button that can render as `<a>`):

```ts
type AsProp<C extends React.ElementType> = { as?: C };
type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);
type PolymorphicComponentProp<C extends React.ElementType, Props = object> =
  React.PropsWithChildren<Props & AsProp<C>>
  & Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, Props>>;

function Box<C extends React.ElementType = 'div'>({ as, children, ...rest }: PolymorphicComponentProp<C>) {
  const Component = as || 'div';
  return <Component {...rest}>{children}</Component>;
}

<Box>div</Box>;
<Box as="a" href="/">link</Box>;
<Box as="button" onClick={...}>button</Box>;
```

This is hard to type cleanly — Radix's `Slot` pattern is usually a better answer.

### Event handler types

```ts
type ChangeHandler = React.ChangeEventHandler<HTMLInputElement>;
type ClickHandler = React.MouseEventHandler<HTMLButtonElement>;
type KeyHandler = React.KeyboardEventHandler<HTMLInputElement>;

const onChange: ChangeHandler = (e) => {
  e.target.value;   // typed as string
};
```

Or inline:

```ts
const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  e.target.value;
};
```

### Children types

```ts
type Props = {
  children: React.ReactNode;        // anything renderable
  // OR
  children: React.ReactElement;     // exactly one element
  // OR
  children: (state: State) => React.ReactNode;   // render prop
};
```

`React.ReactNode` is the most permissive — strings, numbers, elements, arrays, fragments, null, undefined. Use it unless you need to constrain.

### Forwarded refs (React < 19)

```ts
const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(props, ref) {
  return <input ref={ref} {...props} />;
});
```

In React 19+, `ref` is a regular prop on function components — `forwardRef` is no longer needed.
