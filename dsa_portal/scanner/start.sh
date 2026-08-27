#!/bin/sh
set -eu

# Refresh before accepting work, then keep signatures current while this
# instance is alive. A cold start fails closed if the official database cannot
# be refreshed; clamscan independently rejects databases older than two days.
freshclam --quiet
freshclam --daemon --foreground --checks=24 --quiet &

exec uvicorn scanner_app:app --host 0.0.0.0 --port "${PORT:-8080}"
