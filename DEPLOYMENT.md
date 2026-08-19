# NavDhan release and deployment runbook

This runbook is the release authority for the collection-only application.
Commands below are instructions for an approved operator; preparing this file
does not authorize or perform a cloud change.

The legacy DSA database and Vite/Perfios portal are not part of this release.
Do not migrate or layer the new schema over their tables. Production preserves
the legacy `navdhan` database in place and installs this release only in the
separate `navdhan_collection` database.

The supplied `gcp.md` is a historical handoff snapshot and is internally
inconsistent about whether production is provisioned. This tracked runbook and
fresh read-only `gcloud`/SQL evidence are authoritative; never infer current
cloud state from that snapshot. In particular, do not assume the production
`navdhan` database is empty. The release runner intentionally rejects any
non-empty database without this branch's ledger.

> **Current hard blocker:** the branch quarantines every new PDF, but no malware
> scanner dispatcher/service or scanner IAM path is provisioned. Until a
> scanner is deployed and the quarantine-to-clean flow passes staging, uploads
> remain unusable and no backend or Worker revision may receive production
> traffic.

## Fixed production topology

| Resource | Production value |
| --- | --- |
| GCP project | `kubardevops` |
| Cloud SQL instance | `navdhan-prod` |
| Connection name | `kubardevops:asia-south1:navdhan-prod` |
| Engine | PostgreSQL 18 |
| Collection database | `navdhan_collection` |
| Protected legacy database | `navdhan` (never modified by this release) |
| Runtime role | `navdhan_collection_app` |
| Document bucket | `gs://navdhan-documents-prod` |
| Region | `asia-south1` |
| Cloud Run service | `navdhan-backend` |
| Cloud Run identity | `navdhan-backend-sa@kubardevops.iam.gserviceaccount.com` |

Production is intentionally `ZONAL`, not regional, and storage auto-increase is
disabled. Backups run daily at 19:00 UTC, seven are retained, PITR and deletion
protection are enabled. Those cost choices mean a zonal outage causes downtime
and a full disk takes the database offline. Alert on disk utilization at 80%.

The staging instance is `navdhan-staging`, with connection name
`kubardevops:asia-south1:navdhan-staging` and bucket
`gs://navdhan-documents-staging`. It must use a distinct staging Cloud Run
service account; a staging identity must never have access to the production
instance, bucket, or secrets.

## Non-negotiable release order

1. Merge only an approved, reproducible commit with green application,
   database, security, and build gates.
2. Rehearse the database release on a disposable database on
   `navdhan-staging`.
3. Provision and verify the staging malware scanner and its isolated IAM path.
4. Rebuild the stale staging database from the current upward migrations and
   immutable seed; run the complete staging acceptance matrix, including the
   quarantine-to-clean and infected-file paths.
5. Verify production backup/PITR, bootstrap the confirmed-empty production
   `navdhan_collection` database, and run read-only verification directly as
   `navdhan_collection_app`.
6. Build a Cloud Run candidate with **zero traffic** and smoke-test its tagged
   revision.
7. Promote the backend, observe it, then deploy the root Next.js Worker.

Rollback proceeds in reverse: Worker first, Cloud Run second. Database down
migrations are never part of deployment rollback.

These scripts are safety rails, not a production-readiness waiver. Do not
promote while the release audit still has an open blocker, including vulnerable
runtime dependencies, missing public-route rate limits/quotas, unsafe upload or
malware handling, incomplete consent/submission evidence, or failed staging
acceptance. In particular, verify rate limits on anonymous session creation and
document upload through the Worker; the backend service token does not throttle
legitimate Worker-originated abuse.

## 1. Prerequisites and identities

Required local tools are `gcloud`, the Cloud SQL Auth Proxy, PostgreSQL 18
`psql`, Bash, Python, Node/npm, and Wrangler. Pin the release to a Git commit;
never deploy a dirty worktree or a floating `latest` image.

Enable `sqladmin.googleapis.com`, `run.googleapis.com`,
`artifactregistry.googleapis.com`, `storage.googleapis.com`,
`secretmanager.googleapis.com`, `cloudbuild.googleapis.com`, and
`eventarc.googleapis.com` in
`kubardevops`.

Use separate runtime and scanner service accounts for staging and production.
The production Cloud Run backend account must have:

- `roles/cloudsql.client` with an IAM Condition restricting
  `resource.name` to `projects/kubardevops/instances/navdhan-prod` and
  `resource.service` to `sqladmin.googleapis.com`;
- object create/read/copy/delete permissions on `navdhan-documents-prod` (a
  bucket-scoped `roles/storage.objectAdmin` grant); and
- `roles/secretmanager.secretAccessor` only on the five production secrets
  listed in §5.

The production scanner must be a different identity with only the permissions
needed to consume scan jobs, read the exact `quarantine/` object generation,
and access its callback credential. It must not connect to Cloud SQL, write
`clean/` objects, deploy services, or read the backend database/encryption
secrets. Mirror these identities with staging-only grants; never share a
service account across environments.

The custom Cloud Build identity is build-only. Grant it writer access on the
`kuber` Artifact Registry repository, viewer access on the dedicated source
bucket, and log-writer access. It must not receive Cloud Run Admin, Service
Account User, Cloud SQL, document-bucket, or Secret Manager access. An approved
operator deploys the resolved image digest and binds numeric secret versions.

### Malware-scanner gate

Provision an event-driven scanner before any environment accepts uploads. A
GCS finalize event under `quarantine/` should enqueue or invoke a scanner under
the environment-specific scanner identity. The scanner must read the exact
object generation, independently calculate its SHA-256, inspect the PDF in an
isolated/sandboxed runtime, and POST one terminal verdict to
`/internal/document-scans/{document_id}/result` with
`x-navdhan-scan-token`. The payload's generation, digest, job id, and verdict
must match what the backend records; stale, conflicting, or replayed callbacks
must fail closed.

Do not grant the scanner permission to promote objects. The backend alone
copies an exact clean generation into `clean/` after accepting the verdict and
then removes the quarantine source. An infected or unreadable verdict never
creates a clean object or requirement satisfaction. Configure monitoring and a
reconciliation queue for dispatch failures, scan timeouts, callback failures,
and orphaned objects. A bucket lifecycle rule must not silently delete
quarantined bytes while the corresponding database row still says pending;
cleanup must update/audit both stores under the approved retention policy.

The repository implements quarantine, authenticated callback, backend-only
promotion, and the scanner runtime under `dsa_portal/scanner`. The two scanner
Cloud Build files publish immutable, provenance-verified images only. Private
Cloud Run candidates, Eventarc triggers,
environment-specific IAM, monitoring, and reconciliation remain external
infrastructure and remain a release blocker until provisioned and exercised in
staging.

The production `navdhan_collection_app` role and staging `navdhan_app` role are
PostgreSQL roles, not `gcloud sql users` users. The latter would receive
`cloudsqlsuperuser`, defeating row-level security. Verify the production role
as an administrative database user:

```sql
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname = 'navdhan_collection_app';

SELECT parent.rolname AS inherited_role
FROM pg_auth_members membership
JOIN pg_roles member ON member.oid = membership.member
JOIN pg_roles parent ON parent.oid = membership.roleid
WHERE member.rolname = 'navdhan_collection_app';
```

It must be `LOGIN` with every privilege flag in that result false and no role
memberships (especially not `cloudsqlsuperuser`, `pg_read_all_data`, or
`pg_write_all_data`). If the role does not yet exist, create it in SQL with a
generated password and:

```sql
CREATE ROLE navdhan_collection_app
  LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE
  PASSWORD '<generated-and-not-logged>';
```

The password goes into Secret Manager; never put it in Git, a command argument,
or shell history.

## 2. Database release tooling

`database/scripts/release.sh` is the only supported cloud schema runner. It
applies `database/migrations/*.up.sql` then `database/seeds/*.sql`, both in
filename order. It never discovers or executes a down migration.

The runner is idempotent after a successful release and deliberately
fail-closed in ambiguous cases:

- a non-empty database without its release ledger is rejected, which blocks
  accidental installation over the legacy schema;
- every file is recorded with its SHA-256 checksum and cannot be mutated or
  removed later;
- an advisory lock prevents concurrent releases;
- an interrupted file remains `applying` and stops later attempts; and
- PostgreSQL 18, database name, environment/connection pair, migration owner,
  role safety, grants, RLS tenant context, and required seed counts are checked.

If a file remains `applying`, do not manually flip it to `applied`. Preserve
the error and logs, inspect which statements committed, then either repair with
a reviewed forward migration or restore/recreate the database. Migration 003
uses `CREATE INDEX CONCURRENTLY`, so assuming whole-file transactionality is
unsafe.

Run the static database tests before connecting to a cloud database:

```bash
python -m unittest discover -s database/tests -v
bash -n database/scripts/*.sh
shellcheck database/scripts/*.sh
```

## 3. Staging rehearsal and required rebuild

Staging contains the superseded 60-row checklist. The current seed is
upsert-only and cannot remove those stale rows, so re-seeding is forbidden.
Rebuild it from the current branch.

### Disposable rehearsal

First create an empty database named with the prefix
`navdhan_rehearsal_` on `navdhan-staging`, such as
`navdhan_rehearsal_20260819`. This proves the release without touching the
existing staging database. In one terminal, start the Auth Proxy and leave it
running:

```bash
export NAVDHAN_PROXY_SOCKET_ROOT="/tmp/navdhan-cloud-sql-$(id -u)"
install -d -m 700 "$NAVDHAN_PROXY_SOCKET_ROOT"
cloud-sql-proxy --unix-socket "$NAVDHAN_PROXY_SOCKET_ROOT" \
  kubardevops:asia-south1:navdhan-staging
```

In a second terminal, derive the same socket root and set the non-secret
connection metadata:

```bash
export NAVDHAN_PROXY_SOCKET_ROOT="/tmp/navdhan-cloud-sql-$(id -u)"
export TARGET_ENV=rehearsal
export CLOUD_SQL_CONNECTION_NAME=kubardevops:asia-south1:navdhan-staging
export PGHOST="$NAVDHAN_PROXY_SOCKET_ROOT/$CLOUD_SQL_CONNECTION_NAME"
export PGPORT=5432
unset PGHOSTADDR PGSERVICE PGSERVICEFILE
export PGUSER=postgres
export PGDATABASE=navdhan_rehearsal_20260819
export RUNTIME_ROLE=navdhan_app
database/scripts/release.sh
```

Supply the administrative password through a protected `.pgpass`/`PGPASSFILE`
or load `PGPASSWORD` with a hidden prompt; never put it in a command argument
or shell history. Neither script prints it. Then reconnect with the runtime
password and verify the real RLS path:

```bash
export PGUSER=navdhan_app
database/scripts/verify-runtime.sh
```

Repeat `release.sh` as the admin role to prove it is a no-op. Keep the rehearsal
database until its logs and results are reviewed, then explicitly delete only
that named disposable database.

### Rebuild `navdhan` on staging

After rehearsal approval:

1. Confirm staging has no canonical or user data and remove all staging
   backend traffic.
2. Take and verify a staging backup/export for forensic recovery.
3. Delete only the `navdhan` database on `navdhan-staging`, recreate it empty,
   and verify the connection name again. Never delete the instance.
4. Run the same release with `TARGET_ENV=staging` and
   `PGDATABASE=navdhan`.
5. Reconnect as `navdhan_app`, run `verify-runtime.sh`, deploy a zero-traffic
   staging backend, and complete all three constitutions, upload/delete,
   resume, concurrency, submission, immutability, RLS, and session-isolation
   acceptance tests against staging Cloud SQL and staging GCS. A clean test PDF
   must move from an immutable `quarantine/` generation to `clean/` only after
   the authenticated scanner verdict. Infected/unreadable files must never
   satisfy a requirement and must be deleted or retained only under the
   approved quarantine incident policy.

Build the staging image from the approved commit through the
repository-connected staging trigger. The trigger supplies Cloud Build's
full `COMMIT_SHA`; direct `gcloud builds submit` is forbidden because a caller
could otherwise label arbitrary local bytes as an approved commit:

```bash
test -z "$(git status --porcelain --untracked-files=all)"
gcloud builds triggers run navdhan-backend-staging-build \
  --project=kubardevops \
  --region=asia-south1 \
  --sha="$(git rev-parse HEAD)"
```

Do not bootstrap production until that matrix passes on the exact commit being
released.

## 4. Production bootstrap and backup/PITR gate

Production must start this release in an empty PostgreSQL 18
`navdhan_collection` database. The existing `navdhan` database contains the
legacy DSA loan and borrower data and is protected: never delete, rename,
truncate, migrate, or install this release into it. Both databases live on the
same protected instance, but use distinct runtime roles and credentials. No
legacy rows are migrated into the collection schema.

After emptiness is confirmed and the staging gate is signed off, create an
on-demand backup of the empty database and bind the preflight to the exact ID
returned by that operation. Wait until that backup, not merely an older
scheduled backup, reaches `SUCCESSFUL`; this proves there is a recent clean
restore point before bootstrap. Then run the read-only cloud preflight:

```bash
export EXPECTED_BACKUP_ID="$(gcloud sql backups create \
  --project=kubardevops \
  --instance=navdhan-prod \
  --description="pre-bootstrap-$(git rev-parse --short=12 HEAD)" \
  --format='value(id)')"
database/scripts/check-production-preflight.sh
```

It verifies the exact project, instance, connection name, region, database,
PostgreSQL version, RUNNABLE state, automated backups, PITR, deletion
protection, seven-day backup/log retention, and the explicitly selected
successful backup completed no more than six hours earlier. Record its output,
backup ID, and the approved Git SHA in the change ticket.

For every release after launch, repeat that on-demand backup immediately before
the database release; do not merely start it. Confirm the PITR log-retention
window covers the planned deployment and rollback period.

In one terminal, start the proxy for the exact production connection and leave
it running. The release and verification scripts require the instance-named
Unix socket; a localhost TCP
port is intentionally rejected because it cannot prove which proxy target is
behind that port:

```bash
export NAVDHAN_PROXY_SOCKET_ROOT="/tmp/navdhan-cloud-sql-$(id -u)"
install -d -m 700 "$NAVDHAN_PROXY_SOCKET_ROOT"
cloud-sql-proxy --unix-socket "$NAVDHAN_PROXY_SOCKET_ROOT" \
  kubardevops:asia-south1:navdhan-prod
```

In a second terminal, derive the same socket root and run the release:

```bash
export NAVDHAN_PROXY_SOCKET_ROOT="/tmp/navdhan-cloud-sql-$(id -u)"
export TARGET_ENV=production
export CLOUD_SQL_CONNECTION_NAME=kubardevops:asia-south1:navdhan-prod
export PGHOST="$NAVDHAN_PROXY_SOCKET_ROOT/$CLOUD_SQL_CONNECTION_NAME"
export PGPORT=5432
unset PGHOSTADDR PGSERVICE PGSERVICEFILE
export PGUSER=postgres
export PGDATABASE=navdhan_collection
export RUNTIME_ROLE=navdhan_collection_app
export PRODUCTION_RELEASE_ACK=kubardevops:asia-south1:navdhan-prod/navdhan_collection
database/scripts/release.sh
```

Then reconnect directly as `navdhan_collection_app` with its separate password:

```bash
export PGUSER=navdhan_collection_app
database/scripts/verify-runtime.sh
```

The verification transaction is read-only, explicitly sets
`app.current_marketplace_id`, proves every tenant table has enabled and forced
RLS, checks grants/role safety, and confirms the runtime-visible seed shape:
one marketplace, three active checklists, 36 requirement rows, five consent
purposes, and 23 document types.

Take a second successful backup after a fresh bootstrap and before application
traffic. Remove the production acknowledgement and password from the shell
environment when finished.

## 5. Secrets and runtime configuration

Create separate Secret Manager secrets for each environment. Production uses:

| Secret Manager name | Cloud Run environment variable |
| --- | --- |
| `navdhan-prod-db-password` | `DB_PASSWORD` |
| `navdhan-prod-encryption-key` | `ENCRYPTION_KEY` |
| `navdhan-prod-lookup-hmac-key` | `LOOKUP_HMAC_KEY` |
| `navdhan-prod-apply-service-token` | `APPLY_SERVICE_TOKEN` |
| `navdhan-prod-document-scan-callback-token` | `DOCUMENT_SCAN_CALLBACK_TOKEN` |

Staging uses the same five suffixes under the `navdhan-staging-` prefix. Never
grant a staging revision access to a `navdhan-prod-*` secret.

Every Cloud Run revision must bind each secret by an explicitly reviewed
numeric version. Never deploy `:latest`: Secret Manager may resolve a different
value when an old revision starts later, making rollback nondeterministic. This
is especially dangerous for `ENCRYPTION_KEY` and `LOOKUP_HMAC_KEY`, because the
current application has no dual-key read/migration protocol. Do not rotate
either data key until such a protocol and a verified data migration exist.
Record all five numeric versions with the image digest and revision.

`ENCRYPTION_KEY`, `LOOKUP_HMAC_KEY`, `APPLY_SERVICE_TOKEN`, and
`DOCUMENT_SCAN_CALLBACK_TOKEN` must each contain at least 32 bytes of
cryptographically random material in the format expected by the application.
The two service tokens must be distinct. Back up the two data keys durably:
losing the encryption key makes PII unreadable; losing the HMAC key orphans
deterministic lookup hashes. The apply service token is separately copied into
Cloudflare as `APPLY_BACKEND_SERVICE_TOKEN`; the scanner callback token must
never be exposed to the Worker or browser.

No `PERFIOS_*` secret belongs in this service. No service-account JSON key or
`GOOGLE_APPLICATION_CREDENTIALS` belongs in the container.

Production plain environment variables are fixed by the deployment config:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `prod` |
| `HOST` | `0.0.0.0` |
| `GCS_BUCKET` | `navdhan-documents-prod` |
| `GOOGLE_CLOUD_PROJECT` | `kubardevops` |
| `DB_HOST` | `/cloudsql/kubardevops:asia-south1:navdhan-prod` |
| `DB_USER` / `DB_NAME` | `navdhan_collection_app` / `navdhan_collection` |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `4` / `1` |
| `LOG_LEVEL` | `INFO` |
| `ALLOWED_ORIGINS` | `https://navdhan.app,https://www.navdhan.app` |

With four Cloud Run instances, the configured pool can open at most 20
database connections. Cloud Run concurrency is 20 per instance. Increase
pool, concurrency, or instance limits only after checking Cloud SQL
`max_connections`, reserved connections, query latency, and memory together.

## 6. Backend build, candidate, and promotion

`dsa_portal/ci/cloudbuild-backend.yaml` is build-only. It accepts source only
from a repository-connected trigger with a full Cloud Build `COMMIT_SHA`, uses
a unique commit-plus-build image tag, requests verified build provenance, and
contains no runtime credentials or obsolete Perfios configuration. It cannot
deploy Cloud Run, change traffic, or migrate the database. The custom build
service account needs Artifact Registry write and build-log access, not Cloud
Run Admin, Service Account User, Cloud SQL, GCS document access, or Secret
Accessor.

Prerequisites are the `kuber` Artifact Registry repository, the Cloud Run
service account/IAM grants, the exact Cloud SQL attachment and bucket, the
provisioned scanner path, and all five approved numeric secret versions. Confirm
the worktree is clean, then invoke the production repository trigger for the
exact full commit from the repository root:

```bash
test -z "$(git status --porcelain --untracked-files=all)"
gcloud builds triggers run navdhan-backend-production-build \
  --project=kubardevops \
  --region=asia-south1 \
  --sha="$(git rev-parse HEAD)"
```

Record the successful build ID, full image tag, generated provenance, and
resolved `sha256:` digest. The tag is traceability metadata; deploy only the
digest. From the same clean commit, the PowerShell candidate helper validates
the production topology, exact commit-prefixed build tag, image digest, and
each numeric secret version before creating a zero-traffic revision:

```powershell
.\dsa_portal\scripts\deploy-backend.ps1 `
  -CommitSha <40-character-git-sha> `
  -ImageTag <git-sha-cloud-build-id> `
  -DbPasswordSecretVersion <number> `
  -EncryptionKeySecretVersion <number> `
  -LookupHmacKeySecretVersion <number> `
  -ApplyServiceTokenSecretVersion <number> `
  -ScanCallbackTokenSecretVersion <number>
```

Do not grant the build service account permission to run this promotion. The
operator identity must resolve the approved tag, deploy the returned digest,
and bind numeric secret versions. A direct source build or image tag deployment
is not an approved fallback.

Identify the candidate revision and assign it a temporary revision tag without
moving normal service traffic. Test its tagged URL:

- `GET /health` returns 200 without a token;
- every `/api/apply/*` request without `x-navdhan-service-token` is rejected;
- the same route with the approved token reaches normal route authentication;
- scanner callbacks reject a missing/wrong `x-navdhan-scan-token`, accept only
  the distinct scanner credential, and bind the verdict to the exact GCS
  generation and SHA-256;
- a staging-only session/upload round trip reaches the expected database and
  bucket; and
- logs contain no session identifiers, PII, credentials, or service token.

The Cloud Run service is intentionally `--allow-unauthenticated` with ingress
`all`: Cloudflare Workers is outside GCP and cannot pass Cloud Run IAM without
a separate Google credential. This does **not** make the application API
unauthenticated. FastAPI middleware must compare
`x-navdhan-service-token` against `APPLY_SERVICE_TOKEN` in constant time before
every `/api/apply` route; only `/health` is public. Do not promote a revision if
that negative test fails.

After the candidate, database, and application gates pass, record the current
revision for rollback. For an existing service, move a small percentage to the
candidate, observe errors/latency/pool usage/uploads, then move 100%. For the
first production revision, promote to 100% only after the tagged-revision
smoke test. Remove the temporary candidate tag afterward.

## 7. Cloudflare Worker

Only after the backend is healthy at 100%, set both root Next.js Worker values
as Cloudflare secrets (not dashboard-only plain variables, because Wrangler
removes variables absent from the deployed configuration):

- `APPLY_BACKEND_BASE_URL`: the canonical HTTPS Cloud Run service URL; and
- `APPLY_BACKEND_SERVICE_TOKEN`: the same pinned secret version accepted by
  the backend.

Then follow `CLOUDFLARE-DEPLOY.md`. The Worker sends the service token only on
server-to-server requests; it must never expose it to browser code, HTML,
client bundles, logs, or error responses.

The browser talks to `navdhan.app`, not directly to Cloud Run. CORS is defense
in depth only and is not the access-control boundary.

## 8. Rollback and database recovery

Normal rollback order is:

1. Roll the Cloudflare Worker back to its recorded prior version.
2. Route Cloud Run traffic back to the recorded prior revision.
3. Verify health and an end-to-end request before removing candidate tags.

Do not run `database/migrations/*.down.sql`. Releases must use backward-
compatible expand/contract migrations so both old and new application
revisions work during rollout. If a database release fails before traffic,
keep application traffic on the prior revision and repair forward. Staging may
be rebuilt again.

If production data recovery is unavoidable, restore the approved backup/PITR
point to a **new** Cloud SQL instance, validate it privately, and change the
Cloud Run socket/secret only under a separate recovery plan. A point-in-time
database restore does not roll GCS objects back; reconcile document metadata
and objects before serving traffic. Never overwrite or delete the source
instance during diagnosis.

## 9. Post-deploy checks

- Run `database/scripts/verify-runtime.sh` as `navdhan_collection_app` without changing
  rows.
- Confirm Cloud Run has only the intended Cloud SQL attachment, service
  account, secrets, environment variables, scaling limits, and traffic split.
- Confirm the backend rejects missing/incorrect service tokens and that
  `/health` remains public.
- Confirm the scanner rejects stale generation/hash callbacks and that clean,
  infected, unreadable, replayed, and failed-promotion cases remain fail-closed.
- Complete a real application, PDF upload/delete/re-upload, submission,
  refresh/resume, and two-session isolation check.
- Confirm new bytes first land at
  `quarantine/{marketplace_id}/{application_id}/{document_id}.pdf` and only a
  clean authenticated verdict produces
  `clean/{marketplace_id}/{application_id}/{document_id}.pdf`; public access
  prevention must be enforced and uniform bucket-level access enabled.
- Inspect Cloud Run/Cloud SQL metrics for 5xx responses, latency, memory,
  active connections, lock waits, disk utilization, backup success, and PITR
  health.
- Confirm both `navdhan.app` and `www.navdhan.app` route to the expected Worker
  version and record the backend revision, Worker version, Git SHA, migration
  ledger rows, backup IDs, and acceptance evidence.

## 10. Retired deployment paths

`dsa_portal/frontend` is the obsolete Vite/Perfios portal. It calls
`/api/v1/verify/*`, which the collection backend does not provide. Its Cloud
Build file is now an intentional failure guard. Do not run
`deploy-frontend*.ps1`, do not build/sync `public/apply`, and do not configure
`VITE_API_BASE_URL` or `VITE_BACKEND_URL`.

The supported frontend is the repository-root Next.js/OpenNext application on
Cloudflare Workers. The supported backend is `dsa_portal/backend` on Cloud Run.
