\set ON_ERROR_STOP on
\pset pager off

BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;
SELECT set_config('app.current_marketplace_id', :'marketplace_id', true);

SELECT current_database() = :'expected_database' AS database_ok,
       current_setting('server_version_num')::integer / 10000 = 18 AS version_ok,
       current_user = :'runtime_role' AS identity_ok,
       current_setting('app.current_marketplace_id', true) = :'marketplace_id' AS tenant_context_ok
\gset target_
\if :target_database_ok
\else
  \echo 'ERROR: runtime verification reached the wrong database'
  SELECT 1 / 0;
\endif
\if :target_version_ok
\else
  \echo 'ERROR: runtime verification requires PostgreSQL 18'
  SELECT 1 / 0;
\endif
\if :target_identity_ok
\else
  \echo 'ERROR: verification must connect directly as the runtime role'
  SELECT 1 / 0;
\endif
\if :target_tenant_context_ok
\else
  \echo 'ERROR: tenant context was not established'
  SELECT 1 / 0;
\endif

SELECT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
       AND NOT rolcreatedb AND NOT rolcreaterole
       AND NOT has_database_privilege(r.rolname, current_database(), 'CREATE')
       AND NOT EXISTS (
           SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid
       ) AS safe
FROM pg_roles r
WHERE r.rolname = current_user
\gset role_
\if :role_safe
\else
  \echo 'ERROR: runtime role has unsafe cluster privileges'
  SELECT 1 / 0;
\endif

SELECT NOT has_schema_privilege(current_user, 'public', 'CREATE') AS public_schema_create_revoked
\gset schema_
\if :schema_public_schema_create_revoked
\else
  \echo 'ERROR: runtime role can create objects in the public schema'
  SELECT 1 / 0;
\endif

SELECT COALESCE(bool_and(
           c.relrowsecurity
       AND c.relforcerowsecurity
       AND (
           SELECT count(*) = 1
           FROM pg_policy p
           WHERE p.polrelid = c.oid
             AND p.polname = 'tenant_isolation'
             AND p.polcmd = '*'
             AND p.polpermissive
             AND p.polroles = ARRAY[0::oid]
             AND p.polqual IS NOT NULL
             AND p.polwithcheck IS NOT NULL
             AND pg_get_expr(p.polqual, p.polrelid) =
                 pg_get_expr(p.polwithcheck, p.polrelid)
             AND position(
                 'marketplace_id' IN pg_get_expr(p.polqual, p.polrelid)
             ) > 0
             AND position(
                 'app.current_marketplace_id' IN pg_get_expr(p.polqual, p.polrelid)
             ) > 0
       )
       ), false) AS all_tenant_tables_force_rls_and_have_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND NOT c.relispartition
  AND EXISTS (
      SELECT 1
      FROM pg_attribute a
      WHERE a.attrelid = c.oid
        AND a.attname = 'marketplace_id'
        AND NOT a.attisdropped
  )
\gset rls_
\if :rls_all_tenant_tables_force_rls_and_have_policy
\else
  \echo 'ERROR: a tenant table lacks forced RLS or its exact tenant-isolation policy'
  SELECT 1 / 0;
\endif

-- Keep runtime privileges aligned with release.sh's three explicit classes:
-- request-owned tables are read/write, evidence ledgers are append-only, and
-- all remaining configuration/reference tables are read-only. This assertion
-- checks required and forbidden privileges so a broad grant cannot pass.
WITH expected_modes(table_name, privilege_mode) AS (
    VALUES
        ('borrowers', 'read_write'),
        ('borrower_registrations', 'read_write'),
        ('persons', 'read_write'),
        ('person_identifiers', 'read_write'),
        ('borrower_persons', 'read_write'),
        ('loan_applications', 'read_write'),
        ('application_sessions', 'read_write'),
        ('application_parties', 'read_write'),
        ('application_requirements', 'read_write'),
        ('application_requirement_events', 'read_write'),
        ('application_credit_declarations', 'read_write'),
        ('application_existing_credit_facilities', 'read_write'),
        ('documents', 'read_write'),
        ('document_requirement_satisfactions', 'read_write'),
        ('document_events', 'read_write'),
        ('application_status_events', 'append_only'),
        ('consent_grants', 'append_only'),
        ('audit_events', 'append_only')
),
public_tables AS (
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relispartition
),
classified AS (
    SELECT p.oid,
           p.relname,
           COALESCE(e.privilege_mode, 'read_only') AS privilege_mode
    FROM public_tables p
    LEFT JOIN expected_modes e ON e.table_name = p.relname
)
SELECT NOT EXISTS (
           SELECT 1
           FROM expected_modes e
           LEFT JOIN public_tables p ON p.relname = e.table_name
           WHERE p.oid IS NULL
       ) AS all_classified_tables_present,
       count(*) FILTER (WHERE privilege_mode = 'read_write') = 15
       AND count(*) FILTER (WHERE privilege_mode = 'append_only') = 3
       AND count(*) FILTER (WHERE privilege_mode = 'read_only') > 0
       AS privilege_class_counts_ok,
       COALESCE(bool_and(
           has_table_privilege(current_user, oid, 'SELECT')
           AND CASE privilege_mode
               WHEN 'read_write' THEN
                   has_table_privilege(current_user, oid, 'INSERT')
                   AND has_table_privilege(current_user, oid, 'UPDATE')
                   AND has_table_privilege(current_user, oid, 'DELETE')
               WHEN 'append_only' THEN
                   has_table_privilege(current_user, oid, 'INSERT')
                   AND NOT has_table_privilege(current_user, oid, 'UPDATE')
                   AND NOT has_table_privilege(current_user, oid, 'DELETE')
               ELSE
                   NOT has_table_privilege(current_user, oid, 'INSERT')
                   AND NOT has_table_privilege(current_user, oid, 'UPDATE')
                   AND NOT has_table_privilege(current_user, oid, 'DELETE')
               END
           AND NOT has_table_privilege(current_user, oid, 'TRUNCATE')
           AND NOT has_table_privilege(current_user, oid, 'REFERENCES')
           AND NOT has_table_privilege(current_user, oid, 'TRIGGER')
       ), false) AS least_privilege_table_grants_ok
FROM classified
\gset grants_
\if :grants_all_classified_tables_present
\else
  \echo 'ERROR: a required runtime privilege-class table is missing'
  SELECT 1 / 0;
\endif
\if :grants_privilege_class_counts_ok
\else
  \echo 'ERROR: runtime table privilege classes are incomplete'
  SELECT 1 / 0;
\endif
\if :grants_least_privilege_table_grants_ok
\else
  \echo 'ERROR: runtime table privileges exceed or fall short of the approved class'
  SELECT 1 / 0;
\endif

SELECT NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relispartition
      AND (has_table_privilege(current_user, c.oid, 'SELECT')
        OR has_table_privilege(current_user, c.oid, 'INSERT')
        OR has_table_privilege(current_user, c.oid, 'UPDATE')
        OR has_table_privilege(current_user, c.oid, 'DELETE'))
) AS partition_direct_access_revoked
\gset partitions_
\if :partitions_partition_direct_access_revoked
\else
  \echo 'ERROR: runtime role can bypass parent RLS through a direct partition grant'
  SELECT 1 / 0;
\endif

SELECT COALESCE(bool_and(
           has_sequence_privilege(
               current_user, format('%I.%I', sequence_schema, sequence_name), 'USAGE'
           )
       AND has_sequence_privilege(
               current_user, format('%I.%I', sequence_schema, sequence_name), 'SELECT'
           )
       AND NOT has_sequence_privilege(
               current_user, format('%I.%I', sequence_schema, sequence_name), 'UPDATE'
           )
       ), true) AS sequence_grants_ok
FROM information_schema.sequences
WHERE sequence_schema = 'public'
\gset sequences_
\if :sequences_sequence_grants_ok
\else
  \echo 'ERROR: runtime role is missing sequence privileges'
  SELECT 1 / 0;
\endif

SELECT NOT has_schema_privilege(current_user, 'navdhan_release', 'USAGE') AS ledger_hidden
\gset ledger_
\if :ledger_ledger_hidden
\else
  \echo 'ERROR: runtime role can access deployment metadata'
  SELECT 1 / 0;
\endif

SELECT
    (SELECT count(*) FROM marketplaces
     WHERE marketplace_id = :'marketplace_id'::uuid) AS marketplaces,
    (SELECT count(*) FROM checklist_versions
     WHERE marketplace_id = :'marketplace_id'::uuid AND status = 'active') AS active_checklists,
    (SELECT count(*) FROM document_requirements
     WHERE marketplace_id = :'marketplace_id'::uuid) AS document_requirements,
    (SELECT count(*) FROM consent_purposes) AS consent_purposes,
    (SELECT count(*) FROM document_types) AS document_types
\gset counts_

SELECT :counts_marketplaces = 1
       AND :counts_active_checklists = 3
       AND :counts_document_requirements = 36
       AND :counts_consent_purposes = 5
       AND :counts_document_types = 23 AS seed_shape_ok
\gset seed_
\if :seed_seed_shape_ok
\else
  \echo 'ERROR: runtime role cannot see the audited seed shape under RLS'
  SELECT 1 / 0;
\endif

SELECT (SELECT count(*)
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
       AS checklist_distribution_ok,
       (SELECT count(*)
        FROM consent_purposes
        WHERE (purpose_code IN ('privacy_policy', 'terms_of_use', 'credit_bureau_check')
               AND is_mandatory)
           OR (purpose_code = 'communications' AND NOT is_mandatory)
           OR (purpose_code = 'gst_verification'
               AND NOT is_mandatory
               AND notice_text = 'I consent to sharing my GST registration details')) = 5
       AS consent_policy_ok
\gset config_
\if :config_checklist_distribution_ok
\else
  \echo 'ERROR: checklist distribution differs from 12/13/11'
  SELECT 1 / 0;
\endif
\if :config_consent_policy_ok
\else
  \echo 'ERROR: mandatory/optional consent policy has drifted'
  SELECT 1 / 0;
\endif

SELECT :counts_marketplaces AS marketplaces,
       :counts_active_checklists AS active_checklists,
       :counts_document_requirements AS document_requirements,
       :counts_consent_purposes AS consent_purposes,
       :counts_document_types AS document_types;

ROLLBACK;
\echo 'Read-only runtime/RLS verification passed.'
