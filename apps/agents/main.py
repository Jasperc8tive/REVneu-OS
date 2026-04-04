import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router


def validate_internal_agent_key() -> None:
    if os.getenv("ENVIRONMENT", "development") != "production":
        return

    key = os.getenv("AGENT_API_KEY", "")
    unsafe = (not key) or (len(key.strip()) < 24) or ("change-me" in key.lower())
    if unsafe:
        raise RuntimeError("AGENT_API_KEY must be set to a strong non-default value in production")


validate_internal_agent_key()

app = FastAPI(
    title="Revneu OS — Agent Service",
    description="AI growth agent microservices for Nigerian businesses",
    version="0.1.0",
    docs_url="/docs" if os.getenv("ENVIRONMENT", "development") != "production" else None,
    redoc_url=None,
)

# CORS — locked to API service only (agents not publicly accessible)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("API_URL", "http://localhost:4000")],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "revneu-agents"}
