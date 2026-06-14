import base64
import io
import cv2
import numpy as np
from typing import List, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont

from app.services.image_loader import load_image_from_url

def _overlay_timestamp(frame_bgr: np.ndarray, label: str) -> np.ndarray:
    overlay = frame_bgr.copy()
    h, w = overlay.shape[:2]
    cv2.rectangle(overlay, (0, h - 30), (w, h), (0, 0, 0), -1)
    cv2.putText(overlay, label, (8, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
    return overlay

def build_progress_timeline(
    image_urls: List[str],
    labels: Optional[List[str]] = None,
    output_size: Tuple[int, int] = (640, 480),
    fps: int = 2,
) -> str:
    if not image_urls:
        raise ValueError("At least one image URL is required")
    if fps < 1 or fps > 10:
        fps = 2

    labels = labels or [f"Frame {i + 1}" for i in range(len(image_urls))]
    frames_pil: List[Image.Image] = []

    for url, label in zip(image_urls, labels):
        bgr = load_image_from_url(url)
        bgr_resized = cv2.resize(bgr, output_size, interpolation=cv2.INTER_AREA)
        bgr_labeled = _overlay_timestamp(bgr_resized, label)
        rgb = cv2.cvtColor(bgr_labeled, cv2.COLOR_BGR2RGB)
        frames_pil.append(Image.fromarray(rgb))

    if not frames_pil:
        raise ValueError("No frames could be loaded")

    buf = io.BytesIO()
    duration_ms = max(100, int(1000 / fps))
    frames_pil[0].save(
        buf,
        format="GIF",
        save_all=True,
        append_images=frames_pil[1:],
        loop=0,
        duration=duration_ms,
        optimize=False,
    )
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")
