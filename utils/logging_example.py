"""Example usage of SEMSE logging utilities."""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.logging import SEMSELogger, AutonomyLogger, create_logger


def example_semse_logger():
    """Example: Using SEMSELogger with structured logging."""
    logger = create_logger("evidence-processor", pretty=True)

    logger.info("Starting evidence processing batch", {
        "batchId": "batch-001",
        "count": 42,
    })

    # Use context manager for scoped values
    with logger.context(batchId="batch-001", userId="contractor-123"):
        logger.info("Processing evidence items")

        # Use span for distributed tracing
        with logger.span("validate_evidence", {"evidenceType": "photo"}):
            logger.debug("Validating photo dimensions")
            logger.info("Validation passed", {"width": 1920, "height": 1080})

        with logger.span("store_evidence", {"storageId": "s3://bucket"}):
            logger.info("Uploading to S3")
            logger.info("Upload complete", {"size": 2048576})

    logger.warn("Batch processing slow", {
        "expectedMs": 5000,
        "actualMs": 8234,
    })

    logger.error("Failed to process item", {
        "itemId": "item-456",
        "reason": "invalid_format",
    })


def example_autonomy_logger():
    """Example: Using AutonomyLogger for in-memory buffering (Node.js compatible)."""
    logger = AutonomyLogger(run_id="autonomy-run-789")

    logger.info("Autonomy agent started", {"model": "gpt-4", "temp": 0.7})
    logger.info("Processing task", {"taskId": "t123"})
    logger.info("Task complete", {"result": "success"})

    # Get all buffered entries (useful for returning from API responses)
    snapshot = logger.snapshot()
    print(f"Captured {len(snapshot)} log entries")
    for entry in snapshot:
        print(f"  [{entry['level']}] {entry['message']}")


def example_with_error_handling():
    """Example: Error handling with structured context."""
    logger = create_logger("contract-validator")

    try:
        with logger.span("validate_contract", {"contractId": "c123"}):
            logger.info("Starting validation")
            # Simulate error
            raise ValueError("Invalid contract terms")
    except Exception as e:
        logger.error(f"Validation failed: {e}", {
            "contractId": "c123",
            "errorType": type(e).__name__,
        })


if __name__ == "__main__":
    print("=== SEMSELogger Example ===")
    example_semse_logger()

    print("\n=== AutonomyLogger Example ===")
    example_autonomy_logger()

    print("\n=== Error Handling Example ===")
    example_with_error_handling()
