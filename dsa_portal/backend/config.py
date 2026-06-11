import os
from dotenv import load_dotenv

# override=True so .env values win over stale system env vars
# (e.g. GOOGLE_APPLICATION_CREDENTIALS pointing to an old SA key)
load_dotenv(override=True)

# ── App environment ────────────────────────────────────────────────────────────
APP_ENV = os.getenv("APP_ENV", "dev")  # dev | prod — picks bucket + DB conventions

# ── Perfios credentials ────────────────────────────────────────────────────────
SECURE_ID   = os.getenv("PERFIOS_USERNAME")
SECURE_CRED = os.getenv("PERFIOS_PASSWORD")
ORG_ID      = os.getenv("PERFIOS_ORG_ID")

# ── Database (Cloud SQL via cloud-sql-proxy on localhost:5432) ────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://kuber_app:change_me@127.0.0.1:5432/kuber_dev",
)

# ── GCS ────────────────────────────────────────────────────────────────────────
GCS_BUCKET = os.getenv("GCS_BUCKET", f"kuber-kyc-{APP_ENV}")

# ── Crypto ─────────────────────────────────────────────────────────────────────
# Base64-encoded 32-byte key for AES-256-GCM. Used by security.crypto.
# Prod: Cloud Run --set-secrets=ENCRYPTION_KEY=encryption-key:latest
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

BASE_KYC      = "https://hub.perfios.ai/ssp/kyc/api"
BASE_GST      = "https://hub.perfios.ai/ssp/gst/api"
BASE_ITR      = "https://hub.perfios.ai/ssp/itr/api"
# KSCAN hosts the business-entity APIs (PAN-to-CIN/LLPIN). Sandbox uses
# hub-test.perfios.ai; switch to hub.perfios.ai once KSCAN is provisioned in prod.
_kscan_host    = "hub-test.perfios.ai" if APP_ENV == "dev" else "hub.perfios.ai"
BASE_KSCAN     = f"https://{_kscan_host}/ssp/kscan/api"

_insights_host = "hub-test.perfios.ai" if APP_ENV == "dev" else "hub.perfios.ai"
BASE_INSIGHTS  = f"https://{_insights_host}/ssp/insights/api/v3"

# Public base URL of this backend, used as the webhook URL we pass to Perfios
# for async APIs (e.g. MCA Doc Download and Parse). Must be publicly reachable
# from Perfios's network. In prod this is the Cloud Run service URL; in local
# dev set this to an ngrok URL or leave unset to disable webhook-triggered calls.
PUBLIC_BACKEND_URL = os.getenv("PUBLIC_BACKEND_URL", "").rstrip("/")

# retail_org for individual borrowers; sme_org for businesses
BSA_REPORT_TYPE = os.getenv("PERFIOS_BSA_REPORT_TYPE", "retail_org")

PERFIOS_HEADERS = {
    "X-Secure-ID":       SECURE_ID,
    "X-Secure-Cred":     SECURE_CRED,
    "X-Organization-ID": ORG_ID,
}

# BSA (Insights) API needs two extra headers vs the other Perfios products
PERFIOS_BSA_HEADERS = {
    **PERFIOS_HEADERS,
    "content-type": "application/json",
    "x-report-type": BSA_REPORT_TYPE,
}

PERFIOS_BSA_UPLOAD_HEADERS = {
    **PERFIOS_HEADERS,
    "x-report-type": BSA_REPORT_TYPE,
}

# ── Server ─────────────────────────────────────────────────────────────────────
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# ── API routing ────────────────────────────────────────────────────────────────
API_VERSION = os.getenv("API_VERSION", "v1")
API_PREFIX  = f"/api/{API_VERSION}/verify"

# ── CORS ───────────────────────────────────────────────────────────────────────
_origins_raw    = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = ["*"] if _origins_raw == "*" else [o.strip() for o in _origins_raw.split(",")]
