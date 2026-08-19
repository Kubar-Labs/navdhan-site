from __future__ import annotations

import os
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def read(relative_path: str) -> str:
    return (PROJECT_ROOT / relative_path).read_text(encoding="utf-8")


class DatabaseReleaseToolingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.release = read("database/scripts/release.sh")
        cls.runtime_runner = read("database/scripts/verify-runtime.sh")
        cls.runtime_verify = read("database/scripts/verify-runtime.sql")
        cls.preflight = read("database/scripts/check-production-preflight.sh")
        cls.cloudbuild = read("dsa_portal/ci/cloudbuild-backend.yaml")
        cls.staging_cloudbuild = read("dsa_portal/ci/cloudbuild-backend-staging.yaml")
        cls.scanner_cloudbuild = read("dsa_portal/ci/cloudbuild-scanner.yaml")
        cls.staging_scanner_cloudbuild = read(
            "dsa_portal/ci/cloudbuild-scanner-staging.yaml"
        )
        cls.scanner_dockerfile = read("dsa_portal/scanner/Dockerfile")
        cls.retired_frontend = read("dsa_portal/ci/cloudbuild-frontend.yaml")
        cls.powershell = read("dsa_portal/scripts/deploy-backend.ps1")

    def test_release_runner_is_executable_and_forward_only(self) -> None:
        for relative_path in (
            "database/scripts/release.sh",
            "database/scripts/verify-runtime.sh",
            "database/scripts/check-production-preflight.sh",
        ):
            with self.subTest(path=relative_path):
                self.assertTrue(os.access(PROJECT_ROOT / relative_path, os.X_OK))

        self.assertIn('migration_files=("${MIGRATIONS_DIR}"/*.up.sql)', self.release)
        self.assertIn('seed_files=("${SEEDS_DIR}"/*.sql)', self.release)
        self.assertNotIn('migration_files=("${MIGRATIONS_DIR}"/*.down.sql)', self.release)

    def test_release_runner_fails_closed_on_target_and_history_ambiguity(self) -> None:
        for fragment in (
            "kubardevops:asia-south1:navdhan-prod",
            "kubardevops:asia-south1:navdhan-staging",
            "navdhan_collection",
            "navdhan_collection_app",
            "legacy navdhan is protected",
            "PRODUCTION_RELEASE_ACK",
            "server major version must be 18",
            "pg_auth_members",
            "migrations require a distinct administrative database role",
            "public schema contains objects",
            "checksum drift",
            "status = 'applying'",
            "pg_try_advisory_lock",
            "database history contains files absent from this checkout",
            "Duplicate migration ordinal",
            "Duplicate seed ordinal",
            "Auth Proxy Unix-socket directory",
            "PGHOSTADDR must be unset",
            "PGSERVICE and PGSERVICEFILE must be unset",
            "exactly one guarded Unix-socket directory",
            '.s.PGSQL.${PGPORT}',
            '--host="$PGHOST"',
            '--dbname="$PGDATABASE"',
            "SELECT 1 / 0;",
        ):
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.release)
        self.assertNotIn("\\quit 3", self.release)

    def test_release_runner_refreshes_runtime_grants(self) -> None:
        for fragment in (
            "GRANT CONNECT ON DATABASE",
            "GRANT USAGE ON SCHEMA public",
            "GRANT SELECT ON ALL TABLES IN SCHEMA public",
            "GRANT INSERT, UPDATE, DELETE ON TABLE public.%I",
            "GRANT USAGE, SELECT ON SEQUENCE %I.%I",
            "ALTER DEFAULT PRIVILEGES",
            "REVOKE ALL ON SCHEMA navdhan_release",
            "REVOKE ALL PRIVILEGES ON TABLE",
            "AND c.relkind IN ('r', 'p')",
        ):
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.release)

    def test_runtime_verification_is_read_only_and_rls_aware(self) -> None:
        self.assertIn("BEGIN READ ONLY", self.runtime_verify)
        self.assertIn("set_config('app.current_marketplace_id'", self.runtime_verify)
        self.assertIn("c.relrowsecurity", self.runtime_verify)
        self.assertIn("c.relforcerowsecurity", self.runtime_verify)
        self.assertIn("p.polname = 'tenant_isolation'", self.runtime_verify)
        self.assertIn("p.polroles = ARRAY[0::oid]", self.runtime_verify)
        self.assertIn("pg_get_expr(p.polqual", self.runtime_verify)
        self.assertIn("partition_direct_access_revoked", self.runtime_verify)
        self.assertIn("('borrowers', 'read_write')", self.runtime_verify)
        self.assertIn("('consent_grants', 'append_only')", self.runtime_verify)
        self.assertIn("COALESCE(e.privilege_mode, 'read_only')", self.runtime_verify)
        self.assertIn("least_privilege_table_grants_ok", self.runtime_verify)
        self.assertIn("SELECT 1 / 0;", self.runtime_verify)
        self.assertNotIn("\\quit 3", self.runtime_verify)
        self.assertIn("Auth Proxy Unix-socket directory", self.runtime_runner)
        self.assertIn("PGHOSTADDR must be unset", self.runtime_runner)
        self.assertIn("PGSERVICE and PGSERVICEFILE must be unset", self.runtime_runner)
        self.assertIn("exactly one guarded Unix-socket directory", self.runtime_runner)
        self.assertIn('.s.PGSQL.${PGPORT}', self.runtime_runner)
        self.assertIn('--host="$PGHOST"', self.runtime_runner)
        self.assertIn('--dbname="$PGDATABASE"', self.runtime_runner)
        self.assertIn('PROD_DATABASE="navdhan_collection"', self.runtime_runner)
        self.assertIn('PROD_RUNTIME_ROLE="navdhan_collection_app"', self.runtime_runner)
        self.assertIn(
            "NOT has_table_privilege(current_user, oid, 'UPDATE')",
            self.runtime_verify,
        )
        self.assertIn("counts_consent_purposes = 5", self.runtime_verify)
        self.assertIn("checklist distribution differs from 12/13/11", self.runtime_verify)
        self.assertIn("purpose_code = 'communications' AND NOT is_mandatory", self.runtime_verify)
        for write_keyword in ("INSERT INTO", "UPDATE ", "DELETE FROM", "TRUNCATE "):
            with self.subTest(keyword=write_keyword):
                self.assertNotIn(write_keyword, self.runtime_verify)

    def test_production_preflight_is_read_only_and_checks_recovery_controls(self) -> None:
        for fragment in (
            'PROJECT="kubardevops"',
            'INSTANCE="navdhan-prod"',
            'DATABASE="navdhan_collection"',
            'LEGACY_DATABASE="navdhan"',
            "POSTGRES_18",
            "pointInTimeRecoveryEnabled",
            "transactionLogRetentionDays",
            "deletionProtectionEnabled",
            "EXPECTED_BACKUP_ID",
            'backups describe "$EXPECTED_BACKUP_ID"',
            '"$backup_status" == "SUCCESSFUL"',
            "older than six hours",
        ):
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.preflight)
        for mutation in ("instances create", "instances patch", "backups create", "databases delete"):
            with self.subTest(mutation=mutation):
                self.assertNotIn(mutation, self.preflight)

    def test_cloudbuild_publishes_trigger_bound_immutable_image_only(self) -> None:
        for fragment in (
            "--file=dsa_portal/backend/Dockerfile",
            "dsa_portal/backend",
            "validate-trigger-source",
            "RELEASE_SHA=${COMMIT_SHA}",
            "repository-connected trigger",
            "${COMMIT_SHA}-$BUILD_ID",
            "navdhan-build-sa@kubardevops.iam.gserviceaccount.com",
            "requestedVerifyOption: VERIFIED",
        ):
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.cloudbuild)
        self.assertNotIn("PERFIOS_", self.cloudbuild)
        self.assertNotIn("./backend", self.cloudbuild)
        self.assertNotIn("$SHORT_SHA", self.cloudbuild)
        self.assertNotIn("_RELEASE_SHA", self.cloudbuild)
        self.assertNotIn("gcloud run deploy", self.cloudbuild)
        self.assertNotIn("--set-secrets", self.cloudbuild)
        self.assertNotIn("navdhan-prod", self.cloudbuild)
        self.assertNotIn(":latest", self.cloudbuild.split("images:", 1)[1])

    def test_staging_cloudbuild_is_also_build_only_and_trigger_bound(self) -> None:
        for fragment in (
            "validate-trigger-source",
            "RELEASE_SHA=${COMMIT_SHA}",
            "${COMMIT_SHA}-$BUILD_ID",
            "navdhan-build-sa@kubardevops.iam.gserviceaccount.com",
            "requestedVerifyOption: VERIFIED",
        ):
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.staging_cloudbuild)
        self.assertNotIn("navdhan-prod", self.staging_cloudbuild)
        self.assertNotIn("PERFIOS_", self.staging_cloudbuild)
        self.assertNotIn("_RELEASE_SHA", self.staging_cloudbuild)
        self.assertNotIn("gcloud run deploy", self.staging_cloudbuild)
        self.assertNotIn("--set-secrets", self.staging_cloudbuild)

    def test_scanner_images_are_build_only_and_trigger_bound(self) -> None:
        self.assertIn("clamav/clamav@sha256:", self.scanner_dockerfile)
        self.assertIn("freshclam --quiet", self.scanner_dockerfile)
        self.assertIn("USER clamav", self.scanner_dockerfile)

        for config in (self.scanner_cloudbuild, self.staging_scanner_cloudbuild):
            for fragment in (
                "--file=dsa_portal/scanner/Dockerfile",
                "dsa_portal/scanner",
                "validate-trigger-source",
                "RELEASE_SHA=${COMMIT_SHA}",
                "repository-connected trigger",
                "${COMMIT_SHA}-$BUILD_ID",
                "navdhan-build-sa@kubardevops.iam.gserviceaccount.com",
                "requestedVerifyOption: VERIFIED",
            ):
                with self.subTest(fragment=fragment):
                    self.assertIn(fragment, config)
            self.assertNotIn("--set-cloudsql-instances", config)
            self.assertNotIn("DB_PASSWORD", config)
            self.assertNotIn("ENCRYPTION_KEY", config)
            self.assertNotIn("LOOKUP_HMAC_KEY", config)
            self.assertNotIn("APPLY_SERVICE_TOKEN", config)
            self.assertNotIn("_RELEASE_SHA", config)
            self.assertNotIn("gcloud run deploy", config)
            self.assertNotIn("--set-secrets", config)

        self.assertNotIn("navdhan-prod", self.staging_scanner_cloudbuild)

    def test_manual_deploy_matches_cloudbuild_safety_shape(self) -> None:
        for fragment in (
            '"artifacts", "docker", "images", "describe"',
            '$Image = "${ImageBase}@$ImageDigest"',
            '"--no-traffic"',
            '"--concurrency=20"',
            "Refusing to build a dirty or untracked worktree",
            "checked-out Git SHA does not equal the approved CommitSha",
            "DbPasswordSecretVersion",
            "EncryptionKeySecretVersion",
            "LookupHmacKeySecretVersion",
            "ApplyServiceTokenSecretVersion",
            "ScanCallbackTokenSecretVersion",
            "navdhan-prod-lookup-hmac-key",
            "navdhan-prod-apply-service-token",
            "DB_USER=navdhan_collection_app",
            "DB_NAME=navdhan_collection",
        ):
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.powershell)
        self.assertNotIn("PERFIOS_", self.powershell)
        self.assertNotIn("kubar-protocol-main", self.powershell)
        self.assertNotIn('"builds", "submit"', self.powershell)
        self.assertNotIn(":latest", self.powershell)

    def test_legacy_frontend_pipeline_cannot_deploy(self) -> None:
        self.assertIn("RETIRED", self.retired_frontend)
        self.assertIn("exit 1", self.retired_frontend)
        self.assertNotIn("gcloud run deploy", self.retired_frontend)


if __name__ == "__main__":
    unittest.main()
