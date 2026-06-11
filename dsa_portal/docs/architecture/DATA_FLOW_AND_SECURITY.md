# Kuber Verification — Data Flow & Security

**System:** Borrower KYC verification platform
**Document version:** 1.0
**Last updated:** 25 Apr 2026

---

## 1. Executive Summary

The platform collects identity, business, and financial documents from a
borrower during a single verification journey. Each document is verified
against the relevant government source via Perfios APIs, the result is
stored in our database, and the original artefact (where applicable) is
archived in our Cloud Storage bucket for the lender's downstream use.

The journey is gated by an explicit consent step recorded with the
borrower's typed name (digital signature), IP address, user agent, and
timestamp. Sensitive identifiers (Aadhaar, PAN, GSTIN) are stored both
hashed (for de-duplication) and encrypted with AES-256-GCM (for
authorised retrieval). Login passwords required for upstream verification
flows are pass-through only and are never persisted in our system, with
two narrow, deliberate exceptions described in §4.

---

## 2. High-Level Architecture

```
                         ┌──────────────┐
   Borrower (browser) ──▶│   Frontend   │ React + Vite, served over HTTPS
                         └──────┬───────┘
                                │ JSON / multipart
                                ▼
                         ┌──────────────┐
                         │   Backend    │ FastAPI (async), Python 3.12
                         │  (Cloud Run) │
                         └──┬────────┬──┘
                            │        │
                            │        └──────────────┐
                            ▼                       ▼
                  ┌──────────────────┐    ┌──────────────────┐
                  │  Cloud SQL       │    │  Cloud Storage    │
                  │  Postgres 15     │    │  (private bucket) │
                  └──────────────────┘    └──────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │   Perfios APIs   │  KYC, GST, ITR, 26AS, BSA
                  └──────────────────┘
```

All inter-service traffic is over TLS. The backend never exposes the
database or storage bucket directly to the browser.

---

## 3. Verification Journey

### 3.1 Consent (mandatory first step)

The borrower reads a single consent statement covering all subsequent
verifications. They type their full legal name as a digital signature
and tick an explicit acceptance checkbox.

**Stored on consent submission:**

| Field | Source | Storage |
|---|---|---|
| `case_id` | Backend-generated (`LOAN-YYYYMMDD-{6 hex}`) | `cases` |
| `borrower_name` | User input | `cases`, `case_consents` |
| `consent_text` | Verbatim | `case_consents` |
| `consent_version` | `v1.0` | `case_consents` |
| `ip_address` | Request (X-Forwarded-For) | `case_consents` |
| `user_agent` | Request header | `case_consents` |
| `accepted_at` | Server timestamp | `case_consents` |

The `case_id` is generated on the backend with collision protection
(retry on duplicate) and is the journey identifier used by every
subsequent step.

### 3.2 Aadhaar eKYC

| Input | Validation | Storage |
|---|---|---|
| Aadhaar number (12 digits) | UIDAI format check | SHA-256 hash + AES-256-GCM ciphertext + last-4 |
| Borrower's name | Min 3 chars | `aadhaar_verifications.borrower_name` |
| Aadhaar card photo (optional) | JPG/PNG | `gs://<bucket>/cases/{case_id}/aadhaar_card/...` |

**Perfios calls:** `/v3/aadhaar-consent` (issues access key) followed by
`/v2/aadhaar-verification`. Result fields (gender, state, age band,
masked mobile, issued status) are flattened into indexable columns;
the full payload is preserved in `aadhaar_verifications.raw_response`.

The raw 12-digit Aadhaar number is **never written to disk in cleartext**.

### 3.3 PAN Authentication & PAN–Aadhaar Link

Two separate Perfios calls write to the same `pan_verifications` row:

- `/v2/pan` — verifies PAN against the Income Tax department database; returns the registered name.
- `/v3/pan-aadhaar-link` — confirms whether the PAN is linked to the
  Aadhaar collected in step 3.2. Result is recorded as a boolean and
  the Perfios response is preserved.

PAN is encrypted (AES-256-GCM), hashed (SHA-256), and the last four
characters retained for masked display. PAN card photo (optional) is
archived to `gs://<bucket>/cases/{case_id}/pan_card/...`.

### 3.4 GST (Business)

| Input | Storage |
|---|---|
| GSTIN (15 chars) | Hash + ciphertext + last-4 |

Two Perfios calls populate the same `gst_verifications` row:

- `/v2/gstdetailed-additional` — legal name, trade name, registration
  date, jurisdiction, addresses, members, business activities, turnover
  slab, gross income.
- `/v2/gst-return-status` — GSTR-1 / GSTR-3B / GSTR-1A filing history,
  delay flags, and per-quarter filing frequency.

Contact email and mobile from the GST registration are encrypted before
storage; everything else is plaintext (the underlying records are
publicly searchable on the GST portal).

### 3.5 Bank Statement (DSA collect mode)

The borrower uploads their bank statement PDF and, if applicable, the
PDF's password.

| Field | Storage |
|---|---|
| PDF | `gs://<bucket>/cases/{case_id}/bank_statement/<filename>.pdf` |
| File metadata (size, SHA-256, content type) | `bsa_verifications` |
| Loan amount, loan type | `bsa_verifications`, `cases` |
| PDF password (if any) | AES-256-GCM ciphertext in `bsa_verifications` |

The status is recorded as `UPLOADED`. Analysis is run by the lender's
downstream system using the archived PDF and the decrypted password.
The raw password is never stored in plaintext.

### 3.6 Income Tax Returns (ITR)

The borrower provides their PAN and Income Tax e-filing portal password.
The PAN is encrypted, hashed, and last-4 retained. The IT-portal
password is forwarded to Perfios `/v1/itr-return-forms` for the lookup
and is **not persisted** in our database.

On a successful response we capture:

- Entity name, PAN, type, address, DOB / incorporation date
- The PDF and Excel reports generated by Perfios

Both files are downloaded from Perfios's expiring 14-day URL and
re-uploaded to our Cloud Storage bucket for permanent retention:

```
gs://<bucket>/cases/{case_id}/itr/itr.pdf
gs://<bucket>/cases/{case_id}/itr/itr.xlsx
```

The full Perfios response is retained in `itr_verifications.raw_response`
as an audit trail.

### 3.7 Form 26AS (TDS Statement)

Same authentication model as ITR (PAN + IT-portal password). The
backend automatically requests the last three financial years for which
data is reliably available, using the IT e-Filing source path.

Captured fields:

- Borrower profile from the IT portal: name, PAN, status, registered address
- Excel and PDF reports generated by Perfios

Both reports are archived to:

```
gs://<bucket>/cases/{case_id}/form_26as/form_26as.xlsx
gs://<bucket>/cases/{case_id}/form_26as/form_26as.pdf
```

The complete Perfios response is preserved in
`form26as_verifications.raw_response`.

---

## 4. Security Controls

### 4.1 Encryption at rest

- **Database (Cloud SQL):** All data is encrypted at rest with
  Google-managed keys (AES-256). This is enforced by the platform.
- **Application-level encryption (AES-256-GCM):** Sensitive fields
  (Aadhaar number, PAN, GSTIN, contact email/mobile, bank-statement PDF
  password) are additionally encrypted before being written to the
  database. The 32-byte symmetric key is held in Google Secret Manager
  (`encryption-key`) and read at application start. Plaintext values
  for these fields exist only in memory during the request that needs
  them.
- **Cloud Storage:** Every object is stored in a private bucket with
  uniform bucket-level access. Public access is explicitly blocked at
  the bucket level.

### 4.2 Encryption in transit

- Browser ↔ Backend: HTTPS (TLS 1.2+).
- Backend ↔ Perfios: HTTPS only; the upstream URL is fixed in code.
- Backend ↔ Cloud SQL: TLS through the Cloud SQL Auth Proxy. The
  database has no public IP exposure.
- Backend ↔ Cloud Storage: HTTPS using Google's authenticated client
  library.

### 4.3 Authentication & key handling

- **Borrower:** No login required. Each journey is identified solely
  by a server-generated `case_id` and bound to a recorded consent.
- **Backend → GCP:** Application Default Credentials. In production
  the backend runs on Cloud Run with the `kuber-backend-sa` service
  account attached; no JSON keys exist on disk. Locally, ADC is used
  via `gcloud auth application-default login`.
- **Backend → Perfios:** `X-Secure-ID`, `X-Secure-Cred`,
  `X-Organization-ID` headers loaded from environment variables. In
  production these come from Secret Manager, injected as Cloud Run
  environment variables at deploy time.
- **Database:** Two roles — `postgres` (DDL, used only for migrations)
  and `kuber_app` (DML only, used by the application). Passwords are
  held in Secret Manager (`db-password`, `db-app-password`).
- **Encryption key:** Stored in Secret Manager (`encryption-key`).
  Loaded once at application start; not logged.

### 4.4 PII handling

- **Aadhaar number:** Stored as SHA-256 hash, AES-256-GCM ciphertext,
  and last-4 digits. The raw 12-digit value is never persisted.
- **PAN:** Stored as ciphertext + hash + last-4. Plaintext PAN is not
  persisted.
- **GSTIN:** Encrypted at rest even though the value is publicly
  queryable, for consistency with the encryption pattern.
- **Borrower contact email / mobile:** Encrypted at rest.
- **IT-portal passwords (used for ITR and 26AS lookups):** Forwarded to
  Perfios in the API call; not stored.
- **Bank-statement PDF password:** Encrypted at rest. Required so the
  lender's downstream analysis system can decrypt the archived PDF
  without re-prompting the borrower. The encryption key is held in
  Secret Manager.

### 4.5 Logging & audit trail

- Every verification call captures the Perfios request id, status code,
  and full response body in a `raw_response` JSONB column. This makes
  any later investigation possible without re-issuing the request.
- The `case_consents` table preserves the exact consent text shown to
  the borrower along with their typed name, IP address, user agent,
  and acceptance timestamp.
- Application logs are emitted to Cloud Logging in production. Sensitive
  fields (Aadhaar, PAN, passwords) are not logged.

### 4.6 Network controls

- The Cloud SQL instance has no public ingress allowed; access is via
  Cloud SQL Auth Proxy (locally) or the Cloud SQL Unix socket (in Cloud
  Run). There is no IP allow-list to maintain.
- The Cloud Storage bucket has uniform BLA enabled and public access is
  blocked at the bucket level.
- The backend service account is granted only the roles it needs:
  `roles/cloudsql.client`, `roles/storage.objectAdmin` scoped to the
  KYC bucket, `roles/secretmanager.secretAccessor`,
  `roles/logging.logWriter`, and `roles/monitoring.metricWriter`.

### 4.7 Data lifetime

- Verification records and their archived artefacts are retained
  indefinitely for audit; deletion will be governed by the lender's
  retention policy and DPDP Act obligations once defined.
- Bucket versioning is enabled on the Cloud Storage bucket, so
  accidental overwrites or deletes are recoverable.

---

## 5. Compliance Posture

- **Digital Personal Data Protection Act, 2023:** Consent is captured
  before any verification call is made; consent text is versioned and
  stored verbatim alongside the borrower's signature, IP, and user
  agent. Sensitive personal data (Aadhaar) is not stored in cleartext.
- **UIDAI guidance on Aadhaar storage:** Raw Aadhaar numbers are not
  persisted. The hash supports de-duplication; the ciphertext supports
  authorised retrieval; the last-4 digits support masked display.
- **Income Tax / TRACES:** IT-portal credentials supplied for ITR and
  26AS lookups are never written to disk.
- **RBI digital lending guidelines:** All borrower-facing communication
  occurs over HTTPS; the lender receives only a structured handoff
  (database row pointers + Cloud Storage URIs), not raw credentials.

---

## 6. Database Schema (overview)

| Table | Purpose |
|---|---|
| `cases` | Journey identity. One row per loan application. |
| `case_consents` | Consent record per case (typed name, IP, UA, timestamp). |
| `aadhaar_verifications` | One row per case. Hash + ciphertext + last-4 + Perfios output + photo reference. |
| `pan_verifications` | One row per case. Identical pattern to Aadhaar; also holds PAN–Aadhaar link result. |
| `gst_verifications` | Business profile + filing history; contact PII encrypted. |
| `bsa_verifications` | Bank statement PDF reference + encrypted password + loan context. |
| `itr_verifications` | ITR profile + GCS paths to permanent PDF / Excel reports. |
| `form26as_verifications` | 26AS profile + GCS paths to permanent PDF / Excel reports. |

Every table carries `created_at` / `updated_at` columns. All sensitive
columns are documented in the migration files under `infra/sql/`.

---

## 7. Operational Notes

- **Deployment target:** Cloud Run, region `asia-south1`. Backend is
  containerised via Artifact Registry image
  `asia-south1-docker.pkg.dev/kubar-protocol-main/kuber/verification`.
- **Environments:** `dev` and `prod` use separate Cloud SQL databases
  (`kuber_dev`, `kuber`) and separate Cloud Storage buckets
  (`kuber-kyc-dev`, `kuber-kyc-prod`).
- **Schema migrations:** Plain SQL files under `infra/sql/`, applied in
  numeric order. The `kuber_app` role has DML only; migrations are run
  by the `postgres` role.
- **Monitoring:** Cloud Logging captures structured logs; Cloud
  Monitoring metrics are written by the backend service account.

---

*End of document.*
