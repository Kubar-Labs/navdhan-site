"""Canonical entry point for the collection-only FastAPI runtime."""

from collection_app import app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("collection_app:app", host="0.0.0.0", port=8000)
