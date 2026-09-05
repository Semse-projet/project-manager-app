"""SEMSE satellite SDK client (SAT-001).

Python counterpart to packages/sdk/src/client.ts (@semse/sdk) — same auth
headers, same envelope unwrapping (`{requestId, data}`), same status-code to
error-class mapping, same retry policy (idempotent GETs retry, POST/PATCH
don't). Kept dependency-free (stdlib `urllib` only) so this package needs no
pip install beyond itself to run or test.
"""

from __future__ import annotations

import json as _json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

from .errors import (
    SemseApiError,
    SemseAuthError,
    SemseDisabledError,
    SemseNetworkError,
    SemseScopeError,
)

SDK_VERSION = "0.1.0"


@dataclass
class HttpResponse:
    status: int
    body: bytes

    def json(self) -> Any:
        return _json.loads(self.body.decode("utf-8"))


# (method, url, headers, body_bytes_or_none, timeout_seconds) -> HttpResponse
HttpFn = Callable[[str, str, Dict[str, str], Optional[bytes], float], HttpResponse]


def _default_http_fn(
    method: str, url: str, headers: Dict[str, str], body: Optional[bytes], timeout: float
) -> HttpResponse:
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return HttpResponse(status=response.status, body=response.read())
    except urllib.error.HTTPError as error:
        # HTTPError *is* the response for a non-2xx status — read its body
        # instead of treating it as a network failure.
        return HttpResponse(status=error.code, body=error.read())


class SemseClient:
    """Client for the SEMSE `/v1` API, satellite-token or SEMSE Signed Token
    authenticated.
    """

    def __init__(
        self,
        base_url: str,
        token: str,
        app_token: Optional[str] = None,
        timeout_ms: int = 15_000,
        retries: int = 2,
        http_fn: Optional[HttpFn] = None,
    ) -> None:
        if not base_url:
            raise SemseNetworkError("base_url is required")
        if not token:
            raise SemseAuthError("token is required")

        self.base_url = base_url.rstrip("/")
        self.token = token
        self.app_token = app_token
        self.timeout_ms = timeout_ms
        self.retries = retries
        self.http_fn: HttpFn = http_fn or _default_http_fn

        from .resources.intake import IntakeResource

        self.intake = IntakeResource(self)

    def get(self, path: str, headers: Optional[Dict[str, str]] = None) -> Any:
        return self._request("GET", path, None, headers, self.retries)

    def post(self, path: str, body: Any = None, headers: Optional[Dict[str, str]] = None) -> Any:
        return self._request("POST", path, body, headers, 0)

    def patch(self, path: str, body: Any = None, headers: Optional[Dict[str, str]] = None) -> Any:
        return self._request("PATCH", path, body, headers, 0)

    def _request(
        self,
        method: str,
        path: str,
        body: Any,
        headers: Optional[Dict[str, str]],
        retries_left: int,
    ) -> Any:
        request_headers = {
            "authorization": f"Bearer {self.token}",
            "content-type": "application/json",
            "x-semse-sdk-version": SDK_VERSION,
        }
        if self.app_token:
            request_headers["x-semse-app-token"] = self.app_token
        if headers:
            request_headers.update(headers)

        encoded_body = None if body is None else _json.dumps(body).encode("utf-8")

        try:
            response = self.http_fn(
                method, f"{self.base_url}{path}", request_headers, encoded_body, self.timeout_ms / 1000
            )
        except Exception as cause:  # network failure, timeout, DNS, etc.
            if retries_left > 0:
                return self._request(method, path, body, headers, retries_left - 1)
            raise SemseNetworkError(f"Request to {path} failed", cause) from cause

        if 200 <= response.status < 300:
            try:
                envelope = response.json()
            except Exception as cause:
                raise SemseNetworkError(f"Non-JSON response from {path}", cause) from cause
            return envelope.get("data")

        try:
            error_body = response.json()
        except Exception:
            error_body = None
        message = (error_body or {}).get("message") or f"HTTP {response.status} from {path}"

        if response.status == 401:
            raise SemseAuthError(message)
        if response.status == 403:
            raise SemseScopeError(message, (error_body or {}).get("missing") or [])
        if response.status == 503:
            raise SemseDisabledError(message)
        if response.status >= 500 and retries_left > 0:
            return self._request(method, path, body, headers, retries_left - 1)
        raise SemseApiError(message, response.status, error_body)
