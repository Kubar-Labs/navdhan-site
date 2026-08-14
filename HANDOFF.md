
# NavDhan Collection-Only Flow — Handoff

This document describes the repository after Phase 4, the post-Phase-4
hotfix, the Phase 4 gate-closure pass, Phase 5 (consent/review/submission),
and a correctness-fix pass discovered while validating Phase 5 live. It is
intended for a new coding assistant with no conversation history, picking up
to start **Phase 6**.

## 1. Project overview

NavDhan is a borrower loan-application frontend and FastAPI backend. The
collection-only work replaces provider-backed verification with a local,
tenant-aware application-collection flow: the browser captures loan intent,
business/borrower details, party KYC identifiers, entity PAN, GST
registration, a dynamic document checklist, existing-credit-facility
declarations, consent, and now final submission with a real, stable
`application_no`. Phase 6 (canonical Next.js integration, wording cleanup,
localStorage audit) has not started.

The repository is a Next.js application plus a Python service and a separate
SQL migration/seed project:

- Frontend: Next.js 15, React 19, TypeScript 5.7, Tailwind CSS 4,
  `next-intl`, Zod, Vitest 3, Testing Library, OpenNext/Cloudflare tooling.
- Backend: Python FastAPI 0.115, Uvicorn, Pydantic 2.9, SQLAlchemy async
  2.0, asyncpg, PostgreSQL, python-dotenv, cryptography, multipart support.
- Local database: PostgreSQL 18, local cluster on `127.0.0.1:55432`.
  **Two databases matter**: `postgres` is the developer's live/dev
  database; `navdhan_test` is a dedicated, auto-bootstrapped database that
  automated tests use exclusively (see section 9) — this isolation is
  enforced by a fail-fast guard, not just convention. pgAdmin 4 is
  installed locally (`C:\Program Files\PostgreSQL\18\pgAdmin 4\runtime\pgAdmin4.exe`)
  for browsing either database — connect with host `127.0.0.1`, port
  `55432`, user `postgres`, blank password (cluster runs `--auth=trust`).
- Storage: `LocalDocumentStorage` writes validated PDFs to
  `dsa_portal/backend/.local_documents/{marketplace_id}/{application_id}/{document_id}.pdf`
  (gitignored, path overridable via `LOCAL_DOCUMENT_STORAGE_ROOT`). Delete
  is containment-guarded (P4-07) **and now commit-ordered** (P4-H01, closed
  this pass — see section 2): physical deletion happens only after the
  surrounding DB transaction commits, never inside it. `GCSStorage` behind
  the same interface is Phase-8-and-later work.
- Branch: `feat/data-collection-only`. Last commit `d4450d2` (end of
  Phase 3). **Everything for Phase 4, the hotfix, gate-closure, Phase 5,
  and the post-Phase-5 fix pass is uncommitted working-tree state** — run
  `git status` before assuming otherwise; nothing has been committed since
  `d4450d2`. `git status --short` currently reports ~48 changed/untracked
  paths.

Secret handling is a hard constraint: never open or search secret files
(`.env`); load configuration through the existing dotenv/runtime mechanism;
never print environment-variable names or values.

To run the backend locally: from `dsa_portal/backend`,
`python -m uvicorn collection_app:app --host 127.0.0.1 --port 8000`. Confirm
with `curl http://127.0.0.1:8000/health` → `{"status":"ok"}`. A prior
session lost time to Docker (Airbyte) silently shadowing port 8000 on
Windows — that container has since been stopped and is no longer an issue,
but if `/health` doesn't respond, check `netstat -ano | grep :8000` for an
unexpected listener before assuming the backend itself is broken.

## 2. Phase breakdown

Phase names/gates follow `navdhan_collection_only_detailed_plan_v2.md`
(gitignored, present locally). A companion schema reference,
`data-model-reference.md` (also gitignored, present locally), documents
every table/column/enum and is the fastest way to check a column's exact
purpose without re-reading migration SQL.

### Phases 0–3 — done

Unchanged since end-of-Phase-3. See git history at `d4450d2` for detail.

### Phase 4 — Dynamic Checklist + Documents — done, gate closed

Status: **done**. `PHASE4_COMPLETION_GATE.md` recorded seven mandatory
blockers (P4-01 through P4-07) plus five hardening findings (P4-H01–H05).
All seven mandatory blockers are closed with regression tests. Of the
hardening findings, **P4-H01 is now also closed** (this pass — see section
2's Phase 5 fix-pass entry below); H02–H05 remain open, recorded in section
6 with current effort estimates.

### Post-Phase-4 reliability hotfix — done

Two incidents happened while manually testing Phase 4 live: a silent 500 on
first encrypted write (`.env` never loaded for the collection-only runtime),
and a backend test run that nearly wiped a live dev session (tests weren't
isolated to a dedicated database). Both fixed:

- `collection_app.py` calls `load_dotenv()` (`override=False`) at import
  time.
- `build_collection_app(..., validate_crypto: bool = True)` validates
  crypto keys at ASGI startup, not on first use.
- `dsa_portal/backend/tests/db_test_support.py` provides
  `guard_test_database_name()` / `guard_live_connection_is_test_database()`
  / `ensure_test_schema()` — the canonical, mandatory way any backend test
  gets a real DB connection, isolated to `navdhan_test`.

### Phase 5 — Consent, Review, Submit — done

Status: **done**, implemented and verified against
`navdhan_collection_only_detailed_plan_v2.md` §19 (Submission) and §20
(Consent) line by line, then live-tested against the running backend and
the real dev Postgres database (not just the auto-bootstrapped test DB).

**What shipped:**

- Backend: `models/collection_submission.py`, `services/collection_submission.py`,
  `routes/collection_submission.py` — `GET/PUT .../consent`,
  `POST .../submit`. `ConsentPurpose`/`ConsentGrant` ORM mappings added to
  `db/collection_models.py`. Completeness gate reads
  `application_requirements.status` only (no BL-rule duplication, per the
  plan's explicit instruction) plus: primary party present, borrower
  profile collected, entity PAN where the constitution requires it, GST
  state when registered, every mandatory `consent_purposes` row granted at
  its current `notice_version`, and — **derived from
  `application_requirements`, not hardcoded** — PAN/Aadhaar identifiers for
  every party that has a blocking `pan_card`/`aadhaar_kyc` requirement.
  Submit is atomic (`status=submitted`, `submitted_at`, one
  `application_status_events` row, returns `application_no`) and idempotent
  (repeat submit returns the same result, no duplicate event, survives a
  stale `expected_lock_version` on the *second* call by design).
- Frontend: `WizardShell.tsx`'s `review_submit` step now does a real
  `PUT .../consent` then `POST .../submit` against backend-sourced,
  dynamically-rendered consent purposes (mandatory ones required,
  `communications` optional), shows an outstanding-requirements banner, and
  `submission_result` shows the real `application_no`.
- Seed fix: `database/seeds/001_collection_flow.sql` was missing a
  `destinations` row that `consent_grants.destination_id` requires
  (`NOT NULL FK`) — added (`40000000-0000-0000-0000-000000000001`,
  `manual_dashboard`). **This seed must be (re-)applied to the dev
  `postgres` database, not just `navdhan_test`** — the test DB gets it
  automatically via `ensure_test_schema()`, the dev DB does not. If consent
  save 500s locally with a `ForeignKeyViolationError` on `consent_grants`,
  this is why; re-run
  `psql -f database/seeds/001_collection_flow.sql -d postgres` (see section
  1 for connection details).

**Real bugs found and fixed while validating Phase 5** (none of these were
in the original plan's Phase 5 scope, but all were exposed by it):

1. **The Submit button had never worked, in this codebase's entire
   history.** `NavigationFooter.tsx` set `type="submit"` with
   `onClick={undefined}` for the review step, deferring to native
   `<form>` submission — but `WizardShell` never wraps it in a `<form>`.
   Clicking Submit did nothing, silently, on every prior phase. Fixed: the
   button always wires `onClick={onContinue}` now regardless of `variant`.
2. **Submitted applications stayed fully editable.** `_application_for_write`
   (the shared write-path helper used by nearly every mutation) checked
   `lock_version` but never `application.status`. Live-verified: submit an
   application, then `PUT loan-intent` with a new amount — 200, silently
   changes the requested amount on an already-submitted record. Fixed: new
   `ApplicationLockedError` / `_guard_not_submitted()` in
   `services/collection_application.py`, called from
   `_application_for_write` and from `save_loan_intent`'s bypass path (it
   predates the shared helper). Every mutation route now maps this to
   `409` with `"This application has already been submitted."` —
   loan-intent, business-profile, persons/parties, PAN, Aadhaar, entity-PAN,
   GST, credit-declaration, credit-facilities, document upload/delete,
   consent. `submit_application()` deliberately does not use the guarded
   helper, so idempotent resubmit is unaffected. Regression test:
   `test_submitted_application_rejects_every_mutation_path` (13-endpoint
   subtest matrix) in `tests/test_collection_submission_flow.py`.
3. **Single-tab false-positive 409s ("This application changed in another
   tab").** `application`, `requirements`, and `consentStatus` are three
   independently-fetched React states in `WizardShell.tsx` that all mirror
   the *same* backend `loan_applications.lock_version` column. Any
   requirements-track write (document upload/delete, credit declaration,
   credit facility) correctly advances the shared column and returns the
   new value — but only into `requirements` state, never into
   `application` state. Phase 5's review/submit step was the first code
   to read `application.lock_version` after the Documents/Existing-Loans
   steps, exposing the drift as a spurious "changed in another tab" error
   with zero second tab involved. Fixed with one `useEffect` in
   `WizardShell.tsx` that reconciles all three slices to
   `Math.max()` of their `lock_version`s after every render — verified
   this genuinely reproduces and fixes the bug (disabled the effect,
   confirmed the new regression test fails with the exact reported
   symptom, re-enabled it, confirmed it passes). Genuine multi-tab
   conflicts are unaffected — proven by a new backend test —
   because state never crosses tabs to begin with; this only reconciles
   *within* one tab's own component tree.
4. **KYC-identifier completeness gate was overly broad.** Originally coded
   as "every party needs PAN + Aadhaar," unconditionally. Plan §19 says
   "Personal PAN for every application party **whose KYC requirement
   blocks submission**." Fixed to derive which parties actually need
   identifiers from `application_requirements`
   (`pan_card`/`aadhaar_kyc`, `attaches_to='person'`, `blocks_submission`)
   rather than assuming every party universally. No behavioral change
   today (current seed happens to require both for every role on all
   three constitutions) but now structurally correct per spec.
5. **Consent notice text was never displayed**, only the short
   `display_name` label — plan §20 says "the application displays the
   current notice." Fixed: `WizardShell.tsx` now renders `notice_text`
   below the label when it differs from `display_name` (today they're
   identical in the seed, so nothing visibly changed, but this now holds
   once legal copy and the UI label diverge).
6. **P4-H01 closed as a bonus fix in the same pass**: physical document
   deletion (`delete_document`, and `_clear_facilities` on a reverted
   credit declaration) moved to run only *after* the surrounding
   transaction commits, not inside it. A rollback now leaves the file in
   place; a post-commit deletion failure is logged
   (`_LOGGER.exception`) and swallowed rather than surfacing as a request
   failure, since the DB state is already correctly committed and the
   worst case is an orphaned file, never a broken reference. New tests in
   `tests/test_collection_requirements_flow.py`:
   `test_committed_delete_removes_the_physical_file`,
   `test_rolled_back_delete_leaves_the_file_and_the_document_row_intact`,
   `test_post_commit_cleanup_failure_keeps_the_committed_delete`,
   `test_clearing_facilities_removes_their_files_only_after_commit`.

None of this touched Perfios, GCS, Cloud SQL, or Phase 6 wording — confirmed
explicitly at the end of each fix pass.

### Phase 6 — Canonical Next.js Integration

Status: **not started**. Plan scope (§23):

- remove localStorage as sensitive source of truth;
- connect each step to FastAPI;
- connect dynamic requirements;
- replace bank linking with real uploads;
- update verification language.

**Gate:** complete browser flow works locally.

Two things worth knowing before assuming this is a large rebuild — **most
of this phase's plan-text scope may already be satisfied by Phases 2–5**,
just unverified end-to-end:

- "Connect each step to FastAPI" / "connect dynamic requirements" — already
  true. Every step (loan intent, business profile, persons, PAN, Aadhaar,
  entity PAN, GST, documents, existing loans, consent, submit) already
  calls a real backend endpoint; there is no mock/fake data path left in
  `WizardShell.tsx`. What's *not* verified is that this actually works
  end-to-end in a real browser — see the still-outstanding manual smoke
  matrix in section 4.
- "Replace bank linking with real uploads" — already true in effect. The
  `bank_statements` step id is repurposed (since Phase 4) to render
  `ExistingLoansPanel` (real credit-declaration + facility + document
  upload flow), not any OTP/Account-Aggregator bank-linking flow. There is
  no live bank-linking code path today. What's *not* done: the step's
  id/title/description and `WizardMessages` still carry bank-linking-era
  names (`bank_linked`, `bank_consent`, `linkBankLabel`,
  `bankConsentSummary`, etc. in `types.ts`/`WizardShell.tsx` are dead —
  never read from anywhere in the render path anymore) — a cleanup pass
  fits Phase 6.
- "Remove localStorage as sensitive source of truth" — **already true, but
  verify before assuming it's done.** `app/apply/lib/storage.ts`'s
  `saveDraftValues()`/`loadDraftValues()` only ever write five non-sensitive
  fields (`constitution`, `loan_amount`, `tenure_months`, `purpose`,
  `referral_code`) — checked directly, confirmed no PAN/Aadhaar/mobile/
  email path exists. But `saveDraftValues`/`loadDraftValues` are **dead
  code** — grep confirms nothing calls them; only `clearDraftValues()` is
  ever invoked (unconditionally, on every `WizardShell` mount). So in
  practice nothing is ever written to localStorage today. Decide in Phase 6
  whether to delete the dead functions or wire them back up for genuine
  same-browser resume — don't assume either without checking product intent
  first.
- What's genuinely unstarted: the **wording table** in plan §21 — "Aadhaar
  Verification → Aadhaar Details", "PAN Verification → PAN Details", "GST
  Verification → GST Details", "Verify → Save Details", "Link Bank → Upload
  Bank Statements", "Check Eligibility → Submit Application" — and removing
  claims about OTP/eKYC, PAN verification, GST fetching, AA bank linking,
  Perfios, provider reports, eligibility. `app/apply/lib/constants.ts`'s
  `STEP_ORDER` and `WizardShell.tsx`'s `defaultMessages` (e.g.
  `aadhaarConsentSummary: "We will verify your identity using Aadhaar OTP
  through our secure bureau partner"` — literally false today, it's manual
  entry, no OTP, no bureau call) still carry the old copy verbatim and were
  explicitly deferred every time this session was asked to touch wording,
  per repeated prior instruction to keep Phase 5 narrowly scoped.

Do not start Perfios removal, GCS, Cloud SQL, or deployment work as part of
Phase 6 — those are Phases 7/8/24 respectively.

## 3. Architecture and data flow

### Directory map (Phase 5 additions in **bold**, unchanged from the
Phase-4 handoff otherwise)

```text
app/apply/
  _components/DocumentChecklist.tsx        Dynamic requirements/upload UI + useRequirements hook
  _components/ExistingLoansPanel.tsx       Credit declaration + facility UI
  _components/WizardShell.tsx              **Real consent+submit wiring, useConsentStatus hook,
                                               lock-version reconciliation effect**
  _components/WizardShell.phase5.test.tsx  **Consent rendering, submit success/failure,
                                               lock-version regression test**
app/api/apply/applications/current/
  consent/route.ts                         **GET/PUT — new**
  submit/route.ts                          **POST — new**
  requirements/route.ts, documents/*, credit-*                     (Phase 4, unchanged)
src/lib/apply/server/backend-proxy.ts      requestApplyBackend() / requestApplyBackendForm()
                                            APPLY_BACKEND_BASE_URL hardcoded to
                                            http://127.0.0.1:8000 — see section 1 if the port changes
src/components/apply/NavigationFooter.tsx  **Fixed: onClick always wired (was dead for
                                               variant="submit" — see section 2, bug 1)**
dsa_portal/backend/
  models/collection_submission.py          **ConsentGrantWrite, SubmitRequest**
  services/collection_submission.py        **get_consent_status, save_consent_grants,
                                               submit_application (idempotent, completeness gate)**
  routes/collection_submission.py          **Phase 5 route surface**
  services/collection_application.py       **ApplicationLockedError, _guard_not_submitted()**
  services/collection_requirements.py      **_remove_stored_objects() — post-commit deletion (P4-H01)**
  db/collection_models.py                  **ConsentPurpose, ConsentGrant ORM**
  tests/test_collection_submission_flow.py **Phase 5 + submitted-lock + lock-version contract tests**
  tests/test_collection_requirements_flow.py  **+4 P4-H01 consistency tests**
database/seeds/001_collection_flow.sql     **+destinations row (consent_grants FK dependency)**
database/tests/test_collection_seed.py     **+assertion for the destinations row**
HANDOFF.md                                 This file — read first
PHASE4_COMPLETION_GATE.md                  Phase 4 closure record (hardening findings table
                                            in section 6 below supersedes its H01 entry)
```

### Request flow (Phase 5 additions)

The review/submit step reads `application`, `requirements`, and
`consentStatus` — three independently-fetched snapshots of the same backend
row (see section 2, bug 3, for why they must be kept reconciled; the fix is
in place, don't remove the reconciliation effect without understanding why
it exists). On Submit: `PUT consent` (grants) → `POST submit` → on success,
internal `submissionResultState` holds the real `{application_no, status,
submitted_at}` and the wizard advances to `submission_result`.

### Persistence model

Unchanged from the Phase 4 handoff — local files under
`dsa_portal/backend/.local_documents/`, `documents.gcs_bucket = "local"`,
same column shape a future `GCSStorage` will populate.

## 4. Verification snapshot (current working tree)

- Backend: `python -m unittest discover -s tests` from `dsa_portal/backend`
  → **112/112 pass**, against `navdhan_test` (auto-bootstrapped).
- Frontend: `npx vitest run` → **137/137 pass**. `npx tsc --noEmit
  --incremental false` clean. `npx next build` clean, all Phase 5 routes
  present (`.../consent`, `.../submit`).
- Database: `python -m unittest discover -s database/tests` → **23/23
  pass**.
- `git diff --check` → exit 0 (only pre-existing LF/CRLF warnings).
- Live-tested against the real running backend and the real dev Postgres
  database (not just the test DB) — full application journey through
  submit, idempotent resubmit, post-submit mutation rejection (409 on all
  13 mutation endpoints), genuine stale-version rejection across different
  endpoints. See section 2 for what each of those proved.
- **Still not done**: the Phase 4 gate's 17-check × 3-constitution manual
  browser smoke matrix has *never* been run, across this entire project
  history. Every "live" verification so far has been curl/Python-script
  driven directly against the FastAPI backend, not a real browser exercising
  `WizardShell.tsx`. This is the single largest unverified gap before
  calling any of Phases 4–5 "locally accepted" per Phase 8's definition.
  Don't claim it passed — it hasn't been attempted.
- No document has ever been uploaded through the actual multipart UI flow
  end-to-end in this project's live-testing history either — every
  "complete application" reached during live verification got there by
  directly waiving `application_requirements.status` via SQL (mirroring
  what the automated test suite does), specifically to avoid re-deriving
  Phase 4's already-extensively-unit-tested coverage engine. That engine
  itself is well covered by `test_collection_requirements_flow.py`; what's
  unverified is the multipart upload path wired through the real Next.js
  proxy and a real browser `<input type="file">`.

## 5. Key decisions and constraints

Everything from the end-of-Phase-4 handoff still applies (collection-only
boundary, PAN/Aadhaar identifier separation, optimistic locking mandatory,
tenant context transaction-local, sensitive values never logged/localStorage'd,
document requirements driven entirely by `application_requirements`,
coverage dates supplied by the uploader not inferred, `.env`
`override=False`, backend tests never touch the dev database, crypto
validated at startup, local file deletion containment-guarded). Additions
from Phase 5:

- **Consent is granted once per application by the primary applicant only**
  — a product judgment call made and confirmed with the user during Phase 5
  (co-applicant/director parties don't get their own consent screen).
  `consent_grants.person_id` is always the primary party's.
- **A submitted application is immutable.** Every mutation path must run
  through `_guard_not_submitted()` (directly, or via
  `_application_for_write`, which already calls it). Any *new* mutation
  endpoint added in Phase 6 that bypasses the shared helper (as
  `save_loan_intent` historically did) must call the guard explicitly, or
  it silently reopens the "submitted apps stay editable" bug from section
  2.
- **`application`, `requirements`, and `consentStatus` must stay
  lock-version-reconciled.** If Phase 6 adds a fourth independently-fetched
  slice of the same `loan_applications` row (unlikely, but possible if a
  new panel/step is added), it needs to be folded into the reconciliation
  `useEffect` in `WizardShell.tsx`, not just its own isolated fetch/mutate
  cycle.
- **Document deletion is commit-ordered, not delete-then-hope.** Any new
  code path that deletes a stored document must capture the object key(s)
  inside the transaction and call `_remove_stored_objects()` (or the same
  pattern) after the `tenant_session` block exits, never inside it.
- Notice text (`consent_purposes.notice_text`) and display label
  (`display_name`) are logically distinct even though today's seed makes
  them identical — don't assume they'll always match.

## 6. Gotchas and lessons learned (additions since Phase 4)

- **The dev database needs seed re-application independently of the test
  database.** `ensure_test_schema()` re-runs
  `database/seeds/001_collection_flow.sql` against `navdhan_test`
  automatically on every test run (it's idempotent — `ON CONFLICT DO
  UPDATE`/`DO NOTHING` throughout). The dev `postgres` database does not
  get this automatically; a human (or agent) must re-run
  `psql -f database/seeds/001_collection_flow.sql -d postgres` by hand
  after any seed-file change. This is exactly how the missing-`destinations`
  bug in section 2 went undetected by 104 passing backend tests — they all
  ran against the auto-seeded test DB.
- **A shared `lock_version` column read through multiple independently-
  fetched frontend objects is a trap.** If two or more pieces of frontend
  state each hold their own copy of the same backend optimistic-lock
  counter, any write through one of them silently invalidates the others'
  copies unless something actively reconciles them. This class of bug is
  invisible until a later phase adds the first code path that reads a
  now-stale copy — exactly what happened between Phase 4 (write paths that
  advance `requirements.lock_version`) and Phase 5 (the first code to read
  `application.lock_version` after those writes had already run).
- **A UI element that renders correctly can still be dead.** The Submit
  button existed, was styled, was clickable in the DOM sense, passed no
  test that would have caught it (nothing exercised `review_submit` before
  Phase 5) — and had literally never fired its handler, in any phase, ever.
  `type="submit"` outside a `<form>` is inert; nothing in this codebase
  wraps `WizardShell` in a `<form>`. Any future button using
  `variant="submit"`-style patterns in `NavigationFooter` needs an explicit
  `onClick`, full stop.
- **"Use `application_requirements` as the completeness authority" applies
  recursively, not just to documents.** The KYC-identifier gate (section 2,
  bug 4) initially hardcoded "every party needs PAN+Aadhaar" instead of
  deriving *which* parties need them from `application_requirements` rows —
  the same authority principle the plan states for documents applies to any
  completeness check that has a corresponding requirement row.
- Existing Phase 0–4 gotchas (PowerShell call-operator quoting, port 55432
  already running, `--no-verify` push needing a real fix, legacy test
  discovery pollution, migration checks to preserve, PAN ownership-conflict
  directionality, constitution/GST-switch cleanup, proxy not trusting
  client-supplied role, component-test gaps letting real bugs ship
  unnoticed) all still hold — see git history at `d4450d2`.

### Hardening findings (P4-H01–H05) — current disposition

Originally recorded in `PHASE4_COMPLETION_GATE.md`. Re-verified and updated
this pass:

| ID | What it addresses | Status | Before local acceptance? | Before production? | Effort |
|---|---|---|---|---|---|
| P4-H01 | Delete-before-commit divergence between DB and local file | **Closed this pass** — see section 2, bug 6 | — | — | Done |
| P4-H02 | `anyio` resource-cleanup warnings on startup-failure tests | Open, unchanged; still benign (test teardown, not a lifespan leak) | No | No | ~30 min to confirm+silence |
| P4-H03 | 4 high-severity npm advisories (`postcss`, `sharp`) | Open; **re-verified `npm audit fix` now offers a semver-compatible fix for both** — cheaper than `PHASE4_COMPLETION_GATE.md`'s original "may need a framework upgrade" note | No | Yes | ~15–30 min + full frontend re-verify (sharp ships native binaries — re-check the OpenNext/Cloudflare build after) |
| P4-H04 | No Python vulnerability-audit tooling installed | Open; confirmed neither `pip-audit` nor `safety` is in `.venv` | No | Yes | ~15 min to install+run; remediation unknown until it runs |
| P4-H05 | No request rate limiting on collection endpoints | Open by design (not in Phases 0–4 scope); confirmed zero rate-limiting code exists anywhere in the backend | No | **Yes — top priority of the five** | ~half day for basic per-IP/session limits + tests |

None of these block Phase 6. P4-H03/H04 are now cheap enough that leaving
them open is mostly inertia.

## 7. File-level notes for future work

Everything from the Phase 4 handoff still applies. Additions:

- `dsa_portal/backend/services/collection_submission.py` is the Phase 5
  business-logic seam — parallel to `collection_application.py` and
  `collection_requirements.py`, not merged into either. Keep that split for
  Phase 6.
- `_guard_not_submitted()` lives in `services/collection_application.py`
  (not `collection_submission.py`) because it's called from
  `_application_for_write`, the shared helper every other service module
  imports. Don't duplicate it elsewhere.
- `WizardShell.tsx`'s lock-version reconciliation `useEffect` (search for
  "three separately fetched/mutated snapshots" in the file) is load-bearing
  — it's what makes the three-way `application`/`requirements`/
  `consentStatus` split safe to keep. Removing it without replacing the
  underlying single-source-of-truth problem reintroduces section 2's bug 3.
- `NavigationFooter.tsx`'s `variant` prop now only affects whether the
  chevron icon renders — `type` is always `"button"` and `onClick` is
  always wired. If a future change reintroduces a real `<form>` wrapper
  around the wizard, revisit whether `type="submit"` should come back (it
  would then need an `onSubmit` on that form, not rely on default
  first-button-triggers-submit browser behavior).
- `app/apply/lib/storage.ts`'s `saveDraftValues`/`loadDraftValues` are dead
  code (see section 2's Phase 6 entry) — don't assume they're wired to
  anything just because they're tested (`storage.phase3.test.ts` only tests
  the functions in isolation, not their usage).
- `app/apply/lib/constants.ts`'s `STEP_ORDER` and `WizardShell.tsx`'s
  `defaultMessages` still contain OTP/eKYC/fetching/bank-linking language
  that plan §21 explicitly requires be replaced — this is now Phase 6's
  most concrete, unambiguous starting task.

## 8. Open questions and ambiguities

Carried over, still open: exact final UI wording (Phase 6's own job to
resolve, not pre-empt), PostgreSQL version for eventual GCP acceptance
(local dev is 18; original plan says 16), Next 15 security-advisory upgrade
path (see P4-H03 above — now knowably cheaper than previously thought),
Perfios deletion import/call-site graph (Phase 7).

From Phase 5:

- Coverage-completeness semantics (unchanged from Phase 4) still aren't a
  signed-off product rule — flag before Phase 8 acceptance.
- Whether all ten existing-facility fields should really be required (vs.
  some optional) — still a judgment call from the Phase 4 gate-closure
  pass, not re-litigated.
- Whether `saveDraftValues`/`loadDraftValues` (dead code) should be deleted
  or wired up for genuine same-browser resume is a Phase 6 product
  decision, not something to assume either way.
- Whether the `bank_linked`/`bank_consent`/`linkBankLabel`-family dead
  fields/messages should be deleted outright or repurposed is likewise a
  Phase 6 call.

## 9. Immediate next steps

1. **Run the manual vertical-slice smoke matrix first**, before writing any
   Phase 6 code. It has never been run, for any phase, in this project's
   history — every "live" check so far has been script-driven against the
   API directly. The Phase 4 gate's 17 checks (see
   `PHASE4_COMPLETION_GATE.md`) plus a walk through consent → submit → the
   real `application_no` display, across all three constitutions, in an
   actual browser. Confirm `curl http://127.0.0.1:8000/health` returns
   `{"status":"ok"}` first (see section 1).
2. Re-apply the seed to the dev DB if it's a fresh environment or hasn't
   been touched since Phase 5 (`psql -f
   database/seeds/001_collection_flow.sql -d postgres`) — otherwise consent
   save will 500 with a foreign-key violation (section 2).
3. Start Phase 6 with the wording table in plan §21 — it's the one item in
   this phase's scope confirmed *not* already satisfied by earlier phases
   (see section 2's Phase 6 entry for what's likely already done vs. not).
   `STEP_ORDER` in `app/apply/lib/constants.ts` and `defaultMessages` in
   `WizardShell.tsx` are the concrete files.
4. Verify (don't assume) the localStorage and bank-linking items in plan
   §23 are actually satisfied per section 2's analysis above, then decide
   what to do with the dead code either way — delete or genuinely wire up.
5. Add RED integration/component tests first for any new Phase 6 behavior,
   pointed at `navdhan_test` via `db_test_support.py` from the start (backend)
   or mocking `@/app/apply/lib/api` (frontend), matching the established
   pattern in every phase so far.
6. Do not start Perfios removal, Cloud SQL, or GCS until Phase 6 passes its
   own gate (complete browser flow works locally) and the user explicitly
   says to proceed.
7. Consider committing Phases 4 and 5 (currently ~48 uncommitted paths
   sitting on top of `d4450d2`) before starting Phase 6 — ask the user
   first; this session did not commit anything and was never asked to.
