# #1129 — AgentRun finalization: outbox + receipt (candidate)

**Scope:** PR #1129 only, draft, not deployed. Source base: 34c4f270c5ca7d007fa41aedc4241b44a0a4323c

A completed or failed AgentRun previously committed its terminal state before
writing approvals, audit, workspace summary and delegation. Replays ignored these
writes, so a crash between commits could lose effects.

**Opt-in implementation:**
- SEMSE_AGENT_RUN_FINALIZATION_OUTBOX_ENABLED=true writes a contract-validated
  agent.run.finalized.v1 event in the SAME Prisma transaction as the RUNNING →
  COMPLETED / FAILED compare-and-set.
- agent-run-effects.v1 consumes the event through the existing
  DomainOutboxEvent → BullMQ → DomainEventConsumerService pipeline.
- The consumer locks a DomainEventConsumption receipt FOR UPDATE and writes
  approvals (pending only), audit, memory and delegation with the receipt in
  one DB transaction. No partial side effect is committed if processing fails.
  Replayed completed receipts return the original result without duplicating.
- Default mode remains OFF. No change to Railway or payments and no migration.

**Before enabling:** CI on exact HEAD; run real PostgreSQL tests (including
concurrent processing, rollback/DB loss, cross-tenant and replay), Redis/BullMQ
crash simulation and full API+Worker staging exercise; validate approved agent
service principal, type+consumer allowlists and dispatcher/worker kill switches:
  SEMSE_EVENT_TYPE_ALLOWLIST must include agent.run.finalized.v1
  SEMSE_EVENT_CONSUMER_ALLOWLIST must include agent-run-effects.v1

**Retry ordering:** while opt-in mode is active, retry obtains an AgentRun row
lock and rejects a retry if a terminal outbox event lacks a COMPLETED consumer
receipt. The consumer also locks the AgentRun row before applying effects.
Both sides must be validated with real concurrent PostgreSQL transactions.
If the flag is reverted with outstanding events, draining/quarantining events
and preventing replays must be included in the operational rollback. SSE
broadcasts remain best effort. External tool effects are not covered by the
database transaction and are not exactly-once.

**Decision:** keep flag OFF, PR DRAFT. Do not merge or deploy without
independent review, tests and DEC-PLATFORM-001 level 2 gates.
