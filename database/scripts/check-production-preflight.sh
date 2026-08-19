#!/usr/bin/env bash

# Read-only GCP checks required before acknowledging a production DB release.
# This script never creates, updates, deletes, or restores a cloud resource.

set -Eeuo pipefail
IFS=$'\n\t'

readonly PROJECT="kubardevops"
readonly INSTANCE="navdhan-prod"
readonly CONNECTION="kubardevops:asia-south1:navdhan-prod"
readonly DATABASE="navdhan"
readonly MAX_BACKUP_AGE_SECONDS=21600

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

command -v gcloud >/dev/null 2>&1 || die "Required command not found: gcloud"
command -v date >/dev/null 2>&1 || die "Required command not found: date"
[[ -n "${EXPECTED_BACKUP_ID:-}" ]] ||
  die "EXPECTED_BACKUP_ID must name the on-demand backup approved for this release"
[[ "$EXPECTED_BACKUP_ID" =~ ^[0-9]+$ ]] ||
  die "EXPECTED_BACKUP_ID must be a numeric Cloud SQL backup ID"

instance_values="$(gcloud sql instances describe "$INSTANCE" \
  --project="$PROJECT" \
  --format='value(connectionName,databaseVersion,state,region,settings.tier,settings.availabilityType,settings.backupConfiguration.enabled,settings.backupConfiguration.pointInTimeRecoveryEnabled,settings.backupConfiguration.backupRetentionSettings.retainedBackups,settings.backupConfiguration.transactionLogRetentionDays,settings.deletionProtectionEnabled,settings.storageAutoResize)')"
IFS=$'\t' read -r connection version state region tier availability backups_enabled pitr_enabled retained_backups log_retention_days deletion_protection storage_auto_resize <<<"$instance_values"

[[ "$connection" == "$CONNECTION" ]] || die "Cloud SQL connection-name mismatch"
[[ "$version" == "POSTGRES_18" ]] || die "Cloud SQL must run POSTGRES_18"
[[ "$state" == "RUNNABLE" ]] || die "Cloud SQL instance is not RUNNABLE"
[[ "$region" == "asia-south1" ]] || die "Cloud SQL instance is outside asia-south1"
[[ "$tier" == "db-custom-1-3840" ]] || die "Cloud SQL production tier has drifted"
[[ "$availability" == "ZONAL" ]] || die "Cloud SQL availability differs from the approved ZONAL topology"
[[ "${backups_enabled,,}" == "true" ]] || die "Automated backups are not enabled"
[[ "${pitr_enabled,,}" == "true" ]] || die "Point-in-time recovery is not enabled"
[[ "$retained_backups" =~ ^[0-9]+$ && "$retained_backups" -ge 7 ]] ||
  die "Fewer than seven backups are retained"
[[ "$log_retention_days" =~ ^[0-9]+$ && "$log_retention_days" -ge 7 ]] ||
  die "PITR transaction logs are retained for fewer than seven days"
[[ "${deletion_protection,,}" == "true" ]] || die "Deletion protection is not enabled"
if [[ "${storage_auto_resize,,}" == "false" ]]; then
  storage_note="Storage auto-increase is disabled; the 80% disk alert is mandatory."
else
  storage_note="Storage auto-increase is enabled, which is safer than the recorded topology."
fi

database_name="$(gcloud sql databases describe "$DATABASE" \
  --instance="$INSTANCE" \
  --project="$PROJECT" \
  --format='value(name)')"
[[ "$database_name" == "$DATABASE" ]] || die "Database ${DATABASE} does not exist"

approved_backup="$(gcloud sql backups describe "$EXPECTED_BACKUP_ID" \
  --instance="$INSTANCE" \
  --project="$PROJECT" \
  --format='value(id,status,endTime)')"
[[ -n "$approved_backup" ]] || die "Approved production backup does not exist"
IFS=$'\t' read -r backup_id backup_status backup_end_time <<<"$approved_backup"
[[ "$backup_id" == "$EXPECTED_BACKUP_ID" ]] || die "Cloud SQL returned a different backup ID"
[[ "$backup_status" == "SUCCESSFUL" ]] || die "Approved production backup is not SUCCESSFUL"
[[ -n "$backup_end_time" ]] || die "Approved production backup has no completion time"
backup_epoch="$(date -u -d "$backup_end_time" +%s)" || die "Could not parse latest backup time"
now_epoch="$(date -u +%s)"
backup_age_seconds=$((now_epoch - backup_epoch))
((backup_age_seconds >= 0 && backup_age_seconds <= MAX_BACKUP_AGE_SECONDS)) ||
  die "Approved successful backup is older than six hours"

printf 'Production Cloud SQL preflight passed.\n'
printf 'Connection: %s\n' "$CONNECTION"
printf 'Approved successful backup: %s at %s\n' "$backup_id" "$backup_end_time"
printf 'Note: production is intentionally ZONAL; monitor availability. %s\n' "$storage_note"
