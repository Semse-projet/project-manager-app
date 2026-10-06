---
type: plan
feature: "Unified Query and Lineage Layer"
domain: "prometeo"
spec: "docs/specs/prometeo/unified-query-lineage.spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/unified-query-lineage"
date: "2026-10-04"
---

# Plan técnico: Unified Query and Lineage Layer

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
Give Prometeo/operators one bounded read surface across technical, conversational, memory, decision and runtime references.

Files:
- `apps/api/src/modules/intelligence/operational-graph/providers/decision.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/runtime.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/operational-graph.controller.ts`
- `apps/api/src/modules/prometeo/prometeo-tool-registry.ts`
- `apps/api/src/modules/prometeo/tool-governance/tool-governance.policy.ts`
- `apps/api/test/operational-graph.query.test.ts`
- `apps/api/test/prometeo-operational-graph.tool.test.ts`

## Data
No migration. Enforce hard server-side bounds regardless of client input.

## Security
- authorize at source/provider boundary;
- fail closed cross-tenant;
- do not log source bodies/secrets;
- `SEMSE_UNIFIED_QUERY_MODE` off preserves previous behavior.

## Events / idempotency
Read-only. Querying the graph does not emit business events.

## Implementation phases
A. failing tests/contracts  
B. data/domain/provider  
C. API/tool if applicable  
D. local verification  
E. PR/CI/merge  
F. deploy/shadow/canary/live

## Rollback
- disable `SEMSE_UNIFIED_QUERY_MODE`;
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
