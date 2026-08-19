import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
        ignored: [
          ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : []),
          "**/database/.local/**",
          "**/dsa_portal/backend/.local_documents/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
