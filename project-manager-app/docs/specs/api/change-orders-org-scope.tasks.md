---
type: tasks
feature: "Change order organization isolation"
domain: "change-orders"
plan: "docs/specs/api/change-orders-org-scope.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "fix/remediation-change-order-org-scope-20260919"
date: "2026-09-19"
---

# Tasks

- [x] T-001 Read approved domain spec, constitution and ownership invariants.
- [x] T-002 Record base SHA and explicit absence of production verification.
- [x] T-003 Analyze scope: access repair only; no payment or FSM policy change.
- [x] T-004 Research primary authorization and Prisma filtering guidance.
- [x] T-010/T-013 Run regression tests before implementation and record red.
- [x] T-022 Enforce ownership for list/create/individual operations.
- [x] T-024 Run focused and adjacent regression tests.
- [~] T-040/T-041 Build/lint/SDD pass; full coverage run fails on 29 DB connection tests (report).
- [x] T-050 Record evidence and limitations in session report.
- [ ] T-052 CI, review, merge, deploy and authenticated canary (separate gates).
