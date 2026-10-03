---
type: tasks
feature: "BuildOps SSE resource authorization"
domain: "buildops"
plan: "docs/specs/api/buildops-sse-org-scope.plan.md"
version: "2.0"
status: "IN_PROGRESS"
date: "2026-09-19"
---
# Tasks
- [x] T-001 Read approved contracts; inspect producers, guard and subscribers.
- [x] T-002 Record baseline and bound scope to BuildOps SSE.
- [x] T-003 Analyze: restore authorized access only with resource filtering.
- [x] T-004 Research NestJS lifecycle, RxJS error isolation and OWASP authorization.
- [ ] T-010/T-013 Run controller/bus/guard tests red before production changes.
- [ ] T-022 Share REST link authorization; implement event policy and filtering.
- [ ] T-024 Confirm green tests and adjacent regression.
- [ ] T-040 Build/lint/SDD and record full coverage result.
- [ ] T-050 Report and commit.
- [ ] T-052 CI, merge, deploy and authenticated production canary.
