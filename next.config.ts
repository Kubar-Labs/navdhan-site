import type { NextConfig } from "next";

export function buildSecurityHeaders(nodeEnv = process.env.NODE_ENV) {
  const isDevelopment = nodeEnv === "development";
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    isDevelopment
      ? "connect-src 'self' http: https: ws: wss:"
      : "connect-src 'self'",
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    // Next.js and OpenNext emit small inline bootstrap/RSC scripts. Removing
    // unsafe-inline requires a request-scoped nonce implementation across the
    // Worker. unsafe-eval is limited to next dev, where webpack HMR needs it.
    isDevelopment
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
    ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    {
      key: "Permissions-Policy",
      value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ] as const;
}

export const SECURITY_HEADERS = buildSecurityHeaders();

const LOCAL_WATCH_IGNORE_GLOBS = [
  "**/database/.local/**",
  "**/dsa_portal/backend/.local_documents/**",
];

const LOCAL_WATCH_IGNORE_SOURCE = [
  String.raw`(?:^|[/\\])database[/\\]\.local(?:[/\\]|$)`,
  String.raw`(?:^|[/\\])dsa_portal[/\\]backend[/\\]\.local_documents(?:[/\\]|$)`,
].join("|");

export function extendWatchIgnored(ignored: unknown): string[] | RegExp {
  if (ignored instanceof RegExp) {
    return new RegExp(`(?:${ignored.source})|(?:${LOCAL_WATCH_IGNORE_SOURCE})`, ignored.flags);
  }

  return [
    ...(Array.isArray(ignored)
      ? ignored.filter((entry): entry is string => typeof entry === "string")
      : typeof ignored === "string"
        ? [ignored]
        : []),
    ...LOCAL_WATCH_IGNORE_GLOBS,
  ];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
  },
  images: {
    unoptimized: true,
  },
  // The project-local Postgres cluster (database/.local) and local document
  // storage (dsa_portal/backend/.local_documents) live inside the repo tree
  // and are written to continuously while the stack is running (WAL/stats
  // churn, uploaded PDFs). Without this, webpack's dev watcher treats every
  // one of those writes as a source change and fires Fast Refresh, which
  // remounts client components — including the apply wizard — and silently
  // discards any unsaved in-progress form input (found live during Phase 8
  // acceptance testing).
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: extendWatchIgnored(config.watchOptions?.ignored),
      };
    }
    return config;
  },
};

export default nextConfig;
