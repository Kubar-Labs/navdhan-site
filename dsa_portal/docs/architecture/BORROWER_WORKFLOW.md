# Loan Verification — Borrower Workflow

**Document version:** 1.0
**Last updated:** 25 Apr 2026

---

## 1. Overview

The verification platform is a web-based portal that helps a borrower
submit and verify the documents required for their loan application. It
is delivered to the borrower as a single link (sent via SMS or email).
No mobile-app installation is required — it works on any modern browser
on a phone, tablet, or laptop.

The borrower completes the verification themselves in one continuous
session. At the end, the lender's operations team receives a complete
verification packet — identity confirmations, business records, and
financial documents — through a single dashboard / data handoff.

---

## 2. What the Borrower Receives

A single secure link, for example:

```
https://verify.example.com/start?invite=abc123
```

When opened, the link launches the verification journey directly in the
browser. Each link is unique to one application; once the journey is
completed (or expired), the link can no longer be reused.

---

## 3. Documents the Borrower Needs Ready

Before starting, the borrower should keep the following ready. If any
of these are missing the journey can still be paused and resumed.

| # | Item | Required for | Notes |
|---|---|---|---|
| 1 | Aadhaar number | Aadhaar eKYC | 12-digit number |
| 2 | Aadhaar card photo | Aadhaar eKYC | Optional, recommended |
| 3 | PAN number | PAN verification | 10-character PAN |
| 4 | PAN card photo | PAN verification | Optional, recommended |
| 5 | GSTIN | GST verification | 15-character GSTIN — for business loans |
| 6 | Bank statement PDF | Bank statement step | Last 6 to 12 months |
| 7 | Bank statement password | Bank statement step | Only if PDF is password-protected |
| 8 | Income Tax portal password | ITR + Form 26AS | Same password used at `incometax.gov.in` |

### Important note on the IT portal password

Two-Factor Authentication (2FA) **must be disabled** on the borrower's
Income Tax e-Filing portal account before they begin. If 2FA is on, the
ITR and Form 26AS steps cannot complete. The borrower can disable 2FA
from the IT e-Filing portal under "Profile → Login Settings".

---

## 4. The Step-by-Step Journey

The borrower goes through eight screens in sequence. Each screen
typically takes between 30 seconds and 2 minutes.

### Step 1 — Welcome

A landing page introduces the platform and lists what will be verified.
The borrower clicks **Get Started**.

### Step 2 — Consent

The borrower reads a consent statement covering all subsequent
verifications, types their full legal name as a digital signature, and
ticks an acceptance checkbox.

When they click **Agree & Continue**, the system creates a unique
Case ID for this application (format: `LOAN-YYYYMMDD-XXXXXX`). This
Case ID is the reference that ties together every step that follows
and is visible on the final summary screen.

### Step 3 — Aadhaar eKYC

The borrower enters:

- Aadhaar number (12 digits)
- Full name as printed on Aadhaar
- Photo of Aadhaar card (optional — recommended for record-keeping)

The system performs an Aadhaar eKYC check via UIDAI. The result is
displayed immediately:

- "Verified" if the Aadhaar is valid and active
- The system also captures: gender, state, age band, masked mobile

### Step 4 — PAN Verification

The borrower enters:

- PAN number (10 characters)
- Photo of PAN card (optional)

The system performs two checks:

1. **PAN authentication** — confirms the PAN exists in the Income Tax
   department database and returns the registered name.
2. **PAN–Aadhaar link** — confirms whether the PAN is linked to the
   Aadhaar entered in Step 3 (a regulatory requirement).

Both results are shown on the screen.

### Step 5 — GSTIN Verification *(business borrowers)*

The borrower enters their 15-character GSTIN. The system fetches:

- **Business profile**: legal name, trade name, registration date,
  constitution (Pvt Ltd, Partnership, etc.), addresses, members,
  business activities, turnover slab, gross income.
- **Filing history**: GSTR-1 and GSTR-3B filings, delay / default
  flags, per-quarter filing frequency.

A GSTIN that is inactive, cancelled, or has default flags is shown to
the borrower (and recorded for the lender).

### Step 6 — Bank Statement Upload

The borrower provides:

- Loan amount they are applying for (₹)
- Bank statement PDF — most banks email these for the last 6 to 12
  months
- Bank statement PDF password — only if the PDF is password-protected
  (most retail bank PDFs are; most current accounts are not)

The PDF is uploaded directly to secure encrypted storage. The lender's
analysis team receives the file as part of the verification packet.

### Step 7 — Income Tax Returns (ITR)

The borrower enters:

- PAN — auto-filled from Step 4
- Income Tax portal password (the password used at `incometax.gov.in`)

The system fetches the borrower's ITR data for the last three
assessment years. The output includes:

- Entity name, PAN, type, address, date of incorporation
- ITR filing history (which years filed, which forms, status)
- A PDF report and an Excel workbook summarising returns

Both the PDF and Excel are stored in our secure document store.

### Step 8 — Form 26AS (TDS Statement)

The borrower enters:

- PAN — auto-filled
- IT portal password — the same password used in Step 7

The system fetches Form 26AS for the last three financial years
(automatically computed — the borrower does not have to choose a year).
The output includes:

- TDS deducted by employers / customers
- TCS collected
- Tax refunds received
- Any TDS defaults

A PDF and an Excel report are produced and stored alongside the ITR
documents.

### Step 9 — Summary

A summary screen shows the result for each step (Verified / Failed /
Pending), the borrower's Case ID, and an overall completion percentage.
The borrower can download a copy of the report and either close the
session or, if the lender's flow continues, click through to the
loan application form.

---

## 5. What the Lender Receives

After the journey is complete, the lender's operations team can access:

| Asset | Source | Where to find it |
|---|---|---|
| Borrower's typed consent | Captured at Step 2 | `case_consents` table |
| Aadhaar eKYC result | Step 3 | `aadhaar_verifications` table + photo in storage |
| PAN verification result | Step 4 | `pan_verifications` table + photo in storage |
| PAN–Aadhaar link confirmation | Step 4 | `pan_verifications.pan_aadhaar_linked` |
| GST profile + filing history | Step 5 | `gst_verifications` table |
| Bank statement PDF | Step 6 | Document store (path in `bsa_verifications`) |
| ITR PDF + Excel | Step 7 | Document store (paths in `itr_verifications`) |
| Form 26AS PDF + Excel | Step 8 | Document store (paths in `form26as_verifications`) |
| Case ID (cross-reference) | All | `cases.case_id` |

Every artefact is tagged with the same Case ID, so the lender's team
can pull a single application's full file with one query.

---

## 6. Time Estimates

| Phase | Typical duration |
|---|---|
| Welcome + Consent | 1 minute |
| Aadhaar eKYC | 1–2 minutes |
| PAN + PAN–Aadhaar link | 1–2 minutes |
| GST verification | 1–2 minutes |
| Bank statement upload | 1 minute |
| ITR fetch | 2–5 minutes (depends on IT portal load) |
| Form 26AS fetch | 2–5 minutes (depends on IT portal load) |
| **Total (typical)** | **10–15 minutes** |

The ITR and Form 26AS steps are the slowest because they fetch data
live from the Income Tax e-Filing portal.

---

## 7. Common Issues and How to Resolve Them

| Symptom | Likely cause | Resolution |
|---|---|---|
| "Invalid PAN or password" on ITR or 26AS | Wrong IT portal password, OR 2FA enabled | Borrower confirms password at `incometax.gov.in`; disables 2FA from Profile → Login Settings |
| "Wrong password" on bank statement | Wrong PDF password | Most retail banks use first 4 letters of the borrower's name (uppercase) + DDMM of DOB. Borrower should re-check or download a fresh statement |
| GST step shows "no records found" | GSTIN is inactive / cancelled / mistyped | Borrower confirms GSTIN status on `gst.gov.in` |
| Aadhaar shows "not issued" | Mistyped Aadhaar number | Borrower re-enters carefully |
| 26AS shows "Service Unavailable" | IT portal upstream busy | Retry after a few minutes |

If a step fails, the borrower can retry that single step without
restarting the entire journey — the Case ID, consent, and earlier
verified steps are all preserved.

---

## 8. Security & Privacy (one-paragraph summary for the operations team)

The borrower's consent is captured before any verification call is made.
Aadhaar numbers, PAN, and similar sensitive identifiers are never
stored in cleartext — they are encrypted at rest and only the last four
characters are retained for masked display. Login passwords used to
fetch ITR and Form 26AS are forwarded directly to the upstream service
and are not persisted in our system. All uploaded documents are stored
in a private encrypted bucket. Full technical details are available in
the separate Data Flow & Security document.

---

## 9. Support Channels

- For technical issues with the platform itself: contact the engineering
  team (escalation address to be filled in by your operations lead).
- For borrower-facing issues (failed steps, document errors): the
  on-screen error message will specify the cause; the operations team
  can guide the borrower based on Section 7 above.

---

*End of document.*
