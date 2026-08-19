# Deployment — NavDhan Collection Flow

How to provision and deploy this application. Nothing here is hard-coded in
the source: every deployment-varying value is read from the environment, so a
new environment is a matter of provisioning resources and supplying variables.

The system is two deployable units plus two data stores:

| Unit | What it is | Where it runs |
| --- | --- | --- |
| Next.js app | Marketing site + the `/apply` flow and its API routes | Cloudflare Workers (OpenNext) |
| FastAPI backend | `dsa_portal/backend` — the collection API | Cloud Run (containerised) |
| PostgreSQL 18 | Application data | Cloud SQL |
| Object storage | Uploaded PDFs | Google Cloud Storage |

The browser talks only to the Next.js app. Next's server-side route handlers
proxy to the FastAPI backend; the backend is never called directly from a
browser.

---

## 1. Prerequisites

- A GCP project with billing enabled.
- APIs enabled: `sqladmin.googleapis.com`, `run.googleapis.com`,
  `storage.googleapis.com`, `secretmanager.googleapis.com`.
- **PostgreSQL 18 is mandatory.** The schema and its tests are written against
  18 and must not be provisioned on 16 or 17.
- The Cloud SQL Auth Proxy, for applying migrations from an operator machine.

---

## 2. Provision the database

Create a Postgres 18 instance. Sizing is a judgement call, but note two
things that are easy to get wrong:

- **Storage can be increased but never decreased**, and 10 GB is the floor.
- If storage auto-increase is disabled and the disk fills, the instance goes
  **offline** rather than growing. Leave auto-increase on in production.
- Shared-core tiers (`db-f1-micro`, `db-g1-small`) are excluded from the Cloud
  SQL SLA. Fine for staging; not for production.

`max_connections` must cover `(DB_POOL_SIZE + DB_MAX_OVERFLOW) x number of
running backend instances`. Each Cloud Run container opens its own pool, so
this is a function of how far the service scales, not of how many users there
are. Size the instance and the pool together — see §7.

### Database and runtime role

Create the application database, then create the runtime role **in SQL**, not
with `gcloud sql users create`: that command grants `cloudsqlsuperuser`, and
the application must not run as a superuser.

```sql
CREATE ROLE <app_role> WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  PASSWORD '<generated>';
GRANT CONNECT ON DATABASE <database> TO <app_role>;
GRANT USAGE ON SCHEMA public TO <app_role>;
```

### Schema and seed data

Apply, in order, connected as an admin role through the proxy:

1. Every file in `database/migrations/*.up.sql`, in filename order.
2. `database/seeds/001_collection_flow.sql`.

The seed is **required**, not sample data. It creates the marketplace row, the
document type catalogue, consent purposes, and the document checklist. Without
it the backend starts successfully and then fails on the first request.

Then grant the runtime role its privileges — after the schema exists, or there
is nothing to grant on:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO <app_role>;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO <app_role>;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO <app_role>;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO <app_role>;
```

The `ALTER DEFAULT PRIVILEGES` statements matter: `ON ALL TABLES` only covers
tables that exist at the time it runs, so without them a future migration
produces tables the application cannot read.

---

## 3. Provision object storage

Create a bucket for uploaded documents. It holds customer KYC and financial
documents, so:

- Enable **uniform bucket-level access** and **public access prevention**.
- Use a separate bucket per environment. Never share one between staging and
  production.
- Keep it in the same region as the database and the backend.

Objects are written under `{marketplace_id}/{application_id}/{document_id}.pdf`.

---

## 4. Secrets

These must come from Secret Manager and be injected into the backend at
deploy time. None may be committed or logged.

| Secret | Notes |
| --- | --- |
| `ENCRYPTION_KEY` | 32-byte AES-256 key, base64-encoded. Encrypts PII at rest. |
| `LOOKUP_HMAC_KEY` | 32-byte key, base64-encoded. Deterministic hashes for duplicate detection. |
| Database password | For the runtime role created in §2. |

Generate the keys with:

```bash
python -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())"
```

> **Back both keys up somewhere durable before going live.** Losing
> `ENCRYPTION_KEY` makes every encrypted row permanently unreadable; losing
> `LOOKUP_HMAC_KEY` orphans every existing lookup hash. Neither can be
> recovered from the database, and rotating either has the same effect as
> losing it unless the data is re-encrypted first.

---

## 5. Deploy the backend

The image is built from `dsa_portal/backend/Dockerfile`. It runs uvicorn as a
non-root user and takes its bind address and port from `$HOST` and `$PORT`,
which is what lets Cloud Run inject its own port.

Attach the Cloud SQL instance to the service so the connector mounts a unix
socket into the container, and set `DATABASE_URL` to the socket form:

```
postgresql+asyncpg://<app_role>:<password>@/<database>?host=/cloudsql/<project>:<region>:<instance>
```

The service account needs:

- `roles/cloudsql.client` on the project
- `roles/storage.objectAdmin` on the document bucket

**Leave `GOOGLE_APPLICATION_CREDENTIALS` unset.** The attached service account
supplies credentials automatically; a key file inside an image is a
credential-leak path.

The backend validates its configuration at startup — it opens a real database
connection and checks both encryption keys before serving traffic. A
misconfigured deployment fails immediately and visibly rather than at the
first request.

---

## 6. Deploy the frontend

Built and deployed with the OpenNext Cloudflare adapter (`npm run deploy:cf`);
see `CLOUDFLARE-DEPLOY.md` for the mechanics.

`APPLY_BACKEND_BASE_URL` must be set as a Worker variable, pointing at the
backend's URL. It is required — there is deliberately no fallback, because a
default would make a deployed Worker fetch itself instead of the backend and
fail as an opaque timeout rather than a configuration error.

**`dsa_portal/frontend` is not deployed.** It is the legacy verification
portal and calls `/api/v1/verify/*`, which this backend does not serve. Its
`VITE_*` variables have no working value against the collection API.

---

## 7. Environment variables

Read by the **backend**. `dsa_portal/backend/.env.example` is the canonical
list; this table is the deployment view.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes¹ | none | Full DSN. Must use the `postgresql+asyncpg://` scheme. |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | yes¹ | port 5432 | Alternative to `DATABASE_URL`; a `DB_HOST` starting with `/` is treated as a Cloud SQL socket. |
| `ENCRYPTION_KEY` | yes | none | From Secret Manager. |
| `LOOKUP_HMAC_KEY` | yes | none | From Secret Manager. |
| `GCS_BUCKET` | yes | none | Document bucket name. |
| `GOOGLE_CLOUD_PROJECT` | no | — | Read by the Google client libraries. |
| `DB_POOL_SIZE` | no | 10 | Connections held open per process. |
| `DB_MAX_OVERFLOW` | no | 10 | Additional connections a process may open under load. |
| `HOST` / `PORT` | no | `0.0.0.0` / 8000 | Cloud Run injects `PORT`. Never set `HOST` to a loopback address in a container — health checks cannot reach it. |
| `LOG_LEVEL` | no | `INFO` | An unrecognised value falls back to `INFO` rather than failing. |
| `APP_ENV` (or `ENV`) | no | `dev` | `APP_ENV` wins if both are set. |
| `ALLOWED_ORIGINS` | no | `*` | Comma-separated, or `*`. See the note below. |

¹ Either `DATABASE_URL`, or all of `DB_HOST` / `DB_USER` / `DB_NAME`.
`DATABASE_URL` wins when both are present. There is no built-in default: a
missing value fails at startup.

Read by the **frontend**: `APPLY_BACKEND_BASE_URL` (required, see §6).

**On `ALLOWED_ORIGINS`:** it configures CORS, but CORS is not the access
control here. The browser calls the Next.js app, which calls the backend
server-side, so CORS is never evaluated on the real request path. Restricting
it does not protect the backend — see §8.

---

## 8. Before the backend is publicly reachable

**Service-to-service authentication is not implemented.** Once the backend has
a public URL, the only thing in front of it is a session digest supplied by
the client. Anyone who can reach that URL can reach the API — including the
document upload and submission endpoints.

This has to be resolved as part of the deployment, and the frontend's hosting
constrains the options. The Next.js app runs on **Cloudflare Workers**
(`wrangler.jsonc` pins `navdhan.app` and `www.navdhan.app` as custom domains),
so the two services sit on different clouds. That rules out the approach that
would otherwise be simplest — keeping the backend on internal ingress and
reaching it privately — because a Worker cannot route to a Cloud Run service
that is not on the public internet.

Given that, in order of strength:

1. **Cloudflare Tunnel, or mTLS between the Worker and Cloud Run.** The
   backend stops being reachable by anything that cannot present the right
   client certificate or tunnel identity. Most work, strongest result, no
   application code.
2. **A shared secret.** Stored as a Worker secret, sent as a header by
   `backend-proxy.ts`, verified by backend middleware before any route runs.
   Requests without it are rejected at the edge of the application. This is
   the pragmatic fit for a Workers frontend and is perhaps half a day of work
   including a test. Rotate it by setting both values, deploying, then
   removing the old one.
3. **Re-platform the frontend to Cloud Run**, and put the backend on internal
   ingress. Architecturally the cleanest and needs no application code, but it
   means abandoning the Cloudflare setup that is already configured and
   deployed. Only worth considering if the frontend is moving anyway.

Google-issued OIDC tokens are the usual answer for Cloud Run to Cloud Run, but
they do not help here: a Cloudflare Worker is not on GCP's metadata server, so
it cannot mint an identity token without a service-account credential stored
inside the Worker — which is option 2 with more moving parts and a
longer-lived secret.

Whichever is chosen, decide before the backend URL is exposed rather than
after.

**Do not copy the existing deployment on `main`.** It deploys the backend with
`--allow-unauthenticated` and lists the site's origins in `ALLOWED_ORIGINS`
(`dsa_portal/ci/cloudbuild-backend.yaml`), with the frontend reaching it by
public URL. CORS is a browser policy, not access control: it stops a page on
another origin from reading responses, and does nothing against `curl` or any
non-browser client. That backend is callable by anyone holding its URL. This
service handles Aadhaar, PAN and bank statements, so inheriting that shape by
reusing the same pipeline is worth avoiding deliberately.

Two things from that pipeline *are* worth keeping: it runs under a dedicated
service account rather than the default compute account, and it pulls secrets
from Secret Manager with `--set-secrets`. Both match §4 and §5 here.

**Rate limiting is also not implemented.** There is no throttling on the
public API surface, which matters more while the API is publicly reachable.

---

## 9. Operational notes

**Row-level security.** Tenant-scoped tables enforce RLS keyed on a session
variable. Any manual query must set it first, in the same session:

```sql
SET app.current_marketplace_id = '<marketplace uuid>';
```

Without it those tables return zero rows and look unseeded. Global reference
tables have no RLS and return rows either way, which makes a correctly seeded
database look *partially* seeded. On Cloud SQL this applies to the `postgres`
role too — it is `cloudsqlsuperuser`, not a true superuser, and the policies
are declared `FORCE`.

**The seed is upsert-only.** Re-running it inserts and updates, but never
deletes. A database seeded from an older revision of the seed file keeps rows
that were since removed from it. Such a database must be rebuilt, not
re-seeded — otherwise stale checklist rows remain live.

**Document deletion is commit-ordered.** Objects are removed from the bucket
only after the surrounding database transaction commits, so a rolled-back
request never leaves a row pointing at a deleted object. The inverse — a
failed delete after a successful commit — leaves an orphaned object, which is
logged and tolerated.

**Two values are intentionally not configurable:** the marketplace ID
(`services/collection_application.py`) and the default submission destination
(`services/collection_submission.py`). Both are primary keys of seeded rows.
Making them environment-driven would move a value that *must* match a database
row into a place where it can silently disagree with it. They change only
alongside the seed data.
