import os
import socket
import sys
import unittest
from unittest.mock import patch

import cv2
import numpy as np
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import create_app
from app.services.image_loader import (
    _assert_safe_url,
    _fetch_remote_image,
    is_mock_or_local_url,
    load_image_from_url,
    load_image_from_url_with_bytes,
)


LOCAL_ENV = {
    "APP_ENV": "test",
    "ENVIRONMENT": "test",
    "RAILWAY_ENVIRONMENT": "",
    "RAILWAY_ENVIRONMENT_NAME": "",
    "SEMSE_ENVIRONMENT": "test",
}


class FakeResponse:
    def __init__(self, status_code=200, headers=None, chunks=None):
        self.status_code = status_code
        self.headers = headers or {}
        self._chunks = chunks or []
        self.closed = False

    def iter_content(self, chunk_size):
        del chunk_size
        yield from self._chunks

    def close(self):
        self.closed = True


def public_dns_result(hostname, port, **_kwargs):
    del hostname
    return [
        (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("93.184.216.34", port)),
    ]


class TestVisionAuthenticationAndCors(unittest.TestCase):
    def test_health_stays_public_when_production_key_is_missing(self):
        with patch.dict(
            os.environ,
            {**LOCAL_ENV, "RAILWAY_ENVIRONMENT": "production", "VISION_SERVICE_API_KEY": ""},
            clear=False,
        ):
            response = TestClient(create_app()).get("/health")
        self.assertEqual(response.status_code, 200)

    def test_analysis_fails_closed_when_production_key_is_missing(self):
        with patch.dict(
            os.environ,
            {**LOCAL_ENV, "RAILWAY_ENVIRONMENT": "production", "VISION_SERVICE_API_KEY": ""},
            clear=False,
        ):
            response = TestClient(create_app()).post(
                "/v1/evidence/analyze",
                json={"evidenceId": "ev_1", "imageUrl": "mock://test"},
            )
        self.assertEqual(response.status_code, 503)

    def test_analysis_requires_configured_key_and_accepts_the_correct_key(self):
        with patch.dict(
            os.environ,
            {**LOCAL_ENV, "VISION_SERVICE_API_KEY": "test-shared-secret"},
            clear=False,
        ):
            client = TestClient(create_app())
            missing = client.post(
                "/v1/evidence/analyze",
                json={"evidenceId": "ev_1", "imageUrl": "mock://test"},
            )
            wrong = client.post(
                "/v1/evidence/analyze",
                headers={"X-Vision-Api-Key": "wrong"},
                json={"evidenceId": "ev_1", "imageUrl": "mock://test"},
            )
            accepted = client.post(
                "/v1/evidence/analyze",
                headers={"X-Vision-Api-Key": "test-shared-secret"},
                json={"evidenceId": "ev_1", "imageUrl": "mock://test"},
            )

        self.assertEqual(missing.status_code, 401)
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(accepted.status_code, 200)

    def test_cors_uses_explicit_origin_without_credentials(self):
        with patch.dict(
            os.environ,
            {
                **LOCAL_ENV,
                "VISION_CORS_ALLOWED_ORIGINS": "https://app.semseproject.com",
            },
            clear=False,
        ):
            client = TestClient(create_app())
            response = client.options(
                "/v1/evidence/analyze",
                headers={
                    "Origin": "https://app.semseproject.com",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "X-Vision-Api-Key,Content-Type",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "https://app.semseproject.com",
        )
        self.assertNotIn("access-control-allow-credentials", response.headers)

    def test_cors_ignores_wildcard_configuration(self):
        with patch.dict(
            os.environ,
            {**LOCAL_ENV, "VISION_CORS_ALLOWED_ORIGINS": "*"},
            clear=False,
        ):
            response = TestClient(create_app()).options(
                "/v1/evidence/analyze",
                headers={
                    "Origin": "https://attacker.example",
                    "Access-Control-Request-Method": "POST",
                },
            )

        self.assertNotEqual(
            response.headers.get("access-control-allow-origin"),
            "*",
        )
        self.assertNotEqual(
            response.headers.get("access-control-allow-origin"),
            "https://attacker.example",
        )


class TestVisionImageLoaderSecurity(unittest.TestCase):
    def test_local_tokens_in_external_filename_do_not_trigger_mock_mode(self):
        self.assertFalse(
            is_mock_or_local_url(
                "https://bucket.s3.amazonaws.com/evidence/localhost-127.0.0.1.jpg"
            )
        )

    def test_all_resolved_addresses_must_be_public(self):
        addresses = [
            (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("93.184.216.34", 443)),
            (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", ("10.0.0.8", 443)),
        ]
        with (
            patch.dict(os.environ, {"VISION_ALLOWED_HOSTS": "images.example.com"}, clear=False),
            patch("app.services.image_loader.socket.getaddrinfo", return_value=addresses),
            self.assertRaises(HTTPException) as raised,
        ):
            _assert_safe_url("https://images.example.com/photo.jpg")
        self.assertEqual(raised.exception.status_code, 400)

    def test_link_local_ipv4_and_ipv6_are_blocked(self):
        for address in ("169.254.169.254", "fe80::1"):
            family = socket.AF_INET6 if ":" in address else socket.AF_INET
            sockaddr = (address, 443, 0, 0) if family == socket.AF_INET6 else (address, 443)
            with (
                self.subTest(address=address),
                patch.dict(os.environ, {"VISION_ALLOWED_HOSTS": "images.example.com"}, clear=False),
                patch(
                    "app.services.image_loader.socket.getaddrinfo",
                    return_value=[(family, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", sockaddr)],
                ),
                self.assertRaises(HTTPException) as raised,
            ):
                _assert_safe_url("https://images.example.com/photo.jpg")
            self.assertEqual(raised.exception.status_code, 400)

    def test_redirect_to_private_address_is_blocked_before_second_request(self):
        redirect = FakeResponse(
            status_code=302,
            headers={"Location": "https://private.example.com/photo.jpg"},
        )

        def dns_for_host(hostname, port, **_kwargs):
            address = "10.20.30.40" if hostname == "private.example.com" else "93.184.216.34"
            return [
                (socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (address, port)),
            ]

        with (
            patch.dict(
                os.environ,
                {"VISION_ALLOWED_HOSTS": "images.example.com,private.example.com"},
                clear=False,
            ),
            patch("app.services.image_loader.socket.getaddrinfo", side_effect=dns_for_host),
            patch("app.services.image_loader.requests.get", return_value=redirect) as request_get,
            self.assertRaises(HTTPException) as raised,
        ):
            _fetch_remote_image("https://images.example.com/start.jpg")

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(request_get.call_count, 1)
        self.assertTrue(redirect.closed)

    def test_non_image_content_type_is_rejected(self):
        response = FakeResponse(
            headers={"Content-Type": "text/html", "Content-Length": "12"},
            chunks=[b"not-an-image"],
        )
        with (
            patch.dict(os.environ, {"VISION_ALLOWED_HOSTS": "images.example.com"}, clear=False),
            patch("app.services.image_loader.socket.getaddrinfo", side_effect=public_dns_result),
            patch("app.services.image_loader.requests.get", return_value=response),
            self.assertRaises(HTTPException) as raised,
        ):
            _fetch_remote_image("https://images.example.com/photo.jpg")
        self.assertEqual(raised.exception.status_code, 415)
        self.assertTrue(response.closed)

    def test_streamed_body_cannot_exceed_size_limit(self):
        response = FakeResponse(
            headers={"Content-Type": "image/jpeg"},
            chunks=[b"123", b"45"],
        )
        with (
            patch.dict(
                os.environ,
                {
                    "VISION_ALLOWED_HOSTS": "images.example.com",
                    "VISION_MAX_IMAGE_BYTES": "4",
                },
                clear=False,
            ),
            patch("app.services.image_loader.socket.getaddrinfo", side_effect=public_dns_result),
            patch("app.services.image_loader.requests.get", return_value=response),
            self.assertRaises(HTTPException) as raised,
        ):
            _fetch_remote_image("https://images.example.com/photo.jpg")
        self.assertEqual(raised.exception.status_code, 413)
        self.assertTrue(response.closed)

    def test_remote_image_is_downloaded_once_for_pixels_and_exif_bytes(self):
        source = np.full((16, 16, 3), 128, dtype=np.uint8)
        encoded, buffer = cv2.imencode(".jpg", source)
        self.assertTrue(encoded)
        raw_bytes = buffer.tobytes()
        response = FakeResponse(
            headers={
                "Content-Type": "image/jpeg",
                "Content-Length": str(len(raw_bytes)),
            },
            chunks=[raw_bytes],
        )

        with (
            patch.dict(os.environ, {"VISION_ALLOWED_HOSTS": "images.example.com"}, clear=False),
            patch("app.services.image_loader.socket.getaddrinfo", side_effect=public_dns_result),
            patch("app.services.image_loader.requests.get", return_value=response) as request_get,
        ):
            image, downloaded_bytes = load_image_from_url_with_bytes(
                "https://images.example.com/photo.jpg"
            )

        self.assertEqual(request_get.call_count, 1)
        self.assertEqual(image.shape, (16, 16, 3))
        self.assertEqual(downloaded_bytes, raw_bytes)

    def test_mock_and_local_urls_are_disabled_in_production(self):
        with (
            patch.dict(
                os.environ,
                {**LOCAL_ENV, "RAILWAY_ENVIRONMENT": "production"},
                clear=False,
            ),
            self.assertRaises(HTTPException) as raised,
        ):
            load_image_from_url("mock://test")
        self.assertEqual(raised.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
