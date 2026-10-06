---
type: checklist
feature: "Decision Ledger"
spec: "docs/specs/prometeo/decision-ledger.spec.md"
version: "2.0"
date: "2026-10-04"
---

# Checklist: Decision Ledger

## Requirements
- [ ] P1 scenarios testable
- [ ] scope/out-of-scope clear
- [ ] contract matches current repo

## Security
- [ ] source authorization before data return
- [ ] tenant/resource isolation tested
- [ ] no secrets/raw sensitive bodies
- [ ] `SEMSE_DECISION_LEDGER_MODE` off is safe

## Data/events
- [ ] migration/backward compatibility handled
- [ ] retry/idempotency handled where applicable
- [ ] replay/rebuild explicit

## Delivery
- [ ] tests/build/typecheck/lint pass
- [ ] strict/index/coverage pass
- [ ] CI/merge/deploy/activation separately evidenced
- [ ] canary/rollback defined
