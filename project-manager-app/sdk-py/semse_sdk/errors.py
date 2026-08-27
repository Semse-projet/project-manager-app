"""Typed errors for the SEMSE satellite SDK.

Mirrors packages/sdk/src/errors.ts exactly — same names, same status-code
mapping — so a satellite integrator sees the same error taxonomy regardless
of which SDK they use.
"""

from __future__ import annotations

from typing import Any, List, Optional


class SemseError(Exception):
    """Base class for all SDK errors."""


class SemseAuthError(SemseError):
    """401 — invalid, revoked, or expired token."""


class SemseScopeError(SemseError):
    """403 — the token lacks the required scopes."""

    def __init__(self, message: str, missing: Optional[List[str]] = None) -> None:
        super().__init__(message)
        self.missing: List[str] = missing or []


class SemseDisabledError(SemseError):
    """503 — the satellites kill switch is off in SEMSE (SAT-000)."""


class SemseNetworkError(SemseError):
    """Network failure, timeout, or a non-JSON response."""

    def __init__(self, message: str, cause: Optional[BaseException] = None) -> None:
        super().__init__(message)
        self.cause = cause


class SemseApiError(SemseError):
    """Any other HTTP error status."""

    def __init__(self, message: str, status: int, body: Optional[Any] = None) -> None:
        super().__init__(message)
        self.status = status
        self.body = body
