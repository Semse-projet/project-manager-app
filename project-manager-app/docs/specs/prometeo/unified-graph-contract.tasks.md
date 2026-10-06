---
type: tasks
feature: "Unified Operational Graph Contract"
domain: "prometeo"
plan: "docs/specs/prometeo/unified-graph-contract.plan.md"
version: "2.0"
status: "PENDING"
branch: "feat/unified-graph-contract"
date: "2026-10-04"
---

# Tasks: Unified Operational Graph Contract

## Phase 0 — Governance
- [ ] [UNIFIED_GRAPH_CONTRACT-001] Refresh main/Railway
- [ ] [UNIFIED_GRAPH_CONTRACT-002] Approve spec
- [ ] [UNIFIED_GRAPH_CONTRACT-003] Reconcile related files
- [ ] [UNIFIED_GRAPH_CONTRACT-004] Write failing acceptance/security tests

## Phase 1 — Contract/data
- [ ] [UNIFIED_GRAPH_CONTRACT-010] Implement shared types/schemas
- [ ] [UNIFIED_GRAPH_CONTRACT-011] Implement migration if applicable
- [ ] [UNIFIED_GRAPH_CONTRACT-012] Verify backward compatibility
- [ ] [UNIFIED_GRAPH_CONTRACT-013] Verify idempotency/concurrency where applicable

## Phase 2 — Domain/provider
- [ ] [UNIFIED_GRAPH_CONTRACT-020] Implement service/provider/repository
- [ ] [UNIFIED_GRAPH_CONTRACT-021] Enforce source authorization
- [ ] [UNIFIED_GRAPH_CONTRACT-022] Implement degraded/fail-closed behavior
- [ ] [UNIFIED_GRAPH_CONTRACT-023] Pass unit/integration tests

## Phase 3 — API/tool
- [ ] [UNIFIED_GRAPH_CONTRACT-030] Implement endpoint/tool if declared
- [ ] [UNIFIED_GRAPH_CONTRACT-031] Add contract tests
- [ ] [UNIFIED_GRAPH_CONTRACT-032] Update API docs

## Phase 4 — Verification
- [ ] [UNIFIED_GRAPH_CONTRACT-040] directed tests
- [ ] [UNIFIED_GRAPH_CONTRACT-041] regression
- [ ] [UNIFIED_GRAPH_CONTRACT-042] build/typecheck/lint
- [ ] [UNIFIED_GRAPH_CONTRACT-043] pnpm spec:validate:strict
- [ ] [UNIFIED_GRAPH_CONTRACT-044] pnpm spec:coverage
- [ ] [UNIFIED_GRAPH_CONTRACT-045] pnpm spec:index

## Phase 5 — Delivery
- [ ] [UNIFIED_GRAPH_CONTRACT-050] PR review
- [ ] [UNIFIED_GRAPH_CONTRACT-051] CI PASS
- [ ] [UNIFIED_GRAPH_CONTRACT-052] merge SHA
- [ ] [UNIFIED_GRAPH_CONTRACT-053] deployment terminal if runtime changed
- [ ] [UNIFIED_GRAPH_CONTRACT-054] shadow/canary
- [ ] [UNIFIED_GRAPH_CONTRACT-055] authenticated smoke
- [ ] [UNIFIED_GRAPH_CONTRACT-056] production evidence/state update
