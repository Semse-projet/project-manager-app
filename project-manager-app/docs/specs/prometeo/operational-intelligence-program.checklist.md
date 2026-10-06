---
type: checklist
feature: "Operational Intelligence Graph + Decision Lineage Program"
spec: "docs/specs/prometeo/operational-intelligence-program.spec.md"
version: "2.0"
date: "2026-10-04"
---

# Checklist: Operational Intelligence Program

## Semantics
- [ ] Fact/Finding/Proposal/Decision/Action/Outcome remain distinct
- [ ] Ledger records only authorized decisions
- [ ] AgentDecision is not redefined
- [ ] Shared Economic Ledger stays separate
- [ ] Memory is not authorization

## Architecture
- [ ] no graph DB
- [ ] no generic graph store V1
- [ ] Graphify stays technical provider
- [ ] domain services retain write authority
- [ ] Omniverse read-only

## Security
- [ ] provider-level tenant/resource policy
- [ ] cross-tenant tests
- [ ] no PII/secrets in graph attributes
- [ ] traversal bounded
- [ ] degraded sources explicit
