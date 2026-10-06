---
type: plan
feature: "Operational Intelligence Graph + Decision Lineage Program"
domain: "prometeo"
spec: "docs/specs/prometeo/operational-intelligence-program.spec.md"
version: "2.0"
status: "DRAFT"
branch: "feat/operational-intelligence-program"
date: "2026-10-04"
---

# Plan técnico: Operational Intelligence Program

## Truth snapshot
Prepared against main and Railway production at:
`370578ad81298ac53078eeef79db7e4110ce7a2a`

Refresh before implementation.

## Delivery order
1. Unified Graph Contract
2. Decision Ledger
3. Unified Query/Lineage
4. Omniverse Adapter

## Authority
- code topology -> Graphify
- conversations -> Communications
- memory -> AgentMemory/WorkspaceMemory
- authorized decisions -> Decision Ledger
- actions/outcomes -> domain/event authorities
- rendering -> no write authority

## Data
Child 1: no migration.
Child 2: additive Prisma migration.
Child 3: no migration initially.
Child 4: no core DB migration.

## Security
- authorize at provider/source boundary;
- fail closed cross-tenant;
- sanitize graph attributes;
- critical decisions require authority/policy/approval provenance.

## Implementation waves
A. contracts/providers
B. Decision Ledger
C. query + Prometeo tool
D. Omniverse adapter

## Rollback
Feature flags off; no deletion of ledger history.

## Gates
- [ ] ADR accepted
- [ ] specs approved
- [ ] exact paths reconciled
- [ ] migration reviewed
- [ ] permissions reviewed
- [ ] each PR reversible
