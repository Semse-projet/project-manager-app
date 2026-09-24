"""Sense Vision — construction object recognition via a multimodal model.

Spec: docs/specs/vision/sense-vision-field-library.spec.md §5.2 / §8.

The OpenCV analyzers in this service classify generic surfaces (drywall,
wood, brick...) and cannot tell an EMT coupling from an EMT connector, so
this module delegates to a vision-language model behind an explicit opt-in:

  VISION_OBJECT_PROVIDER = "ollama" | "openai"   (unset -> disabled)
  VISION_OBJECT_MODEL    = model name (defaults below)

The model only proposes candidates. It is constrained to the library
vocabulary the API sends, and the API (not this service) decides whether a
candidate is a real library item and how confident the answer is. Frames are
held in memory only for the duration of the request and never written.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Iterable, Optional

import cv2
import numpy as np
import requests

logger = logging.getLogger(__name__)

SUPPORTED_PROVIDERS = ("ollama", "openai")
DEFAULT_MODELS = {"ollama": "qwen2.5vl:3b", "openai": "gpt-4o-mini"}
MAX_CANDIDATES = 3
# Downscale before sending to the model: plenty for object identity, keeps
# payloads/latency small, and re-encoding drops EXIF (GPS, device) metadata.
MAX_MODEL_EDGE_PX = 1024


class ProviderDisabled(Exception):
    """No VISION_OBJECT_PROVIDER configured — an expected state, not a failure."""


class ProviderMisconfigured(Exception):
    """VISION_OBJECT_PROVIDER set to something unusable — must be loud."""


@dataclass(frozen=True)
class RecognizerConfig:
    provider: str
    model: str
    timeout_s: float
    ollama_base_url: str
    ollama_api_key: str
    openai_api_key: str
    openai_base_url: str


def resolve_config(env: Optional[dict] = None) -> RecognizerConfig:
    env = os.environ if env is None else env
    provider = (env.get("VISION_OBJECT_PROVIDER") or "").strip().lower()
    if not provider:
        raise ProviderDisabled()
    if provider not in SUPPORTED_PROVIDERS:
        raise ProviderMisconfigured(f"Unsupported VISION_OBJECT_PROVIDER '{provider}'")
    openai_api_key = (env.get("OPENAI_API_KEY") or "").strip()
    if provider == "openai" and not openai_api_key:
        raise ProviderMisconfigured("VISION_OBJECT_PROVIDER=openai requires OPENAI_API_KEY")
    try:
        timeout_s = max(1.0, int(env.get("VISION_OBJECT_TIMEOUT_MS", "10000")) / 1000)
    except ValueError:
        timeout_s = 10.0
    return RecognizerConfig(
        provider=provider,
        model=(env.get("VISION_OBJECT_MODEL") or DEFAULT_MODELS[provider]).strip(),
        timeout_s=timeout_s,
        ollama_base_url=(env.get("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/"),
        ollama_api_key=(env.get("OLLAMA_API_KEY") or "").strip(),
        openai_api_key=openai_api_key,
        openai_base_url=(env.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/"),
    )


# ── Image preparation ─────────────────────────────────────────────────────

def encode_for_model(image: np.ndarray) -> str:
    """Resize (longest edge <= MAX_MODEL_EDGE_PX) and re-encode as JPEG base64."""
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest > MAX_MODEL_EDGE_PX:
        scale = MAX_MODEL_EDGE_PX / float(longest)
        image = cv2.resize(image, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)
    ok, buffer = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        raise ValueError("Could not encode image for the model")
    return base64.b64encode(buffer.tobytes()).decode("ascii")


# ── Prompt & output parsing ───────────────────────────────────────────────

def build_prompt(vocabulary: Iterable[dict]) -> str:
    lines = [f"- {entry['slug']}: {entry['name']}" for entry in vocabulary if entry.get("slug") and entry.get("name")]
    return (
        "You identify the single main construction tool, material, fitting or piece of equipment "
        "in a job-site photo.\n"
        "Choose from this library when it matches (slug: English name):\n"
        + "\n".join(lines)
        + "\n\nRules:\n"
        "- Return up to 3 candidates, most likely first.\n"
        "- Use the library slug when an entry matches; otherwise set slug to null and give your best English label.\n"
        "- confidence is your probability (0 to 1) that the candidate is correct. Be honest: similar-looking items "
        "(coupling vs connector, compression vs set-screw) deserve lower confidence unless the detail is visible.\n"
        "- If there is no clear construction object, return an empty candidates list.\n"
        "- Ignore people, faces, documents, screens and license plates; never describe them.\n"
        'Reply with JSON only: {"candidates": [{"slug": "emt-coupling", "label": "EMT coupling", "confidence": 0.9}]}'
    )


_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def parse_model_output(text: Any, vocabulary_slugs: set[str]) -> list[dict]:
    """Tolerant parsing of the model's reply into validated candidates.

    Malformed output yields an empty list (the API then answers "unknown"),
    never an exception and never a fabricated candidate.
    """
    if not isinstance(text, str) or not text.strip():
        return []
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = _JSON_OBJECT_RE.search(text)
        if not match:
            return []
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return []

    raw_candidates = data.get("candidates") if isinstance(data, dict) else None
    if not isinstance(raw_candidates, list):
        return []

    candidates: list[dict] = []
    for raw in raw_candidates:
        if not isinstance(raw, dict):
            continue
        confidence = raw.get("confidence")
        if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
            continue
        confidence = float(min(1.0, max(0.0, confidence)))
        slug = raw.get("slug")
        slug = slug.strip().lower() if isinstance(slug, str) else None
        if slug not in vocabulary_slugs:
            slug = None
        label = raw.get("label")
        label = label.strip()[:120] if isinstance(label, str) and label.strip() else None
        if slug is None and label is None:
            continue
        candidates.append({"slug": slug, "label": label, "confidence": confidence})
        if len(candidates) >= MAX_CANDIDATES:
            break
    return candidates


# ── Providers ─────────────────────────────────────────────────────────────

def _call_ollama(config: RecognizerConfig, prompt: str, image_b64: str) -> str:
    headers = {"Content-Type": "application/json"}
    if config.ollama_api_key:
        headers["Authorization"] = f"Bearer {config.ollama_api_key}"
    response = requests.post(
        f"{config.ollama_base_url}/api/chat",
        json={
            "model": config.model,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0},
            "messages": [{"role": "user", "content": prompt, "images": [image_b64]}],
        },
        headers=headers,
        timeout=config.timeout_s,
    )
    response.raise_for_status()
    return (response.json().get("message") or {}).get("content", "")


def _call_openai(config: RecognizerConfig, prompt: str, image_b64: str) -> str:
    response = requests.post(
        f"{config.openai_base_url}/chat/completions",
        json={
            "model": config.model,
            "temperature": 0,
            "max_tokens": 300,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}", "detail": "low"}},
                    ],
                }
            ],
        },
        headers={"Authorization": f"Bearer {config.openai_api_key}", "Content-Type": "application/json"},
        timeout=config.timeout_s,
    )
    response.raise_for_status()
    choices = response.json().get("choices") or []
    return ((choices[0] if choices else {}).get("message") or {}).get("content", "")


_PROVIDER_CALLS = {"ollama": _call_ollama, "openai": _call_openai}


def recognize_objects(image: np.ndarray, vocabulary: list[dict], config: RecognizerConfig) -> dict:
    prompt = build_prompt(vocabulary)
    image_b64 = encode_for_model(image)
    raw_text = _PROVIDER_CALLS[config.provider](config, prompt, image_b64)
    slugs = {entry["slug"] for entry in vocabulary if isinstance(entry.get("slug"), str)}
    return {
        "provider": config.provider,
        "model": config.model,
        "candidates": parse_model_output(raw_text, slugs),
    }
