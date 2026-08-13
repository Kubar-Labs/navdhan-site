# Collection backend

The canonical backend is the collection-only FastAPI application. From this
directory, start it locally with:

```powershell
python -m uvicorn collection_app:app --host 0.0.0.0 --port 8000
```

The health check is available at `http://127.0.0.1:8000/health`; borrower
collection endpoints are under `http://127.0.0.1:8000/api/apply/`.

The runtime intentionally registers only collection routes. The legacy
verification/provider modules remain in the repository for the later removal
phase, but the canonical entry point does not import or register them.
