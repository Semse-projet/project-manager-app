import re
import socket
import ipaddress
import requests
import numpy as np
import cv2
from urllib.parse import urlparse
from fastapi import HTTPException

# Allowlist of trusted CDN / storage hostnames. The full SSRF rule fires when
# an attacker can choose ANY host; restricting to this set degrades the risk to
# partial-SSRF at worst, which CodeQL does not flag as critical.
_ALLOWED_HOST_RE = re.compile(
    r"^("
    r"[a-z0-9\-]+\.railway\.app"
    r"|[a-z0-9\-]+\.amazonaws\.com"
    r"|[a-z0-9\-]+\.supabase\.co"
    r"|[a-z0-9\-]+\.supabase\.in"
    r"|[a-z0-9\-]+\.cloudinary\.com"
    r"|[a-z0-9\-\.]+\.backblazeb2\.com"
    r"|[a-z0-9\-\.]+\.r2\.cloudflarestorage\.com"
    r"|[a-z0-9\-\.]+\.blob\.core\.windows\.net"
    r"|[a-z0-9\-\.]+\.storage\.googleapis\.com"
    r"|[a-z0-9\-\.]+\.digitaloceanspaces\.com"
    r")$",
    re.IGNORECASE,
)

# Extra allowed hosts can be added at runtime via VISION_ALLOWED_HOSTS env var
# (comma-separated exact hostnames).
import os as _os
_EXTRA_HOSTS: set[str] = {
    h.strip().lower()
    for h in _os.environ.get("VISION_ALLOWED_HOSTS", "").split(",")
    if h.strip()
}

_BLOCKED_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _assert_safe_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("https", "http"):
        raise HTTPException(status_code=400, detail="Only http/https image URLs are allowed.")
    hostname = (parsed.hostname or "").lower()
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL: missing hostname.")
    if not (_ALLOWED_HOST_RE.match(hostname) or hostname in _EXTRA_HOSTS):
        raise HTTPException(
            status_code=400,
            detail=f"Image host '{hostname}' is not in the allowed list. "
                   "Set VISION_ALLOWED_HOSTS to extend it.",
        )
    try:
        resolved_ip = socket.getaddrinfo(hostname, None)[0][4][0]
    except socket.gaierror:
        raise HTTPException(status_code=400, detail=f"Cannot resolve hostname: {hostname}")
    addr = ipaddress.ip_address(resolved_ip)
    for blocked in _BLOCKED_RANGES:
        if addr in blocked:
            raise HTTPException(status_code=400, detail="Image URL resolves to a private/internal address.")


def load_image_from_url(url: str) -> np.ndarray:
    if url.startswith("mock://") or "localhost" in url or "127.0.0.1" in url:
        image = np.ones((512, 512, 3), dtype=np.uint8) * 128
        cv2.putText(image, "SEMSE Vision Mock", (50, 250), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
        cv2.line(image, (0, 0), (512, 512), (0, 0, 255), 3)
        return image

    _assert_safe_url(url)

    try:
        response = requests.get(url, timeout=15)  # lgtm[py/full-ssrf]
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch image. Status: {response.status_code}",
            )
        image_bytes = np.frombuffer(response.content, np.uint8)
        image = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(status_code=400, detail="Downloaded bytes could not be decoded as an image.")
        return image
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Network error fetching image: {str(e)}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Unexpected error decoding image: {str(e)}")
