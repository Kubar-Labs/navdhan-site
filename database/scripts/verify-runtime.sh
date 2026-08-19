#!/usr/bin/env bash

# Connect as navdhan_app and execute only read-only, RLS-aware checks.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly MARKETPLACE_ID="10000000-0000-0000-0000-000000000001"
readonly PROD_CONNECTION="kubardevops:asia-south1:navdhan-prod"
readonly STAGING_CONNECTION="kubardevops:asia-south1:navdhan-staging"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

for name in TARGET_ENV CLOUD_SQL_CONNECTION_NAME PGHOST PGPORT PGUSER PGDATABASE; do
  [[ -n "${!name:-}" ]] || die "Required environment variable is not set: ${name}"
done
command -v psql >/dev/null 2>&1 || die "Required command not found: psql"
[[ "$PGUSER" == "navdhan_app" ]] || die "PGUSER must be navdhan_app"

case "$TARGET_ENV" in
  production)
    [[ "$CLOUD_SQL_CONNECTION_NAME" == "$PROD_CONNECTION" && "$PGDATABASE" == "navdhan" ]] ||
      die "Production verification target does not match ${PROD_CONNECTION}/navdhan"
    ;;
  staging)
    [[ "$CLOUD_SQL_CONNECTION_NAME" == "$STAGING_CONNECTION" && "$PGDATABASE" == "navdhan" ]] ||
      die "Staging verification target does not match ${STAGING_CONNECTION}/navdhan"
    ;;
  rehearsal)
    [[ "$CLOUD_SQL_CONNECTION_NAME" == "$STAGING_CONNECTION" && "$PGDATABASE" == navdhan_rehearsal_* ]] ||
      die "Rehearsal verification must use navdhan-staging/navdhan_rehearsal_*"
    ;;
  *) die "TARGET_ENV must be production, staging, or rehearsal" ;;
esac

socket_suffix="/${CLOUD_SQL_CONNECTION_NAME}"
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

printf 'Running read-only runtime verification against %s/%s...\n' \
  "$CLOUD_SQL_CONNECTION_NAME" "$PGDATABASE"
psql \
  --no-psqlrc \
  --no-password \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --set="expected_database=${PGDATABASE}" \
  --set="runtime_role=navdhan_app" \
  --set="marketplace_id=${MARKETPLACE_ID}" \
  --file="${SCRIPT_DIR}/verify-runtime.sql"
