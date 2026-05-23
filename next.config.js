/** @type {import('next').NextConfig} */

// Security headers — defense-in-depth even with safe React rendering.
//
// CSP (Content-Security-Policy):
//   - default-src 'self'   — only same-origin resources allowed by default.
//   - script-src 'self'    — block inline + cross-origin scripts. Even if
//     attacker injects <script> via XSS, browser refuses to execute.
//   - style-src 'self' 'unsafe-inline' — Tailwind injects styles inline.
//   - img-src 'self' data: https: — allow image URLs from media sites.
//   - connect-src 'self'   — fetch only to our own backend.
//   - frame-ancestors 'none' — anti-clickjacking.
//   - base-uri 'self'      — block <base> tag tampering.
//   - object-src 'none'    — block <object>, <embed>.
//   - upgrade-insecure-requests — auto-upgrade http to https in prod.
//
// Trade-off: Next.js dev mode injects inline scripts/styles for HMR. We loosen
// CSP in development so dev experience isn't broken. Production stays strict.

const isProd = process.env.NODE_ENV === 'production';

const csp = [
  "default-src 'self'",
  isProd
    ? "script-src 'self'"
    : "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  isProd ? "upgrade-insecure-requests" : null,
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['cheerio', 'rss-parser', 'robots-parser'],
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
