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

Run `python -m unittest discover -s tests -v` against the dedicated PostgreSQL
18 test database before release. Production deployment and database release
procedures are controlled by the root `DEPLOYMENT.md`; this service never runs
schema migrations at startup.
