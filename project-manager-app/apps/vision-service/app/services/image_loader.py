import base64
import binascii
import ipaddress
import os
import re
import socket
from urllib.parse import urljoin, urlparse

import cv2
import numpy as np
import requests
from fastapi import HTTPException

_ALLOWED_HOST_RE = re.compile(
    r"^("
    r"[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.railway\.app"
    r"|[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.amazonaws\.com"
    r"|[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.supabase\.co"
    r"|[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.supabase\.in"
    r"|[a-z0-9\-]+(?:\.[a-z0-9\-]+)*\.cloudinary\.com"
    r"|[a-z0-9\-\.]+\.backblazeb2\.com"
    r"|[a-z0-9\-\.]+\.r2\.cloudflarestorage\.com"
    r"|[a-z0-9\-\.]+\.blob\.core\.windows\.net"
    r"|[a-z0-9\-\.]+\.storage\.googleapis\.com"
    r"|[a-z0-9\-\.]+\.digitaloceanspaces\.com"
    r")$",
    re.IGNORECASE,
)

_ALLOWED_CONTENT_TYPES = {
    "image/bmp",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
}
_DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024
_DEFAULT_MAX_IMAGE_PIXELS = 40_000_000
_DEFAULT_TIMEOUT_SECONDS = 15
_DEFAULT_MAX_REDIRECTS = 3
_DOWNLOAD_CHUNK_BYTES = 64 * 1024


def _positive_int_env(name: str, default: int, maximum: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        return default
    if value <= 0:
        return default
    return min(value, maximum)


def _is_production_environment() -> bool:
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


def _mock_sources_allowed() -> bool:
    if _is_production_environment():
        return False
    explicit = os.environ.get("VISION_ALLOW_MOCK_URLS", "").strip().lower()
    if explicit:
        return explicit in {"1", "true", "yes"}
    return True


def _extra_allowed_hosts() -> set[str]:
    return {
        host.strip().lower().rstrip(".")
        for host in os.environ.get("VISION_ALLOWED_HOSTS", "").split(",")
        if host.strip()
    }


def _assert_safe_url(url: str) -> None:
    try:
        parsed = urlparse(url)
        port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Invalid image URL.") from error

    scheme = parsed.scheme.lower()
    if scheme not in ("https", "http"):
        raise HTTPException(status_code=400, detail="Only http/https image URLs are allowed.")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="Image URLs cannot include credentials.")
    if port not in (80, 443):
        raise HTTPException(status_code=400, detail="Only standard HTTP(S) ports are allowed.")

    hostname = (parsed.hostname or "").lower().rstrip(".")
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL: missing hostname.")
    if not (_ALLOWED_HOST_RE.fullmatch(hostname) or hostname in _extra_allowed_hosts()):
        raise HTTPException(
            status_code=400,
            detail=f"Image host '{hostname}' is not in the allowed list. "
                   "Set VISION_ALLOWED_HOSTS to extend it.",
        )

    try:
        addresses = {
            result[4][0].split("%", 1)[0]
            for result in socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
        }
    except OSError as error:
        raise HTTPException(status_code=400, detail=f"Cannot resolve hostname: {hostname}") from error
    if not addresses:
        raise HTTPException(status_code=400, detail=f"Cannot resolve hostname: {hostname}")

    for resolved_ip in addresses:
        try:
            address = ipaddress.ip_address(resolved_ip)
        except ValueError as error:
            raise HTTPException(status_code=400, detail="Hostname resolved to an invalid address.") from error
        if not address.is_global:
            raise HTTPException(status_code=400, detail="Image URL resolves to a private/internal address.")


def is_mock_or_local_url(url: str) -> bool:
    """True only when the URL's scheme/hostname is actually the mock shortcut
    or a local dev host — not merely a substring match on the whole URL, which
    let an attacker-chosen filename like ".../127.0.0.1-photo.jpg" on a real
    external host redirect to the fixed mock image and skip real analysis.
    """
    parsed = urlparse(url)
    if parsed.scheme.lower() == "mock":
        return True
    hostname = (parsed.hostname or "").lower().rstrip(".")
    return hostname in ("localhost", "127.0.0.1", "::1")


def _mock_image() -> np.ndarray:
    image = np.ones((512, 512, 3), dtype=np.uint8) * 128
    cv2.putText(
        image,
        "SEMSE Vision Mock",
        (50, 250),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        (255, 255, 255),
        2,
    )
    cv2.line(image, (0, 0), (512, 512), (0, 0, 255), 3)
    return image


def _read_limited_body(response: requests.Response, max_bytes: int) -> bytes:
    content_length = response.headers.get("Content-Length")
    if content_length:
        try:
            declared_bytes = int(content_length)
        except ValueError as error:
            raise HTTPException(status_code=400, detail="Invalid image Content-Length.") from error
        if declared_bytes < 0 or declared_bytes > max_bytes:
            raise HTTPException(status_code=413, detail="Image exceeds the maximum allowed size.")

    chunks: list[bytes] = []
    total_bytes = 0
    for chunk in response.iter_content(chunk_size=_DOWNLOAD_CHUNK_BYTES):
        if not chunk:
            continue
        total_bytes += len(chunk)
        if total_bytes > max_bytes:
            raise HTTPException(status_code=413, detail="Image exceeds the maximum allowed size.")
        chunks.append(chunk)
    return b"".join(chunks)


def _fetch_remote_image(url: str) -> bytes:
    max_bytes = _positive_int_env(
        "VISION_MAX_IMAGE_BYTES",
        _DEFAULT_MAX_IMAGE_BYTES,
        32 * 1024 * 1024,
    )
    timeout_seconds = _positive_int_env(
        "VISION_IMAGE_TIMEOUT_SECONDS",
        _DEFAULT_TIMEOUT_SECONDS,
        60,
    )
    max_redirects = _positive_int_env(
        "VISION_MAX_IMAGE_REDIRECTS",
        _DEFAULT_MAX_REDIRECTS,
        5,
    )
    current_url = url

    for redirect_count in range(max_redirects + 1):
        _assert_safe_url(current_url)
        try:
            response = requests.get(
                current_url,
                allow_redirects=False,
                headers={"Accept": ", ".join(sorted(_ALLOWED_CONTENT_TYPES))},
                stream=True,
                timeout=(5, timeout_seconds),
            )
        except requests.RequestException as error:
            raise HTTPException(status_code=400, detail="Network error fetching image.") from error

        try:
            if response.status_code in {301, 302, 303, 307, 308}:
                location = response.headers.get("Location")
                if not location:
                    raise HTTPException(status_code=400, detail="Image redirect is missing a location.")
                if redirect_count >= max_redirects:
                    raise HTTPException(status_code=400, detail="Image URL exceeded the redirect limit.")
                current_url = urljoin(current_url, location)
                continue

            if response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to fetch image. Status: {response.status_code}",
                )

            content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            if content_type not in _ALLOWED_CONTENT_TYPES:
                raise HTTPException(status_code=415, detail="Remote content is not an allowed image type.")
            try:
                return _read_limited_body(response, max_bytes)
            except requests.RequestException as error:
                raise HTTPException(status_code=400, detail="Network error fetching image.") from error
        finally:
            response.close()

    raise HTTPException(status_code=400, detail="Image URL exceeded the redirect limit.")


def load_image_from_url_with_bytes(url: str) -> tuple[np.ndarray, bytes | None]:
    if is_mock_or_local_url(url):
        if not _mock_sources_allowed():
            raise HTTPException(status_code=400, detail="Mock/local image URLs are disabled.")
        return _mock_image(), None

    image_bytes = _fetch_remote_image(url)
    image = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Downloaded bytes could not be decoded as an image.")

    max_pixels = _positive_int_env(
        "VISION_MAX_IMAGE_PIXELS",
        _DEFAULT_MAX_IMAGE_PIXELS,
        100_000_000,
    )
    if int(image.shape[0]) * int(image.shape[1]) > max_pixels:
        raise HTTPException(status_code=413, detail="Decoded image exceeds the maximum pixel count.")
    return image, image_bytes


def load_image_from_url(url: str) -> np.ndarray:
    image, _ = load_image_from_url_with_bytes(url)
    return image


# Sense Vision live frames (spec: vision/sense-vision-field-library §5.2).
# The API already validated MIME, base64 and size; this re-checks size and
# decodability because this service must not trust its caller blindly.
DEFAULT_FRAME_MAX_BYTES = 700_000


def load_image_from_base64(image_data: str, max_bytes: int = DEFAULT_FRAME_MAX_BYTES) -> np.ndarray:
    try:
        raw = base64.b64decode(image_data, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="imageData is not valid base64.")
    if not raw:
        raise HTTPException(status_code=400, detail="imageData is empty.")
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail="Frame is too large.")
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="imageData could not be decoded as an image.")
    return image
