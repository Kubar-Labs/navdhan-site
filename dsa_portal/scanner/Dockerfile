FROM docker.io/clamav/clamav@sha256:2bb8cd7dfe3e87f86e969a2c415f7698583175e46dc2234672be9210c982c144

USER root

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH=/opt/venv/bin:$PATH

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.lock .
RUN python3 -m venv /opt/venv \
    && pip install --require-hashes --requirement requirements.lock \
    && freshclam --quiet
COPY scanner_app.py start.sh ./

RUN chmod 0555 /app/start.sh \
    && chown -R clamav:clamav /app
USER clamav

EXPOSE 8080
ENTRYPOINT []
CMD ["/app/start.sh"]
