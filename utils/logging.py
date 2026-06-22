"""SEMSE observability logging utility.

Structured logging with JSON output, context tracking, and integration
with SEMSE's observability stack (Railway, logging platforms, etc.).
"""

import json
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Generator, Optional
from uuid import uuid4

import logging as stdlib_logging


class LogLevel(Enum):
    """Log level enumeration matching SEMSE standards."""
    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


class SEMSELogger:
    """Structured logger for SEMSE services.

    Provides JSON-formatted logging compatible with observability platforms,
    automatic context tracking (runId, traceId, spanId), and performance monitoring.

    Example:
        logger = SEMSELogger("autonomy-service", run_id="xyz")
        logger.info("Processing task", {"taskId": "123", "status": "started"})
        with logger.span("process_evidence"):
            # ... do work
            logger.info("Evidence processed")
    """

    def __init__(
        self,
        service: str,
        run_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        pretty: bool = False,
        min_level: LogLevel = LogLevel.DEBUG,
    ):
        """Initialize SEMSE logger.

        Args:
            service: Service identifier (e.g., "autonomy-service", "api-bridge")
            run_id: Unique identifier for this run (auto-generated if not provided)
            trace_id: Distributed trace identifier (auto-generated if not provided)
            pretty: If True, pretty-print JSON for console (dev mode)
            min_level: Minimum log level to emit
        """
        self.service = service
        self.run_id = run_id or str(uuid4())
        self.trace_id = trace_id or str(uuid4())
        self.pretty = pretty
        self.min_level = min_level

        self._context_stack = []
        self._span_stack = []
        self._python_logger = stdlib_logging.getLogger(service)

        if not self._python_logger.handlers:
            handler = stdlib_logging.StreamHandler(sys.stdout)
            formatter = stdlib_logging.Formatter("%(message)s")
            handler.setFormatter(formatter)
            self._python_logger.addHandler(handler)
            self._python_logger.setLevel(stdlib_logging.DEBUG)

    def debug(self, message: str, data: Optional[dict[str, Any]] = None) -> None:
        """Log at DEBUG level."""
        self._log(LogLevel.DEBUG, message, data)

    def info(self, message: str, data: Optional[dict[str, Any]] = None) -> None:
        """Log at INFO level."""
        self._log(LogLevel.INFO, message, data)

    def warn(self, message: str, data: Optional[dict[str, Any]] = None) -> None:
        """Log at WARN level."""
        self._log(LogLevel.WARN, message, data)

    def error(self, message: str, data: Optional[dict[str, Any]] = None) -> None:
        """Log at ERROR level."""
        self._log(LogLevel.ERROR, message, data)

    @contextmanager
    def span(self, name: str, data: Optional[dict[str, Any]] = None) -> Generator[str, None, None]:
        """Context manager for distributed tracing spans.

        Automatically tracks span duration and nesting.

        Example:
            with logger.span("process_evidence", {"evidenceId": "123"}):
                logger.info("Starting processing")
                # ... do work
                logger.info("Processing complete")
            # Duration logged automatically
        """
        span_id = str(uuid4())
        start_time = time.perf_counter()

        self._span_stack.append({
            "spanId": span_id,
            "name": name,
            "startTime": datetime.now(timezone.utc).isoformat(),
            "parentSpanId": self._span_stack[-1]["spanId"] if self._span_stack else None,
        })

        self.info(f"[span.start] {name}", {
            "spanId": span_id,
            "spanName": name,
            **(data or {}),
        })

        try:
            yield span_id
        except Exception as e:
            elapsed = time.perf_counter() - start_time
            self.error(f"[span.error] {name}", {
                "spanId": span_id,
                "spanName": name,
                "durationMs": round(elapsed * 1000, 2),
                "error": str(e),
                "errorType": type(e).__name__,
            })
            raise
        finally:
            elapsed = time.perf_counter() - start_time
            self.info(f"[span.end] {name}", {
                "spanId": span_id,
                "spanName": name,
                "durationMs": round(elapsed * 1000, 2),
            })
            self._span_stack.pop()

    @contextmanager
    def context(self, **kwargs: Any) -> Generator[None, None, None]:
        """Context manager for scoped logging context.

        Values added here appear in all logs within the context.

        Example:
            with logger.context(projectId="p123", userId="u456"):
                logger.info("Starting work")  # includes projectId, userId
        """
        self._context_stack.append(kwargs)
        try:
            yield
        finally:
            self._context_stack.pop()

    def snapshot(self) -> dict[str, Any]:
        """Get current logger state (useful for testing/debugging)."""
        return {
            "service": self.service,
            "runId": self.run_id,
            "traceId": self.trace_id,
            "contextDepth": len(self._context_stack),
            "spanDepth": len(self._span_stack),
        }

    def _get_context_data(self) -> dict[str, Any]:
        """Merge all active context values."""
        merged = {}
        for ctx in self._context_stack:
            merged.update(ctx)
        return merged

    def _log(
        self,
        level: LogLevel,
        message: str,
        data: Optional[dict[str, Any]] = None,
    ) -> None:
        """Internal structured log emission."""
        if self._should_skip_level(level):
            return

        entry = {
            "level": level.value,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": self.service,
            "runId": self.run_id,
            "traceId": self.trace_id,
        }

        # Add current span if active
        if self._span_stack:
            current_span = self._span_stack[-1]
            entry["spanId"] = current_span["spanId"]
            entry["spanName"] = current_span["name"]
            entry["spanDepth"] = len(self._span_stack)

        # Add context and data
        context = self._get_context_data()
        if context:
            entry["context"] = context
        if data:
            entry["data"] = data

        # Output
        output = json.dumps(entry, separators=(",", ":"))
        if self.pretty:
            output = json.dumps(entry, indent=2)

        # Determine Python log level
        py_level = {
            LogLevel.DEBUG: stdlib_logging.DEBUG,
            LogLevel.INFO: stdlib_logging.INFO,
            LogLevel.WARN: stdlib_logging.WARNING,
            LogLevel.ERROR: stdlib_logging.ERROR,
        }[level]

        self._python_logger.log(py_level, output)

    def _should_skip_level(self, level: LogLevel) -> bool:
        """Check if level should be skipped based on minimum level."""
        level_order = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
        return level_order.index(level) < level_order.index(self.min_level)


class AutonomyLogger:
    """Compatible wrapper matching SEMSE's AutonomyLogger TypeScript interface.

    Provides an in-memory log buffer for structured results, compatible with
    Node.js AutonomyLogger API.
    """

    def __init__(self, run_id: Optional[str] = None, seed: Optional[list[dict[str, Any]]] = None):
        """Initialize autonomy logger.

        Args:
            run_id: Unique run identifier (auto-generated if not provided)
            seed: Initial log entries
        """
        self.run_id = run_id or str(uuid4())
        self.items: list[dict[str, Any]] = seed or []

    def debug(self, message: str, data: Optional[dict[str, Any]] = None) -> None:
        """Log at DEBUG level."""
        self._push("debug", message, data)

    def info(self, message: str, data: Optional[dict[str, Any]] = None) -> None:
        """Log at INFO level."""
        self._push("info", message, data)

    def warn(self, message: str, data: Optional[dict[str, Any]] = None) -> None:
        """Log at WARN level."""
        self._push("warn", message, data)

    def error(self, message: str, data: Optional[dict[str, Any]] = None) -> None:
        """Log at ERROR level."""
        self._push("error", message, data)

    def snapshot(self) -> list[dict[str, Any]]:
        """Get snapshot of all buffered log entries."""
        return [*self.items]

    def _push(self, level: str, message: str, data: Optional[dict[str, Any]] = None) -> None:
        """Add entry to buffer."""
        self.items.append({
            "level": level,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **({"data": data} if data else {}),
        })


def create_logger(
    service: str,
    run_id: Optional[str] = None,
    pretty: bool = False,
) -> SEMSELogger:
    """Factory function to create a SEMSE logger.

    Example:
        logger = create_logger("evidence-processor", run_id="batch-001")
    """
    return SEMSELogger(service, run_id=run_id, pretty=pretty)
