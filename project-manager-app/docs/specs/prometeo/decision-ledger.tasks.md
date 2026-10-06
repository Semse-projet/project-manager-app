---
type: tasks
feature: "Decision Ledger"
domain: "prometeo"
plan: "docs/specs/prometeo/decision-ledger.plan.md"
version: "2.0"
status: "PENDING"
branch: "feat/decision-ledger"
date: "2026-10-04"
---

# Tasks: Decision Ledger

## Phase 0 — Governance
- [ ] [DECISION_LEDGER-001] Refresh main/Railway
- [ ] [DECISION_LEDGER-002] Approve spec
- [ ] [DECISION_LEDGER-003] Reconcile related files
- [ ] [DECISION_LEDGER-004] Write failing acceptance/security tests

## Phase 1 — Contract/data
- [ ] [DECISION_LEDGER-010] Implement shared types/schemas
- [ ] [DECISION_LEDGER-011] Implement migration if applicable
- [ ] [DECISION_LEDGER-012] Verify backward compatibility
- [ ] [DECISION_LEDGER-013] Verify idempotency/concurrency where applicable

## Phase 2 — Domain/provider
- [ ] [DECISION_LEDGER-020] Implement service/provider/repository
- [ ] [DECISION_LEDGER-021] Enforce source authorization
- [ ] [DECISION_LEDGER-022] Implement degraded/fail-closed behavior
- [ ] [DECISION_LEDGER-023] Pass unit/integration tests

## Phase 3 — API/tool
- [ ] [DECISION_LEDGER-030] Implement endpoint/tool if declared
- [ ] [DECISION_LEDGER-031] Add contract tests
- [ ] [DECISION_LEDGER-032] Update API docs

## Phase 4 — Verification
- [ ] [DECISION_LEDGER-040] directed tests
- [ ] [DECISION_LEDGER-041] regression
- [ ] [DECISION_LEDGER-042] build/typecheck/lint
- [ ] [DECISION_LEDGER-043] pnpm spec:validate:strict
- [ ] [DECISION_LEDGER-044] pnpm spec:coverage
- [ ] [DECISION_LEDGER-045] pnpm spec:index

## Phase 5 — Delivery
- [ ] [DECISION_LEDGER-050] PR review
- [ ] [DECISION_LEDGER-051] CI PASS
- [ ] [DECISION_LEDGER-052] merge SHA
- [ ] [DECISION_LEDGER-053] deployment terminal if runtime changed
- [ ] [DECISION_LEDGER-054] shadow/canary
- [ ] [DECISION_LEDGER-055] authenticated smoke
- [ ] [DECISION_LEDGER-056] production evidence/state update
