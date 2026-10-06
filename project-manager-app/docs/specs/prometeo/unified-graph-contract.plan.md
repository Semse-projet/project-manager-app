---
type: plan
feature: "Unified Operational Graph Contract"
domain: "prometeo"
spec: "docs/specs/prometeo/unified-graph-contract.spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/unified-graph-contract"
date: "2026-10-04"
---

# Plan técnico: Unified Operational Graph Contract

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
Provide one typed read contract across Graphify, conversations and governed memory without another authoritative graph store.

Files:
- `apps/api/src/modules/intelligence/operational-graph/operational-graph.types.ts`
- `apps/api/src/modules/intelligence/operational-graph/operational-graph.service.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/graphify.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/memory.provider.ts`
- `apps/api/src/modules/intelligence/operational-graph/providers/conversation.provider.ts`
- `apps/api/test/operational-graph.contract.test.ts`

## Data
No Prisma migration. No generic graph node/edge tables in V1.

## Security
- authorize at source/provider boundary;
- fail closed cross-tenant;
- do not log source bodies/secrets;
- `SEMSE_OPERATIONAL_GRAPH_MODE` off preserves previous behavior.

## Events / idempotency
Read-only and reconstructable; no domain events required.

## Implementation phases
A. failing tests/contracts  
B. data/domain/provider  
C. API/tool if applicable  
D. local verification  
E. PR/CI/merge  
F. deploy/shadow/canary/live

## Rollback
- disable `SEMSE_OPERATIONAL_GRAPH_MODE`;
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
