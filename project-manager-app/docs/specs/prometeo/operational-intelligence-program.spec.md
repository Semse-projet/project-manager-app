---
id: "prometeo.operational-intelligence-program"
title: "Operational Intelligence Graph + Decision Lineage Program"
domain: "prometeo"
sdd_version: "2.0"
version: "1.0"
status: "REVIEW"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - "SEMSE_OPERATIONAL_GRAPH_MODE"
  - "SEMSE_DECISION_LEDGER_MODE"
  - "SEMSE_UNIFIED_QUERY_MODE"
  - "SEMSE_OMNIVERSE_ADAPTER_MODE"
production_evidence: []
related_files:
  - "docs/architecture/ADR-044-operational-intelligence-graph.md"
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
last_verified: "2026-10-06"
---

# Spec: Operational Intelligence Graph + Decision Lineage Program

## 1. Problem and result

SEMSE has technical, conversational, memory, policy and runtime sources but no
common lineage contract that reconstructs:

`source -> finding -> proposal -> decision -> action -> outcome`

without duplicating source authority.

Expected result:
- tenant-safe lineage;
- append-only authorized decisions;
- Prometeo provenance queries;
- sanitized Omniverse projection.

## 2. Scope

Included:
- `prometeo.unified-graph-contract`
- `prometeo.decision-ledger`
- `prometeo.unified-query-lineage`
- `prometeo.omniverse-adapter`
- reuse SourceRef/correlation/causation
- bounded traversal

Out of scope:
- graph DB
- generic graph persistence V1
- replacing memory
- replacing AgentDecision
- replacing approvals/policy
- Shared Economic Ledger F5
- Omniverse writes
- inferred historical IDs
- automatic Finding -> Decision

## 3. Authority

- Graphify owns technical topology.
- Conversation system owns conversation source.
- Memory stores governed context.
- Decision Ledger records authorized decisions.
- Domain services own actions/outcomes.
- Omniverse owns no business state.

## 4. Acceptance scenarios

### P1 — Explain an authorized decision
Return every visible source/policy/approval/action/outcome reference with
provenance and no fabricated edge.

### P1 — Technical/operational impact
Combine technical Graphify dependencies with explicit operational references
without changing source authority.

### P1 — Omniverse snapshot
Return only authorized sanitized nodes/edges. Never leak another tenant.

Edge cases:
- provider down => `degraded`
- cycle => bounded termination
- missing source => no fabricated edge
- retry => one DecisionRecord
- correction => append + supersede

## 5. Shared response contract

Every unified graph response includes:
- nodes
- edges
- degradedSources
- truncated
- maxDepthApplied
- correlationId

## 6. State/events

Decision Ledger:
`ACTIVE -> SUPERSEDED | VOIDED`

Reuse event backbone where durable asynchronous recording is required.

## 7. Data

Only Decision Ledger requires mandatory persistence in V1.
No `db push`.
Additive migrations only.

## 8. Rollout

`off -> shadow -> canary -> live`

## 9. Tests

- provider contracts
- cycles/depth/node limits
- tenant/resource isolation
- ledger append-only/idempotency/supersession
- source ref reconstruction
- policy/approval provenance
- degraded semantics
- Prometeo authorization
- Omniverse sanitization
- authenticated canary

## 10. Implementation map

Do not implement the parent in one PR.
Use the four child specs.

## 11. Research

- PostgreSQL recursive CTEs
- W3C Trace Context
- OpenTelemetry context propagation

## 12. Closure gates

- [ ] ADR accepted
- [ ] child specs approved before code
- [ ] tests precede implementation
- [ ] strict/index/coverage green
- [ ] CI/merge/deploy/activation separately evidenced
- [ ] authenticated canary
- [ ] no secrets in evidence
