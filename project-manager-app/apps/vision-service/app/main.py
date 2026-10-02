import hmac
import os

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.routes.health import router as health_router
from app.routes.evidence import router as evidence_router
from app.routes.objects import router as objects_router


def is_production_environment() -> bool:
    environment = (
        os.environ.get("SEMSE_ENVIRONMENT")
        or os.environ.get("APP_ENV")
        or os.environ.get("ENVIRONMENT")
        or os.environ.get("NODE_ENV")
        or ""
    ).strip().lower()
    return bool(
        os.environ.get("RAILWAY_ENVIRONMENT")
        or os.environ.get("RAILWAY_ENVIRONMENT_NAME")
        or environment in {"production", "prod"}
    )


def cors_allowed_origins() -> list[str]:
    # This service is server-to-server. A wildcard is never a valid configured
    # origin here, even with allow_credentials disabled.
    return [
        origin
        for origin in (
            value.strip()
            for value in os.environ.get("VISION_CORS_ALLOWED_ORIGINS", "").split(",")
        )
        if origin and origin != "*"
    ]


async def require_api_key(x_vision_api_key: str = Header(default="", alias="X-Vision-Api-Key")) -> None:
    """Shared-secret gate: no endpoint here checked identity at all before —
    anyone with the public URL could run the full (costly) analysis suite for
    free. Permissive when VISION_SERVICE_API_KEY is unset outside production,
    matching this repo's existing fail-closed-in-prod-only pattern, so local
    dev keeps working without extra config.
    """
    expected_api_key = os.environ.get("VISION_SERVICE_API_KEY", "").strip()
    if not expected_api_key:
        if is_production_environment():
            raise HTTPException(status_code=503, detail="VISION_SERVICE_API_KEY is not configured")
        return
    if not hmac.compare_digest(x_vision_api_key, expected_api_key):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def create_app() -> FastAPI:
    app = FastAPI(
        title="SEMSE Vision Service",
        version="0.1.0",
        description="Computer vision service for SEMSE evidence analysis using OpenCV.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_allowed_origins(),
        allow_credentials=False,
        allow_methods=["POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Vision-Api-Key"],
    )

    # Health stays public so Railway and monitoring can assess availability.
    app.include_router(health_router)
    app.include_router(
        evidence_router,
        prefix="/v1/evidence",
        dependencies=[Depends(require_api_key)],
    )
    # Sense Vision object recognition (spec: vision/sense-vision-field-library).
    app.include_router(
        objects_router,
        prefix="/v1/objects",
        dependencies=[Depends(require_api_key)],
    )
    return app


app = create_app()
