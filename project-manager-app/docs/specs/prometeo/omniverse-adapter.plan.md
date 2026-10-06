---
type: plan
feature: "Omniverse Read-Only Projection Adapter"
domain: "prometeo"
spec: "docs/specs/prometeo/omniverse-adapter.spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/omniverse-adapter"
date: "2026-10-04"
---

# Plan técnico: Omniverse Read-Only Projection Adapter

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
Expose a safe projection to the separate Omniverse Control Center without DB access, raw sensitive payloads or write authority.

Files:
- `apps/api/src/modules/intelligence/omniverse/omniverse-projection.service.ts`
- `apps/api/src/modules/intelligence/omniverse/omniverse-projection.controller.ts`
- `apps/api/src/modules/intelligence/omniverse/omniverse.dto.ts`
- `apps/api/test/omniverse-projection.test.ts`
- `docs/architecture/SEMSE_API_SURFACE_V1.md`

## Data
No core migration. No Omniverse mirror DB in V1.

## Security
- authorize at source/provider boundary;
- fail closed cross-tenant;
- do not log source bodies/secrets;
- `SEMSE_OMNIVERSE_ADAPTER_MODE` off preserves previous behavior.

## Events / idempotency
Read-only; snapshot reads emit no domain event.

## Implementation phases
A. failing tests/contracts  
B. data/domain/provider  
C. API/tool if applicable  
D. local verification  
E. PR/CI/merge  
F. deploy/shadow/canary/live

## Rollback
- disable `SEMSE_OMNIVERSE_ADAPTER_MODE`;
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
