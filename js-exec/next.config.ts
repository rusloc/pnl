import type { NextConfig } from 'next';

// Security headers (ADR-0002 §2.6, E-82; the policy of the P&L and Mirelo apps). The app is embedded by the vosk.dev
// repo in an iframe: `frame-ancestors` lists the allowed hosts from EMBED_ALLOWED_ORIGINS (server-side env, comma-separated origins); no X-Frame-Options, which
// would block the embed. 'unsafe-inline' scripts are the day-one compromise for Next's inline hydration scripts
// (per-request nonces via proxy.ts are deferred, Q5); 'unsafe-eval' is added only for `next dev` tooling.

function allowedOrigins(): string[] {
  const raw = process.env.EMBED_ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((origin) => {
      const url = new URL(origin); // throws on a malformed entry: fail the build, never ship a broken policy
      const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
      if (url.origin !== origin || (url.protocol !== 'https:' && !local))
        throw new Error(`EMBED_ALLOWED_ORIGINS: "${origin}" must be a bare https origin like https://vosk.dev`);
      return origin;
    });
}

const dev = process.env.NODE_ENV === 'development';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  `frame-ancestors ${["'self'", ...allowedOrigins()].join(' ')}`,
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  // create-next-app 16.4.2 defaults; with cacheComponents, useSearchParams must sit under a Suspense boundary.
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
