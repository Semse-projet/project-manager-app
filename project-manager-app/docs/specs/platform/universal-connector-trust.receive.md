# Receive-Driven Development — Universal Connector Trust v1

**Date:** 2026-10-05  
**Spec:** `platform.universal-connector-trust`  
**ADR:** ADR-042  
**Release rule:** no requirement is production-ready without a closed evidence chain.

## Contract
For every security requirement:
`Requirement → Threat → Control → Enforcement Point → Test → Expected Result → Evidence`.

States: `NOT_IMPLEMENTED`, `IMPLEMENTED_UNVERIFIED`, `TESTED`, `EVIDENCED`, `CERTIFIED`.

| Requirement | Threat | Control | Enforcement point | Required test | Expected result | Evidence / state |
|---|---|---|---|---|---|---|
| Tenant isolation | cross-tenant disclosure/mutation | actor/connection/envelope tenant equality | pre-adapter enforcement | tenant + envelope mismatch | deny before provider call | pending conformance / IMPLEMENTED_UNVERIFIED |
| Least privilege | scope escalation | capability manifest + scopes | pre-adapter enforcement | capability/scope denied | deny | pending / IMPLEMENTED_UNVERIFIED |
| Delegation | agent exceeds delegated authority | subset + expiry + risk budget | delegation gate | excess scope + expired delegation | deny | pending / IMPLEMENTED_UNVERIFIED |
| Connector lifecycle | revoked/suspended connector executes | status gate | pre-adapter | SUSPENDED/REVOKED/QUARANTINED | deny | pending / NOT_IMPLEMENTED |
| Read-only | write through read-only connection | classify write operations incl. sync writes | pre-adapter | create/update/delete/execute/sync-write | deny | pending / IMPLEMENTED_UNVERIFIED |
| Policy | provider/agent bypasses policy | canonical Policy decision | before execution | policy deny | deny | pending / IMPLEMENTED_UNVERIFIED |
| Approval | high-risk action self-approves | canonical Approval requirement | before execution | approval absent | deny | pending / IMPLEMENTED_UNVERIFIED |
| Secrets | credential leakage to logs/prompts/agent | secret isolation + sanitization | adapter boundary/logging | secret scan | zero leaked provider secrets | pending / NOT_IMPLEMENTED |
| Data authority | malicious external content changes authority | data-is-not-authority invariant | ingestion/tool boundary | prompt injection authority attempt | permissions unchanged | pending / NOT_IMPLEMENTED |
| Idempotency | duplicate external mutation | idempotency key/dedup | mutation gateway | same key x10 | exactly one mutation | pending / NOT_IMPLEMENTED |
| Recovery | retry duplicates after interruption | checkpoint/resume | sync runtime | interrupted sync/restart | resume without duplicates | pending / NOT_IMPLEMENTED |
| Blast radius | anomalous mass mutation | volume/rate/tenant limits + pause | write gateway | 80k vs 20/hr baseline | pause/quarantine/approval | pending / NOT_IMPLEMENTED |
| Webhook trust | replay/forged webhook causes action | authenticity + replay/dedup; webhook != authz | webhook ingress | forged/replayed event | reject/no business authority | pending / NOT_IMPLEMENTED |
| Tool trust | changed tool silently retains authority | registry schema/fingerprint/version/risk | tool registry | fingerprint/risk change | authorization re-evaluated | pending / NOT_IMPLEMENTED |
| Audit lineage | action cannot be reconstructed | Security Ledger lineage | decision/execution boundary | successful + denied action | complete lineage | pending / NOT_IMPLEMENTED |
| Emergency stop | compromised connector keeps writing | kill switches | connector/write gateway | emergency disable | future writes blocked | pending / NOT_IMPLEMENTED |

## Certification gate
P0 failures block release. P1 failures block release absent a formally recorded exception. Secret leakage, cross-tenant access, or Policy/Approval bypass have no silent waiver.

Evidence package per release: `contract-version.json`, `requirement-matrix.json`, `conformance-results.json`, `tenant-isolation-results.json`, `authz-results.json`, `agent-security-results.json`, `secret-scan-results.json`, `recovery-results.json`, `threat-model-version.json`, `exceptions.json`, `provenance.json`.
