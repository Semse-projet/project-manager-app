---
id: "prometeo.decision-ledger"
title: "Decision Ledger"
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
feature_flags: ["SEMSE_DECISION_LEDGER_MODE"]
production_evidence: []
related_files:
  - "packages/db/prisma/schema.prisma"
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
last_verified: "2026-10-04"
---

# Spec: Decision Ledger

## 1. Problem and result
Add an append-only semantic record of authorized business/operational decisions with source/effect lineage.

## 2. Scope

### Included
- DecisionRecord / DecisionSourceRef / DecisionEffectRef
- append-only history
- tenant idempotency key
- authority/policy/approval provenance
- supersession/void without destructive edit
- read API
- internal recordAuthorizedDecision
- outbox/event adapter where shared transaction is impossible

### Out of scope
- authorizing decisions
- replacing PolicyDecision
- replacing AgentApproval
- replacing AgentDecision
- Shared Economic Ledger
- automatic Finding/Proposal -> Decision
- raw conversation body copies

## 3. Security and authority
- tenant scope mandatory for operational data;
- provider/service owner applies policy before returning content;
- no scope elevation;
- no complete source bodies in logs;
- read/query never authorizes actions;
- unknown historical values stay null.

## 4. Acceptance

### P1 — primary behavior
Given an authorized actor and valid source references, when the capability is
called, then it returns only evidence-backed, authorized data using the declared
contract and never fabricates lineage.

### P1 — isolation
A cross-tenant request fails closed before source content is returned.

### P1 — degradation
If a non-authoritative provider is unavailable, the response is explicit about
degradation and preserves valid results from healthy providers.

## 5. Contracts
Read:
- GET /v1/intelligence/decisions/:id
- GET /v1/intelligence/decisions?subjectType=&subjectId=

Internal:
`DecisionLedgerService.recordAuthorizedDecision(input, tx?)`

No generic public POST in V1.

## 6. Events / idempotency / reconstruction
Use same Prisma transaction when possible; otherwise durable event/outbox + idempotent consumer. Replay must not duplicate decisions.

## 7. Data / migration
Additive Prisma migration.
Indexes:
- `(tenantId, subjectType, subjectId, effectiveAt)`
- `(tenantId, correlationId)`
- unique `(tenantId, idempotencyKey)`

Do not destructively cascade ledger history.

## 8. Observability / rollout
Flag: `SEMSE_DECISION_LEDGER_MODE`
Rollout: `off -> shadow -> canary -> live`

Metrics:
- latency
- success/failure
- denied scope
- degraded/truncated where applicable

## 9. Required tests
- migration compatibility
- idempotency/concurrency
- append-only immutability
- supersession/void
- authority/policy/approval validation
- tenant isolation
- source/effect refs
- outbox replay

## 10. Implementation map
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/<timestamp>_decision_ledger/migration.sql`
- `apps/api/src/modules/intelligence/decision-ledger/decision-ledger.repository.ts`
- `apps/api/src/modules/intelligence/decision-ledger/decision-ledger.service.ts`
- `apps/api/src/modules/intelligence/decision-ledger/decision-ledger.controller.ts`
- `apps/api/test/decision-ledger.test.ts`
- `apps/api/test/decision-ledger.integration.test.ts`

## 11. External research
- PostgreSQL recursive queries: https://www.postgresql.org/docs/current/queries-with.html
- W3C Trace Context: https://www.w3.org/TR/trace-context/
- OpenTelemetry propagation: https://opentelemetry.io/docs/concepts/context-propagation/

## 12. Closure gates
- [ ] APPROVED before code
- [ ] failing tests first
- [ ] strict/index/coverage green
- [ ] CI PASS
- [ ] merge SHA recorded
- [ ] terminal deploy if runtime changed
- [ ] authenticated canary
- [ ] evidence without secrets

## Archivos y endpoints planificados (aún inexistentes)

Se mantienen fuera del frontmatter porque `spec:validate:strict` exige que `related_files` y `related_endpoints` existan en el repo. Se mueven al frontmatter cuando el slice los cree.

- `packages/db/prisma/migrations/<timestamp>_decision_ledger/migration.sql`
- `apps/api/src/modules/intelligence/decision-ledger/decision-ledger.repository.ts`
- `apps/api/src/modules/intelligence/decision-ledger/decision-ledger.service.ts`
- `apps/api/src/modules/intelligence/decision-ledger/decision-ledger.controller.ts`
- `apps/api/test/decision-ledger.test.ts`
- `apps/api/test/decision-ledger.integration.test.ts`
- endpoint: `GET /v1/intelligence/decisions/:id`
- endpoint: `GET /v1/intelligence/decisions`
