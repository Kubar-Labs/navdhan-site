# Borrower Verification Flow

Business-loan-only product. Every case has a human signatory acting on behalf of a registered entity (Pvt Ltd / Public Co / LLP).

## Steps (in order)

1. **Welcome** — landing screen, no data collected.
2. **Consent** — captures entity legal name, signatory full name (digital signature), signatory mobile. Writes `cases` row + `case_consents` row. Returns `case_id`.
3. **Aadhaar** — signatory's Aadhaar. Perfios `/v3/aadhaar-mobilelink`. Writes `aadhaar_verifications`.
4. **Personal PAN** — signatory's PAN + PAN-Aadhaar link check. Perfios `/v2/pan` and `/v3/pan-aadhaar-link`. Writes `pan_verifications`.
5. **Business PAN** — entity's PAN, then two sub-steps:
   - **Step 1:** Entity PAN auth → `kyb_pan_verifications` (Perfios `/v2/pan`)
   - **Step 2:** CIN/LLPIN lookup → `kyb_cin_verifications` (Perfios KSCAN `/v3/pan-cin`)
   - **Step 3:** GST search by PAN → `kyb_gst_searches` (Perfios `/gst/v2/search`)
6. **GST** — pick a GSTIN (pre-filled from step 5's list) → verify + fetch returns. Writes `gst_verifications`.
7. **Bank** — PDF statement upload + password + loan amount/duration/type. Writes `bsa_verifications`.
8. **P&L** — PDF upload only. Writes `pl_verifications`.
9. **ITR** — three input paths:
   - **Credentials:** PAN + IT-portal password → tries Perfios `/v1/itr-return-forms`; on success persists `status=COMPLETED`, on failure falls back to encrypted-credential storage (`status=COLLECTED`).
   - **Upload:** user uploads ITR sheet (PDF/Excel/etc.) → GCS, `status=UPLOADED`, `input_method='upload'`.
   - **Skip:** confirmation modal warns about reduced accuracy → row written with `status=SKIPPED`, `input_method='skipped'`.
   Writes `itr_verifications`.
10. **Form 26AS** — same three paths as ITR (Credentials / Upload / Skip). Writes `form26as_verifications`.
11. **Summary** — review screen, no data collected.

## Data layout per case

| Step | Table written |
|------|---------------|
| Consent | `cases`, `case_consents` |
| Aadhaar | `aadhaar_verifications` |
| Personal PAN | `pan_verifications` |
| Business PAN | `kyb_pan_verifications`, `kyb_cin_verifications`, `kyb_gst_searches` |
| GST | `gst_verifications` |
| Bank | `bsa_verifications` |
| P&L | `pl_verifications` |
| ITR | `itr_verifications` |
| Form 26AS | `form26as_verifications` |

All tables keyed by `case_id` (FK to `cases.id`).

## Key conventions

- PII (Aadhaar, PAN, IT-portal passwords) is **encrypted at rest** (AES-256-GCM) and **hashed** for de-duplication.
- Perfios files (PDFs/Excel) are archived to our GCS bucket so they don't vanish in 14 days.
- Every case is `cases.borrower_type='business'`; the column exists for historical rows and future re-introduction of other types but the API only produces `'business'`.
- Personal Aadhaar+PAN belong to the signatory (a human). Business PAN belongs to the entity. The link check (step 4) verifies the signatory's identity, not the entity.
- For ITR / 26AS: `input_method` column tells you which of the three paths a case took. `status='COMPLETED'` only when Perfios actually returned data; `'COLLECTED'` means we have credentials but no data yet; `'UPLOADED'` means we have a user-supplied sheet; `'SKIPPED'` means the user explicitly opted out.

## Source-of-truth files

- Frontend step order: `frontend/src/App.tsx` (`STEP_ORDER`)
- Frontend step components: `frontend/src/steps/*.tsx`
- Backend routes: `backend/routes/*.py` (+ `backend/routes/kyb/` for business-PAN sub-steps)
- Schema: `infra/sql/0NN_*.sql`, mirrored in `backend/db/models.py`
- Migration runbook: `docs/MIGRATIONS.md`
