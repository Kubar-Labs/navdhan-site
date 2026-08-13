# NavDhan local PostgreSQL 18 database

This directory contains the collection-flow schema, reversible migrations,
and the minimum local seed data. The schema implements the activated tables in
`data-model-reference.md`, permits encrypted Aadhaar values, stores only browser
session token digests, and forces row-level security on tenant data.

For this collection-only iteration, checklist versions are deliberately scoped
to a specific marketplace. Global checklist rows are not enabled; this keeps
application-to-checklist product, constitution, and tenant consistency enforced
entirely through composite database foreign keys.

The commands below use the isolated local PostgreSQL 18 cluster on port `55432`.
They do not use the legacy database service.

## Start the isolated cluster

Initialize a dedicated cluster once:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\initdb.exe' -D 'database\.local\data' -U postgres --auth=trust
```

Start it for local development:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D 'database\.local\data' -l 'database\.local\postgres.log' -o '-p 55432 -h 127.0.0.1' start
```

The `.local` directory is ignored by Git.

## Apply the schema and seed

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --no-password -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f 'database\migrations\001_collection_schema.up.sql'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --no-password -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f 'database\migrations\002_application_requirement_coverage_snapshot.up.sql'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --no-password -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f 'database\migrations\003_person_email_lookup_hash.up.sql'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --no-password -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f 'database\seeds\001_collection_flow.sql'
```

Migrations `002` and `003` are safe for both freshly created and already
provisioned local schemas. The seed is transactional and idempotent, so it is
safe to apply again.

## Roll back

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --no-password -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f 'database\migrations\003_person_email_lookup_hash.down.sql'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --no-password -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f 'database\migrations\002_application_requirement_coverage_snapshot.down.sql'
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' --no-password -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f 'database\migrations\001_collection_schema.down.sql'
```

The down migration removes project tables, indexes, policies, triggers,
functions, and enum types. It intentionally leaves the shared `citext` and
`pgcrypto` extensions installed.

## Tenant context

Before application access to tenant rows, set the current marketplace inside
the transaction:

```sql
SET LOCAL app.current_marketplace_id = '00000000-0000-0000-0000-000000000000';
```

Use the real marketplace UUID. Application roles must not be superusers and
must not have row-security bypass privileges.

## Tests

```powershell
python -m unittest discover -s database\tests -v
```
