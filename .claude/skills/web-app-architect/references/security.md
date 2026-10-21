# Security Architecture Reference

Detailed security patterns for web applications. The engine/core must enforce all security — wrappers (web, mobile) are untrusted clients.

---

## Authentication Patterns

### OAuth 2.0 + PKCE (Recommended for all apps)

Use Authorization Code Flow with PKCE for both web and mobile. Never use the Implicit flow.

**Web flow (Next.js + Supabase):**
1. Client initiates login → redirect to provider (Google, GitHub, etc.)
2. Provider redirects back with authorization code
3. Server exchanges code for tokens via `/auth/callback` route handler
4. Server sets secure HTTP-only cookies with session token
5. Subsequent requests carry cookie automatically

**Mobile flow (React Native / Flutter):**
1. Client opens system browser or in-app browser for login
2. Provider redirects to deep link with authorization code
3. App exchanges code for tokens (PKCE ensures no interception)
4. Store refresh token in platform-specific secure storage (iOS Keychain, Android Keystore)
5. Use short-lived access tokens (15 min); refresh silently

### Multi-Factor Authentication (MFA)

Enable TOTP-based MFA through your auth provider (Supabase supports this natively). For critical actions (delete account, change email, export data), require MFA re-verification even within an active session.

### Session Management

- Use HTTP-only, Secure, SameSite=Lax cookies for web sessions
- Set short session lifetimes (1 hour) with transparent refresh
- Implement session revocation: store active sessions in DB, allow users to view and revoke them
- On password change or security events, invalidate all other sessions

---

## Authorization Models

### Role-Based Access Control (RBAC)

Define roles with clear permission sets:

```
roles:
  viewer:  [read]
  editor:  [read, write]
  admin:   [read, write, delete, manage_users]
  owner:   [read, write, delete, manage_users, manage_billing, delete_org]
```

Enforce at three layers:
1. **API middleware** — check role before handler executes
2. **Engine service layer** — verify permissions within business logic
3. **Database RLS** — final safety net, enforced at the data layer

### Attribute-Based Access Control (ABAC)

When RBAC isn't granular enough, use attribute-based rules:

```
rule: allow
condition:
  - user.org_id == resource.org_id        # Same org
  - user.department IN resource.viewers   # Department access
  - resource.classification != "top_secret" OR user.clearance >= 5
```

Implement ABAC checks in the engine service layer using a policy evaluation function. Keep policies declarative and testable.

### Row-Level Security (RLS)

RLS is your last line of defense. Even if application code has a bug, RLS prevents unauthorized data access.

```sql
-- Users see only their org's data
CREATE POLICY "org_isolation" ON projects
  FOR ALL
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

-- Users can only modify their own resources
CREATE POLICY "owner_write" ON documents
  FOR UPDATE
  USING (created_by = auth.uid());

-- Admins of an org can see all org data
CREATE POLICY "admin_read" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = auth.uid()
        AND org_members.org_id = audit_logs.org_id
        AND org_members.role = 'admin'
    )
  );
```

---

## Input Validation

Validate at the API boundary using Zod schemas. Define schemas in the engine's models layer and reuse them across web and mobile.

```typescript
// engine/models/project.ts
import { z } from 'zod'

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(['private', 'team', 'public']).default('private'),
  tags: z.array(z.string().max(30)).max(10).optional(),
})

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>
```

**Validation rules:**
- Validate all inputs server-side, regardless of client-side validation
- Sanitize HTML/markdown inputs to prevent XSS (use DOMPurify or similar)
- Validate file uploads: check MIME type (from file header, not extension), enforce size limits, scan for malware if accepting arbitrary files
- Reject unexpected fields — use `.strict()` in Zod to catch extra properties

---

## Rate Limiting

### Tiered Strategy

| Endpoint type | Limit | Window | Scope |
|--------------|-------|--------|-------|
| Public (login, signup) | 10 req | 1 min | IP |
| Authenticated general | 100 req | 1 min | User |
| AI generation | 20 req | 1 min | User |
| Admin / sensitive | 30 req | 1 min | User |
| Webhooks (inbound) | 1000 req | 1 min | IP |

### Implementation

Use a layered approach:
1. **Edge level** (Cloudflare/Vercel): block abusive IPs before they hit your app
2. **Application level**: per-user limits using Redis or Upstash with sliding window counters
3. **AI-specific**: track token usage per user per billing period; enforce budget caps

Return standard rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1699900000
Retry-After: 30
```

---

## Content Security Policy (CSP)

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://*.supabase.co https://cdn.yourdomain.com;
  connect-src 'self' https://*.supabase.co https://api.anthropic.com wss://*.supabase.co;
  font-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

For Next.js, set CSP in `next.config.js` headers or in middleware. Use nonces for inline scripts where needed (Next.js supports this).

---

## CORS Configuration

```typescript
// Only allow known origins
const allowedOrigins = [
  'https://yourdomain.com',
  'https://app.yourdomain.com',
  process.env.NODE_ENV === 'development' && 'http://localhost:3000',
].filter(Boolean)

// For public APIs, allow any origin but restrict methods
// For private APIs, whitelist only your domains
```

---

## API Key Management (for External APIs)

When your app exposes APIs to third-party developers:

1. **Key generation**: Use cryptographically secure random strings (256-bit minimum). Prefix keys for easy identification: `pk_live_`, `sk_live_`, `pk_test_`, `sk_test_`
2. **Storage**: Store only the hash of the key in your database. Show the full key exactly once on creation.
3. **Scoping**: Attach permissions to each key (read-only, write, admin). Allow keys to be scoped to specific resources.
4. **Rotation**: Provide a rotation endpoint that creates a new key and gives a grace period for the old key (e.g., 24 hours).
5. **Rate limiting**: Enforce per-key rate limits. Return remaining quota in response headers.
6. **Audit**: Log every API key usage with timestamp, endpoint, and IP. Alert on unusual patterns.

---

## Audit Logging

Log all security-relevant events to an append-only audit table:

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users,
  actor_type text NOT NULL DEFAULT 'user', -- 'user', 'api_key', 'system'
  action text NOT NULL,        -- 'user.login', 'project.delete', 'role.change'
  target_type text,            -- 'project', 'user', 'org'
  target_id uuid,
  metadata jsonb DEFAULT '{}', -- Additional context (IP, user agent, old/new values)
  org_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_target ON audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX idx_audit_org ON audit_logs(org_id, created_at DESC);

-- RLS: only org admins can read audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_audit" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = auth.uid()
        AND org_members.org_id = audit_logs.org_id
        AND org_members.role IN ('admin', 'owner')
    )
  );
```

---

## Dependency & Supply Chain Security

- Pin exact dependency versions in `package-lock.json` / `yarn.lock`
- Run `npm audit` in CI and block deployments on critical vulnerabilities
- Use tools like Socket.dev or Snyk for deeper supply chain analysis
- Limit the number of direct dependencies — each one is an attack surface
- Review new dependencies before adding: check maintainers, download trends, last publish date