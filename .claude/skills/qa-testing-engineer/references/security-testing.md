# Security Testing for Web Apps

Security tests are the most important tests in your suite. The default question for any code that crosses a trust boundary: **"What if the input is malicious?"** This file maps OWASP categories to concrete test patterns for Next.js + Supabase + Vercel apps.

If the code:
- accepts user input,
- crosses a session/auth boundary,
- writes to a database,
- renders HTML,
- redirects,
- or sets a cookie,

then you owe it security tests. Treat the absence of a security test as a vulnerability, not as an absence of evidence.

---

## OWASP Top 10 → test mapping

| OWASP                           | Where it bites in Next.js / Supabase                              | Section below      |
| ------------------------------- | ----------------------------------------------------------------- | ------------------ |
| Broken access control (A01)     | Server Actions trusting client `userId`, missing RLS              | IDOR / auth        |
| Cryptographic failures (A02)    | Weak JWT validation, secrets in `NEXT_PUBLIC_`, plain HTTP cookies | JWT / secrets      |
| Injection (A03)                 | XSS, SQL via raw RPC, header injection                            | XSS / injection    |
| Insecure design (A04)           | Open redirects, missing rate limits, password reset by email only | Open redirect      |
| Security misconfiguration (A05) | Missing security headers, permissive CORS, debug enabled          | Headers / CORS     |
| Authentication failures (A07)   | User enumeration, weak passwords, session fixation                | Auth flows         |
| Software & data integrity (A08) | Unsigned cookies, unsigned webhook payloads                       | Webhook signing    |
| SSRF (A10)                      | User-supplied URLs in image proxies / fetch                       | SSRF               |

---

## Cross-Site Scripting (XSS)

Three flavours: reflected, stored, DOM. React escapes by default — XSS in a React app usually comes from one of:

- `dangerouslySetInnerHTML`
- `<a href={userInput}>` with `javascript:` URLs
- `<iframe src={userInput}>`
- Server-rendered HTML in a Route Handler returning `Content-Type: text/html`
- Markdown/MDX rendering without sanitization
- `next/og` or other server-rendered SVG containing user input

### Test fixtures

Keep an XSS payload list in `test/fixtures/xss.ts`:

```ts
export const xssPayloads = [
  '<script>alert(1)</script>',
  '"><script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',          // case variations
  'java\tscript:alert(1)',         // tab in scheme
  'data:text/html,<script>alert(1)</script>',
  '<iframe srcdoc="<script>alert(1)</script>">',
  "</textarea><script>alert(1)</script>",
  '\u003cscript\u003ealert(1)\u003c/script\u003e', // unicode-escaped
  '<math><mtext></form><form><mglyph><svg><mtext><textarea><a title="</textarea><img src=x onerror=alert(1)>">',
];
```

### Test patterns

**Markdown / rich text renderer:**

```ts
import { xssPayloads } from '@/test/fixtures/xss';

describe('renderMarkdown', () => {
  it.each(xssPayloads)('strips XSS payload: %s', (payload) => {
    const html = renderMarkdown(payload);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror=/i);
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/<iframe/i);
  });
});
```

**Link handling:**

```ts
it.each([
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  ' javascript:alert(1)',  // leading whitespace
  'vbscript:msgbox(1)',
])('rejects dangerous URL scheme: %s', (url) => {
  expect(sanitizeUrl(url)).toBeNull(); // or returns 'about:blank'
});

it.each(['https://x.com', 'http://x.com', 'mailto:x@y.com', '/relative', '#anchor'])(
  'allows safe URL: %s',
  (url) => {
    expect(sanitizeUrl(url)).toBe(url);
  },
);
```

**`dangerouslySetInnerHTML` review:**

If you find this in code, the test must verify the sanitization library is the one running (not a hand-rolled escape):

```ts
it('uses DOMPurify on user content', () => {
  // Mock DOMPurify to verify it's called
  vi.mock('isomorphic-dompurify');
  render(<UserBio bio="<script>alert(1)</script>" />);
  expect(DOMPurify.sanitize).toHaveBeenCalled();
});
```

A hand-rolled escape is a vulnerability waiting to happen. The test should fail the design, not validate it.

---

## CSRF (Cross-Site Request Forgery)

Server Actions in Next.js have built-in same-origin checks (Origin header validation against the configured `allowedOrigins`). For Route Handlers and any state-changing endpoint accepting cookies for auth, you need explicit CSRF protection.

```ts
it('rejects POST without same-origin', async () => {
  const res = await POST(new Request('http://test/api/transfer', {
    method: 'POST',
    headers: {
      'origin': 'https://evil.com',
      'content-type': 'application/json',
      'cookie': 'session=valid',
    },
    body: JSON.stringify({ amount: 100, to: 'attacker' }),
  }));
  expect(res.status).toBe(403);
});

it('rejects POST with no origin header (older clients)', async () => {
  const res = await POST(new Request('http://test/api/transfer', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cookie': 'session=valid' },
    body: JSON.stringify({ amount: 100, to: 'attacker' }),
  }));
  expect(res.status).toBe(403);
});

it('accepts POST with same-origin', async () => {
  const res = await POST(new Request('http://test/api/transfer', {
    method: 'POST',
    headers: {
      'origin': 'http://test',
      'content-type': 'application/json',
      'cookie': 'session=valid',
    },
    body: JSON.stringify({ amount: 100, to: 'me' }),
  }));
  expect(res.status).toBe(200);
});
```

If the endpoint uses bearer tokens (not cookies), CSRF is not exploitable for that endpoint — the attacker can't get the token. Don't add CSRF tokens to bearer-auth endpoints "just in case"; do confirm the test mix matches the auth model.

---

## IDOR (Insecure Direct Object Reference)

The single most common authorization bug: an authenticated user A can access user B's resource by changing an ID in the URL or request body.

```ts
describe('GET /api/posts/[id]', () => {
  it('returns the post when the user owns it', async () => {
    const res = await GET(authedRequest(USER_A), { params: { id: USER_A_POST_ID } });
    expect(res.status).toBe(200);
  });

  it('returns 404 (not 403) for a post owned by another user', async () => {
    // 404 is preferred over 403 — 403 confirms the resource exists, leaking info
    const res = await GET(authedRequest(USER_A), { params: { id: USER_B_POST_ID } });
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await GET(new Request('http://test'), { params: { id: USER_A_POST_ID } });
    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-existent post', async () => {
    const res = await GET(authedRequest(USER_A), { params: { id: 'ghost' } });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/posts/[id]', () => {
  it('rejects updates by non-owner', async () => {
    const res = await PATCH(authedRequest(USER_A, { title: 'hacked' }), {
      params: { id: USER_B_POST_ID },
    });
    expect(res.status).toBe(404);
    // Verify nothing changed in the DB
    expect(await db.posts.findById(USER_B_POST_ID)).toMatchObject({ title: 'Bob original' });
  });
});
```

**Server Action IDOR test:**

```ts
it('rejects deletePost when caller is not the author', async () => {
  vi.mocked(auth).mockResolvedValue({ user: { id: USER_A } } as any);
  vi.mocked(db.posts.findById).mockResolvedValue({ id: 'p1', authorId: USER_B } as any);

  await expect(deletePost('p1')).rejects.toThrow(/not authorized|not found/i);
  expect(db.posts.delete).not.toHaveBeenCalled();
});
```

**The IDOR matrix to test for any resource:**

|             | Owner | Other authenticated user | Unauthenticated | Admin |
| ----------- | ----- | ------------------------ | --------------- | ----- |
| GET         | ✓     | 404 (not 403)            | 401             | ✓     |
| PATCH/PUT   | ✓     | 404                      | 401             | ✓     |
| DELETE      | ✓     | 404                      | 401             | ✓     |
| Create with `userId: someoneElse` | should ignore client `userId` and use session |

The "not 403, but 404" rule: don't leak existence to non-owners. Returning 403 reveals "the resource exists, you just can't see it" — useful info for an attacker enumerating IDs.

---

## Authentication Tests

### User enumeration

The error for "email doesn't exist" must equal the error for "wrong password":

```ts
it('signin returns generic error for unknown email', async () => {
  const res = await signIn({ email: 'doesnotexist@x.com', password: 'whatever' });
  expect(res.error).toBe('Invalid credentials');
});

it('signin returns generic error for wrong password', async () => {
  const res = await signIn({ email: 'real@user.com', password: 'wrong' });
  expect(res.error).toBe('Invalid credentials'); // SAME message
});

it('signin response time does not leak existence', async () => {
  // This test is fragile — keep it as a spot check, not gate.
  const t1 = await measure(() => signIn({ email: 'unknown@x.com', password: 'x' }));
  const t2 = await measure(() => signIn({ email: 'real@user.com', password: 'wrong' }));
  // Both should hit bcrypt, so within ~50ms is fine
  expect(Math.abs(t1 - t2)).toBeLessThan(50);
});
```

### Password reset flow

```ts
it('returns 200 even for a non-existent email (no enumeration)', async () => {
  const res = await POST(new Request('http://test/api/forgot', {
    method: 'POST',
    body: JSON.stringify({ email: 'ghost@x.com' }),
  }));
  expect(res.status).toBe(200);
  expect(sendEmail).not.toHaveBeenCalled(); // but no email sent
});

it('rate-limits password reset by email', async () => {
  for (let i = 0; i < 5; i++) {
    await POST(new Request('http://test/api/forgot', {
      method: 'POST',
      body: JSON.stringify({ email: 'real@x.com' }),
    }));
  }
  const res = await POST(new Request('http://test/api/forgot', {
    method: 'POST',
    body: JSON.stringify({ email: 'real@x.com' }),
  }));
  expect(res.status).toBe(429);
});

it('reset token expires after 1 hour', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  const token = await createResetToken('user@x.com');

  vi.setSystemTime(new Date('2025-01-15T13:01:00Z'));
  await expect(consumeResetToken(token)).rejects.toThrow(/expired/i);
});

it('reset token is single-use', async () => {
  const token = await createResetToken('user@x.com');
  await consumeResetToken(token); // first use OK
  await expect(consumeResetToken(token)).rejects.toThrow(/already used|invalid/i);
});
```

### Session fixation

After login, the session ID **must** rotate. If it doesn't, an attacker who set the victim's pre-login session ID now has the post-login session.

```ts
it('rotates the session token on login', async () => {
  const cookieJar = new CookieJar();
  cookieJar.set('session', 'pre-login-id');

  await POST(loginRequest('user@x.com', 'pw', cookieJar));

  expect(cookieJar.get('session')).not.toBe('pre-login-id');
});
```

---

## JWT Validation

JWT bugs are usually one of:
- accepting `alg: none`,
- not verifying the signature,
- not checking `exp`,
- not checking `iss` / `aud`,
- accepting an expired token after a clock skew.

```ts
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode('test-secret');

async function makeToken(claims: object, opts: { exp?: number; alg?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: opts.alg ?? 'HS256' })
    .setExpirationTime(opts.exp ?? '1h')
    .sign(secret);
}

it('rejects alg:none tokens', async () => {
  const headerB64 = btoa(JSON.stringify({ alg: 'none' })).replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify({ sub: 'attacker' })).replace(/=/g, '');
  const token = `${headerB64}.${payloadB64}.`;

  await expect(verifyAuthToken(token)).rejects.toThrow();
});

it('rejects tokens signed with the wrong key', async () => {
  const otherSecret = new TextEncoder().encode('other-secret');
  const badToken = await new SignJWT({ sub: 'u1' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(otherSecret);

  await expect(verifyAuthToken(badToken)).rejects.toThrow();
});

it('rejects expired tokens', async () => {
  const expired = await makeToken({ sub: 'u1' }, { exp: Math.floor(Date.now() / 1000) - 60 });
  await expect(verifyAuthToken(expired)).rejects.toThrow(/expired|exp/i);
});

it('rejects tokens with wrong issuer', async () => {
  const wrongIss = await new SignJWT({ sub: 'u1', iss: 'evil-idp' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
  await expect(verifyAuthToken(wrongIss)).rejects.toThrow();
});

it('rejects tokens with wrong audience', async () => {
  const wrongAud = await new SignJWT({ sub: 'u1', iss: 'good', aud: 'someone-else' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);
  await expect(verifyAuthToken(wrongAud)).rejects.toThrow();
});

it('accepts a well-formed token', async () => {
  const good = await makeToken({ sub: 'u1', iss: 'good', aud: 'my-app' });
  await expect(verifyAuthToken(good)).resolves.toMatchObject({ sub: 'u1' });
});
```

For Supabase JWTs specifically, validation is handled by the SDK against the Supabase issuer. The thing to test is that **your own code** doesn't trust an unvalidated token — e.g., never `JSON.parse(atob(token.split('.')[1]))` to read the user ID. Always use `supabase.auth.getUser()` server-side.

---

## Open Redirects

The OAuth callback `?next=` parameter is the classic vector. Also: any "back to" URL after login, any `redirect=` query parameter.

```ts
const evilUrls = [
  'https://evil.com',
  '//evil.com',
  '/\\evil.com',
  'http://evil.com@goodsite.com', // user-info trick
  'https:evil.com',
  '\nhttps://evil.com',           // CRLF injection in Location header
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
];

it.each(evilUrls)('rejects redirect to: %s', (target) => {
  expect(safeRedirect(target, 'http://test')).toBe('http://test/'); // default
});

it.each(['/dashboard', '/posts/abc', '/'])('allows safe relative redirect: %s', (target) => {
  expect(safeRedirect(target, 'http://test')).toBe(`http://test${target}`);
});

it('allows redirect to the same origin only', () => {
  expect(safeRedirect('http://test/dashboard', 'http://test')).toBe('http://test/dashboard');
  expect(safeRedirect('http://other.test/dashboard', 'http://test')).toBe('http://test/');
});
```

---

## Rate Limiting

Rate limiting is the difference between a hot take on Hacker News and an outage. Test:

```ts
it('allows N requests then 429s', async () => {
  for (let i = 0; i < 10; i++) {
    const res = await handler(makeReq('1.2.3.4'));
    expect(res.status).toBe(200);
  }
  const res = await handler(makeReq('1.2.3.4'));
  expect(res.status).toBe(429);
  expect(res.headers.get('retry-after')).toBeTruthy();
});

it('keys per-IP, not globally', async () => {
  for (let i = 0; i < 10; i++) await handler(makeReq('1.2.3.4'));
  const res = await handler(makeReq('5.6.7.8'));
  expect(res.status).toBe(200); // different IP, fresh budget
});

it('keys per-user when authenticated, not per-IP', async () => {
  // Otherwise an attacker behind the same NAT as the victim shares budget
  for (let i = 0; i < 10; i++) await handler(authedReq(USER_A, '1.2.3.4'));
  const res = await handler(authedReq(USER_B, '1.2.3.4'));
  expect(res.status).toBe(200);
});

it('resets after the window', async () => {
  vi.useFakeTimers();
  for (let i = 0; i < 10; i++) await handler(makeReq('1.2.3.4'));
  vi.advanceTimersByTime(60_000); // 1 minute window
  const res = await handler(makeReq('1.2.3.4'));
  expect(res.status).toBe(200);
});
```

---

## Security Headers

Headers should be set in middleware or the deployment config. Test:

```ts
it('sets a Content-Security-Policy on HTML responses', async () => {
  const res = await middleware(makeReq('/'));
  const csp = res.headers.get('content-security-policy');
  expect(csp).toBeTruthy();
  expect(csp).not.toMatch(/'unsafe-inline'/); // unless intentional + nonce-based
  expect(csp).toMatch(/default-src 'self'/);
  expect(csp).toMatch(/frame-ancestors 'none'/); // or 'self'
});

it('sets HSTS on production', async () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  const res = await middleware(makeReq('/'));
  expect(res.headers.get('strict-transport-security'))
    .toMatch(/max-age=\d{6,}; includeSubDomains/);
});

it('sets X-Content-Type-Options: nosniff', async () => {
  const res = await middleware(makeReq('/'));
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
});

it('sets Referrer-Policy', async () => {
  const res = await middleware(makeReq('/'));
  expect(res.headers.get('referrer-policy')).toMatch(/^(strict-origin-when-cross-origin|same-origin|no-referrer)$/);
});

it('sets Permissions-Policy denying unused features', async () => {
  const res = await middleware(makeReq('/'));
  const pp = res.headers.get('permissions-policy') ?? '';
  expect(pp).toMatch(/camera=\(\)/);
  expect(pp).toMatch(/microphone=\(\)/);
  expect(pp).toMatch(/geolocation=\(\)/);
});
```

---

## Cookie Flags

```ts
it('session cookie has Secure, HttpOnly, SameSite=Lax', async () => {
  const res = await POST(loginRequest('user@x.com', 'pw'));
  const setCookie = res.headers.get('set-cookie') ?? '';
  expect(setCookie).toMatch(/session=/);
  expect(setCookie).toMatch(/HttpOnly/i);
  expect(setCookie).toMatch(/Secure/i);
  expect(setCookie).toMatch(/SameSite=Lax/i); // or Strict
  expect(setCookie).toMatch(/Path=\//);
});

it('session cookie does not set Domain (so subdomains can\'t access it)', async () => {
  const res = await POST(loginRequest('user@x.com', 'pw'));
  const setCookie = res.headers.get('set-cookie') ?? '';
  expect(setCookie).not.toMatch(/Domain=/i);
});
```

---

## File Upload Validation

```ts
it('rejects files over 5MB', async () => {
  const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' });
  const res = await POST(uploadRequest(big));
  expect(res.status).toBe(413);
});

it('rejects mismatched mime type and content', async () => {
  // Filename ends in .png but content is HTML
  const fake = new File(['<html><script>alert(1)</script></html>'], 'innocent.png', {
    type: 'image/png',
  });
  const res = await POST(uploadRequest(fake));
  expect(res.status).toBe(400);
});

it.each([
  '../etc/passwd',
  '..\\..\\etc\\passwd',
  '/etc/passwd',
  'C:\\Windows\\System32',
  'file/with/slash',
  'file\u0000.png', // null byte
])('rejects path-traversal in filename: %s', async (filename) => {
  const f = new File([new Uint8Array(10)], filename, { type: 'image/png' });
  const res = await POST(uploadRequest(f));
  expect(res.status).toBe(400);
});

it('strips EXIF (privacy / metadata)', async () => {
  // After upload, fetched file should not contain GPS / camera info
  const original = await readFixture('photo-with-exif.jpg');
  const res = await POST(uploadRequest(new File([original], 'p.jpg', { type: 'image/jpeg' })));
  const stored = await fetchUploaded(res);
  expect(extractExif(stored)).toEqual({});
});

it('does not allow SVG (XSS via <script>)', async () => {
  const svg = new File(['<svg onload="alert(1)" xmlns="http://www.w3.org/2000/svg"/>'], 's.svg', {
    type: 'image/svg+xml',
  });
  const res = await POST(uploadRequest(svg));
  expect(res.status).toBe(400); // SVG only if you explicitly support and sanitize it
});
```

---

## SSRF (Server-Side Request Forgery)

If your backend ever calls `fetch(userSuppliedUrl)` (image proxy, link unfurling, webhooks), test it.

```ts
const ssrfTargets = [
  'http://localhost:8080/admin',
  'http://127.0.0.1/',
  'http://0.0.0.0/',
  'http://[::1]/',
  'http://169.254.169.254/latest/meta-data/', // AWS metadata
  'http://metadata.google.internal/', // GCP
  'http://169.254.170.2/', // ECS task metadata
  'file:///etc/passwd',
  'http://10.0.0.1/', // RFC1918 internal
  'http://192.168.1.1/',
  'http://my-internal-service.internal/',
];

it.each(ssrfTargets)('blocks SSRF to: %s', async (url) => {
  await expect(unfurl(url)).rejects.toThrow(/not allowed|invalid host/i);
});

it('blocks DNS-rebinding (host resolves to internal IP)', async () => {
  // Mock the DNS resolver to return 127.0.0.1 for "evil.com"
  vi.mocked(resolveDns).mockResolvedValue(['127.0.0.1']);
  await expect(unfurl('http://evil.com/')).rejects.toThrow(/not allowed/i);
});

it('blocks redirect chain that lands on internal IP', async () => {
  // Initial fetch goes to public IP, but server returns 302 → http://127.0.0.1
  // Your fetch wrapper must re-validate every hop, not just the initial URL.
  server.use(http.get('http://public.example/', () =>
    HttpResponse.redirect('http://127.0.0.1/admin', 302),
  ));
  await expect(unfurl('http://public.example/')).rejects.toThrow(/not allowed/i);
});
```

---

## Webhook Signature Validation

For Stripe / GitHub / Supabase webhooks:

```ts
it('rejects webhook with invalid signature', async () => {
  const res = await POST(new Request('http://test/api/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'totally fake' },
    body: JSON.stringify({ type: 'payment.succeeded' }),
  }));
  expect(res.status).toBe(401);
});

it('rejects webhook with missing signature header', async () => {
  const res = await POST(new Request('http://test/api/webhook', {
    method: 'POST',
    body: JSON.stringify({ type: 'payment.succeeded' }),
  }));
  expect(res.status).toBe(401);
});

it('rejects replayed webhook (timestamp too old)', async () => {
  const sig = makeStripeSig({ payload: '...', timestamp: Date.now() / 1000 - 600 }); // 10min old
  const res = await POST(stripeWebhookReq(sig));
  expect(res.status).toBe(401);
});

it('processes a valid webhook exactly once (idempotency)', async () => {
  const event = { id: 'evt_123', type: 'payment.succeeded', data: { object: {} } };
  await POST(stripeWebhookReq(signStripe(event)));
  await POST(stripeWebhookReq(signStripe(event))); // replay
  expect(processPayment).toHaveBeenCalledTimes(1); // idempotent
});
```

---

## What you can't unit-test

Some classes of vulnerability need other tools:
- **TLS configuration** → `testssl.sh`, SSL Labs.
- **Dependency vulnerabilities** → `npm audit`, Snyk, Dependabot.
- **Runtime XSS in production** → Playwright + a malicious payload library.
- **Subresource Integrity** → check the deployed HTML.
- **Real CSP enforcement** → browser, not node.

The role of unit tests is to enforce that the **logic** is correct. Then a security scan + review covers the rest. Don't try to replicate a scanner in your test suite.

---

## A useful "is this secure?" checklist for any new endpoint

When you see a new Server Action / Route Handler, walk this list and write tests for each that applies:

1. **Auth**: what's the auth model (cookie session, JWT, none)? Test with no auth, wrong auth, expired auth.
2. **Authorization**: who can call this? Test as user A, user B, admin, guest.
3. **Input validation**: every field — wrong type, missing, too long, malicious payload.
4. **Output**: do we leak more data than intended? (e.g., returning the full user object including email/hash when only `name` is needed.)
5. **Side effects**: does the wrong caller cause the wrong side effect? (Sending email to attacker, charging the wrong card.)
6. **Rate limiting**: can it be hammered to brute-force, DOS, or enumerate?
7. **CSRF / origin**: state-changing endpoint with cookie auth → test cross-origin POST.
8. **Errors**: do error messages leak existence of resources? Stack traces? Internal IDs?
9. **Caching**: is `Cache-Control: no-store` set when the response is user-specific?
10. **Logs**: do we log secrets, tokens, full request bodies on errors? (Inspect, don't test — but flag in review.)
