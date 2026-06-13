from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router as health_router
from app.routes.evidence import router as evidence_router

app = FastAPI(
    title="SEMSE Vision Service",
    version="0.1.0",
    description="Computer vision service for SEMSE evidence analysis using OpenCV."
)

# Enable CORS for communication within the monorepo services
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(evidence_router, prefix="/v1/evidence")
