"""Sense Vision object recognition — spec: docs/specs/vision/sense-vision-field-library.spec.md §9.

Run: python -m unittest discover -s tests   (from apps/vision-service)
No network: provider HTTP calls are patched.
"""
import base64
import json
import os
import sys
import unittest
import unittest.mock

import cv2
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import HTTPException  # noqa: E402

from app.services import object_recognizer  # noqa: E402
from app.services.image_loader import load_image_from_base64  # noqa: E402
from app.services.object_recognizer import (  # noqa: E402
    ProviderDisabled,
    ProviderMisconfigured,
    build_prompt,
    encode_for_model,
    parse_model_output,
    recognize_objects,
    resolve_config,
)

try:
    from fastapi.testclient import TestClient  # needs httpx (test-only dependency)
except Exception:  # pragma: no cover
    TestClient = None

VOCAB = [{"slug": "emt-coupling", "name": "EMT coupling"}, {"slug": "emt-connector", "name": "EMT connector"}]
SLUGS = {entry["slug"] for entry in VOCAB}


def jpeg_b64(width=64, height=48) -> str:
    image = np.full((height, width, 3), 200, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", image)
    assert ok
    return base64.b64encode(buf.tobytes()).decode("ascii")


class TestResolveConfig(unittest.TestCase):
    def test_unset_provider_is_disabled(self):
        with self.assertRaises(ProviderDisabled):
            resolve_config({})

    def test_unknown_provider_is_loud(self):
        with self.assertRaises(ProviderMisconfigured):
            resolve_config({"VISION_OBJECT_PROVIDER": "magic"})

    def test_openai_without_key_is_loud(self):
        with self.assertRaises(ProviderMisconfigured):
            resolve_config({"VISION_OBJECT_PROVIDER": "openai"})

    def test_defaults(self):
        config = resolve_config({"VISION_OBJECT_PROVIDER": "ollama"})
        self.assertEqual(config.model, "qwen2.5vl:3b")
        config = resolve_config({"VISION_OBJECT_PROVIDER": "OpenAI", "OPENAI_API_KEY": "k", "VISION_OBJECT_MODEL": "m"})
        self.assertEqual((config.provider, config.model), ("openai", "m"))


class TestParseModelOutput(unittest.TestCase):
    def test_valid_json(self):
        text = json.dumps({"candidates": [{"slug": "emt-coupling", "label": "EMT coupling", "confidence": 0.91}]})
        self.assertEqual(parse_model_output(text, SLUGS), [{"slug": "emt-coupling", "label": "EMT coupling", "confidence": 0.91}])

    def test_json_wrapped_in_prose(self):
        text = 'Sure! ```json\n{"candidates": [{"slug": "emt-connector", "label": "x", "confidence": 0.6}]}\n```'
        self.assertEqual(parse_model_output(text, SLUGS)[0]["slug"], "emt-connector")

    def test_garbage_yields_empty(self):
        for text in ["", "no idea", "{not json", None, 42, json.dumps({"candidates": "nope"}), json.dumps([1, 2])]:
            self.assertEqual(parse_model_output(text, SLUGS), [], text)

    def test_unknown_slug_is_dropped_but_label_kept(self):
        text = json.dumps({"candidates": [{"slug": "made-up", "label": "Mystery widget", "confidence": 0.7}]})
        self.assertEqual(parse_model_output(text, SLUGS), [{"slug": None, "label": "Mystery widget", "confidence": 0.7}])

    def test_confidence_clamped_and_invalid_skipped(self):
        text = json.dumps(
            {
                "candidates": [
                    {"slug": "emt-coupling", "confidence": 1.7},
                    {"slug": "emt-connector", "confidence": "high"},
                    {"slug": "emt-connector", "confidence": True},
                    {"slug": None, "label": None, "confidence": 0.4},
                ]
            }
        )
        self.assertEqual(parse_model_output(text, SLUGS), [{"slug": "emt-coupling", "label": None, "confidence": 1.0}])

    def test_caps_at_three(self):
        text = json.dumps({"candidates": [{"label": f"x{i}", "confidence": 0.5} for i in range(6)]})
        self.assertEqual(len(parse_model_output(text, SLUGS)), 3)


class TestImageHandling(unittest.TestCase):
    def test_base64_roundtrip(self):
        image = load_image_from_base64(jpeg_b64())
        self.assertEqual(image.shape[:2], (48, 64))

    def test_invalid_base64(self):
        with self.assertRaises(HTTPException) as ctx:
            load_image_from_base64("not*base64")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_not_an_image(self):
        with self.assertRaises(HTTPException) as ctx:
            load_image_from_base64(base64.b64encode(b"hello world").decode())
        self.assertEqual(ctx.exception.status_code, 400)

    def test_too_large(self):
        with self.assertRaises(HTTPException) as ctx:
            load_image_from_base64(jpeg_b64(), max_bytes=10)
        self.assertEqual(ctx.exception.status_code, 413)

    def test_encode_for_model_downscales(self):
        big = np.zeros((3000, 2000, 3), dtype=np.uint8)
        decoded = cv2.imdecode(np.frombuffer(base64.b64decode(encode_for_model(big)), np.uint8), cv2.IMREAD_COLOR)
        self.assertEqual(max(decoded.shape[:2]), 1024)


class TestRecognizeObjects(unittest.TestCase):
    def test_prompt_lists_vocabulary(self):
        prompt = build_prompt(VOCAB)
        self.assertIn("emt-coupling: EMT coupling", prompt)
        self.assertIn("JSON", prompt)

    def test_provider_output_is_parsed(self):
        config = resolve_config({"VISION_OBJECT_PROVIDER": "ollama"})
        reply = json.dumps({"candidates": [{"slug": "emt-coupling", "label": "EMT coupling", "confidence": 0.88}]})
        with unittest.mock.patch.dict(object_recognizer._PROVIDER_CALLS, {"ollama": lambda *_: reply}):
            result = recognize_objects(np.zeros((32, 32, 3), dtype=np.uint8), VOCAB, config)
        self.assertEqual(result["provider"], "ollama")
        self.assertEqual(result["candidates"][0]["slug"], "emt-coupling")


@unittest.skipIf(TestClient is None, "httpx not installed")
class TestRoute(unittest.TestCase):
    def setUp(self):
        from app.main import app

        self.client = TestClient(app)

    def test_disabled_provider_returns_503(self):
        with unittest.mock.patch.dict(os.environ, {"VISION_OBJECT_PROVIDER": ""}):
            response = self.client.post(
                "/v1/objects/recognize", json={"imageData": jpeg_b64(), "mimeType": "image/jpeg", "vocabulary": VOCAB}
            )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"], "provider_disabled")

    def test_requires_exactly_one_image(self):
        response = self.client.post("/v1/objects/recognize", json={"vocabulary": VOCAB})
        self.assertEqual(response.status_code, 422)
        response = self.client.post(
            "/v1/objects/recognize",
            json={"imageUrl": "mock://x", "imageData": jpeg_b64(), "mimeType": "image/jpeg", "vocabulary": VOCAB},
        )
        self.assertEqual(response.status_code, 422)

    def test_success_with_patched_provider(self):
        reply = json.dumps({"candidates": [{"slug": "emt-connector", "label": "EMT connector", "confidence": 0.7}]})
        with unittest.mock.patch.dict(os.environ, {"VISION_OBJECT_PROVIDER": "ollama"}), unittest.mock.patch.dict(
            object_recognizer._PROVIDER_CALLS, {"ollama": lambda *_: reply}
        ):
            response = self.client.post(
                "/v1/objects/recognize", json={"imageData": jpeg_b64(), "mimeType": "image/jpeg", "vocabulary": VOCAB}
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["candidates"][0]["slug"], "emt-connector")

    def test_provider_timeout_maps_to_504(self):
        import requests

        def boom(*_):
            raise requests.Timeout()

        with unittest.mock.patch.dict(os.environ, {"VISION_OBJECT_PROVIDER": "ollama"}), unittest.mock.patch.dict(
            object_recognizer._PROVIDER_CALLS, {"ollama": boom}
        ):
            response = self.client.post(
                "/v1/objects/recognize", json={"imageData": jpeg_b64(), "mimeType": "image/jpeg", "vocabulary": VOCAB}
            )
        self.assertEqual(response.status_code, 504)


if __name__ == "__main__":
    unittest.main()
