# Collection backend

This is the canonical collection-only FastAPI runtime. Configure an ignored
`.env` from `.env.example`, connect it to the authoritative PostgreSQL 18
schema, and start it locally with:

```powershell
python -m pip install --require-hashes --requirement requirements.lock
python -m uvicorn collection_app:app --host 0.0.0.0 --port 8000
```

`requirements.lock` is the install artifact used by CI and the production
image. Update dependencies in `../pyproject.toml`, refresh `../uv.lock`, then
run the following from `dsa_portal/` instead of editing the export by hand:

```bash
uv export --frozen --no-dev --no-emit-project --format requirements.txt \
  --output-file backend/requirements.lock
```

The health check is available at `http://127.0.0.1:8000/health`. Borrower
collection endpoints are under `/api/apply/` and require the
`x-navdhan-service-token` shared with the root Next.js server runtime. The
browser never calls this service directly.

Verification providers are deliberately fail-closed. The only registered mode
is `VERIFICATION_PROVIDER_MODE=disabled`; no live OTP, tax, or banking adapter
is shipped. A future integration must use a provider-hosted consent journey and
signed callbacks. NavDhan must never collect tax-portal or banking passwords.

Run `python -m unittest discover -s tests -v` against the dedicated PostgreSQL
18 test database before release. Production deployment and database release
procedures are controlled by the root `DEPLOYMENT.md`; this service never runs
schema migrations at startup.

## Retention job

Application retention is an explicit private job, never an API endpoint. It is
tenant-scoped by PostgreSQL RLS and defaults to a read-only dry run:

```bash
python -m maintenance.retention --marketplace-id <uuid>
python -m maintenance.retention --marketplace-id <uuid> --execute
```

Never-submitted drafts become eligible after 30 days without an update;
submitted records become eligible after 60 calendar months. The executing job
deletes each GCS generation before scrubbing its database metadata and PII. A
storage error fails that item before database scrubbing, so a later run can
retry. Schedule one private Cloud Run Job invocation per marketplace only after
a dry-run review, backup verification, least-privilege IAM, and staging proof.
