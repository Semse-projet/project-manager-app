---
type: checklist
feature: "BuildOps SSE resource authorization"
spec: "docs/specs/api/buildops.spec.md"
version: "2.0"
date: "2026-09-19"
---
# Checklist
- [x] Approved contracts and canonical ownership determine policy.
- [x] No new payment, migration, infrastructure or event production behavior.
- [ ] RED/GREEN proves permission and resource access independently.
- [ ] Every recognized event family has an explicit permission and resource.
- [ ] Mixed/unknown/malformed references fail closed.
- [ ] Denial/errors preserve later events; order and unsubscription verified.
- [ ] REST authorization regression passes after helper extraction.
- [ ] Build, lint, strict SDD and full test result documented.
- [ ] CI/merge/deploy/canary separately verified.
