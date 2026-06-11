"""
Shared async HTTP client for all Perfios API calls.
Uses httpx.AsyncClient — reused across the app lifespan via app.state.
All POST/GET helpers retry up to _RETRY_ATTEMPTS times on 5xx or timeout.
BSA polling (bsa_get) is excluded — the poll loop already provides resilience.
"""

import asyncio
import logging
import httpx
from fastapi import Request
from config import PERFIOS_HEADERS, PERFIOS_BSA_HEADERS, PERFIOS_BSA_UPLOAD_HEADERS

log = logging.getLogger(__name__)

_RETRY_ATTEMPTS = 3
_RETRY_BACKOFF  = [2, 5]   # seconds between attempt 1→2, 2→3


def _headers(case_id: str = None) -> dict:
    h = {**PERFIOS_HEADERS, "Content-Type": "application/json"}
    if case_id:
        h["X-Customer-Reference-ID"] = case_id
    return h


def _upload_headers(case_id: str = None) -> dict:
    h = {**PERFIOS_HEADERS}
    if case_id:
        h["X-Customer-Reference-ID"] = case_id
    return h


def get_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http_client


async def _retry(label: str, coro_fn):
    """Run coro_fn up to _RETRY_ATTEMPTS times on 5xx response or timeout."""
    last_exc: Exception | None = None
    resp = None
    for attempt in range(_RETRY_ATTEMPTS):
        try:
            resp = await coro_fn()
            if resp.status_code >= 400:
                log.error("Perfios %s %s body=%s", resp.status_code, label, resp.text[:500])
            if resp.status_code >= 500 and attempt < _RETRY_ATTEMPTS - 1:
                delay = _RETRY_BACKOFF[attempt]
                log.warning("Perfios %s on attempt %d/%d for %s, retrying in %ds",
                            resp.status_code, attempt + 1, _RETRY_ATTEMPTS, label, delay)
                await asyncio.sleep(delay)
                continue
            resp.raise_for_status()
            return resp
        except httpx.TimeoutException as exc:
            last_exc = exc
            if attempt < _RETRY_ATTEMPTS - 1:
                delay = _RETRY_BACKOFF[attempt]
                log.warning("Perfios timeout attempt %d/%d for %s, retrying in %ds",
                            attempt + 1, _RETRY_ATTEMPTS, label, delay)
                await asyncio.sleep(delay)
    if last_exc:
        raise last_exc
    raise httpx.HTTPStatusError("All retries exhausted", request=None, response=resp)


async def post(client: httpx.AsyncClient, url: str, payload: dict,
               case_id: str = None) -> dict:
    resp = await _retry(url, lambda: client.post(url, json=payload, headers=_headers(case_id)))
    return resp.json()


async def get(client: httpx.AsyncClient, url: str, params: dict = None,
              case_id: str = None) -> httpx.Response:
    return await _retry(url, lambda: client.get(url, params=params, headers=_headers(case_id)))


async def post_multipart(client: httpx.AsyncClient, url: str,
                         file_bytes: bytes, filename: str,
                         data: dict = None, case_id: str = None) -> dict:
    files = {"file": (filename, file_bytes, "application/pdf")}
    resp = await _retry(url, lambda: client.post(url, files=files, data=data or {},
                                                  headers=_upload_headers(case_id)))
    return resp.json()


# ── BSA (Insights API) helpers ────────────────────────────────────────────────
# Insights requires two extra headers and wraps every payload in {"payload":{}}

async def bsa_post(client: httpx.AsyncClient, url: str, payload: dict) -> dict:
    resp = await _retry(url, lambda: client.post(url, json={"payload": payload},
                                                  headers=PERFIOS_BSA_HEADERS))
    return resp.json()


async def bsa_post_file(client: httpx.AsyncClient, url: str,
                        file_bytes: bytes, filename: str) -> dict:
    files = {"file": (filename, file_bytes, "application/pdf")}
    resp = await _retry(url, lambda: client.post(url, files=files,
                                                  headers=PERFIOS_BSA_UPLOAD_HEADERS))
    return resp.json()


async def bsa_get(client: httpx.AsyncClient, url: str,
                  params: dict = None) -> httpx.Response:
    # No retry here — the poll loop in bank_statement.py already handles transient failures.
    resp = await client.get(url, params=params, headers=PERFIOS_BSA_HEADERS)
    resp.raise_for_status()
    return resp
