from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from db.session import init_engine, close_engine
from routes import aadhaar, pan, gst, itr, form26as, bank_statement, cases, pl
from routes import kyb as kyb_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # DB engine
    init_engine()
    # Shared HTTP client — reused across requests
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(900.0),
        follow_redirects=True,
    )
    try:
        yield
    finally:
        await app.state.http_client.aclose()
        await close_engine()


app = FastAPI(
    title="Kuber Verification API",
    description="Borrower KYC verification via Perfios — Aadhaar, PAN, GST, ITR, 26AS, BSA",
    version=config.API_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in [cases.router, aadhaar.router, pan.router, gst.router, itr.router,
               form26as.router, bank_statement.router, pl.router,
               kyb_routes.router]:
    app.include_router(router, prefix=config.API_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "env": config.APP_ENV,
            "api_prefix": config.API_PREFIX,
            "gcs_bucket": config.GCS_BUCKET}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=True)
