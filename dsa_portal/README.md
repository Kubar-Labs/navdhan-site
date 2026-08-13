# Kuber Verification

Borrower KYC verification platform for lending. Captures identity, business,
and financial documents from a borrower in a single web journey, runs them
against the relevant government sources via Perfios APIs, and hands a
complete verification packet to the lender.

## What's verified

- **Aadhaar** — UIDAI eKYC
- **PAN + PAN-Aadhaar Link** — Income Tax department
- **GSTIN + Filing History** — GST Network
- **Bank Statement** — collected as PDF; lender runs analysis
- **ITR (3 years)** — Income Tax e-Filing portal
- **Form 26AS** — TRACES / IT e-Filing portal

Each verification result is stored in Postgres; uploaded documents and
Perfios-generated reports are archived in Cloud Storage. Full data flow
and security details: see [`DATA_FLOW_AND_SECURITY.md`](DATA_FLOW_AND_SECURITY.md).
End-user / operations guide: see [`BORROWER_WORKFLOW.md`](BORROWER_WORKFLOW.md).

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind, TypeScript |
| Backend | FastAPI (async), Python 3.12, SQLAlchemy 2.0 + asyncpg |
| Database | Cloud SQL Postgres 15 |
| Storage | Google Cloud Storage (private bucket, uniform BLA) |
| Secrets | Google Secret Manager |
| Encryption | AES-256-GCM at the application layer |

## Repository layout

```
backend/                # FastAPI app
  config.py             # env-driven configuration
  main.py               # ASGI entrypoint
  routes/               # one file per verification type + cases
  services/             # shared DB helpers + Perfios client + persistence helpers
  db/                   # SQLAlchemy session + ORM models
  storage/              # Google Cloud Storage upload helpers
  security/             # AES-256-GCM crypto helper
  models/               # Pydantic request / response schemas
  requirements.txt
  .env.example          # template — copy to .env and fill in

frontend/               # Vite + React UI
  src/
    steps/              # one component per journey step
    components/         # shared UI building blocks
    api/                # axios client wrappers
  .env.example

infra/sql/              # ordered SQL migrations (001_init.sql, 002_grants.sql, ...)

ARCHITECTURE.md
BORROWER_WORKFLOW.md
DATA_FLOW_AND_SECURITY.md
PROJECT_CONTEXT.md
```

## Local development

### 1. Prerequisites

- Python 3.12 (via `uv` or `pyenv`)
- Node 18+
- Google Cloud SDK (`gcloud`) authenticated as a user with project access
- `cloud-sql-proxy` binary (download from Google's release page)

### 2. Authenticate to GCP (Application Default Credentials)

```bash
gcloud auth application-default login
```

This populates the well-known ADC file, which the backend's Google
client libraries use automatically. **No service account JSON keys are
required or supported for local development.**

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in the secrets in `backend/.env`. Pull values from Secret Manager:

```bash
gcloud secrets versions access latest --secret=db-app-password
gcloud secrets versions access latest --secret=encryption-key
gcloud secrets versions access latest --secret=perfios-username
gcloud secrets versions access latest --secret=perfios-password
gcloud secrets versions access latest --secret=perfios-org-id
```

### 4. Tunnel to Cloud SQL

```bash
./cloud-sql-proxy.exe kubar-protocol-main:asia-south1:kuber-db --port 5433
```

(Mac/Linux: drop the `.exe`.)

### 5. Run backend

```bash
cd backend
../.venv/Scripts/python.exe -m uvicorn collection_app:app --host 127.0.0.1 --port 8000
```

Health check: <http://localhost:8000/health>

This command starts the collection-only runtime. Legacy provider modules remain
in the source tree until their planned removal phase, but they are not imported
or registered by this application.

### 6. Run frontend

```bash
cd frontend
npm install
npm run dev
```

Vite's dev server proxies `/api/*` to the backend. Open <http://localhost:3000>.

## Database migrations

SQL files in `infra/sql/` are applied in numeric order. The `kuber_app` user
has DML only; migrations must be run as `postgres`.

For a step-by-step runbook (auth setup, gotchas, postgres pwd rotation), see
[`docs/MIGRATIONS.md`](docs/MIGRATIONS.md). Short version with `psql`:

```bash
psql -h 127.0.0.1 -p 5433 -U postgres -d kuber -f infra/sql/001_init.sql
```

For an asyncpg-based applier pattern, see the existing helpers at
`backend/_apply_migration*.py` (gitignored).

## Production deployment

Backend deploys to Cloud Run with the `kuber-backend-sa` service account
attached. All secrets are injected via `--set-secrets` from Google Secret
Manager — no `.env` file is shipped.

```bash
gcloud run deploy kuber-verification \
  --image asia-south1-docker.pkg.dev/kubar-protocol-main/kuber/verification:latest \
  --region asia-south1 \
  --service-account kuber-backend-sa@kubar-protocol-main.iam.gserviceaccount.com \
  --add-cloudsql-instances kubar-protocol-main:asia-south1:kuber-db \
  --set-env-vars APP_ENV=prod,GCS_BUCKET=kuber-kyc-prod,API_VERSION=v1,PUBLIC_BACKEND_URL=https://kuber-verification-ufzxw24k5a-el.a.run.app \
  --set-secrets DATABASE_URL=database-url:latest,\
ENCRYPTION_KEY=encryption-key:latest,\
PERFIOS_USERNAME=perfios-username:latest,\
PERFIOS_PASSWORD=perfios-password:latest,\
PERFIOS_ORG_ID=perfios-org-id:latest
```

## Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system architecture and design choices
- [`BORROWER_WORKFLOW.md`](BORROWER_WORKFLOW.md) — end-user-facing process flow
- [`DATA_FLOW_AND_SECURITY.md`](DATA_FLOW_AND_SECURITY.md) — security controls per data point
- [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — project background

## License

Proprietary.
