import os
import json
import logging
import requests
from typing import Optional

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT_MS", "15000")) // 1000
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY", "")

SYSTEM_PROMPTS = {
    "material": (
        "You are a senior construction materials expert. "
        "Given a JSON analysis of building materials detected in a photo, "
        "provide concise, actionable trade advice in 2-4 sentences. "
        "Include: what materials to order, prep steps, and any risk to flag. "
        "Reply ONLY with plain text — no markdown, no bullet lists."
    ),
    "space": (
        "You are a construction project intake specialist. "
        "Given a JSON classification of a construction space, "
        "summarize what the space needs in 2-3 sentences and suggest the most relevant trade. "
        "Mention if photos confirm or contradict the client's stated scope. "
        "Reply ONLY with plain text — no markdown."
    ),
    "safety": (
        "You are a construction safety officer. "
        "Given a JSON safety check result for a job-site photo, "
        "write a 2-3 sentence safety briefing: what PPE is missing, the compliance score, "
        "and the single most urgent corrective action. "
        "Reply ONLY with plain text — no markdown."
    ),
    "portfolio": (
        "You are a contractor portfolio verification specialist. "
        "Given a JSON fraud and quality analysis of a portfolio photo, "
        "explain in 2-3 sentences why the photo was flagged approve/review/reject. "
        "Be direct and reference specific scores. "
        "Reply ONLY with plain text — no markdown."
    ),
}


def _build_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if OLLAMA_API_KEY:
        headers["Authorization"] = f"Bearer {OLLAMA_API_KEY}"
    return headers


def enrich(domain: str, cv_result: dict) -> Optional[str]:
    """
    Sends cv_result JSON to Ollama and returns a plain-text insight string.
    Returns None on any error so callers can degrade gracefully.
    """
    system_prompt = SYSTEM_PROMPTS.get(domain)
    if not system_prompt:
        return None

    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(cv_result, ensure_ascii=False)},
        ],
    }

    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
            headers=_build_headers(),
            timeout=OLLAMA_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data.get("message", {}).get("content", "").strip()
        return content if content else None
    except Exception as exc:
        logger.warning("Ollama enrichment failed (domain=%s): %s", domain, exc)
        return None
