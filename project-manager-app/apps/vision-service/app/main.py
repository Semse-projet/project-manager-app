import os
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router as health_router
from app.routes.evidence import router as evidence_router

app = FastAPI(
    title="SEMSE Vision Service",
    version="0.1.0",
    description="Computer vision service for SEMSE evidence analysis using OpenCV."
)

# This service is only meant to be called server-to-server (apps/api's
# VisionServiceClient), never directly from a browser, so it doesn't need
# credentialed cross-origin requests. allow_origins=["*"] + allow_credentials=True
# made FastAPI reflect the caller's real Origin back (CORS spec forbids a
# literal "*" alongside credentials), which let any site's browser call this
# service's endpoints "with credentials" on behalf of a visitor.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("VISION_CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Railway (and any other real deployment) auto-injects this; its absence is
# how local dev is told apart from a live environment, same signal used
# elsewhere in this repo (e.g. SEMSE_BOOTSTRAP_TOKEN's prod-only enforcement).
_IS_PRODUCTION = bool(os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_ENVIRONMENT_NAME"))
_VISION_SERVICE_API_KEY = os.environ.get("VISION_SERVICE_API_KEY", "").strip()


async def require_api_key(x_vision_api_key: str = Header(default="", alias="X-Vision-Api-Key")) -> None:
    """Shared-secret gate: no endpoint here checked identity at all before —
    anyone with the public URL could run the full (costly) analysis suite for
    free. Permissive when VISION_SERVICE_API_KEY is unset outside production,
    matching this repo's existing fail-closed-in-prod-only pattern, so local
    dev keeps working without extra config.
    """
    if not _VISION_SERVICE_API_KEY:
        if _IS_PRODUCTION:
            raise HTTPException(status_code=503, detail="VISION_SERVICE_API_KEY is not configured")
        return
    if x_vision_api_key != _VISION_SERVICE_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# Include routers. Health stays public (Railway/monitoring hits it with no key).
app.include_router(health_router)
app.include_router(evidence_router, prefix="/v1/evidence", dependencies=[Depends(require_api_key)])
