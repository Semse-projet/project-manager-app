from fastapi import APIRouter

router = APIRouter()

@router.get("/health", tags=["system"])
def health_check():
    return {
        "status": "ok",
        "service": "semse-vision-service",
        "version": "0.1.0"
    }
