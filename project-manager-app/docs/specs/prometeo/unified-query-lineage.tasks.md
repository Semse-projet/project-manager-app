---
type: tasks
feature: "Unified Query and Lineage Layer"
domain: "prometeo"
plan: "docs/specs/prometeo/unified-query-lineage.plan.md"
version: "2.0"
status: "PENDING"
branch: "feat/unified-query-lineage"
date: "2026-10-04"
---

# Tasks: Unified Query and Lineage Layer

## Phase 0 — Governance
- [ ] [UNIFIED_QUERY_LINEAGE-001] Refresh main/Railway
- [ ] [UNIFIED_QUERY_LINEAGE-002] Approve spec
- [ ] [UNIFIED_QUERY_LINEAGE-003] Reconcile related files
- [ ] [UNIFIED_QUERY_LINEAGE-004] Write failing acceptance/security tests

## Phase 1 — Contract/data
- [ ] [UNIFIED_QUERY_LINEAGE-010] Implement shared types/schemas
- [ ] [UNIFIED_QUERY_LINEAGE-011] Implement migration if applicable
- [ ] [UNIFIED_QUERY_LINEAGE-012] Verify backward compatibility
- [ ] [UNIFIED_QUERY_LINEAGE-013] Verify idempotency/concurrency where applicable

## Phase 2 — Domain/provider
- [ ] [UNIFIED_QUERY_LINEAGE-020] Implement service/provider/repository
- [ ] [UNIFIED_QUERY_LINEAGE-021] Enforce source authorization
- [ ] [UNIFIED_QUERY_LINEAGE-022] Implement degraded/fail-closed behavior
- [ ] [UNIFIED_QUERY_LINEAGE-023] Pass unit/integration tests

## Phase 3 — API/tool
- [ ] [UNIFIED_QUERY_LINEAGE-030] Implement endpoint/tool if declared
- [ ] [UNIFIED_QUERY_LINEAGE-031] Add contract tests
- [ ] [UNIFIED_QUERY_LINEAGE-032] Update API docs

## Phase 4 — Verification
- [ ] [UNIFIED_QUERY_LINEAGE-040] directed tests
- [ ] [UNIFIED_QUERY_LINEAGE-041] regression
- [ ] [UNIFIED_QUERY_LINEAGE-042] build/typecheck/lint
- [ ] [UNIFIED_QUERY_LINEAGE-043] pnpm spec:validate:strict
- [ ] [UNIFIED_QUERY_LINEAGE-044] pnpm spec:coverage
- [ ] [UNIFIED_QUERY_LINEAGE-045] pnpm spec:index

## Phase 5 — Delivery
- [ ] [UNIFIED_QUERY_LINEAGE-050] PR review
- [ ] [UNIFIED_QUERY_LINEAGE-051] CI PASS
- [ ] [UNIFIED_QUERY_LINEAGE-052] merge SHA
- [ ] [UNIFIED_QUERY_LINEAGE-053] deployment terminal if runtime changed
- [ ] [UNIFIED_QUERY_LINEAGE-054] shadow/canary
- [ ] [UNIFIED_QUERY_LINEAGE-055] authenticated smoke
- [ ] [UNIFIED_QUERY_LINEAGE-056] production evidence/state update
