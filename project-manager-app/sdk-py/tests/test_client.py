"""SAT-001 anillo 2 (Python) — semse_sdk: auth header, versión, envelope,
errores tipados y reintentos. Mirrors tests/unit/sdk-client.test.ts's
coverage for the subset this SDK implements (auth + intake, per this
spec's section 4/5 scope — jobs/milestones/satellites are TS-SDK-only
extensions beyond the original ask).

Run: python3 -m unittest discover -s sdk-py/tests -t sdk-py
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from semse_sdk import (  # noqa: E402
    SDK_VERSION,
    HttpResponse,
    SemseApiError,
    SemseAuthError,
    SemseClient,
    SemseDisabledError,
    SemseNetworkError,
    SemseScopeError,
)


def json_response(status: int, body: object) -> HttpResponse:
    return HttpResponse(status=status, body=json.dumps(body).encode("utf-8"))


class RecordedCall:
    def __init__(self, method: str, url: str, headers: dict, body):
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body


def make_client(responses, calls: list, **extra):
    queue = list(responses) if not callable(responses) else responses

    def http_fn(method, url, headers, body, timeout):
        calls.append(RecordedCall(method, url, headers, body))
        if callable(queue):
            return queue()
        if not queue:
            raise RuntimeError("no more mocked responses")
        return queue.pop(0)

    return SemseClient(base_url="https://api.semse.test/", token="sst_test", http_fn=http_fn, **extra)


class SdkClientTest(unittest.TestCase):
    def test_sends_bearer_and_sdk_version_and_unwraps_envelope(self):
        calls: list = []
        client = make_client(
            [json_response(200, {"requestId": "r1", "data": {"intakeId": "int_1"}})], calls
        )

        result = client.intake.get("int_1")

        self.assertEqual(result, {"intakeId": "int_1"})
        self.assertEqual(calls[0].url, "https://api.semse.test/v1/intake/int_1")
        self.assertEqual(calls[0].headers["authorization"], "Bearer sst_test")
        self.assertEqual(calls[0].headers["x-semse-sdk-version"], SDK_VERSION)

    def test_401_403_503_map_to_typed_errors(self):
        with self.assertRaises(SemseAuthError):
            make_client([json_response(401, {"message": "Invalid satellite token"})], []).intake.get("x")

        with self.assertRaises(SemseScopeError) as ctx:
            make_client(
                [json_response(403, {"message": "lacks scopes", "missing": ["intake:read"]})], []
            ).intake.get("x")
        self.assertEqual(ctx.exception.missing, ["intake:read"])

        with self.assertRaises(SemseDisabledError):
            make_client([json_response(503, {"message": "disabled"})], []).intake.get("x")

    def test_get_retries_on_5xx_and_network_failure_post_does_not(self):
        recovered = make_client(
            [
                json_response(500, {"message": "boom"}),
                json_response(200, {"requestId": "r2", "data": {"ok": True}}),
            ],
            [],
        ).intake.get("x")
        self.assertEqual(recovered, {"ok": True})

        calls: list = []

        def always_fails(*_args, **_kwargs):
            raise ConnectionError("ECONNREFUSED")

        failing = make_client(always_fails, calls)
        with self.assertRaises(SemseNetworkError):
            failing.intake.analyze(raw_description="remodelar mi baño completo")
        self.assertEqual(len(calls), 1)

    def test_non_auth_4xx_maps_to_api_error_with_status(self):
        with self.assertRaises(SemseApiError) as ctx:
            make_client([json_response(400, {"message": "bad input"})], []).intake.get("x")
        self.assertEqual(ctx.exception.status, 400)

    def test_intake_analyze_posts_with_optional_channel(self):
        calls: list = []
        client = make_client([json_response(200, {"requestId": "r3", "data": {"intakeId": "int_1"}})], calls)

        client.intake.analyze(raw_description="quiero remodelar mi baño", channel="alexa")

        self.assertEqual(calls[0].url, "https://api.semse.test/v1/intake/analyze")
        self.assertEqual(calls[0].method, "POST")
        self.assertEqual(calls[0].headers["x-semse-channel"], "alexa")
        self.assertEqual(json.loads(calls[0].body), {"rawDescription": "quiero remodelar mi baño"})

    def test_intake_answer_uses_patch(self):
        calls: list = []
        client = make_client([json_response(200, {"requestId": "r4", "data": {}})], calls)

        client.intake.answer("int_1", question_id="q1", selected_values=["tile"])

        self.assertEqual(calls[0].url, "https://api.semse.test/v1/intake/int_1/answer")
        self.assertEqual(calls[0].method, "PATCH")

    def test_without_app_token_header_absent(self):
        calls: list = []
        make_client([json_response(200, {"requestId": "r5", "data": {"ok": True}})], calls).intake.get("x")

        self.assertNotIn("x-semse-app-token", calls[0].headers)

    def test_with_app_token_sends_header_alongside_bearer(self):
        calls: list = []
        client = make_client(
            [json_response(200, {"requestId": "r6", "data": {}})], calls, app_token="sst_mobile_app_token"
        )

        client.intake.get("x")

        self.assertEqual(calls[0].headers["authorization"], "Bearer sst_test")
        self.assertEqual(calls[0].headers["x-semse-app-token"], "sst_mobile_app_token")


if __name__ == "__main__":
    unittest.main()
