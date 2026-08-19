# NavDhan PostgreSQL 18 database

This directory is the authoritative collection-flow schema. It is not an
upgrade path for the legacy DSA schema: the two define incompatible tables.
Staging must be rebuilt from this directory, and production must begin with the
fresh PostgreSQL 18 `navdhan` database.

## Release rules

- PostgreSQL **18** is mandatory.
- Apply only `migrations/*.up.sql`, in filename order, followed by
  `seeds/*.sql`, in filename order.
- Never edit or delete a migration or seed after it has been released. Add the
  next numbered file instead.
- Never run `*.down.sql` against staging or production. Application rollback
  and database recovery are separate operations; see `DEPLOYMENT.md`.
- Run migrations as the same administrative database role each time. The
  service connects only as `navdhan_app`, which must remain a non-superuser
  without `BYPASSRLS`, `CREATEDB`, or `CREATEROLE`.

`scripts/release.sh` enforces these rules. It:

- verifies the guarded environment, database name, PostgreSQL major version,
  writable primary, and runtime role;
- refuses to baseline any non-empty database, preventing an accidental install
  over the legacy schema;
- holds a PostgreSQL advisory lock for the whole release;
- records filename checksums and refuses drift or missing historical files;
- leaves interrupted work in a fail-closed `applying` state instead of guessing
  whether partially completed DDL is safe to repeat;
- applies the required seed exactly once as an immutable release input;
- refreshes table, sequence, and default privileges for `navdhan_app`; and
- verifies the audited seed shape while explicitly setting the RLS tenant.

The seed is application configuration, not sample data. It creates the NavDhan
marketplace, product, five consent purposes, document catalogue, and the three
active checklists (36 requirement rows). A changed seed must be expressed as a
new numbered seed or migration; mutating an applied seed is rejected.

Privacy policy, terms of use, and credit-bureau consent are globally mandatory.
Marketing communications and GST-detail sharing are optional at the catalogue
level; application logic conditionally requires GST consent only when GST
details are supplied. Marketing consent never gates submission.

## Staging and production

Use the Cloud SQL Auth Proxy and follow the exact commands and preflight gates
in `DEPLOYMENT.md`. Both scripts require the proxy's instance-named Unix
socket, rather than an unbound localhost TCP port, so the declared connection
name and the PostgreSQL endpoint cannot accidentally refer to different Cloud
SQL instances. The release runner intentionally supports only:

- `kubardevops:asia-south1:navdhan-staging` / `navdhan`;
- a disposable `navdhan_rehearsal_*` database on that staging instance; and
- `kubardevops:asia-south1:navdhan-prod` / `navdhan`, with an additional
  production acknowledgement after backup/PITR preflight.

After release, reconnect directly as `navdhan_app` and run
`scripts/verify-runtime.sh`. Its SQL transaction is read-only and sets
`app.current_marketplace_id` before reading tenant tables, so RLS is tested
rather than accidentally bypassed.

## Local development

The existing Windows development cluster is project-local at
`database/.local/data`, port `55432`; it is not the Windows PostgreSQL service.
The historical `*.down.sql` files remain useful for disposable local databases,
but the safer reset is to drop and recreate the disposable database and apply
all current upward files. Do not copy a local reset procedure into a cloud
release.

Run static database contract tests from the repository root:

```bash
python -m unittest discover -s database/tests -v
```
