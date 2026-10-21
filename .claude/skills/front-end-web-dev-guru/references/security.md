# Web Security Deep Reference

The general web-security reference. For Next.js-specific security (Server Actions, middleware CSP, token cookies in App Router), see `references/nextjs.md` § 10. They cross-reference; read both when working on auth or hardening.

This file's goal: name every common attack class, explain the actual mechanism, and show the concrete defense.

## Table of Contents

1. [Same-Origin Policy & CORS](#1-same-origin-policy--cors)
2. [XSS — Cross-Site Scripting](#2-xss--cross-site-scripting)
3. [CSRF — Cross-Site Request Forgery](#3-csrf--cross-site-request-forgery)
4. [Content Security Policy (CSP)](#4-content-security-policy-csp)
5. [Token storage strategies](#5-token-storage-strategies)
6. [Cookies — proper attributes](#6-cookies--proper-attributes)
7. [Security headers](#7-security-headers)
8. [Subresource Integrity (SRI)](#8-subresource-integrity-sri)
9. [Clickjacking](#9-clickjacking)
10. [Open redirects](#10-open-redirects)
11. [SSRF (where front-end touches it)](#11-ssrf-where-front-end-touches-it)
12. [Prototype pollution](#12-prototype-pollution)
13. [Dependency / supply-chain security](#13-dependency--supply-chain-security)
14. [OAuth & SSO pitfalls](#14-oauth--sso-pitfalls)
15. [File uploads](#15-file-uploads)
16. [Session management](#16-session-management)
17. [Auth-flow specific issues](#17-auth-flow-specific-issues)
18. [Pre-deploy security checklist](#18-pre-deploy-security-checklist)

---

## 1. Same-Origin Policy & CORS

### 1.1 The mental model that fixes 90% of CORS bugs

**The Same-Origin Policy (SOP) is the default.** A page on `https://app.example.com` cannot read responses from `https://api.example.com` by default — different origins.

**CORS is not security.** CORS is a mechanism for a server to *opt-in* to relaxing SOP, by sending response headers that tell the browser "this other origin is allowed to read me."

When someone says "CORS is blocking my fetch":
- The fetch reached the server (the request happened).
- The server's response is in the browser.
- The browser is refusing to expose it to the JS code because the server didn't allow this origin.

**Fix: change the server.** No client-side workaround exists (and shouldn't — the same-origin policy is what protects every user's bank tab from your random tab).

### 1.2 Origin = scheme + host + port

```
https://example.com         ≠   http://example.com           (scheme differs)
https://example.com         ≠   https://www.example.com      (host differs)
https://example.com         ≠   https://example.com:8080     (port differs)
https://example.com/a/b     =   https://example.com/c/d      (path doesn't matter)
```

### 1.3 Simple vs. preflighted requests

A request is **simple** (no preflight) iff:
- Method is `GET`, `HEAD`, or `POST`, AND
- The only headers set are CORS-safelisted (`Accept`, `Accept-Language`, `Content-Language`, `Content-Type` with limited values), AND
- `Content-Type` if present is `application/x-www-form-urlencoded`, `multipart/form-data`, or `text/plain`.

Anything else triggers a **preflight** `OPTIONS` request first. The browser asks "may I do X?" and the server says yes/no via headers.

```
Browser → OPTIONS /endpoint
          Origin: https://app.example.com
          Access-Control-Request-Method: PUT
          Access-Control-Request-Headers: content-type, authorization

Server  → 204 No Content
          Access-Control-Allow-Origin: https://app.example.com
          Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
          Access-Control-Allow-Headers: content-type, authorization
          Access-Control-Max-Age: 86400
          Vary: Origin
```

### 1.4 The credentials variant

When the request has `credentials: 'include'` (cookies, basic auth, client certs):
- Server MUST respond with `Access-Control-Allow-Credentials: true`.
- Server MUST respond with a **specific** `Access-Control-Allow-Origin` (NEVER `*`).
- Server MUST NOT use `*` for `Allow-Headers` or `Allow-Methods` either — must be specific.

```ts
// Correct credentialed CORS response
const origin = req.headers.get('origin');
const ALLOWED = new Set(['https://app.example.com']);
const allowOrigin = origin && ALLOWED.has(origin) ? origin : '';
return new Response(JSON.stringify(data), {
  headers: {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',                                // CRITICAL for caches
    'Content-Type': 'application/json',
  },
});
```

### 1.5 The `Vary: Origin` trap

If a CDN/proxy caches a response for origin A, then a request comes in for origin B, it'll serve the wrong CORS response. **Always `Vary: Origin` when the response varies by origin.** This trips up everyone at least once.

### 1.6 Common CORS mistakes

| Mistake | Symptom | Fix |
|---|---|---|
| `Access-Control-Allow-Origin: *` with credentials | Browser blocks despite "permissive" header | Echo specific origin from a whitelist |
| Missing `OPTIONS` handler | Preflight 404s | Implement explicit `OPTIONS` route |
| Forgetting `Vary: Origin` | Random CORS failures from CDN cache | Add `Vary: Origin` |
| `Allow-Headers` doesn't include the header you're sending | Preflight 200 but actual request blocked | List every non-safelisted header in `Allow-Headers` |
| Allowing all origins reflectively (`Allow-Origin: <whatever-was-sent>`) | Effectively no security | Whitelist explicit origins |

### 1.7 Proxying instead of CORS

If you can't change the upstream API (third-party, no control), proxy through your own backend. In Next.js, a Route Handler is perfect:

```ts
// app/api/proxy/route.ts
export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get('url')!;
  // VALIDATE the URL is in your allowlist! Otherwise you've built an open proxy / SSRF.
  const ALLOWED_HOSTS = new Set(['api.partner.com']);
  if (!ALLOWED_HOSTS.has(new URL(url).host)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const res = await fetch(url);
  return new Response(res.body, { headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' } });
}
```

---

## 2. XSS — Cross-Site Scripting

The attacker injects script that runs in another user's session. **The single most important class of web vulnerability.**

### 2.1 The three flavors

**Stored XSS** (most dangerous): payload is saved in your database (e.g., user's profile bio with `<script>...</script>`) and rendered for everyone who views it.

**Reflected XSS**: payload is in the URL/query/form, server echoes it back unsanitized. Attacker sends victims a crafted link.

**DOM-based XSS**: the server sends benign HTML; client-side JS reads attacker-controlled data (URL hash, postMessage, document.referrer) and injects it into the DOM.

### 2.2 React's default protection — and where it fails

React escapes `{userInput}` automatically. This blocks 99% of XSS. The escape hatches are:

```tsx
// 1. dangerouslySetInnerHTML — explicitly opts out
<div dangerouslySetInnerHTML={{ __html: userBio }} />        // BUG WAITING TO HAPPEN

// 2. href/src attributes accept javascript: URLs
<a href={userProvidedUrl}>...</a>                            // attacker passes "javascript:alert(1)"

// 3. Direct DOM manipulation via refs
ref.current.innerHTML = userInput;                           // bypasses React entirely

// 4. Server-rendered HTML strings (e.g., MDX, Markdown to HTML)
// If you don't sanitize the HTML representation before rendering, XSS.
```

### 2.3 Defenses

**For HTML content** (rich text, markdown rendered to HTML): sanitize with **DOMPurify**.

```tsx
import DOMPurify from 'isomorphic-dompurify';

const clean = DOMPurify.sanitize(userBio, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'li'],
  ALLOWED_ATTR: ['href'],
  ALLOWED_URI_REGEXP: /^(https?:\/\/|mailto:|\/)/i,
});
return <div dangerouslySetInnerHTML={{ __html: clean }} />;
```

**For URL attributes**: validate the URL before rendering.

```ts
function safeHref(s: string): string {
  try {
    const u = new URL(s, 'https://example.com');   // base for relative URLs
    if (u.protocol !== 'https:' && u.protocol !== 'http:' && u.protocol !== 'mailto:') {
      return '#';
    }
    return u.toString();
  } catch {
    return '#';
  }
}
```

**For the whole app**: a strict Content Security Policy (see § 4) acts as a last line of defense. Even if XSS slips through, CSP can prevent the payload from running.

### 2.4 Trusted Types (modern defense)

Trusted Types is a CSP-driven mechanism that makes DOM XSS sinks (`innerHTML`, `outerHTML`, `document.write`) refuse to accept plain strings — only typed values produced by a trusted policy.

```
Content-Security-Policy: require-trusted-types-for 'script'; trusted-types default
```

Combined with frameworks that produce Trusted Types output, DOM XSS becomes nearly impossible. Support is good in Chromium, behind a flag in Firefox — still worth shipping in CSP report-only mode to find issues.

### 2.5 Markdown / MDX security

- `react-markdown` is safe by default — escapes raw HTML unless you opt in.
- `remark-html` / `rehype-raw` can re-introduce raw HTML — sanitize after with `rehype-sanitize`.
- MDX runs JS, so user-authored MDX is **not safe** to render. Treat MDX as code, not content.

### 2.6 URL fragments and `postMessage`

```ts
// ❌ DOM-based XSS
const tab = location.hash.slice(1);   // user-controlled
document.getElementById('tab').innerHTML = `Tab: ${tab}`;

// ❌ Trusting postMessage senders
window.addEventListener('message', e => {
  document.body.innerHTML += e.data;
});

// ✅ Always validate origin and content
window.addEventListener('message', e => {
  if (e.origin !== 'https://trusted.com') return;
  if (typeof e.data !== 'object' || e.data?.type !== 'expected') return;
  // ...
});
```

---

## 3. CSRF — Cross-Site Request Forgery

The attacker tricks the user's authenticated browser into making a state-changing request. The classic example: `<img src="https://bank.com/transfer?to=attacker&amount=10000">` on a malicious page; if the user is logged into bank.com, the browser auto-attaches their session cookie.

### 3.1 What's vulnerable

CSRF only works against **ambient authentication** — credentials the browser auto-attaches without JS code touching them:

| Auth method | CSRF-vulnerable by default? |
|---|---|
| Cookies (session, JWT in cookie) | YES — auto-attached |
| HTTP Basic Auth | YES — auto-attached |
| Client certificates | YES — auto-attached |
| Bearer tokens in `Authorization` header | NO — not auto-attached |

If your API is bearer-token-only and the client reads the token from memory, CSRF is largely irrelevant. The cost: tokens in memory die on page reload (need a refresh flow).

### 3.2 Modern defenses (cookie auth)

**`SameSite=Lax` cookies (browser default).** Cookies aren't sent on cross-site `POST`/`PUT`/`DELETE` or on subresource loads. Top-level `GET` navigations still send them — fine for `GET` (which shouldn't mutate anyway).

**`SameSite=Strict` for sensitive cookies.** No cross-site sending at all. Downside: clicking a link to your site from elsewhere acts as logged-out.

**`SameSite=None; Secure`** when you genuinely need cross-site (e.g., embedded widget). Required for cross-site cookies in modern browsers.

### 3.3 Defense in depth (don't rely on SameSite alone)

Older browsers, edge cases (browser extensions, certain WebView contexts), and `SameSite=None` use cases need additional defense:

**Origin / Referer check** on every state-changing request:
```ts
const origin = req.headers.get('origin') ?? req.headers.get('referer');
const allowed = ['https://example.com'];
if (!origin || !allowed.some(a => origin.startsWith(a))) {
  return new Response('Forbidden', { status: 403 });
}
```

**CSRF tokens** (synchronizer pattern):
1. On render, generate a random token, store in session, include in form as hidden input.
2. On submit, server compares form token to session token. Mismatch → reject.
3. Tokens are per-session or per-request. Don't reuse across users.

Next.js Server Actions invoked via `<form action={...}>` get an Origin/host check automatically. Route Handlers don't — implement yourself.

### 3.4 SameSite gotchas

- `SameSite=Lax` is the default in modern browsers, but **not all**. Always set explicitly.
- `SameSite=None` requires `Secure` (HTTPS) — the cookie is rejected otherwise.
- `SameSite` doesn't apply to subdomains as you might expect — `app.example.com` and `api.example.com` are *same-site* (for cookie purposes), even though they're different *origins*.

---

## 4. Content Security Policy (CSP)

CSP is a defense-in-depth mechanism: even if XSS slips through, it constrains what malicious code can do.

### 4.1 The directives that matter

```
default-src 'self';                                      # fallback for any *-src not listed
script-src 'self' 'nonce-{random}' 'strict-dynamic';     # only same-origin + nonce-tagged scripts
style-src 'self' 'unsafe-inline';                        # 'unsafe-inline' often unavoidable for CSS
img-src 'self' data: https:;                             # data: URIs and any HTTPS image
font-src 'self' data:;                                   # web fonts
connect-src 'self' https://api.example.com;              # XHR / fetch / WebSocket targets
frame-src 'none';                                        # iframes embedded in this page
frame-ancestors 'none';                                  # who may iframe THIS page (replaces X-Frame-Options)
form-action 'self';                                      # where forms may submit
base-uri 'self';                                         # restricts <base href> attacks
object-src 'none';                                       # block <object>/<embed>
upgrade-insecure-requests;                               # rewrite http: subresources to https:
```

### 4.2 The three CSP postures

**Loose / report-only (audit phase).** Use `Content-Security-Policy-Report-Only` first — get violations reported, don't break the app.

**Reasonable.** No `'unsafe-inline'` for scripts (use nonces/hashes), HTTPS-only image sources, restricted `connect-src`. Most production apps land here.

**Strict.** Nonce-only `script-src` with `'strict-dynamic'`, `frame-ancestors 'none'`, no `'unsafe-eval'`. Hard to retrofit, easy if you start clean.

### 4.3 Strict CSP recipe

```
Content-Security-Policy:
  default-src 'self';
  script-src 'nonce-{random}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https: data:;
  font-src 'self' data:;
  connect-src 'self' https://*.your-services.com;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  object-src 'none';
  upgrade-insecure-requests;
```

**`'strict-dynamic'`** is the trick: a script loaded with the right nonce can load further scripts dynamically, so you don't have to enumerate every CDN. But pre-existing host whitelists (`'self'`, `https://cdn.com`) are *ignored* when `'strict-dynamic'` is present — only nonces/hashes count for `script-src`.

For the Next.js nonce pattern, see `references/nextjs.md` § 8.5.

### 4.4 Common CSP pitfalls

- **Inline event handlers** (`onclick="..."`) need `'unsafe-inline'` or are dropped. React doesn't generate these — fine. Watch hand-written HTML.
- **`eval()` or `Function(...)`** in dependencies → need `'unsafe-eval'`, which mostly defeats CSP. Find a different lib.
- **Style nonces** are tricky — most CSS libs inject many style tags. `'unsafe-inline'` for styles is a common compromise.
- **Browser extensions** can violate your CSP visibly — distinguish "broken on user's machine" from "your CSP is too tight." Test in incognito with extensions off.
- **`report-uri` is deprecated** — use `report-to` with the `Reporting-Endpoints` header.

### 4.5 Reporting endpoint

```
Reporting-Endpoints: csp-endpoint="/api/csp-report"
Content-Security-Policy: default-src 'self'; report-to csp-endpoint
```

```ts
// app/api/csp-report/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json();
  console.warn('CSP violation', body);   // ship to your logging / Sentry
  return new NextResponse(null, { status: 204 });
}
```

---

## 5. Token storage strategies

### 5.1 The matrix

| Where | XSS exposure | CSRF exposure | Survives reload | Use for |
|---|---|---|---|---|
| `httpOnly` cookie | Not readable from JS | Auto-attached → vulnerable (mitigate w/ SameSite + token) | YES | Session, refresh token |
| Memory (React state) | Readable iff XSS reaches your code | Not auto-attached → safe | NO | Short-lived access token |
| `localStorage` | Readable by ANY script (incl. injected ads, extensions, XSS) | Not auto-attached | YES | Avoid for auth |
| `sessionStorage` | Same as `localStorage` | Same | Tab-only | Same — avoid |
| IndexedDB | Same as `localStorage` from XSS perspective | — | YES | Large structured offline data |

### 5.2 Recommended pattern for SPAs

- **Refresh token**: `httpOnly`, `Secure`, `SameSite=Lax`, narrow `Path` (e.g., `/api/auth/refresh`).
- **Access token**: short-lived (5–15 min), held in **memory** of the SPA, sent as `Authorization: Bearer ...`.
- On reload: silent refresh by calling the refresh endpoint; the cookie is auto-attached, server returns a new access token in the body.
- On logout: server clears the refresh cookie; client drops the in-memory access token.

This combines the strengths: refresh token can't be exfiltrated by XSS (httpOnly), access token can't be CSRF'd (not auto-attached).

### 5.3 Recommended pattern for Next.js SSR apps

`httpOnly` session cookie, full stop. The SSR layer reads the cookie, verifies the session, renders the page. No tokens in the browser at all.

### 5.4 Why `localStorage` for auth is bad

Any script on your page can read it. That includes:
- An XSS payload (one bug = full account takeover).
- A compromised dependency (supply-chain attack).
- A malicious browser extension (much more common than you think).
- An ad script you embedded.

People keep recommending it because "but CSRF!" — and they're right that cookies have CSRF risk, but `SameSite=Lax` + Origin checks neutralize CSRF, while nothing neutralizes XSS reading `localStorage`.

### 5.5 JWT specifics

- **Don't use JWT for sessions if you don't need stateless verification.** Opaque session IDs + a server-side store are simpler and easier to revoke.
- If you do use JWT: short expiry (15 min), refresh-token flow for renewal, always verify `alg` matches expected value (algorithm confusion attacks), include audience (`aud`) and issuer (`iss`) checks.
- **Never use `none` algorithm.** Reject any token with `alg: none`.
- **Don't store sensitive data in the JWT body** — it's base64, not encrypted.
- Verify JWTs server-side on EVERY request — the client can't be trusted to enforce expiry.

---

## 6. Cookies — proper attributes

```
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800
```

- **`HttpOnly`** — JS can't read it. Required for any auth-bearing cookie.
- **`Secure`** — only sent over HTTPS. Required in production. Required for `SameSite=None`.
- **`SameSite`** — `Lax` is the sane default; `Strict` for hardened auth cookies; `None` only when cross-site is genuinely needed (and then `Secure` is mandatory).
- **`Path`** — narrow it for sensitive cookies (refresh token at `/api/auth/refresh`).
- **`Max-Age` or `Expires`** — set explicitly. Session cookies (no expiry) die on browser close, which is sometimes what you want and sometimes not.
- **`Domain`** — leave it out unless you genuinely need to share across subdomains. Setting it broadens scope.
- **`__Host-` prefix** — `__Host-session=...; Secure; Path=/; HttpOnly` enforces `Secure`, no `Domain`, `Path=/`. Best-practice prefix for sensitive cookies.

---

## 7. Security headers

The full set you should be sending:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: ... (see § 4)
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp        (if you need SharedArrayBuffer)
X-Frame-Options: DENY                              (legacy; modern is frame-ancestors in CSP)
```

### 7.1 What each one does

- **HSTS** — after the first visit, browser refuses HTTP for `max-age` seconds. `preload` opts into a hardcoded browser list. Set carefully; once preloaded, removal takes weeks.
- **`X-Content-Type-Options: nosniff`** — browsers won't try to "guess" content types. Prevents an uploaded `.txt` from being executed as `.html`.
- **`Referrer-Policy`** — controls what the `Referer` header leaks to other sites. `strict-origin-when-cross-origin` is a sane default.
- **`Permissions-Policy`** — opt out of features your site doesn't use. Prevents iframes/extensions from claiming them.
- **COOP** (`same-origin`) — isolates your window from cross-origin pages it opens. Mitigates XS-Leaks and Spectre-class attacks.
- **CORP** (`same-origin`) — your resources can't be embedded by other origins.
- **COEP** (`require-corp`) — required for `SharedArrayBuffer`. Adds friction (every cross-origin resource must opt-in) but enables high-resolution timers safely.

### 7.2 HSTS preload — careful

To opt into the browser preload list (`hstspreload.org`), you need:
- Valid HTTPS cert.
- All subdomains on HTTPS.
- `max-age` ≥ 1 year, `includeSubDomains`, `preload` directive.

Once preloaded, you cannot easily revert — removal takes weeks/months. **Verify everything works on HTTPS first**, then preload.

---

## 8. Subresource Integrity (SRI)

When loading third-party scripts/styles, include an integrity hash so the browser refuses modified versions.

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous"
></script>
```

- Generate with `cat lib.js | openssl dgst -sha384 -binary | openssl base64 -A`.
- `crossorigin` is required.
- If the file changes upstream, SRI breaks — use **versioned, immutable URLs** for SRI to be useful.
- Better still: self-host the file. SRI is a workaround for "I have to load from a CDN."

---

## 9. Clickjacking

Attacker iframes your site, overlays UI, tricks user into clicking something they didn't intend.

**Defense (single line):**
```
Content-Security-Policy: frame-ancestors 'none'      # nobody can iframe me
# or
Content-Security-Policy: frame-ancestors 'self'      # only my own pages
# or
Content-Security-Policy: frame-ancestors https://partner.example.com
```

`X-Frame-Options: DENY` is the legacy equivalent — keep it for browsers that don't support `frame-ancestors`.

---

## 10. Open redirects

Attacker passes `?next=https://attacker.com/login` and your post-login redirect sends them to a phishing clone of your login page.

```ts
// ❌ DANGEROUS
const next = searchParams.get('next') ?? '/dashboard';
return Response.redirect(next);

// ✅ Allow only same-origin paths
function safeNext(s: string | null): string {
  if (!s) return '/dashboard';
  // allow only paths starting with `/` and not `//` (which is a protocol-relative URL)
  if (!s.startsWith('/') || s.startsWith('//')) return '/dashboard';
  // sanity check: it must parse as a same-origin URL
  try {
    const u = new URL(s, 'https://example.com');
    if (u.origin !== 'https://example.com') return '/dashboard';
    return u.pathname + u.search;
  } catch {
    return '/dashboard';
  }
}
```

Open redirects are also useful to attackers as **OAuth callback hijack** vectors and as building blocks in phishing chains. Patch even when "low impact."

---

## 11. SSRF (where front-end touches it)

Server-Side Request Forgery: server makes outbound HTTP requests on attacker-controlled URLs, which the attacker uses to scan internal networks or hit cloud metadata endpoints.

Front-end touches SSRF when you build proxy / image-resize / link-preview endpoints:

```ts
// ❌ Open SSRF
export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get('url')!;
  const r = await fetch(url);                    // attacker passes http://169.254.169.254/...
  return new Response(r.body);
}

// ✅ Whitelist + private-IP block
const ALLOWED_HOSTS = new Set(['cdn.partner.com', 'images.partner.com']);
async function safeFetch(rawUrl: string) {
  const u = new URL(rawUrl);
  if (u.protocol !== 'https:') throw new Error('https only');
  if (!ALLOWED_HOSTS.has(u.hostname)) throw new Error('host not allowed');
  // resolve and verify the resolved IP isn't private (need DNS lookup; libs like 'private-ip' help)
  return fetch(u);
}
```

Also block:
- Cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`, `fd00:ec2::254`).
- Private IP ranges (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `::1`, `fc00::/7`).
- Localhost variations.

The DNS layer matters: `attacker.com` could resolve to a private IP. Resolve, then check.

---

## 12. Prototype pollution

Attacker controls keys in an object that gets recursively merged into another, polluting `Object.prototype`. Effects: every object in the app suddenly has unexpected properties.

Vulnerable patterns:
```js
function deepMerge(target, source) {
  for (const key in source) {                          // 'in' iterates inherited props too
    if (typeof source[key] === 'object') {
      deepMerge(target[key], source[key]);             // target['__proto__'] = source['__proto__']
    } else {
      target[key] = source[key];
    }
  }
}
deepMerge({}, JSON.parse('{"__proto__": {"polluted": 1}}'));
console.log(({}).polluted);   // 1
```

Defenses:
- Use `Object.hasOwn(source, key)` or `Object.keys(source)` (skips prototype).
- Use `Object.create(null)` for "dictionary" objects (no prototype to pollute).
- Reject keys: `__proto__`, `constructor`, `prototype`.
- Use a vetted lib: `lodash.merge` patched their version; `mixme` is safe; `deepmerge` is safe by default.

---

## 13. Dependency / supply-chain security

Your front-end ships hundreds of transitive dependencies to every user. Treat the dep tree as part of your attack surface.

### 13.1 Practices

- **Commit lockfiles.** `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`. Always.
- **`npm ci` in CI**, not `npm install`. Reproducible installs.
- **Audit regularly.** `npm audit` / `pnpm audit` / Snyk / Dependabot.
- **Pin via `overrides` (npm) / `resolutions` (yarn/pnpm)** to patch transitive deps without waiting for upstream releases.
- **Reduce direct deps.** Every direct dep is a maintenance burden and an attack vector.
- **Prefer well-maintained deps with many maintainers** over abandoned single-maintainer libs.
- **Consider `pnpm`** — strict node_modules layout catches phantom dependencies.
- **Verify package signatures** (`npm install --foreground-scripts=false` to disable arbitrary install scripts; npm 10+ supports provenance).

### 13.2 Specific risk patterns

- **Typosquatting** — `expresss`, `lodahs`. Triple-check package names when adding new deps.
- **Compromised maintainer accounts** (event-stream, ua-parser-js incidents). Audit suspicious activity in your dep tree.
- **Postinstall scripts** can run arbitrary code. `npm install --ignore-scripts` for untrusted deps.
- **Browser extensions in dev** can read your `localStorage`/cookies during local testing.

### 13.3 Bundle audit

Beyond security, audit what's actually in your client bundle:

```bash
# Next.js
npm install -D @next/bundle-analyzer
ANALYZE=true npm run build

# Vite
npm install -D rollup-plugin-visualizer
# add to vite.config.ts and build
```

Look for:
- Server-side libs accidentally in client bundle (huge, security-sensitive).
- Multiple versions of the same lib (e.g., two React copies — bug city).
- Large polyfills shipped to modern browsers.
- Dev-only deps shipped (mock data, fixtures, test helpers).

---

## 14. OAuth & SSO pitfalls

OAuth flows are full of footguns. The Authorization Code flow with PKCE is the modern standard for SPAs and mobile.

### 14.1 Required steps

1. **Generate `state`** — random, stored in httpOnly cookie. Verify on callback.
2. **Generate `code_verifier`** (PKCE) — random 43-128 chars, hash → `code_challenge` sent in initial request, plain `code_verifier` sent in code exchange.
3. **Validate `state`** on callback. **CSRF protection.**
4. **Validate `code` is fresh** — single-use, short TTL.
5. **Validate `id_token` signature** (OIDC) — public key from JWKS endpoint, check `iss`, `aud`, `exp`, `nonce`.
6. **Store tokens server-side** (Next.js: cookie session). Don't ship the access token to the SPA unless strictly necessary.

### 14.2 Common mistakes

- **Using Implicit Flow** for SPAs. Deprecated. Use Authorization Code + PKCE.
- **Skipping `state` validation.** Open CSRF on the auth flow.
- **Allowing wildcards in `redirect_uri`.** OAuth provider misconfig that lets an attacker steal codes.
- **Trusting `id_token` without verifying signature.** Always verify against the provider's JWKS.
- **Mixing access tokens between user accounts** — bind tokens to a session.
- **Long-lived access tokens.** 5-15 min lifetime, refresh as needed.

### 14.3 Logout

True logout has three parts:
1. Clear the session cookie.
2. Revoke the refresh token at the auth provider (or your own store).
3. Optionally, redirect to provider's logout endpoint to kill the SSO session.

---

## 15. File uploads

User-uploaded files are an attack surface end-to-end. Every step matters.

### 15.1 Client side

- **Validate file type** by extension AND MIME — both are user-controlled, but a mismatch is an obvious red flag.
- **Validate size** before upload (don't waste user's bandwidth, don't waste server's).
- **Show progress** for files > 1 MB.

### 15.2 Server side

- **Re-validate type, size.** Client validation is UX; server is authoritative.
- **Inspect file magic bytes** — `image/png` upload should start with the PNG signature, not just have the right header.
- **Process images through a library** (sharp) — re-encoding strips potentially-malicious metadata and embedded scripts.
- **Strip EXIF** unless you genuinely need it. Location data leaks.
- **Store outside the web root** OR on dedicated origin (`uploads.example.com` not `example.com`). Avoids serving user content from the trusted origin (cookies/CSP).
- **Set `Content-Disposition: attachment`** for downloads — prevents inline rendering.
- **Use `Content-Type: application/octet-stream`** for unknown types.
- **Generate filenames** server-side. Don't trust user-supplied names — path traversal, special characters.
- **Virus scan** for sensitive applications (ClamAV).
- **Never serve user uploads from same origin as your app** — XSS via uploaded HTML.

### 15.3 Direct-to-cloud uploads (S3, Supabase Storage)

```ts
// Server: generate signed upload URL with strict policy
const url = await getSignedUploadUrl({
  contentType: 'image/jpeg',
  contentLengthRange: [0, 5 * 1024 * 1024],  // 5 MB cap
  expiresIn: 60,
});
// Client: PUT directly to S3 with that URL
```

The upload bypasses your server (cheaper, faster), but you still control type/size via the signed policy.

---

## 16. Session management

- **Regenerate session IDs after login** — prevents session fixation.
- **Tie session to fingerprint** (User-Agent + IP, with tolerance for IP changes on mobile). Detect hijacking.
- **Idle timeout** — log out after N minutes inactivity for sensitive apps.
- **Absolute timeout** — even active users get logged out after 24h / 7d / whatever.
- **Concurrent session limits** — optionally limit to N active sessions per user.
- **Session inspection UI** — let users see their active sessions and revoke them.

---

## 17. Auth-flow specific issues

### 17.1 Login

- **Generic error messages** — "Invalid email or password" not "Email not found" (account enumeration prevention).
- **Rate limit by IP AND by email** — IP rate limiting alone is bypassed by botnets; email rate limiting alone is bypassed by enumeration.
- **CAPTCHA after N failures** — hCaptcha / Turnstile for repeated attempts.
- **Notify on new device login** — email the user.

### 17.2 Signup

- **Email verification before granting full access.**
- **Strong password policy** — current NIST guidance: 8+ chars min, check against breach corpus (HIBP), no arbitrary complexity rules.
- **Rate limit signups** — block signup spam / fake account farms.

### 17.3 Password reset

- **Generate cryptographically random token** (256-bit), single-use, short TTL (15-60 min).
- **Hash the token in the database** — even if DB is exfiltrated, tokens are useless.
- **Invalidate all sessions** when password is reset.
- **Notify the user via email** when password is reset (not just on initiation).
- **Don't reveal whether the email exists** — same response for "reset email sent" whether or not the address is registered.

### 17.4 Email change

- **Confirm via the OLD email** before sending the verification link to the new email — prevents account takeover via stolen session.
- **Notify the old email** that the address was changed.
- **Cooldown period** before further sensitive changes.

### 17.5 2FA / MFA

- **TOTP** (authenticator app) is the floor — better than SMS (SIM-swap risk).
- **Backup codes** — 8-10 single-use codes, generated at 2FA enrollment, stored hashed.
- **WebAuthn / Passkeys** is the gold standard — phishing-resistant by design.

---

## 18. Pre-deploy security checklist

Run through this before every production deploy. Use it as a PR template.

**Auth & sessions**
- [ ] All sensitive cookies are `HttpOnly`, `Secure`, `SameSite=Lax` or stricter.
- [ ] Session ID regenerated on login / privilege change.
- [ ] Logout clears all auth state (cookie, refresh token, etc.).
- [ ] Password reset token is single-use, time-limited, hashed in DB.

**Input handling**
- [ ] All Server Actions / Route Handlers validate input (Zod or equivalent).
- [ ] All user-rendered HTML is sanitized (DOMPurify) before `dangerouslySetInnerHTML`.
- [ ] All user-supplied URLs are validated against an allowlist of protocols.
- [ ] All redirect targets are validated (no open redirects).

**Headers**
- [ ] HSTS with `includeSubDomains` (and `preload` if eligible).
- [ ] CSP set, ideally with nonces, no `'unsafe-eval'`, minimal `'unsafe-inline'`.
- [ ] `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`.

**CORS & CSRF**
- [ ] No `Access-Control-Allow-Origin: *` on credentialed endpoints.
- [ ] CORS responses include `Vary: Origin`.
- [ ] State-changing endpoints check Origin/Referer or use CSRF tokens.
- [ ] Server Actions invoked cross-origin are validated.

**Secrets & env**
- [ ] No `NEXT_PUBLIC_*` vars contain server-only secrets.
- [ ] `.env*` files in `.gitignore`.
- [ ] Production env vars set in Vercel/host dashboard, not committed.
- [ ] No tokens / API keys in client bundle (verify with bundle analyzer).

**Deps**
- [ ] Lockfile committed and up to date.
- [ ] `npm audit` / `pnpm audit` no high/critical issues, or documented exception.
- [ ] No abandoned/unmaintained direct deps.

**Files & uploads**
- [ ] User uploads served from a different origin or with `Content-Disposition: attachment`.
- [ ] Upload size and type validated server-side.

**Misc**
- [ ] Rate limiting on auth endpoints, OAuth callback, AI/expensive endpoints.
- [ ] Errors don't leak stack traces to users in production.
- [ ] Logging captures auth events, never logs passwords/tokens/full PANs.
- [ ] Bundle analyzer run; nothing server-only in client bundle.
