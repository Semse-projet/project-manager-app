---
type: checklist
feature: "Change order organization isolation"
spec: "docs/specs/api/change-orders.spec.md"
version: "2.0"
date: "2026-09-19"
---

# Checklist

- [x] Analysis: approved spec and canonical ownership invariants authorize this repair.
- [x] Every supported resource reference has an explicit tenant/org policy.
- [x] No new permissions, transitions, financial rules, events or schema changes.
- [x] Red/green tests prove denial before writes and preserve authorized access.
- [x] Pagination does not include unauthorized records.
- [x] Build, lint, regression, coverage and SDD results recorded separately; global test gate remains FAIL (29 DB connection failures).
- [x] Report links evidence, limitations and rollback.
- [ ] CI/merge/deploy/canary independently verified before production closure.
