# Phase 4 Completion Gate

**Current decision:** Phase 5 is blocked until every mandatory item in this document is closed and the final verification gate passes.

**Scope source:** `navdhan_collection_only_detailed_plan_v2.md`, especially sections 12–16, 21, and Phase 4 in section 23, plus the explicitly approved existing-loan field requirements.

**Last reviewed:** 2026-08-14

## Phase 4 goal

Phase 4 must provide a complete vertical slice for:

- retrieving materialized application requirements;
- rendering the constitution-specific checklist dynamically;
- storing and linking local PDF documents;
- tracking document coverage and replacement history;
- collecting existing-credit declarations and facilities;
- materializing an existing-loan-track and sanction-letter requirement for each facility;
- proving that all three constitutions display and enforce their correct checklist.

Phase 5 consent, review, and submission behavior must not be implemented while this gate is open.

## Mandatory blockers

### P4-01 — Multi-document uploads are incorrectly treated as replacements

**Status:** Open

**Location:** `app/apply/_components/DocumentChecklist.tsx`

The component always passes `row.documents[0].document_id` as `supersedesDocumentId` after the first upload. This makes every later upload replace the first document.

This prevents:

- two distinct fiscal-year ITR documents from satisfying `min_count = 2`;
- multiple monthly bank statements from merging into a complete 12-month range;
- multiple monthly GST returns from merging into a complete coverage range.

**Required correction:**

- Default subsequent uploads to **add another document**.
- Offer replacement against a specifically selected existing document only when the user explicitly chooses Replace.
- Preserve `supersedes_document_id` for genuine replacements.
- Do not overwrite or silently supersede an existing document when the requirement still needs additional documents or coverage.

**Required tests:**

- Uploading two fiscal-year documents results in two live documents and a collected requirement.
- Uploading multiple monthly documents retains each document and merges their intervals.
- Explicit replacement supersedes only the selected document.
- Replacement preserves the chain and recalculates requirement status.

### P4-02 — Existing-loan collection does not include the approved field set

**Status:** Open

**Locations:**

- `app/apply/_components/ExistingLoansPanel.tsx`
- `app/apply/lib/types.ts`
- `app/apply/lib/validation.ts`
- `app/apply/lib/api.ts`
- `dsa_portal/backend/models/collection_requirements.py`
- `dsa_portal/backend/services/collection_requirements.py`
- `dsa_portal/backend/services/collection_snapshot.py`

The current UI collects only facility type, lender, outstanding amount, and EMI. The approved borrower-declared facility data is:

- Loan Type
- Lender
- ROI
- EMI
- Loan amount
- Tenure
- Start Date
- End Date
- Outstanding
- Paid EMI count

The database/backend already contains most of these columns, but the browser payload, Next validation, UI, and requirements snapshot do not carry the complete set.

**Required correction:**

- Add the complete field set to the TypeScript payload and response types.
- Validate the complete field set in the Next proxy and FastAPI request model.
- Collect the fields in `ExistingLoansPanel`.
- Persist every accepted field.
- Return every field needed for resume and later masked review.
- Validate date ordering and reject invalid ranges with a user-safe 422 response.
- Confirm which fields are required versus optional before finalizing validation; do not silently omit approved fields.

**Required tests:**

- Complete facility save and reload.
- Invalid ROI, amount, EMI, tenure, date range, and paid-EMI values are rejected.
- Refresh restores all entered facility fields.
- Adding multiple facilities keeps each facility and its own requirements.

### P4-03 — The generic credit facility is mislabeled

**Status:** Open

**Location:** `app/apply/_components/ExistingLoansPanel.tsx`

The `credit` facility type is displayed as “Credit card.” The approved decision is that credit remains generic because it may represent a line of credit or another credit facility.

**Required correction:** Display the option as **Credit** without narrowing its meaning.

**Required test:** Assert that the option label is “Credit” and not “Credit card.”

### P4-04 — Requirements loading failures are hidden

**Status:** Open

**Locations:**

- `app/apply/_components/WizardShell.tsx`
- `app/apply/_components/DocumentChecklist.tsx`

The wizard checks `loading || !requirements` before checking `requirementsError`. When the request fails, `requirements` remains null and the user sees an indefinite loading message instead of the error.

**Required correction:**

- Render the error before the null/loading fallback after loading finishes.
- Provide an explicit retry action wired to `reload()`.
- Preserve the last valid snapshot when a later refresh fails.

**Required tests:**

- Initial loading state.
- Successful requirements load.
- Failed load displays a user-safe error.
- Retry succeeds and replaces the error with the checklist.

### P4-05 — Required PDF validation is incomplete

**Status:** Open

**Locations:**

- `app/api/apply/applications/current/documents/route.ts`
- `dsa_portal/backend/routes/collection_requirements.py`
- `dsa_portal/backend/storage/local_documents.py`
- `dsa_portal/backend/services/collection_requirements.py`

The detailed plan requires, at minimum:

- non-empty content;
- allowed MIME type;
- expected filename extension;
- valid PDF signature;
- obvious structural readability;
- the document-type size limit.

The current implementation checks non-empty content, MIME, the opening PDF signature, and size. It does not validate the filename extension and does not perform basic structural-readability validation.

**Required correction:**

- Carry the sanitized original filename only as validation metadata; never use it in the storage path.
- Require the expected `.pdf` extension case-insensitively.
- Add a minimum structural PDF check appropriate for this phase, such as verifying a plausible PDF trailer/end marker without introducing OCR, extraction, malware infrastructure, or document parsing beyond the plan.
- Continue enforcing the document-type MIME allowlist and 10 MB product limit.
- Return generic validation messages without file contents or sensitive metadata.

**Required tests:**

- Empty file rejected.
- Incorrect MIME rejected.
- Incorrect extension rejected.
- Header-only/truncated/corrupt PDF rejected.
- Oversized PDF rejected.
- Minimal structurally valid PDF accepted.

### P4-06 — Phase 4 UI behavior has no direct component coverage

**Status:** Open

**Locations:**

- `app/apply/_components/DocumentChecklist.tsx`
- `app/apply/_components/ExistingLoansPanel.tsx`
- `app/apply/_components/WizardShell.tsx`

The current Phase 4 frontend tests cover API clients and Next proxy routes. They do not render or exercise the Phase 4 components, which allowed P4-01, P4-02, P4-03, and P4-04 to pass unnoticed.

**Required correction:** Add focused Testing Library tests for the component behavior. Avoid duplicating backend rule tests in the frontend.

**Minimum component coverage:**

- backend-driven checklist rendering;
- add-versus-replace upload behavior;
- consolidated and multiple-document display;
- alternate-document state display;
- complete existing-loan form;
- generic Credit label;
- facility-scoped sanction-letter and loan-track rows;
- loading, error, retry, and successful reload;
- optimistic-lock conflict surfaced without advancing the wizard.

### P4-07 — Local document deletion lacks a root-containment guard

**Status:** Open

**Location:** `dsa_portal/backend/storage/local_documents.py`

`delete()` joins the storage root with the database object key and deletes the resulting path without resolving it and asserting that it remains inside the configured storage root. The current object keys are server-generated, but defensive containment is required before treating local deletion as safe.

**Required correction:**

- Resolve the configured root and candidate path.
- Refuse deletion when the candidate is outside the root.
- Continue using server-generated UUID path segments.
- Never incorporate borrower-provided filenames or identifiers into storage paths.

**Required tests:**

- Valid tenant/application/document path deletes successfully.
- Parent traversal is rejected.
- Absolute paths are rejected.
- A missing valid path remains idempotent.

## Hardening findings to resolve or explicitly accept before the Phase 4 commit

### P4-H01 — File deletion and database commit can diverge

**Status:** Open decision

`delete_document()` marks database state and removes the local file before the surrounding database transaction has definitely committed. A later commit failure could leave an uploaded document record pointing at a missing file.

This is not explicitly assigned by the plan, which only specifies upload compensation, but it is a real reliability risk introduced by Phase 4.

Before committing Phase 4, choose and test one narrow approach:

- commit the database state before best-effort physical deletion and retain recoverable cleanup metadata; or
- perform compensating restoration/rollback behavior suitable for local storage; or
- document the accepted local-only limitation and schedule durable cleanup/reconciliation before production storage.

Do not add a full transactional outbox in this phase; the plan explicitly excludes it.

### P4-H02 — Startup-failure tests emit resource-cleanup warnings

**Status:** Open, non-blocking if documented

The backend suite passes but some startup-failure tests emit unclosed in-memory stream warnings. Confirm that this is limited to test-client teardown and does not represent a production lifespan leak. Fix the test cleanup if possible without changing runtime behavior.

### P4-H03 — Dependency audit reports existing high-severity advisories

**Status:** Open project security debt

The production dependency audit reports four high-severity advisories in the existing Next.js dependency tree and transitive packages. A complete repair may require a separately reviewed framework upgrade.

This is not a Phase 4 collection feature, but it must be recorded in the Phase 4 commit/PR notes and must not be described as security-clean. Do not run an automatic dependency rewrite as part of the Phase 4 correction without a separate compatibility plan.

### P4-H04 — Python vulnerability audit tooling is unavailable locally

**Status:** Open tooling gap

The installed packages pass the dependency-consistency check, but the vulnerability-audit utility is not installed. Decide whether to install/run it as a separate approved tooling action or rely on CI/dependency scanning for this commit.

### P4-H05 — No request rate limiting exists on the collection endpoints

**Status:** Deferred production hardening

Rate limiting is not assigned to Phases 0–4 in the collection-only plan. It should be tracked for production hardening and must not be misrepresented as implemented.

## Explicitly deferred; do not pull into the Phase 4 correction

- Consent grants, masked final review, completeness enforcement, submission, and stable application number: **Phase 5**.
- Full canonical browser-flow consolidation: **Phase 6**.
- Removing legacy provider routes, imports, clients, callbacks, and configuration: **Phase 7**.
- Exhaustive local acceptance, corrupt/oversized negative cases across the whole journey, repeated-submit safety, and zero provider traffic across the final system: **Phase 8**.
- GCS storage and Cloud SQL: after mandatory local acceptance.
- OCR, extraction, malware-scanning infrastructure, tamper analysis, and provider report generation: explicitly outside this iteration.

Legacy provider routes may remain visible in the Next build until Phase 7, but Phase 4 collection code must make zero provider calls.

## Final Phase 4 verification gate

All mandatory blockers must be closed before running this gate.

### Automated checks

From the repository root:

```powershell
npm test
npx tsc --noEmit --incremental false
npm run build
python -m unittest discover -s database\tests -v
git diff --check
```

From `dsa_portal/backend`:

```powershell
python -m unittest discover -s tests -v
```

Expected minimum baseline before adding correction tests:

- Frontend: 112 passing tests.
- Backend: 73 passing tests against the isolated test database.
- Database: 22 passing tests.
- TypeScript: clean.
- Production build: clean and Phase 4 routes present.

The final counts must be higher after the required component and regression tests are added.

### Manual vertical-slice smoke checks

For each constitution—Proprietorship, Partnership, and Private Limited:

1. Create an application and refresh; the same application resumes.
2. Confirm the correct required, optional, alternate, and coverage rows appear.
3. Upload a valid single PDF and confirm persisted reload.
4. Upload two fiscal-year financial documents without one replacing the other.
5. Upload multiple monthly bank/GST documents and confirm interval merging.
6. Upload one consolidated full-period document and confirm it satisfies the appropriate coverage row.
7. Replace a specifically selected document and confirm only that document is superseded.
8. Delete a document and confirm requirement/alternate-group status is recalculated.
9. Declare no existing facilities and confirm no facility-scoped rows appear.
10. Declare multiple facilities with the complete approved fields.
11. Confirm each facility receives its own sanction-letter and existing-loan-track requirement.
12. Upload facility documents and confirm they cannot satisfy a different facility.
13. Refresh and confirm all fields, facilities, documents, and statuses reload.
14. Confirm stale updates receive 409 with no partial change.
15. Confirm missing/foreign sessions cannot read, upload, or delete documents.
16. Confirm no sensitive identifier is written to browser storage, logs, errors, or local document paths.
17. Confirm no provider request is made by the collection-only flow.

## Exit criteria

Phase 4 may be committed and Phase 5 may begin only when:

- P4-01 through P4-07 are closed with regression tests;
- P4-H01 has either been fixed or explicitly accepted with documented rationale;
- P4-H02 through P4-H05 are recorded with their final disposition;
- all automated checks pass;
- the manual smoke checks pass for all three constitutions;
- the working-tree diff contains only expected Phase 4/hotfix/documentation changes;
- local assistant settings, generated graph artifacts, local database state, local uploaded documents, and ignored planning/model outputs are not staged;
- Graphify has been refreshed;
- Phase 4 is committed separately before any Phase 5 implementation starts.

