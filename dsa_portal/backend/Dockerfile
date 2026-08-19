# Production image for the Navdhan collection-only backend.

# Pin the multi-architecture manifest for reproducible builds. Refresh this
# digest deliberately after reviewing upstream Python image security updates.
FROM python:3.12-slim@sha256:2c941e860699f878900b0edc2403613c234d4b32eda3cc9fa7036991a2a63c4a

# Faster pip + no .pyc files + flush logs immediately
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install the fully resolved, hash-locked dependency set first so this layer is
# cached until the lock changes. Source-code edits won't bust the cache.
COPY requirements.lock .
RUN pip install --require-hashes --requirement requirements.lock

# Copy the application
COPY . .

# Run as a non-root user
RUN useradd --create-home --shell /usr/sbin/nologin app && chown -R app:app /app
USER app

# Informational only -- the runtime port comes from $PORT (Cloud Run injects
# it, typically 8080), falling back to 8000 for local `docker run`.
EXPOSE 8000

# Single-process uvicorn. Cloud Run handles concurrency at the platform
# level (multiple containers); workers within a container offers no win.
# Shell form so $HOST/$PORT expand; exec so uvicorn keeps PID 1 and receives
# the platform's shutdown signals.
CMD ["sh", "-c", "exec uvicorn collection_app:app --host \"${HOST:-0.0.0.0}\" --port \"${PORT:-8000}\""]
