# Applying SQL migrations to kuber-db

Runbook for applying files in `infra/sql/NNN_*.sql` to both `kuber` (prod) and
`kuber_dev` (dev) on Cloud SQL. Written after migrations 019 + 020 to capture
every gotcha we hit so the next run is one shell session.

Past helpers live at `backend/_apply_migration_as_postgres.py` and
`backend/_apply_migration.py` — copy one of those into `backend/_apply_NNN.py`
and update the SQL file list at the top. Anything in `backend/_*.py` is
gitignored, so these stay local to your machine.

---

## Prerequisites

- `cloud-sql-proxy.exe` in `backend/` (or on PATH).
- `gcloud` CLI installed and an authorized NavDhan operator account (or another member of
  `kubar-protocol-main` with `cloudsql.client` + Secret Manager access).
- Python venv at `.venv/` with `asyncpg` and `python-dotenv` (already in
  `requirements.txt`).

---

## Step 1 — Unset `GOOGLE_APPLICATION_CREDENTIALS`

This env var is set **system-wide on the dev machine** pointing at a service
account key for an unrelated project (saturnintech). If left set, the proxy
and gcloud sign JWTs with the wrong key and Cloud SQL responds with
`invalid_grant: Invalid JWT Signature` — which looks like a connection-reset
in asyncpg.

Do this in **every shell** you use for migrations:

```powershell
Remove-Item Env:\GOOGLE_APPLICATION_CREDENTIALS -ErrorAction SilentlyContinue
$env:GOOGLE_APPLICATION_CREDENTIALS    # should print nothing
```

(Long-term: remove it from Windows System Properties → Environment Variables
so new shells start clean.)

---

## Step 2 — Refresh auth (only if expired)

Two independent auth tracks. Refresh whichever is expired:

- **ADC** (for cloud-sql-proxy, Secret Manager REST API, any Google client lib):
  ```powershell
  gcloud auth application-default login
  ```
- **gcloud CLI user auth** (for `gcloud secrets`, `gcloud sql`, etc.):
  ```powershell
  gcloud auth login --no-browser   # --no-browser avoids CSRF flakiness on Windows
  ```

Verify ADC is good:

```powershell
gcloud auth application-default print-access-token   # should print ya29.*…
```

If you only need migrations (not arbitrary `gcloud` commands), **only ADC is
required** — the migration script + Secret Manager REST calls below all use
ADC.

---

## Step 3 — Start cloud-sql-proxy

In a separate terminal, with `GOOGLE_APPLICATION_CREDENTIALS` unset:

```powershell
.\backend\cloud-sql-proxy.exe kubar-protocol-main:asia-south1:kuber-db --port 15432
```

Wait for `The proxy has started successfully and is ready for new connections!`

Keep the terminal open — that's where errors surface. If clients can't
connect, **look there first** (e.g. `invalid_grant` means redo Step 1 or 2).

---

## Step 4 — Get the `postgres` superuser password

DDL on the `cases` / `kyb_verifications` / etc. tables requires the `postgres`
user. The `kuber_app` user (whose password is in `.env`'s `DATABASE_URL` and
Secret Manager's `db-app-password`) has DML only — it will fail with
`must be owner of table cases`.

The current postgres password lives in Secret Manager as `db-password`.
Fetch it via REST (uses ADC, no gcloud CLI needed):

```powershell
Remove-Item Env:\GOOGLE_APPLICATION_CREDENTIALS -ErrorAction SilentlyContinue
$tok = (gcloud auth application-default print-access-token).Trim()
$h = @{ Authorization = "Bearer $tok" }
$r = Invoke-RestMethod -Headers $h -Uri `
    "https://secretmanager.googleapis.com/v1/projects/kubar-protocol-main/secrets/db-password/versions/latest:access"
$env:POSTGRES_PASSWORD = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($r.payload.data))
```

> **If that password authentication fails** for `postgres`, the secret is stale.
> Reset it — see [Step 4b](#step-4b--reset-postgres-password-if-the-secret-is-stale).

---

## Step 5 — Run the migration script

```powershell
python backend/_apply_NNN.py     # your local applier
```

A good applier:

1. Loads `DATABASE_URL` from `.env` via `python-dotenv` (uses it for host
   parsing only — user/pass come from `$env:POSTGRES_PASSWORD`).
2. Forces port `15432` and connects as `postgres` via the proxy using
   **asyncpg kwargs** (not a URL — passwords with `@`, `:`, `/` break URL
   parsing).
3. Applies each SQL file to **`kuber_dev` first**, then **`kuber`**.
4. Verifies the expected columns / tables exist after each apply.

Migration SQL must be idempotent (`IF NOT EXISTS` / `ON CONFLICT`) so re-runs
are safe.

---

## Step 4b — Reset postgres password if the secret is stale

This is what we did to unblock 019 + 020 when no available password worked.
Only do it if Step 4's pwd fails — it rotates a credential used by Cloud SQL.

The `postgres` user is admin-only; nothing in the app runs as `postgres`
(your backend uses `kuber_app`). Rotating it is safe and reversible.

```powershell
Remove-Item Env:\GOOGLE_APPLICATION_CREDENTIALS -ErrorAction SilentlyContinue
$tok = (gcloud auth application-default print-access-token).Trim()
$h = @{ Authorization = "Bearer $tok"; 'Content-Type' = 'application/json' }

# 1. Generate a strong random password
$bytes = New-Object byte[] 24
(New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
$newpw = [Convert]::ToBase64String($bytes) -replace '[+/=]',''

# 2. Reset via Cloud SQL Admin API
$body = @{ name='postgres'; password=$newpw; host='' } | ConvertTo-Json
$r = Invoke-RestMethod -Headers $h -Method Put -Body $body -Uri `
    "https://sqladmin.googleapis.com/sql/v1beta4/projects/kubar-protocol-main/instances/kuber-db/users?name=postgres&host="
"Reset op: $($r.status)"   # expect: DONE
Start-Sleep -Seconds 3

# 3. Export for the migration script
$env:POSTGRES_PASSWORD = $newpw

# 4. After migration succeeds, update Secret Manager so the next person finds it
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($newpw))
$vbody = @{ payload = @{ data = $b64 } } | ConvertTo-Json -Compress
Invoke-RestMethod -Headers $h -Method Post -Body $vbody -Uri `
    "https://secretmanager.googleapis.com/v1/projects/kubar-protocol-main/secrets/db-password:addVersion"
```

---

## Troubleshooting cheatsheet

| Symptom                                                    | Cause                                                      | Fix                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Proxy logs `invalid_grant: Invalid JWT Signature`          | `GOOGLE_APPLICATION_CREDENTIALS` set to wrong SA key       | Step 1 in the proxy's shell, then restart proxy             |
| asyncpg `ConnectionDoesNotExistError: connection was closed in the middle of operation` | Same as above — proxy can't reach Cloud SQL                | Check proxy terminal; usually the JWT issue                 |
| `password authentication failed for user "postgres"`       | Wrong / stale postgres pwd                                 | Step 4b (reset)                                             |
| `must be owner of table cases`                             | Connected as `kuber_app`, not `postgres`                   | Set `$env:POSTGRES_PASSWORD` (Step 4) before running script |
| `gcloud secrets list` → `Reauthentication failed`          | gcloud CLI auth expired                                    | `gcloud auth login --no-browser`                            |
| `getaddrinfo failed` with `@` in URL                       | Special chars in password broke URL parsing                | Use asyncpg kwargs (host/port/user/password), not a URL     |
