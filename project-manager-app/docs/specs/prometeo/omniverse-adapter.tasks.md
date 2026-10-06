---
type: tasks
feature: "Omniverse Read-Only Projection Adapter"
domain: "prometeo"
plan: "docs/specs/prometeo/omniverse-adapter.plan.md"
version: "2.0"
status: "PENDING"
branch: "feat/omniverse-adapter"
date: "2026-10-04"
---

# Tasks: Omniverse Read-Only Projection Adapter

## Phase 0 — Governance
- [ ] [OMNIVERSE_ADAPTER-001] Refresh main/Railway
- [ ] [OMNIVERSE_ADAPTER-002] Approve spec
- [ ] [OMNIVERSE_ADAPTER-003] Reconcile related files
- [ ] [OMNIVERSE_ADAPTER-004] Write failing acceptance/security tests

## Phase 1 — Contract/data
- [ ] [OMNIVERSE_ADAPTER-010] Implement shared types/schemas
- [ ] [OMNIVERSE_ADAPTER-011] Implement migration if applicable
- [ ] [OMNIVERSE_ADAPTER-012] Verify backward compatibility
- [ ] [OMNIVERSE_ADAPTER-013] Verify idempotency/concurrency where applicable

## Phase 2 — Domain/provider
- [ ] [OMNIVERSE_ADAPTER-020] Implement service/provider/repository
- [ ] [OMNIVERSE_ADAPTER-021] Enforce source authorization
- [ ] [OMNIVERSE_ADAPTER-022] Implement degraded/fail-closed behavior
- [ ] [OMNIVERSE_ADAPTER-023] Pass unit/integration tests

## Phase 3 — API/tool
- [ ] [OMNIVERSE_ADAPTER-030] Implement endpoint/tool if declared
- [ ] [OMNIVERSE_ADAPTER-031] Add contract tests
- [ ] [OMNIVERSE_ADAPTER-032] Update API docs

## Phase 4 — Verification
- [ ] [OMNIVERSE_ADAPTER-040] directed tests
- [ ] [OMNIVERSE_ADAPTER-041] regression
- [ ] [OMNIVERSE_ADAPTER-042] build/typecheck/lint
- [ ] [OMNIVERSE_ADAPTER-043] pnpm spec:validate:strict
- [ ] [OMNIVERSE_ADAPTER-044] pnpm spec:coverage
- [ ] [OMNIVERSE_ADAPTER-045] pnpm spec:index

## Phase 5 — Delivery
- [ ] [OMNIVERSE_ADAPTER-050] PR review
- [ ] [OMNIVERSE_ADAPTER-051] CI PASS
- [ ] [OMNIVERSE_ADAPTER-052] merge SHA
- [ ] [OMNIVERSE_ADAPTER-053] deployment terminal if runtime changed
- [ ] [OMNIVERSE_ADAPTER-054] shadow/canary
- [ ] [OMNIVERSE_ADAPTER-055] authenticated smoke
- [ ] [OMNIVERSE_ADAPTER-056] production evidence/state update
