"""Canonical entry point for the collection-only FastAPI runtime."""

from collection_app import app  # noqa: F401 - canonical ASGI export


if __name__ == "__main__":
    import uvicorn

    from settings import load_settings

    settings = load_settings()
    uvicorn.run("collection_app:app", host=settings.host, port=settings.port)
