#!/usr/bin/env bash

# Apply NavDhan's forward-only database migrations and required seed files.
#
# This runner deliberately refuses to baseline a non-empty database. That is
# what prevents the collection schema from being layered over the incompatible
# legacy DSA schema. It also records a checksum before each file is applied. An
# interrupted item remains in "applying" state and requires an operator to
# inspect or restore the database; the runner never guesses whether partial DDL
# is safe to repeat.

set -Eeuo pipefail
IFS=$'\n\t'
export LC_ALL=C

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
DATABASE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
readonly DATABASE_DIR
readonly MIGRATIONS_DIR="${DATABASE_DIR}/migrations"
readonly SEEDS_DIR="${DATABASE_DIR}/seeds"
readonly MARKETPLACE_ID="10000000-0000-0000-0000-000000000001"
readonly PROD_CONNECTION="kubardevops:asia-south1:navdhan-prod"
readonly STAGING_CONNECTION="kubardevops:asia-south1:navdhan-staging"
readonly PROD_DATABASE="navdhan_collection"
readonly PROD_RELEASE_ROLE="navdhan_collection_release"
readonly PROD_RUNTIME_ROLE="navdhan_collection_app"
readonly NONPROD_RUNTIME_ROLE="navdhan_app"
readonly PROD_ACK="kubardevops:asia-south1:navdhan-prod/navdhan_collection"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

require_variable() {
  local name="$1"
  [[ -n "${!name:-}" ]] || die "Required environment variable is not set: ${name}"
}

sha256_file() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -- "$path" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -- "$path" | awk '{print $1}'
  else
    die "sha256sum or shasum is required"
  fi
}

validate_target() {
  require_variable TARGET_ENV
  require_variable CLOUD_SQL_CONNECTION_NAME
  require_variable PGHOST
  require_variable PGPORT
  require_variable PGUSER
  require_variable PGDATABASE
  require_variable RUNTIME_ROLE

  [[ "$PGDATABASE" != "postgres" && "$PGDATABASE" != "template0" && "$PGDATABASE" != "template1" ]] ||
    die "Refusing to install application tables in ${PGDATABASE}"

  case "$TARGET_ENV" in
    production)
      [[ "$CLOUD_SQL_CONNECTION_NAME" == "$PROD_CONNECTION" ]] ||
        die "Production connection must be ${PROD_CONNECTION}"
      [[ "$PGDATABASE" == "$PROD_DATABASE" ]] ||
        die "Production database must be ${PROD_DATABASE}; legacy navdhan is protected"
      [[ "$RUNTIME_ROLE" == "$PROD_RUNTIME_ROLE" ]] ||
        die "Production RUNTIME_ROLE must be ${PROD_RUNTIME_ROLE}"
      [[ "$PGUSER" == "$PROD_RELEASE_ROLE" ]] ||
        die "Production PGUSER must be ${PROD_RELEASE_ROLE}"
      [[ "${PRODUCTION_RELEASE_ACK:-}" == "$PROD_ACK" ]] ||
        die "Set PRODUCTION_RELEASE_ACK=${PROD_ACK} after completing the production preflight"
      ;;
    staging)
      [[ "$CLOUD_SQL_CONNECTION_NAME" == "$STAGING_CONNECTION" ]] ||
        die "Staging connection must be ${STAGING_CONNECTION}"
      [[ "$PGDATABASE" == "navdhan" ]] || die "Staging database must be navdhan"
      [[ "$RUNTIME_ROLE" == "$NONPROD_RUNTIME_ROLE" ]] ||
        die "Staging RUNTIME_ROLE must be ${NONPROD_RUNTIME_ROLE}"
      ;;
    rehearsal)
      [[ "$CLOUD_SQL_CONNECTION_NAME" == "$STAGING_CONNECTION" ]] ||
        die "Rehearsals must run on ${STAGING_CONNECTION}"
      [[ "$PGDATABASE" == navdhan_rehearsal_* ]] ||
        die "A rehearsal database name must start with navdhan_rehearsal_"
      [[ "$RUNTIME_ROLE" == "$NONPROD_RUNTIME_ROLE" ]] ||
        die "Rehearsal RUNTIME_ROLE must be ${NONPROD_RUNTIME_ROLE}"
      ;;
    *)
      die "TARGET_ENV must be production, staging, or rehearsal"
      ;;
  esac

  local socket_suffix="/${CLOUD_SQL_CONNECTION_NAME}"
  [[ "$PGHOST" == /* && "$PGHOST" == *"$socket_suffix" ]] ||
    die "PGHOST must be the Auth Proxy Unix-socket directory ending in ${socket_suffix}"
  [[ "$PGHOST" != *,* ]] ||
    die "PGHOST must contain exactly one guarded Unix-socket directory"
  [[ "$PGPORT" == "5432" ]] ||
    die "PGPORT must be 5432 for the guarded Auth Proxy Unix socket"
  [[ -z "${PGHOSTADDR:-}" ]] ||
    die "PGHOSTADDR must be unset because it can bypass the guarded Unix socket"
  [[ -z "${PGSERVICE:-}" && -z "${PGSERVICEFILE:-}" ]] ||
    die "PGSERVICE and PGSERVICEFILE must be unset because service parameters can override the guarded endpoint"
  [[ -S "${PGHOST}/.s.PGSQL.${PGPORT}" ]] ||
    die "Cloud SQL Auth Proxy socket is not ready at ${PGHOST}/.s.PGSQL.${PGPORT}"
}

sql_quote() {
  # Repository-controlled filenames are still quoted before being placed in
  # the generated psql plan. Newlines are rejected to keep psql meta-commands
  # unambiguous.
  local value="$1"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] ||
    die "SQL plan values may not contain newlines"
  printf '%s' "${value//\'/\'\'}"
}

validate_target
require_command psql
require_command awk

shopt -s nullglob
migration_files=("${MIGRATIONS_DIR}"/*.up.sql)
seed_files=("${SEEDS_DIR}"/*.sql)
shopt -u nullglob

((${#migration_files[@]} > 0)) || die "No forward migrations found"
((${#seed_files[@]} > 0)) || die "No required seed files found"

for path in "${migration_files[@]}" "${seed_files[@]}"; do
  [[ -f "$path" ]] || die "Release input is not a regular file: ${path}"
  [[ "$(basename -- "$path")" != *.down.sql ]] ||
    die "A destructive down migration entered the release plan: ${path}"
done

declare -A seen_ordinals=()
for path in "${migration_files[@]}"; do
  filename="$(basename -- "$path")"
  [[ "$filename" =~ ^([0-9]{3})_[a-z0-9_]+\.up\.sql$ ]] ||
    die "Migration filename must match NNN_name.up.sql: ${filename}"
  ordinal="${BASH_REMATCH[1]}"
  key="migration_${ordinal}"
  [[ -z "${seen_ordinals[$key]:-}" ]] ||
    die "Duplicate migration ordinal: ${ordinal}"
  seen_ordinals["$key"]="$filename"
done
for path in "${seed_files[@]}"; do
  filename="$(basename -- "$path")"
  [[ "$filename" =~ ^([0-9]{3})_[a-z0-9_]+\.sql$ ]] ||
    die "Seed filename must match NNN_name.sql: ${filename}"
  ordinal="${BASH_REMATCH[1]}"
  key="seed_${ordinal}"
  [[ -z "${seen_ordinals[$key]:-}" ]] ||
    die "Duplicate seed ordinal: ${ordinal}"
  seen_ordinals["$key"]="$filename"
done

plan_file="$(mktemp "${TMPDIR:-/tmp}/navdhan-db-release.XXXXXX.sql")"
cleanup() {
  rm -f -- "$plan_file"
}
trap cleanup EXIT

cat >"$plan_file" <<'SQL'
\set ON_ERROR_STOP on
\pset pager off
SET application_name = 'navdhan_database_release';
SET lock_timeout = '10s';
SET statement_timeout = '15min';
SET search_path = public, pg_catalog;

SELECT current_database() = :'expected_database' AS target_database_ok,
       current_setting('server_version_num')::integer / 10000 = 18 AS server_version_ok,
       NOT pg_is_in_recovery() AS writable_primary_ok
\gset target_

\if :target_target_database_ok
\else
  \echo 'ERROR: connected database does not match the guarded target'
  SELECT 1 / 0;
\endif
\if :target_server_version_ok
\else
  \echo 'ERROR: PostgreSQL server major version must be 18'
  SELECT 1 / 0;
\endif
\if :target_writable_primary_ok
\else
  \echo 'ERROR: database is a read-only recovery replica'
  SELECT 1 / 0;
\endif

SELECT count(*) = 1
       AND bool_and(rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
                    AND NOT rolcreatedb AND NOT rolcreaterole
                    AND NOT has_database_privilege(r.rolname, current_database(), 'CREATE')
                    AND NOT EXISTS (
                        SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid
                    )) AS role_is_safe
FROM pg_roles r
WHERE r.rolname = :'runtime_role'
\gset role_
\if :role_role_is_safe
\else
  \echo 'ERROR: runtime role is missing or has unsafe privileges'
  SELECT 1 / 0;
\endif

SELECT current_user <> :'runtime_role'
       AND has_database_privilege(current_user, current_database(), 'CREATE')
       AS release_admin_ok
\gset admin_
\if :admin_release_admin_ok
\else
  \echo 'ERROR: migrations require a distinct administrative database role'
  SELECT 1 / 0;
\endif

-- Hold one database-wide lock for the whole psql session. Fail immediately if
-- another operator already has it; PostgreSQL releases it automatically even
-- when ON_ERROR_STOP terminates the session.
SELECT pg_try_advisory_lock(177145922, 20260819) AS acquired
\gset release_lock_
\if :release_lock_acquired
\else
  \echo 'ERROR: another NavDhan database release is already running'
  SELECT 1 / 0;
\endif

SELECT to_regclass('navdhan_release.schema_history') IS NOT NULL AS history_exists
\gset bootstrap_
\if :bootstrap_history_exists
\else
  SELECT NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
  ) AND NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
  ) AND NOT EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
  ) AS public_schema_is_empty
  \gset bootstrap_
  \if :bootstrap_public_schema_is_empty
  \else
    \echo 'ERROR: public schema contains objects and has no NavDhan release ledger'
    \echo 'ERROR: rebuild staging or use a fresh production database; automatic baselining is forbidden'
    SELECT 1 / 0;
  \endif
\endif

CREATE SCHEMA IF NOT EXISTS navdhan_release;
REVOKE ALL ON SCHEMA navdhan_release FROM PUBLIC;
CREATE TABLE IF NOT EXISTS navdhan_release.schema_history (
    kind text NOT NULL CHECK (kind IN ('migration', 'seed')),
    filename text NOT NULL,
    checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
    status text NOT NULL CHECK (status IN ('applying', 'applied')),
    applied_by text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    applied_at timestamptz,
    PRIMARY KEY (kind, filename),
    CHECK ((status = 'applying' AND applied_at IS NULL)
        OR (status = 'applied' AND applied_at IS NOT NULL))
);
REVOKE ALL ON ALL TABLES IN SCHEMA navdhan_release FROM PUBLIC;

SELECT NOT EXISTS (
    SELECT 1 FROM navdhan_release.schema_history WHERE applied_by <> current_user
) AS same_migration_owner
\gset owner_
\if :owner_same_migration_owner
\else
  \echo 'ERROR: release owner differs from the role that applied existing migrations'
  SELECT 1 / 0;
\endif
SQL

item_index=0
append_release_item() {
  local kind="$1"
  local path="$2"
  local filename checksum prefix quoted_path
  filename="$(basename -- "$path")"
  checksum="$(sha256_file "$path")"
  prefix="item_${item_index}_"
  quoted_path="$(sql_quote "$path")"

  {
    printf "\\set item_kind '%s'\n" "$(sql_quote "$kind")"
    printf "\\set item_filename '%s'\n" "$(sql_quote "$filename")"
    printf "\\set item_checksum '%s'\n" "$checksum"
    cat <<SQL
SELECT EXISTS (
           SELECT 1 FROM navdhan_release.schema_history
           WHERE kind = :'item_kind' AND filename = :'item_filename'
       ) AS exists,
       COALESCE((
           SELECT checksum_sha256 <> :'item_checksum'
           FROM navdhan_release.schema_history
           WHERE kind = :'item_kind' AND filename = :'item_filename'
       ), false) AS checksum_mismatch,
       COALESCE((
           SELECT status = 'applied'
           FROM navdhan_release.schema_history
           WHERE kind = :'item_kind' AND filename = :'item_filename'
       ), false) AS applied,
       COALESCE((
           SELECT status = 'applying'
           FROM navdhan_release.schema_history
           WHERE kind = :'item_kind' AND filename = :'item_filename'
       ), false) AS interrupted
\\gset ${prefix}
\\if :${prefix}checksum_mismatch
  \\echo 'ERROR: checksum drift in an already-recorded release file'
  SELECT 1 / 0;
\\endif
\\if :${prefix}interrupted
  \\echo 'ERROR: a previous attempt was interrupted while applying this file'
  \\echo 'ERROR: inspect or restore the database; never mark it applied without evidence'
  SELECT 1 / 0;
\\endif
\\if :${prefix}applied
  \\echo 'Already applied: ' :item_kind :item_filename
\\else
  INSERT INTO navdhan_release.schema_history (
      kind, filename, checksum_sha256, status, applied_by
  ) VALUES (
      :'item_kind', :'item_filename', :'item_checksum', 'applying', current_user
  );
  \\echo 'Applying: ' :item_kind :item_filename
  \\ir '${quoted_path}'
  UPDATE navdhan_release.schema_history
  SET status = 'applied', applied_at = clock_timestamp()
  WHERE kind = :'item_kind'
    AND filename = :'item_filename'
    AND checksum_sha256 = :'item_checksum'
    AND status = 'applying';
\\endif
SQL
  } >>"$plan_file"
  item_index=$((item_index + 1))
}

for path in "${migration_files[@]}"; do
  append_release_item migration "$path"
done
for path in "${seed_files[@]}"; do
  append_release_item seed "$path"
done

cat >>"$plan_file" <<SQL
SELECT count(*) FILTER (WHERE kind = 'migration') = ${#migration_files[@]}
       AND count(*) FILTER (WHERE kind = 'migration' AND status = 'applied') = ${#migration_files[@]}
       AND count(*) FILTER (WHERE kind = 'seed') = ${#seed_files[@]}
       AND count(*) FILTER (WHERE kind = 'seed' AND status = 'applied') = ${#seed_files[@]}
       AS release_history_complete
FROM navdhan_release.schema_history
\\gset history_
\\if :history_release_history_complete
\\else
  \\echo 'ERROR: database history contains files absent from this checkout or incomplete items'
  SELECT 1 / 0;
\\endif

-- Grants are intentionally repeated on every successful run so newly added
-- tables and sequences cannot be omitted from the runtime role.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'runtime_role') \\gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'runtime_role') \\gexec
-- Start from a read-only baseline. Configuration, consent-policy, checklist,
-- retention, provider, and destination tables are release-owned data; a
-- compromised request-serving role must not be able to rewrite them.
SELECT format(
    'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I',
    :'runtime_role'
) \\gexec
SELECT format(
    'GRANT SELECT ON ALL TABLES IN SCHEMA public TO %I',
    :'runtime_role'
) \\gexec

-- Only tables mutated by the collection runtime receive write privileges.
-- Adding a new runtime-owned table is an explicit, reviewed release change.
WITH writable(table_name) AS (
    VALUES
        ('borrowers'),
        ('borrower_registrations'),
        ('persons'),
        ('person_identifiers'),
        ('borrower_persons'),
        ('loan_applications'),
        ('application_sessions'),
        ('application_parties'),
        ('application_requirements'),
        ('application_requirement_events'),
        ('application_credit_declarations'),
        ('application_existing_credit_facilities'),
        ('documents'),
        ('document_requirement_satisfactions'),
        ('document_events')
)
SELECT format(
    'GRANT INSERT, UPDATE, DELETE ON TABLE public.%I TO %I',
    table_name, :'runtime_role'
)
FROM writable
\\gexec

-- These ledgers are append-only to the runtime. Historical application-state,
-- consent, and audit evidence cannot be rewritten or deleted by the service.
WITH append_only(table_name) AS (
    VALUES
        ('application_status_events'),
        ('consent_grants'),
        ('audit_events')
)
SELECT format(
    'GRANT INSERT ON TABLE public.%I TO %I',
    table_name, :'runtime_role'
)
FROM append_only
\\gexec

SELECT format(
    'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I',
    :'runtime_role'
) \\gexec
WITH sequence_owners(table_name) AS (
    VALUES
        ('borrowers'),
        ('borrower_registrations'),
        ('persons'),
        ('person_identifiers'),
        ('borrower_persons'),
        ('loan_applications'),
        ('application_sessions'),
        ('application_parties'),
        ('application_requirements'),
        ('application_requirement_events'),
        ('application_credit_declarations'),
        ('application_existing_credit_facilities'),
        ('documents'),
        ('document_requirement_satisfactions'),
        ('document_events'),
        ('application_status_events'),
        ('consent_grants'),
        ('audit_events')
)
SELECT format(
    'GRANT USAGE, SELECT ON SEQUENCE %I.%I TO %I',
    sequence_namespace.nspname, sequence.relname, :'runtime_role'
)
FROM pg_class AS sequence
JOIN pg_namespace AS sequence_namespace
  ON sequence_namespace.oid = sequence.relnamespace
JOIN pg_depend AS dependency
  ON dependency.objid = sequence.oid
 AND dependency.deptype IN ('a', 'i')
JOIN pg_class AS owning_table
  ON owning_table.oid = dependency.refobjid
JOIN sequence_owners
  ON sequence_owners.table_name = owning_table.relname
WHERE sequence.relkind = 'S'
  AND sequence_namespace.nspname = 'public'
\\gexec
-- A partition is reached through its RLS-protected parent and does not need a
-- direct grant. Direct access to a child could bypass the parent's policy.
SELECT format(
    'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %I',
    n.nspname, c.relname, :'runtime_role'
)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relispartition
\\gexec
SELECT format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
    current_user, :'runtime_role'
) \\gexec
SELECT format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
    current_user, :'runtime_role'
) \\gexec
SELECT format('REVOKE ALL ON SCHEMA navdhan_release FROM %I', :'runtime_role') \\gexec

BEGIN READ ONLY;
SELECT set_config('app.current_marketplace_id', :'marketplace_id', true);
SELECT (SELECT count(*) FROM marketplaces
        WHERE marketplace_id = :'marketplace_id'::uuid) = 1
       AND (SELECT count(*) FROM checklist_versions
            WHERE marketplace_id = :'marketplace_id'::uuid AND status = 'active') = 3
       AND (SELECT count(*) FROM document_requirements
            WHERE marketplace_id = :'marketplace_id'::uuid) = 36
       AND (SELECT count(*)
            FROM document_requirements dr
            JOIN checklist_versions cv
              ON cv.marketplace_id = dr.marketplace_id
             AND cv.checklist_version_id = dr.checklist_version_id
            WHERE dr.marketplace_id = :'marketplace_id'::uuid
              AND cv.constitution = 'proprietorship') = 12
       AND (SELECT count(*)
            FROM document_requirements dr
            JOIN checklist_versions cv
              ON cv.marketplace_id = dr.marketplace_id
             AND cv.checklist_version_id = dr.checklist_version_id
            WHERE dr.marketplace_id = :'marketplace_id'::uuid
              AND cv.constitution = 'partnership') = 13
       AND (SELECT count(*)
            FROM document_requirements dr
            JOIN checklist_versions cv
              ON cv.marketplace_id = dr.marketplace_id
             AND cv.checklist_version_id = dr.checklist_version_id
            WHERE dr.marketplace_id = :'marketplace_id'::uuid
              AND cv.constitution = 'private_limited') = 11
       AND (SELECT count(*) FROM consent_purposes) = 5
       AND (SELECT count(*)
            FROM consent_purposes
            WHERE (purpose_code IN ('privacy_policy', 'terms_of_use', 'credit_bureau_check')
                   AND is_mandatory)
               OR (purpose_code = 'communications' AND NOT is_mandatory)
               OR (purpose_code = 'gst_verification'
                   AND NOT is_mandatory
                   AND notice_text = 'I consent to sharing my GST registration details')) = 5
       AND (SELECT count(*) FROM document_types) = 23
       AS required_seed_shape_ok
\\gset seedcheck_
ROLLBACK;
\\if :seedcheck_required_seed_shape_ok
\\else
  \\echo 'ERROR: required seed data does not match the audited release shape'
  SELECT 1 / 0;
\\endif

SELECT NOT EXISTS (
           SELECT 1
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           JOIN pg_roles r ON r.oid = c.relowner
           WHERE n.nspname = 'public'
             AND c.relkind IN ('r', 'p', 'S')
             AND r.rolname = :'runtime_role'
       )
       AND NOT has_schema_privilege(:'runtime_role', 'navdhan_release', 'USAGE')
       AS ownership_and_ledger_acl_ok
\\gset grantcheck_
\\if :grantcheck_ownership_and_ledger_acl_ok
\\else
  \\echo 'ERROR: runtime role owns schema objects or can access the release ledger'
  SELECT 1 / 0;
\\endif

SELECT pg_advisory_unlock(177145922, 20260819);
\\echo 'NavDhan database release completed successfully.'
SQL

printf 'Applying guarded %s database release to %s/%s as %s...\n' \
  "$TARGET_ENV" "$CLOUD_SQL_CONNECTION_NAME" "$PGDATABASE" "$PGUSER"

psql \
  --no-psqlrc \
  --no-password \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --set="expected_database=${PGDATABASE}" \
  --set="runtime_role=${RUNTIME_ROLE}" \
  --set="marketplace_id=${MARKETPLACE_ID}" \
  --file="$plan_file"
