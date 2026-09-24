"""Sense Vision object recognition route.

Spec: docs/specs/vision/sense-vision-field-library.spec.md §5.2.
Mounted at /v1/objects behind the same X-Vision-Api-Key gate as /v1/evidence.
"""
import logging
import os
from typing import List, Literal, Optional

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.services.image_loader import DEFAULT_FRAME_MAX_BYTES, load_image_from_base64, load_image_from_url
from app.services.object_recognizer import (
    ProviderDisabled,
    ProviderMisconfigured,
    recognize_objects,
    resolve_config,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class VocabularyEntry(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=120)


class RecognizeObjectsRequest(BaseModel):
    imageUrl: Optional[str] = Field(default=None, max_length=2048)
    imageData: Optional[str] = Field(default=None, max_length=2_000_000)
    mimeType: Optional[Literal["image/jpeg", "image/png", "image/webp"]] = None
    vocabulary: List[VocabularyEntry] = Field(default_factory=list, max_length=2000)

    @model_validator(mode="after")
    def exactly_one_image(self):
        if bool(self.imageUrl) == bool(self.imageData):
            raise ValueError("Provide exactly one of imageUrl or imageData")
        if self.imageData and not self.mimeType:
            raise ValueError("mimeType is required with imageData")
        return self


class RecognizedCandidate(BaseModel):
    slug: Optional[str]
    label: Optional[str]
    confidence: float


class RecognizeObjectsResponse(BaseModel):
    provider: str
    model: str
    candidates: List[RecognizedCandidate]


def _frame_max_bytes() -> int:
    try:
        value = int(os.environ.get("VISION_FRAME_MAX_BYTES", DEFAULT_FRAME_MAX_BYTES))
        return value if value > 0 else DEFAULT_FRAME_MAX_BYTES
    except ValueError:
        return DEFAULT_FRAME_MAX_BYTES


@router.post("/recognize", response_model=RecognizeObjectsResponse, tags=["objects"])
def recognize_objects_endpoint(request: RecognizeObjectsRequest):
    try:
        config = resolve_config()
    except ProviderDisabled:
        # Expected state until someone opts in on Railway — the API maps this
        # to status "unavailable" and the UI falls back to manual search.
        raise HTTPException(status_code=503, detail="provider_disabled")
    except ProviderMisconfigured as exc:
        logger.error("Object recognition misconfigured: %s", exc)
        raise HTTPException(status_code=500, detail="provider_misconfigured")

    if request.imageData:
        image = load_image_from_base64(request.imageData, _frame_max_bytes())
    else:
        image = load_image_from_url(request.imageUrl)

    vocabulary = [entry.model_dump() for entry in request.vocabulary]
    try:
        return recognize_objects(image, vocabulary, config)
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="provider_timeout")
    except requests.RequestException as exc:
        # Log the class only: provider error bodies can echo request details.
        logger.warning("Object recognition provider error: %s", type(exc).__name__)
        raise HTTPException(status_code=502, detail="provider_error")
