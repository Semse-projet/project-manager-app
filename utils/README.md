# SEMSE Utilities

Shared Python utilities for SEMSE services.

## Logging

The `logging` module provides structured logging with JSON output, context tracking, and distributed tracing—fully integrated with SEMSE's observability stack.

### Quick Start

```python
from utils.logging import create_logger

logger = create_logger("my-service")
logger.info("Processing started", {"itemId": "123"})
```

### SEMSELogger

Full-featured logger with distributed tracing, context management, and structured output.

**Features:**
- Automatic JSON formatting for observability platforms
- Distributed tracing (traceId, spanId, spanDepth)
- Context managers for scoped values
- Span timing and performance tracking
- Automatic error logging in spans
- Pretty-print mode for local development

**Initialization:**

```python
from utils.logging import SEMSELogger

# Basic
logger = SEMSELogger("service-name")

# With custom runId/traceId
logger = SEMSELogger(
    "service-name",
    run_id="batch-001",
    trace_id="distributed-trace-xyz"
)

# Pretty-print for dev (default: compact JSON)
logger = SEMSELogger("service-name", pretty=True)

# Set minimum log level
from utils.logging import LogLevel
logger = SEMSELogger(
    "service-name",
    min_level=LogLevel.WARN
)
```

**Logging:**

```python
logger.debug("Message", {"key": "value"})
logger.info("Message", {"key": "value"})
logger.warn("Message", {"key": "value"})
logger.error("Message", {"key": "value"})
```

**Context:**

Add values that appear in all logs within a scope:

```python
with logger.context(projectId="p123", userId="u456"):
    logger.info("Starting work")  # includes projectId, userId
    logger.info("Processing")     # includes projectId, userId
```

**Spans:**

Track operations with automatic timing and error handling:

```python
with logger.span("process_evidence", {"evidenceType": "photo"}):
    logger.info("Validation started")
    # ... do work
    logger.info("Validation complete")
# Automatically logs span duration and errors
```

**Output Example:**

```json
{
  "level": "info",
  "message": "Processing started",
  "timestamp": "2026-06-04T23:24:51.770016+00:00",
  "service": "evidence-processor",
  "runId": "87506e3b-dda0-46b0-a12f-917190f1014e",
  "traceId": "3b6b36b1-9810-45a3-8ed8-fb078b16cada",
  "spanId": "fba04f40-9c12-4fb8-9231-775472401b3d",
  "spanName": "validate_evidence",
  "spanDepth": 1,
  "context": {
    "projectId": "p123",
    "userId": "u456"
  },
  "data": {
    "evidenceType": "photo"
  }
}
```

### AutonomyLogger

Compatible in-memory logger matching SEMSE's Node.js `AutonomyLogger` interface. Useful for buffering logs and returning them in API responses.

```python
from utils.logging import AutonomyLogger

logger = AutonomyLogger(run_id="autonomy-run-789")
logger.info("Task started", {"taskId": "t123"})
logger.info("Task complete", {"result": "success"})

# Get all buffered entries
snapshot = logger.snapshot()
# [
#   {"level": "info", "message": "Task started", "timestamp": "...", "data": {...}},
#   {"level": "info", "message": "Task complete", "timestamp": "...", "data": {...}}
# ]
```

### Integration with Railway/Observability

All logs emit to stdout in JSON format, automatically picked up by:
- Railway's logging system
- CloudWatch, Datadog, ELK, Splunk, etc.
- Any JSON-compatible observability platform

Structured fields enable:
- Filtering by `service`, `runId`, `traceId`, `spanId`
- Correlation across distributed traces
- Duration tracking via `spanDepth` and timing fields
- Error grouping and analysis

### Examples

See `logging_example.py` for complete examples:

```bash
python3 -m utils.logging_example
```

## Architecture Notes

- **Module naming:** Import as `from utils.logging import ...` to avoid shadowing stdlib
- **Context stack:** Nested contexts merge; innermost values override
- **Span stacks:** Spans can be nested; `spanDepth` tracks nesting level
- **Performance:** JSON encoding at log time (configurable via `pretty` mode)
- **Thread safety:** Standard logging handlers are thread-safe by default
