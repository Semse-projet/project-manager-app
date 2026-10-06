---
type: plan
feature: "Decision Ledger"
domain: "prometeo"
spec: "docs/specs/prometeo/decision-ledger.spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/decision-ledger"
date: "2026-10-04"
---

# Plan técnico: Decision Ledger

## Truth snapshot
Prepared against `370578ad81298ac53078eeef79db7e4110ce7a2a`.
Refresh before implementation.

## Constitution check
- [ ] spec APPROVED
- [ ] permissions/resource scope final
- [ ] tests written first
- [ ] no parallel authority/store
- [ ] delivery stages tracked separately

## Architecture
Add an append-only semantic record of authorized business/operational decisions with source/effect lineage.

Files:
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/<timestamp>_decision_ledger/migration.sql`
- `apps/api/src/modules/intelligence/decision-ledger/decision-ledger.repository.ts`
- `apps/api/src/modules/intelligence/decision-ledger/decision-ledger.service.ts`
- `apps/api/src/modules/intelligence/decision-ledger/decision-ledger.controller.ts`
- `apps/api/test/decision-ledger.test.ts`
- `apps/api/test/decision-ledger.integration.test.ts`

## Data
Additive Prisma migration.
Indexes:
- `(tenantId, subjectType, subjectId, effectiveAt)`
- `(tenantId, correlationId)`
- unique `(tenantId, idempotencyKey)`

Do not destructively cascade ledger history.

## Security
- authorize at source/provider boundary;
- fail closed cross-tenant;
- do not log source bodies/secrets;
- `SEMSE_DECISION_LEDGER_MODE` off preserves previous behavior.

## Events / idempotency
Use same Prisma transaction when possible; otherwise durable event/outbox + idempotent consumer. Replay must not duplicate decisions.

## Implementation phases
A. failing tests/contracts  
B. data/domain/provider  
C. API/tool if applicable  
D. local verification  
E. PR/CI/merge  
F. deploy/shadow/canary/live

## Rollback
- disable `SEMSE_DECISION_LEDGER_MODE`;
- do not delete ledger history;
- restore previous read path;
- forward-fix persisted data if needed.

## Gates
- [ ] exact files refreshed
- [ ] tests first
- [ ] spec strict
- [ ] regression
- [ ] CI terminal
- [ ] deployment terminal if affected
- [ ] authenticated canary
