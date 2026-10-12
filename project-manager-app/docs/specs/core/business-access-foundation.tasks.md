# Tasks — DEC-R1

| ID | Task | Gate |
|---|---|---|
| R1-01 | Owner approval, HEAD, conflicts, spec and index | Approved |
| R1-02 | Negative tests org A/B, revoked session, failure, login and refresh | Write tests first |
| R1-03 | Implement durable issue, active session and role intersection | Unit + build |
| R1-04 | Prevent refresh replay and elevation | Concurrency tests |
| R1-05 | Read-only organization scope, 404/403 and OPS_ADMIN | Cross-org tests |
| R1-06 | Bootstrap BFF/worker contract and production AUTH_SECRET gate | Integration tests |
| R1-07 | Strict spec, API tests, typecheck, CI | Terminal evidence |
| R1-08 | Draft PR, no merge, no deploy | Human review |
| R1-09 | Synthetic tenant/org canary | Separate release approval |


## Follow-up tasks
- [x] Verify main/PR #877 and historical CI.
- [x] Write role-borrowing regression before code.
- [x] Enforce target roles on list/detail/members.
- [x] Run focused regression; record full-CI limits.
- [ ] Draft follow-up PR; no merge/deploy.
