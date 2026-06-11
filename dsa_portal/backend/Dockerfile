# Production image for the Kuber Verification backend.
# Built and deployed via:
#   gcloud builds submit backend/ \
#     --tag asia-south1-docker.pkg.dev/kubar-protocol-main/kuber/verification:v1
#
# The container expects:
#   - $PORT          (Cloud Run sets this; default 8080 for local docker run)
#   - DATABASE_URL, ENCRYPTION_KEY, PERFIOS_*  (from Secret Manager via Cloud Run --set-secrets)
#   - APP_ENV, GCS_BUCKET, API_VERSION, ALLOWED_ORIGINS  (from --set-env-vars)
# No .env file is read in the image.

FROM python:3.12-slim

# Faster pip + no .pyc files + flush logs immediately
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install Python deps first so this layer is cached as long as
# requirements.txt is unchanged. Source-code edits won't bust the cache.
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy the application
COPY . .

# Run as a non-root user
RUN useradd --create-home --shell /usr/sbin/nologin app && chown -R app:app /app
USER app

# Cloud Run injects PORT; default for local docker run.
ENV PORT=8080
EXPOSE 8080

# Single-process uvicorn. Cloud Run handles concurrency at the platform
# level (multiple containers); workers within a container offers no win.
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
