-- Re-apply grants only (separately from 001_init.sql, because the initial
-- import aborted on an unsupported CURRENT_CATALOG clause). Safe to re-run.

GRANT USAGE ON SCHEMA public TO kuber_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kuber_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kuber_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kuber_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kuber_app;
