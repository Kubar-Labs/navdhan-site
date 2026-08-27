# NavDhan

NavDhan is a localized Next.js marketing site and borrower application gateway.
The production architecture consists of:

- the Next.js 15 / React 19 frontend on Cloudflare Workers;
- a collection-only FastAPI service behind the server-side Next.js API proxy;
- the PostgreSQL 18 schema and release tooling in `database/`; and
- quarantined PDF storage with an isolated scanner boundary in Google Cloud.

The former Vite/Perfios portal is retired. `/{locale}/apply` is the only
supported borrower UI; do not recreate `public/apply` or deploy a second
frontend.

## Local frontend

Use Node.js 22 and the committed lockfile:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The site runs at `http://localhost:3000`. Application routes proxy server-side
to `APPLY_BACKEND_BASE_URL`; `APPLY_BACKEND_SERVICE_TOKEN` must match the
backend's `APPLY_SERVICE_TOKEN`. Neither value may use a `NEXT_PUBLIC_` name.

Sensitive intake is fail-closed. `APPLY_INTAKE_MODE` must remain `paused` until
the database, gateway, scanner, and provider acceptance gates in
`DEPLOYMENT.md` pass in staging.

Run the complete frontend gate with:

```bash
npm run verify
```

This runs zero-warning ESLint, TypeScript, Vitest, the production dependency
audit, and the OpenNext Cloudflare build. `npm run build` runs the normal
Next.js build independently.

## Local backend and database

The canonical backend is `dsa_portal/backend/collection_app.py`. Copy its
`.env.example` to an ignored `.env`, configure PostgreSQL 18 and the encryption
keys, then run from `dsa_portal/backend`:

```bash
python -m pip install --require-hashes --requirement requirements.lock
python -m uvicorn collection_app:app --host 127.0.0.1 --port 8000
```

Never apply the collection migrations over the incompatible legacy database.
Cloud releases must use `database/scripts/release.sh`, which accepts only an
empty target or a database carrying this release ledger.

Static and backend checks:

```bash
python -m unittest discover -s database/tests -v
cd dsa_portal/backend
python -m unittest discover -s tests -v
```

## Repository map

- `app/`, `src/`, `content/`: routes, UI, localization, and legal content
- `database/`: PostgreSQL migrations, seeds, release tools, and tests
- `dsa_portal/backend/`: authenticated collection API
- `dsa_portal/scanner/`: isolated malware-scanner runtime
- `DEPLOYMENT.md`: staging and production release authority
- `CLOUDFLARE-DEPLOY.md`: Worker delivery, verification, and rollback

## Delivery

GitHub Actions are intentionally not required. Cloudflare Git Builds may build
the repository-connected commit, but it does not bypass the release gates.
Production remains operator-controlled: record the approved SHA and current
Worker version, pass staging, keep intake paused until acceptance, then use the
Cloudflare project connection documented in `CLOUDFLARE-DEPLOY.md`.

No generic production deploy npm script is provided. The preview command is
explicitly scoped as `npm run cf:deploy:preview` and uses
`wrangler.preview.jsonc`, which has no production routes.

## License

Proprietary.
