-- 022: Drop kyb_pl_verifications.
--
-- The async MCA Doc Download flow has been removed. Business borrowers
-- now upload a P&L PDF like individual borrowers — both go into the
-- existing pl_verifications table via /pl/upload.
--
-- The kyb_pl_verifications table created by 021 is no longer referenced
-- by any ORM model or route, so dropping it is safe.
--
-- Apply via cloud-sql-proxy on 127.0.0.1:15432.

BEGIN;

DROP TABLE IF EXISTS kyb_pl_verifications;

COMMIT;
