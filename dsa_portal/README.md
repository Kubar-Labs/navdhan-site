# NavDhan collection service

This directory retains the historical `dsa_portal` name, but its only
supported runtime is the collection-only FastAPI service in `backend/`.

## Supported components

- `backend/`: production FastAPI application, models, storage adapter, and tests
- `ci/cloudbuild-backend*.yaml`: provenance-verified, build-only image pipelines
- `scanner/`: isolated PDF malware scanner and tests

The old frontend and direct deployment scripts have been removed. Do not
recreate or synchronize a Vite bundle into `public/apply`. The root Next.js
application owns the borrower UI and Cloudflare deployment.

The authoritative database is the PostgreSQL 18 project under `../database`.
It is intentionally incompatible with the legacy DSA schema; no old DSA data
migration is supported.

For setup and release instructions, use the root `README.md`,
`database/README.md`, and `DEPLOYMENT.md`.
