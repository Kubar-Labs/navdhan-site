# NavDhan collection service

This directory retains the historical `dsa_portal` name, but its only
supported runtime is the collection-only FastAPI service in `backend/`.

## Supported components

- `backend/`: production FastAPI application, models, storage adapter, and tests
- `ci/cloudbuild-backend*.yaml`: provenance-verified, build-only image pipelines
- `scripts/deploy-backend.ps1`: guarded manual backend candidate fallback

The `frontend/`, `infra/`, and old frontend deployment scripts describe the
removed Vite/Perfios architecture. They are reference-only and must not be
built, synchronized into `public/apply`, or deployed. The root Next.js
application owns the borrower UI and Cloudflare deployment.

The authoritative database is the PostgreSQL 18 project under `../database`.
It is intentionally incompatible with the legacy DSA schema; no old DSA data
migration is supported.

For setup and release instructions, use the root `README.md`,
`database/README.md`, and `DEPLOYMENT.md`.
