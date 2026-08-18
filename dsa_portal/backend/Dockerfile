# Production image for the Navdhan collection-only backend.

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

# Informational only -- the runtime port comes from $PORT (Cloud Run injects
# it, typically 8080), falling back to 8000 for local `docker run`.
EXPOSE 8000

# Single-process uvicorn. Cloud Run handles concurrency at the platform
# level (multiple containers); workers within a container offers no win.
# Shell form so $HOST/$PORT expand; exec so uvicorn keeps PID 1 and receives
# the platform's shutdown signals.
CMD ["sh", "-c", "exec uvicorn collection_app:app --host \"${HOST:-0.0.0.0}\" --port \"${PORT:-8000}\""]
