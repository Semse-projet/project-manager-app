"""Unit tests for SEMSE logging utility.

Tests cover:
- traceId/spanId propagation
- context scoping
- span timing
- nested spans
- JSON output
- pretty-print mode
- error capture
"""

import json
import logging as stdlib_logging
import sys
from io import StringIO
from typing import Any

import pytest

from utils.logging import AutonomyLogger, LogLevel, SEMSELogger, create_logger


@pytest.fixture
def capture_logs():
    """Capture logger output to a string buffer."""
    buffer = StringIO()
    handler = stdlib_logging.StreamHandler(buffer)
    handler.setFormatter(stdlib_logging.Formatter("%(message)s"))

    def get_logs() -> list[dict[str, Any]]:
        """Parse captured JSON logs."""
        buffer.seek(0)
        lines = buffer.getvalue().strip().split("\n")
        return [json.loads(line) for line in lines if line.strip()]

    return buffer, get_logs, handler


class TestSEMSELoggerBasics:
    """Test basic SEMSELogger functionality."""

    def test_initialization(self, capture_logs):
        """Test logger initialization with defaults."""
        logger = SEMSELogger("test-service")

        assert logger.service == "test-service"
        assert logger.run_id  # auto-generated
        assert logger.trace_id  # auto-generated
        assert logger.pretty is False
        assert logger.min_level == LogLevel.DEBUG

    def test_custom_run_and_trace_ids(self):
        """Test logger with custom IDs."""
        logger = SEMSELogger(
            "test-service",
            run_id="run-123",
            trace_id="trace-456",
        )

        assert logger.run_id == "run-123"
        assert logger.trace_id == "trace-456"

    def test_snapshot(self):
        """Test logger snapshot reflects current state."""
        logger = SEMSELogger("test-service")
        snap = logger.snapshot()

        assert snap["service"] == "test-service"
        assert snap["runId"] == logger.run_id
        assert snap["traceId"] == logger.trace_id
        assert snap["contextDepth"] == 0
        assert snap["spanDepth"] == 0

    def test_factory_function(self):
        """Test create_logger factory."""
        logger = create_logger("factory-service", run_id="id-123", pretty=True)

        assert isinstance(logger, SEMSELogger)
        assert logger.service == "factory-service"
        assert logger.run_id == "id-123"
        assert logger.pretty is True


class TestLogLevels:
    """Test log level filtering and output."""

    def test_all_log_levels_emitted(self, capture_logs):
        """Test that all log levels produce output."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)
        logger._python_logger.setLevel(stdlib_logging.DEBUG)

        logger.debug("debug msg")
        logger.info("info msg")
        logger.warn("warn msg")
        logger.error("error msg")

        logs = get_logs()
        assert len(logs) == 4
        assert logs[0]["level"] == "debug"
        assert logs[1]["level"] == "info"
        assert logs[2]["level"] == "warn"
        assert logs[3]["level"] == "error"

    def test_min_level_filtering(self, capture_logs):
        """Test that min_level filters correctly."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service", min_level=LogLevel.WARN)
        logger._python_logger.addHandler(handler)

        logger.debug("debug msg")
        logger.info("info msg")
        logger.warn("warn msg")
        logger.error("error msg")

        logs = get_logs()
        assert len(logs) == 2
        assert logs[0]["level"] == "warn"
        assert logs[1]["level"] == "error"


class TestJSONOutput:
    """Test JSON structure and formatting."""

    def test_compact_json_output(self, capture_logs):
        """Test default compact JSON output."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service", pretty=False)
        logger._python_logger.addHandler(handler)

        logger.info("test message", {"key": "value"})

        logs = get_logs()
        assert len(logs) == 1
        log = logs[0]

        assert log["level"] == "info"
        assert log["message"] == "test message"
        assert log["service"] == "test-service"
        assert log["runId"] == logger.run_id
        assert log["traceId"] == logger.trace_id
        assert log["data"] == {"key": "value"}
        assert "timestamp" in log

    def test_pretty_print_output(self, capture_logs):
        """Test pretty-printed JSON output."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service", pretty=True)
        logger._python_logger.addHandler(handler)

        logger.info("test message")

        output = buffer.getvalue()
        # Pretty-printed JSON should have newlines and indentation
        assert "\n" in output
        assert "  " in output  # indentation

        # But it should still be valid JSON
        lines = output.strip().split("\n")
        reconstructed = "".join(lines)
        parsed = json.loads(reconstructed)
        assert parsed["level"] == "info"

    def test_data_parameter_included(self, capture_logs):
        """Test that data parameter is included in output."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        logger.info("test", {"custom": "data", "count": 42})

        logs = get_logs()
        assert logs[0]["data"] == {"custom": "data", "count": 42}

    def test_no_data_when_not_provided(self, capture_logs):
        """Test that data field is omitted when not provided."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        logger.info("test")

        logs = get_logs()
        assert "data" not in logs[0]


class TestTraceIdPropagation:
    """Test traceId and spanId propagation."""

    def test_trace_id_in_all_logs(self, capture_logs):
        """Test that traceId appears in all logs."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service", trace_id="trace-xyz")
        logger._python_logger.addHandler(handler)

        logger.info("msg1")
        logger.info("msg2")
        logger.info("msg3")

        logs = get_logs()
        for log in logs:
            assert log["traceId"] == "trace-xyz"

    def test_run_id_in_all_logs(self, capture_logs):
        """Test that runId appears in all logs."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service", run_id="run-abc")
        logger._python_logger.addHandler(handler)

        logger.info("msg1")
        logger.info("msg2")

        logs = get_logs()
        for log in logs:
            assert log["runId"] == "run-abc"

    def test_span_id_propagation_in_span(self, capture_logs):
        """Test that spanId is included in logs within a span."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.span("test-span"):
            logger.info("inside span")

        logs = get_logs()
        # span.start, info, span.end
        assert len(logs) == 3

        # Span start
        assert logs[0]["message"] == "[span.start] test-span"
        assert logs[0]["spanId"]
        assert "spanName" in logs[0]["data"]

        # Log inside span
        assert logs[1]["message"] == "inside span"
        assert logs[1]["spanId"] == logs[0]["spanId"]

        # Span end
        assert logs[2]["message"] == "[span.end] test-span"
        assert logs[2]["spanId"] == logs[0]["spanId"]

    def test_span_id_not_in_logs_outside_span(self, capture_logs):
        """Test that spanId is not included in logs outside a span."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        logger.info("outside span")

        logs = get_logs()
        assert "spanId" not in logs[0]


class TestContextScoping:
    """Test context manager functionality."""

    def test_context_values_in_logs(self, capture_logs):
        """Test that context values appear in logs."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.context(projectId="p123", userId="u456"):
            logger.info("msg1")
            logger.info("msg2")

        logs = get_logs()
        assert logs[0]["context"] == {"projectId": "p123", "userId": "u456"}
        assert logs[1]["context"] == {"projectId": "p123", "userId": "u456"}

    def test_nested_context_merging(self, capture_logs):
        """Test that nested contexts merge correctly."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.context(a="outer"):
            logger.info("outer level")

            with logger.context(b="inner"):
                logger.info("inner level")

            logger.info("back to outer")

        logs = get_logs()
        assert logs[0]["context"] == {"a": "outer"}
        assert logs[1]["context"] == {"a": "outer", "b": "inner"}
        assert logs[2]["context"] == {"a": "outer"}

    def test_context_values_override(self, capture_logs):
        """Test that inner context values override outer ones."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.context(key="outer"):
            with logger.context(key="inner"):
                logger.info("msg")

        logs = get_logs()
        assert logs[0]["context"]["key"] == "inner"

    def test_context_not_in_logs_outside_scope(self, capture_logs):
        """Test that context is removed after exiting scope."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.context(key="value"):
            logger.info("inside")

        logger.info("outside")

        logs = get_logs()
        assert "context" in logs[0]
        assert "context" not in logs[1]

    def test_snapshot_reflects_context_depth(self, capture_logs):
        """Test that snapshot shows current context depth."""
        logger = SEMSELogger("test-service")

        assert logger.snapshot()["contextDepth"] == 0

        with logger.context(a="1"):
            assert logger.snapshot()["contextDepth"] == 1

            with logger.context(b="2"):
                assert logger.snapshot()["contextDepth"] == 2

        assert logger.snapshot()["contextDepth"] == 0


class TestSpanTiming:
    """Test span timing and duration tracking."""

    def test_span_timing_in_logs(self, capture_logs):
        """Test that span duration is logged."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.span("test-span"):
            pass

        logs = get_logs()
        # span.start, span.end
        assert len(logs) == 2

        assert "durationMs" not in logs[0]  # span.start has no duration
        assert logs[1]["data"]["durationMs"] >= 0  # span.end has duration

    def test_span_duration_positive(self, capture_logs):
        """Test that span duration is measured correctly."""
        import time

        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.span("test-span"):
            time.sleep(0.01)  # 10ms

        logs = get_logs()
        duration = logs[1]["data"]["durationMs"]
        assert duration >= 8  # Allow some variance

    def test_span_names_logged(self, capture_logs):
        """Test that span names are included."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.span("my-span", {"spanData": "value"}):
            logger.info("inside")

        logs = get_logs()
        assert logs[0]["data"]["spanName"] == "my-span"
        assert logs[0]["data"]["spanData"] == "value"


class TestNestedSpans:
    """Test nested span functionality."""

    def test_nested_spans_tracked(self, capture_logs):
        """Test that nested spans are properly tracked."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.span("outer"):
            with logger.span("inner"):
                logger.info("nested")

        logs = get_logs()
        # outer.start, inner.start, info, inner.end, outer.end
        assert len(logs) == 5

        outer_id = logs[0]["spanId"]
        inner_id = logs[1]["spanId"]

        assert outer_id != inner_id
        assert logs[2]["spanId"] == inner_id  # info is in inner span
        assert logs[3]["spanId"] == inner_id  # inner.end
        assert logs[4]["spanId"] == outer_id  # outer.end

    def test_span_depth_tracking(self, capture_logs):
        """Test that spanDepth is tracked correctly."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.span("outer"):
            logger.info("level1")
            with logger.span("inner"):
                logger.info("level2")
            logger.info("back to level1")

        logs = get_logs()
        # Filter to just the info logs (not span.start/end)
        info_logs = [l for l in logs if l["message"] in ("level1", "level2", "back to level1")]

        assert info_logs[0]["message"] == "level1"
        assert info_logs[0]["spanDepth"] == 1
        assert info_logs[1]["message"] == "level2"
        assert info_logs[1]["spanDepth"] == 2
        assert info_logs[2]["message"] == "back to level1"
        assert info_logs[2]["spanDepth"] == 1

    def test_snapshot_span_depth(self):
        """Test that snapshot shows span depth."""
        logger = SEMSELogger("test-service")

        assert logger.snapshot()["spanDepth"] == 0

        with logger.span("s1"):
            assert logger.snapshot()["spanDepth"] == 1
            with logger.span("s2"):
                assert logger.snapshot()["spanDepth"] == 2
            assert logger.snapshot()["spanDepth"] == 1

        assert logger.snapshot()["spanDepth"] == 0


class TestErrorCapture:
    """Test error handling in spans."""

    def test_error_captured_in_span(self, capture_logs):
        """Test that exceptions are captured with error logs."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        try:
            with logger.span("failing-span"):
                raise ValueError("test error")
        except ValueError:
            pass

        logs = get_logs()
        # span.start, span.error, span.end
        assert len(logs) == 3

        error_log = logs[1]
        assert error_log["level"] == "error"
        assert "[span.error] failing-span" in error_log["message"]
        assert error_log["data"]["error"] == "test error"
        assert error_log["data"]["errorType"] == "ValueError"
        assert error_log["data"]["durationMs"] >= 0

    def test_exception_re_raised(self, capture_logs):
        """Test that exceptions are re-raised."""
        logger = SEMSELogger("test-service")

        with pytest.raises(ValueError, match="test error"):
            with logger.span("span"):
                raise ValueError("test error")

    def test_span_end_still_logged_on_error(self, capture_logs):
        """Test that span.end is logged even when error occurs."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        try:
            with logger.span("span"):
                raise ValueError("error")
        except ValueError:
            pass

        logs = get_logs()
        assert any("[span.end]" in log["message"] for log in logs)

    def test_error_log_method(self, capture_logs):
        """Test the error() log method."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        logger.error("Error message", {"errorCode": 500})

        logs = get_logs()
        assert logs[0]["level"] == "error"
        assert logs[0]["message"] == "Error message"
        assert logs[0]["data"]["errorCode"] == 500


class TestCombinedScenarios:
    """Test realistic combined scenarios."""

    def test_context_and_spans_together(self, capture_logs):
        """Test context and spans working together."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.context(projectId="p123"):
            with logger.span("process"):
                logger.info("processing")

        logs = get_logs()
        # Find the "processing" log
        info_log = next(l for l in logs if l["message"] == "processing")

        assert info_log["context"]["projectId"] == "p123"
        assert "spanId" in info_log
        assert info_log["spanName"] == "process"

    def test_multiple_context_and_span_levels(self, capture_logs):
        """Test multiple nested contexts and spans."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        with logger.context(level="1"):
            with logger.span("span1"):
                with logger.context(level="2"):
                    with logger.span("span2"):
                        logger.info("deep log")

        logs = get_logs()
        info_log = next(l for l in logs if l["message"] == "deep log")

        assert info_log["context"]["level"] == "2"
        assert info_log["spanName"] == "span2"
        assert info_log["spanDepth"] == 2

    def test_yield_value_from_span(self, capture_logs):
        """Test that span context manager yields span_id."""
        logger = SEMSELogger("test-service")

        with logger.span("test") as span_id:
            assert span_id  # Should be a non-empty string
            assert isinstance(span_id, str)


class TestAutonomyLogger:
    """Test AutonomyLogger in-memory buffering."""

    def test_initialization(self):
        """Test AutonomyLogger initialization."""
        logger = AutonomyLogger()
        assert logger.run_id
        assert logger.items == []

    def test_custom_run_id(self):
        """Test AutonomyLogger with custom run_id."""
        logger = AutonomyLogger(run_id="run-123")
        assert logger.run_id == "run-123"

    def test_seed_initialization(self):
        """Test AutonomyLogger initialization with seed."""
        seed = [
            {"level": "info", "message": "msg1", "timestamp": "2026-06-04T00:00:00+00:00"},
        ]
        logger = AutonomyLogger(seed=seed)
        assert len(logger.items) == 1
        assert logger.items[0]["message"] == "msg1"

    def test_log_methods(self):
        """Test all AutonomyLogger log methods."""
        logger = AutonomyLogger()

        logger.debug("debug msg", {"data": "d"})
        logger.info("info msg", {"data": "i"})
        logger.warn("warn msg", {"data": "w"})
        logger.error("error msg", {"data": "e"})

        assert len(logger.items) == 4
        assert logger.items[0]["level"] == "debug"
        assert logger.items[1]["level"] == "info"
        assert logger.items[2]["level"] == "warn"
        assert logger.items[3]["level"] == "error"

    def test_snapshot(self):
        """Test AutonomyLogger snapshot creates a copy."""
        logger = AutonomyLogger()
        logger.info("msg1")
        logger.info("msg2")

        snap1 = logger.snapshot()
        logger.info("msg3")
        snap2 = logger.snapshot()

        assert len(snap1) == 2
        assert len(snap2) == 3
        assert len(logger.items) == 3

    def test_json_serializable(self):
        """Test that AutonomyLogger output is JSON serializable."""
        logger = AutonomyLogger()
        logger.info("test", {"key": "value"})

        snap = logger.snapshot()
        # Should not raise
        json_str = json.dumps(snap)
        parsed = json.loads(json_str)

        assert parsed[0]["message"] == "test"
        assert parsed[0]["data"]["key"] == "value"

    def test_without_data_parameter(self):
        """Test logging without data parameter."""
        logger = AutonomyLogger()
        logger.info("message only")

        snap = logger.snapshot()
        assert snap[0]["message"] == "message only"
        assert "data" not in snap[0]


class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_empty_message(self, capture_logs):
        """Test logging with empty message."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        logger.info("")

        logs = get_logs()
        assert logs[0]["message"] == ""

    def test_special_characters_in_message(self, capture_logs):
        """Test logging with special characters."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        logger.info("Message with 特殊文字 and\nnewlines")

        logs = get_logs()
        assert "特殊文字" in logs[0]["message"]

    def test_large_data_object(self, capture_logs):
        """Test logging with large data object."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        large_data = {f"key_{i}": f"value_{i}" for i in range(100)}
        logger.info("large", large_data)

        logs = get_logs()
        assert len(logs[0]["data"]) == 100

    def test_nested_data_structures(self, capture_logs):
        """Test logging with nested data structures."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        logger.info("nested", {
            "outer": {
                "inner": {
                    "deep": "value"
                }
            },
            "list": [1, 2, 3],
        })

        logs = get_logs()
        assert logs[0]["data"]["outer"]["inner"]["deep"] == "value"
        assert logs[0]["data"]["list"] == [1, 2, 3]

    def test_none_values_in_data(self, capture_logs):
        """Test logging with None values."""
        buffer, get_logs, handler = capture_logs
        logger = SEMSELogger("test-service")
        logger._python_logger.addHandler(handler)

        logger.info("msg", {"key": None})

        logs = get_logs()
        assert logs[0]["data"]["key"] is None
