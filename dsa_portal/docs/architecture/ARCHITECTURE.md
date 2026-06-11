# Kuber Verification — Architecture & Implementation Plan

> **Scope:** Cloud architecture, GCP services, database schema, deployment plan, and weekly implementation roadmap for the Perfios-based KYC/eSign verification backend.
>
> **Status:** Planning. Code changes begin Week 1.
> **Target region:** `asia-south1` (Mumbai)
> **Date:** 2026-04-24

---

## 1. Problem Statement

An automated borrower verification pipeline for Indian lending. Users upload PAN card image, Aadhaar card image, and bank statement PDF. Backend calls Perfios APIs for Aadhaar / PAN / GSTIN / Bank Statement / ITR / Form 26AS verification, persists results, and exposes them to the frontend.

Non-goals (v1): ML-based fraud scoring, AA (Account Aggregator) integration, eSign DSN flow.

---

## 2. High-Level Architecture

```
                         Internet
                            │
                            ▼
              ┌──────────────────────────────┐
              │  HTTPS Load Balancer          │  ← Phase 2
              │  + Cloud Armor (WAF+rate-lim) │
              └───────────────┬──────────────┘
                              │
                              ▼
             ┌────────────────────────────────┐
             │   Cloud Run: kuber-backend     │ ── Perfios APIs (outbound)
             │   (FastAPI, Python 3.11)       │
             └──┬──────┬──────┬──────┬────────┘
                │      │      │      │
    Secret Mgr ─┘      │      │      └─ Cloud Tasks ──► Cloud Run: kuber-worker
    (Perfios creds,    │      │                         (BSA polling, webhooks)
     DB pass)          │      │                                │
                       │      │                                ▼
                       │      │                         same DB + GCS
                       │      │
           VPC Connector      │
                       │      ▼
                       │    Cloud Storage
                       │    gs://kuber-kyc-<env>/
                       │
                       ▼
              Cloud SQL (Postgres 15)
              private IP only

Build: GitHub → Cloud Build → Artifact Registry → Cloud Run
Observability: Cloud Logging + Monitoring + Trace (auto-wired)
```

---

## 3. GCP Services

### Day 1 (MVP)

| # | Service | Purpose |
|---|---------|---------|
| 1 | **Cloud Run** | Host FastAPI backend. Stateless, auto-scales 0→N. |
| 2 | **Cloud SQL (Postgres 15)** | Borrowers, cases, verification results, document metadata. |
| 3 | **Cloud Storage (GCS)** | Store PAN / Aadhaar / bank statement uploads. |
| 4 | **Secret Manager** | Perfios creds, DB password, API signing key. |
| 5 | **Artifact Registry** | Store Docker images. |
| 6 | **Cloud IAM** | Scoped service accounts (backend SA, deploy SA). |
| 7 | **Cloud Logging** | JSON app logs, audit trail. |
| 8 | **Cloud Monitoring** | Uptime checks, latency, error rate, custom metrics. |

### Phase 2 (hardening, before real traffic)

| # | Service | Purpose |
|---|---------|---------|
| 9  | **Cloud Build** | CI/CD: git push → build → deploy. |
| 10 | **VPC + Serverless VPC Connector** | Private network between Cloud Run and Cloud SQL. |
| 11 | **Cloud Tasks** | Async BSA polling queue. |
| 12 | **HTTPS Load Balancer + Cloud Armor** | Custom domain + WAF + rate limiting. |
| 13 | **Terraform** (optional) | Infra-as-code for entire stack. |

### Add later (scale / compliance)

BigQuery + Datastream (analytics), Pub/Sub (event bus), Memorystore Redis (cache), Cloud KMS/CMEK (Aadhaar encryption), Cloud DLP (PII redaction in logs), Eventarc (GCS upload triggers).

---

## 4. Repository Layout (target)

```
verification/
├── ARCHITECTURE.md                 ← this file
├── PROJECT_CONTEXT.md
├── Dockerfile                      ← NEW
├── cloudbuild.yaml                 ← NEW (Phase 2)
├── .dockerignore                   ← NEW
├── .gcloudignore                   ← NEW
├── infra/                          ← NEW
│   ├── README.md
│   ├── terraform/                  ← optional, Phase 2
│   │   ├── main.tf
│   │   ├── cloud_run.tf
│   │   ├── cloud_sql.tf
│   │   ├── gcs.tf
│   │   ├── iam.tf
│   │   ├── secrets.tf
│   │   └── variables.tf
│   └── sql/
│       ├── 001_init.sql
│       └── 002_*.sql
├── backend/
│   ├── main.py                     ← modified (DB + GCS clients in lifespan)
│   ├── config.py                   ← modified (Secret Manager support)
│   ├── requirements.txt            ← modified (new deps)
│   ├── db/                         ← NEW
│   │   ├── __init__.py
│   │   ├── session.py              ← SQLAlchemy async engine + pool
│   │   └── models.py               ← ORM: Borrower, Case, Document, Verification
│   ├── storage/                    ← NEW
│   │   ├── __init__.py
│   │   └── gcs.py                  ← signed URL upload + object metadata
│   ├── models/
│   │   └── schemas.py              ← add DocumentUploadInit / Confirm
│   ├── routes/
│   │   ├── aadhaar.py              ← modified (persist + link to GCS)
│   │   ├── pan.py                  ← modified (persist + link to GCS)
│   │   ├── bank_statement.py       ← modified (signed-URL flow)
│   │   ├── documents.py            ← NEW: /documents/upload-url, /documents/{id}/confirm
│   │   ├── borrowers.py            ← NEW: create/get borrower, case lifecycle
│   │   └── health.py               ← NEW: /health, /ready
│   ├── services/
│   │   ├── perfios.py              ← modified (60s timeout, retries)
│   │   ├── idempotency.py          ← NEW: dedup on (case_id, verification_type)
│   │   └── rate_limit.py           ← NEW (Phase 2)
│   └── middleware/
│       └── auth.py                 ← NEW (Phase 2)
└── frontend/
```

---

## 5. Database Schema

Single-file migration `infra/sql/001_init.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- for gen_random_uuid()

CREATE TYPE doc_type AS ENUM (
  'aadhaar_card', 'pan_card', 'bank_statement',
  'itr', 'form_26as', 'aadhaar_photo'
);
CREATE TYPE verification_type AS ENUM (
  'aadhaar', 'pan', 'gstin', 'bank_statement', 'itr', 'form_26as'
);
CREATE TYPE case_status AS ENUM (
  'pending', 'in_progress', 'verified', 'rejected', 'review'
);

CREATE TABLE borrowers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  pan             TEXT UNIQUE,
  aadhaar_hash    TEXT UNIQUE,             -- SHA-256 of Aadhaar; never store raw
  dob             DATE,
  mobile          TEXT,
  email           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         TEXT UNIQUE NOT NULL,    -- business-level ID from caller
  borrower_id     UUID REFERENCES borrowers(id),
  status          case_status DEFAULT 'pending',
  loan_amount     BIGINT,
  loan_type       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_cases_borrower ON cases(borrower_id);

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
  doc_type        doc_type NOT NULL,
  gcs_bucket      TEXT NOT NULL,
  gcs_path        TEXT NOT NULL,
  content_type    TEXT,
  size_bytes      BIGINT,
  sha256          CHAR(64),
  uploaded_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (case_id, doc_type)
);

CREATE TABLE verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
  type            verification_type NOT NULL,
  perfios_txn_id  TEXT,
  status          TEXT,                    -- PROCESSING / COMPLETED / FAILED
  result_json     JSONB,                   -- full Perfios response
  error_code      TEXT,
  error_reason    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (case_id, type)                   -- idempotency key
);
CREATE INDEX idx_verifications_case ON verifications(case_id);
CREATE INDEX idx_verifications_txn ON verifications(perfios_txn_id);
```

**Rules:**
- Never store raw Aadhaar number. Store SHA-256 hash for dedup.
- `UNIQUE (case_id, type)` on `verifications` is the idempotency key — a second Perfios call for the same case+type reuses the stored result.
- `result_json` holds the full Perfios response (JSONB) for audit.
- `ON DELETE CASCADE` — deleting a case cleans up docs + verifications.

---

## 6. GCS Bucket Layout

**Buckets:**
- `kuber-kyc-dev`
- `kuber-kyc-prod`

**Per-bucket settings:**
- Uniform bucket-level access: **ON**
- Public access prevention: **ON**
- Versioning: **ON**
- Region: `asia-south1`
- Storage class: Standard
- Lifecycle: Coldline after 365 days, delete after 2555 days (7 years)
- Encryption: Google-managed (Day 1), CMEK via Cloud KMS later

**Object path:**
```
borrowers/{borrower_id}/{doc_type}/{doc_id}.{ext}
```

**Why `{doc_id}` and not the PAN/Aadhaar number:** keeps PII out of object paths (which show up in logs).

**Upload flow (signed-URL, recommended from Day 1):**

```
1. Client → POST /documents/upload-url
   body: { case_id, doc_type, content_type }

2. Backend:
   - validate content_type ∈ {image/jpeg, image/png, application/pdf}
   - generate doc_id (uuid)
   - build gcs_path
   - sign V4 PUT URL, TTL = 15 min
   - return { upload_url, doc_id, gcs_path, expires_at }

3. Client → PUT <upload_url> with the file bytes (direct to GCS)

4. Client → POST /documents/{doc_id}/confirm

5. Backend:
   - fetch object metadata from GCS (size, content-type, md5/crc32c)
   - validate size/content-type
   - insert row into `documents` table
   - return { doc_id, status: "stored" }
```

This keeps file bytes out of Cloud Run → no RAM pressure, no egress charges.

---

## 7. IAM — Service Accounts

### `kuber-backend-sa@<project>.iam.gserviceaccount.com` (Cloud Run runtime)

| Role | Scope |
|------|-------|
| `roles/secretmanager.secretAccessor` | 5 named secrets only |
| `roles/cloudsql.client` | project |
| `roles/storage.objectAdmin` | `kuber-kyc-<env>` bucket only |
| `roles/logging.logWriter` | project |
| `roles/monitoring.metricWriter` | project |
| `roles/iam.serviceAccountTokenCreator` | self (required to sign URLs) |

### `kuber-deploy-sa@<project>.iam.gserviceaccount.com` (CI/CD)

| Role | Scope |
|------|-------|
| `roles/run.admin` | project |
| `roles/artifactregistry.writer` | project |
| `roles/iam.serviceAccountUser` | `kuber-backend-sa` (to deploy as it) |

**Rule:** never run Cloud Run as the Compute Default SA.

---

## 8. Secrets

Stored in Secret Manager. Mounted into Cloud Run via `--set-secrets`.

| Name | Contents |
|------|----------|
| `perfios-username` | Perfios `X-Secure-ID` |
| `perfios-password` | Perfios `X-Secure-Cred` |
| `perfios-org-id` | Perfios `X-Organization-ID` |
| `db-password` | Postgres app user password |
| `api-signing-key` | JWT/HMAC signing key (Phase 2 auth) |

---

## 9. Cloud Run Deployment

### Dockerfile (target)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
ENV PYTHONUNBUFFERED=1 PORT=8080
EXPOSE 8080

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### `gcloud run deploy` (Day 1)

```
gcloud run deploy kuber-backend \
  --source . \
  --region asia-south1 \
  --min-instances 1 \
  --max-instances 20 \
  --concurrency 40 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --service-account kuber-backend-sa@<project>.iam.gserviceaccount.com \
  --add-cloudsql-instances <project>:asia-south1:kuber-db \
  --set-secrets PERFIOS_USERNAME=perfios-username:latest,PERFIOS_PASSWORD=perfios-password:latest,PERFIOS_ORG_ID=perfios-org-id:latest,DB_PASSWORD=db-password:latest \
  --set-env-vars ENV=prod,GCS_BUCKET=kuber-kyc-prod,DB_HOST=/cloudsql/<project>:asia-south1:kuber-db,DB_USER=kuber_app,DB_NAME=kuber,LOG_LEVEL=INFO
```

Phase 2: drop `--add-cloudsql-instances`, connect via VPC Connector + private IP; add `--no-allow-unauthenticated` once Load Balancer is in front; add `--vpc-connector` and `--ingress=internal-and-cloud-load-balancing`.

---

## 10. Observability

### Cloud Logging

Switch `print()` → `logging` module, emit JSON, attach `trace_id` from `X-Cloud-Trace-Context`:

```python
import logging, sys
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
)
```

### Cloud Monitoring — Day 1 alerts

1. Uptime check on `/health` fails 3× in a row → email
2. Cloud Run 5xx rate > 1% over 5 min → email
3. Cloud Run memory utilisation > 80% sustained 5 min → email

### Custom metrics (later)

- `perfios.latency` (histogram, label: `api`)
- `perfios.calls` (counter, labels: `api`, `status`)
- `document.upload.bytes` (histogram, label: `doc_type`)

---

## 11. Concurrency & Scalability

### Already safe
- FastAPI + `httpx.AsyncClient` shared via lifespan (`backend/main.py:12`)
- Stateless request handling — horizontal scaling via Cloud Run is automatic
- Aadhaar / PAN / GST routes: one instance handles 50–80 concurrent calls on 1 GB RAM

### Fixes required
| Issue | Location | Fix |
|-------|----------|-----|
| PDF read fully into RAM | `backend/routes/bank_statement.py:55` | Move to signed-URL upload — file bypasses Cloud Run |
| 900s httpx timeout | `backend/main.py:13` | Drop to 60s + retries via `tenacity` |
| No idempotency | All verify routes | `UNIQUE (case_id, type)` + check before Perfios call |
| No rate limit | All routes | `slowapi` per-IP (Phase 2) + Cloud Armor |
| No auth | All routes | API key or JWT middleware (Phase 2) |
| CORS `*` | `backend/config.py:35` | Restrict to known frontend origins in prod |

### Expected ceiling after fixes

| Config | Concurrent users |
|--------|------------------|
| 1 Cloud Run instance, `concurrency=40` | ~200 |
| `max-instances=20` | ~4,000 (real limit becomes Perfios QPS) |

---

## 12. Dependencies (`requirements.txt` additions)

```
# Day 1
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.14.0
google-cloud-storage==2.19.0
google-cloud-secret-manager==2.21.1
google-cloud-logging==3.11.3
tenacity==9.0.0
structlog==24.4.0

# Phase 2
google-cloud-tasks==2.16.4
google-cloud-monitoring==2.22.2
slowapi==0.1.9
python-jose[cryptography]==3.3.0
```

---

## 13. Implementation Roadmap

| Week | Deliverable | Services touched |
|------|-------------|------------------|
| **1** | GCS + signed-URL upload flow; `documents` table; `/documents/upload-url` and `/documents/{id}/confirm` routes | GCS, Cloud SQL |
| **2** | Postgres persistence for `borrowers`, `cases`, `verifications`; idempotency; drop 900s timeout; add tenacity retries | Cloud SQL, code hygiene |
| **3** | Dockerize; deploy to Cloud Run; Secret Manager; IAM service accounts; Artifact Registry | Cloud Run, Secrets, AR, IAM |
| **4** | JSON logs with trace IDs; Monitoring uptime check + 3 alerts; custom Perfios metrics | Logging, Monitoring |
| **5** | Cloud Build CI/CD; VPC Connector; private DB IP | Cloud Build, VPC |
| **6** | Cloud Tasks for BSA polling; replace client polling with task-based async flow | Cloud Tasks |
| **7** | HTTPS LB + Cloud Armor; lock Cloud Run to LB-only ingress; API-key middleware | Load Balancer, Cloud Armor, auth |

**After Week 7 → production-ready for real borrower traffic.**

---

## 14. Cost Estimate (monthly, ~1,000 borrowers)

| Service | USD |
|---------|-----|
| Cloud Run (1 min instance, ~1M req) | $5–15 |
| Cloud SQL (db-f1-micro, 10 GB) | ~$10 |
| GCS (100 GB + signed URL reads) | ~$3 |
| Secret Manager | <$1 |
| Artifact Registry | <$1 |
| Logging + Monitoring | Free tier |
| **Day 1 total** | **~$20–30** |
| Phase 2 (LB + Cloud Armor + VPC + Tasks) | +$20–40 |
| **Phase 2 total** | **~$40–70** |

Perfios API credits are a separate line item and are the dominant variable cost.

---

## 15. Open Decisions

| # | Decision | Options | Default recommendation |
|---|----------|---------|------------------------|
| 1 | Region | `asia-south1` (Mumbai), `asia-south2` (Delhi) | `asia-south1` |
| 2 | Authentication | API key (service-to-service), JWT (per-borrower) | API key between frontend ↔ backend |
| 3 | Aadhaar image storage | Unmasked + mask on render, or store masked only | Unmasked + mask on render (standard lender practice) |
| 4 | Infra-as-code | `gcloud` CLI, Terraform | `gcloud` Weeks 1–4, Terraform from Week 5 |
| 5 | Upload flow | Server-proxied, Signed-URL | Signed-URL from Day 1 |

All five should be resolved before Week 1 starts.

---

## 16. Out of Scope (explicitly)

- Frontend implementation
- ML-based document authenticity checks (sig verification, tamper detection)
- Account Aggregator integration
- eSign DSN flow
- Multi-region DR
- On-prem deployment

These are revisited post-v1.

---

## 17. References

- `PROJECT_CONTEXT.md` — product-level overview, Perfios product mapping
- `backend/main.py` — FastAPI entrypoint
- `backend/routes/` — per-verification route handlers
- `backend/services/perfios.py` — shared HTTP client
- Perfios Hub — `https://hub.perfios.ai` (endpoints confirmed only after sandbox registration)
