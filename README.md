# NavDhan

NavDhan's production application consists of:

- a localized Next.js 15 / React 19 frontend deployed to Cloudflare Workers;
- a collection-only FastAPI service deployed to Google Cloud Run;
- the authoritative PostgreSQL 18 schema in `database/`; and
- private PDF storage in Google Cloud Storage.

The former Perfios/Vite DSA portal and its database are retired reference
material. They are not a migration source, compatibility target, or supported
deployment path.

## Local frontend

Use Node.js 22 and install the committed lockfile exactly:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The root application is available at `http://localhost:3000`. Its server-side
apply routes proxy to the FastAPI URL configured by
`APPLY_BACKEND_BASE_URL`; `APPLY_BACKEND_SERVICE_TOKEN` must match the
backend's `APPLY_SERVICE_TOKEN` and must never use a `NEXT_PUBLIC_` name.
Agentation is mounted only in development, including on localized `/apply`
routes, and is not rendered in production.

Deployed apply routes use Cloudflare's native rate-limit bindings as a coarse
first layer and an `ApplyRateLimiter` Durable Object for exact enforcement. The
checked-in `worker/index.js` wrapper and both Wrangler configs are therefore
release-critical; see `CLOUDFLARE-DEPLOY.md` for migration and rollback rules.

Useful release checks:

```bash
npm run lint
npm run typecheck
npm test
npm run cf:build
```

## Local backend and database

The canonical backend is `dsa_portal/backend/collection_app.py`. Copy
`dsa_portal/backend/.env.example` to an ignored `.env`, configure the
PostgreSQL 18 database and cryptographic keys, then run from that directory:

```bash
python -m pip install --require-hashes -r requirements.lock
python -m uvicorn collection_app:app --host 127.0.0.1 --port 8000
```

The current upward migrations and required seed live in `database/`. Never
apply them over the incompatible legacy DSA schema. Cloud releases must use
`database/scripts/release.sh`, which accepts only an empty target or a database
already carrying its checked release ledger.

Run the database and backend suites against PostgreSQL 18 before a release:

```bash
python -m unittest discover -s database/tests -v
cd dsa_portal/backend
python -m unittest discover -s tests -v
```

## Repository map

- `app/`, `src/`, `content/`: Next.js routes, UI, localization, and content
- `database/`: authoritative PostgreSQL 18 migrations, seed, release tooling,
  and database tests
- `dsa_portal/backend/`: collection-only FastAPI service and tests
- `dsa_portal/frontend/`, `dsa_portal/infra/`: retired legacy reference only
- `.github/workflows/ci.yml`: frontend, backend, database, audit, and build gates
- `DEPLOYMENT.md`: controlled staging and production release runbook
- `CLOUDFLARE-DEPLOY.md`: Cloudflare Worker configuration and rollback

## Deployment

Do not deploy from a dirty worktree or bypass staging. The required order is
documented in `DEPLOYMENT.md`: disposable PostgreSQL 18 rehearsal, rebuilt
staging acceptance, production backup/preflight and schema bootstrap,
zero-traffic Cloud Run candidate, backend promotion, then the Cloudflare
Worker. Database down migrations are never an application rollback mechanism.

## License

Proprietary.
