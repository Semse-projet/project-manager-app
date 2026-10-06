# Receive-Driven Development — Universal Connector Trust v1

**Date:** 2026-10-06  
**Spec:** `platform.universal-connector-trust`  
**ADR:** ADR-042  
**Release rule:** no requirement is production-ready without a closed evidence chain.

## Contract
For every security requirement:

`Requirement → Threat → Control → Enforcement Point → Test → Expected Result → Evidence`

States:
- `NOT_IMPLEMENTED`: no enforcement exists.
- `IMPLEMENTED_UNVERIFIED`: enforcement exists but canonical CI evidence is missing.
- `TEST_AUTHORED`: executable conformance test exists but has not yet produced accepted CI evidence.
- `TESTED`: required test has passed on the release candidate SHA.
- `EVIDENCED`: results/provenance are attached to the release evidence package.
- `CERTIFIED`: all applicable release and production gates have passed.

## Requirement matrix

| Requirement | Threat | Control | Enforcement point | Required test | Expected result | Current state |
|---|---|---|---|---|---|---|
| Tenant isolation | cross-tenant disclosure/mutation | actor/runtime/resource/envelope tenant equality | pre-adapter trust boundary | resource + envelope mismatch | deny before provider call | IMPLEMENTED_UNVERIFIED; resource test authored, explicit envelope test pending |
| Runtime binding | caller forges connection/provider/trust/adoption | trusted `ConnectorRuntimeState` equality | pre-adapter | connection/provider/trust mismatch | deny `RUNTIME_MISMATCH` | TEST_AUTHORED |
| Least privilege | capability/scope escalation | manifest + exact operation + exact scope | pre-adapter | absent capability/missing scope | deny | TEST_AUTHORED |
| Delegation | agent exceeds delegated authority | capability/scope subset + expiry + resource boundary + budget | delegation gate | outside boundary/excess budget/expiry | deny | IMPLEMENTED_UNVERIFIED; boundary/budget tests authored |
| Connector lifecycle | revoked/suspended/degraded connector executes | ACTIVE-only execution | pre-adapter | every non-ACTIVE state | deny | TEST_AUTHORED |
| Read-only | mutation via read-only connection | write-effect classification | pre-adapter | update/delete/sync/execute | deny | TEST_AUTHORED |
| Policy | provider/agent bypasses Policy | canonical Policy decision | before execution | Policy DENY | deny | TEST_AUTHORED |
| Approval | sensitive action self-approves | explicit canonical Approval | before execution | approval absent | deny | TEST_AUTHORED |
| Trust level | low-assurance connector performs sensitive action | minimum trust per capability | pre-adapter | VERIFIED vs CERTIFIED capability | deny | TEST_AUTHORED |
| Secrets | credentials leak to payload/prompt/log | opaque SecretReference + external secret manager | adapter boundary/logging | repository/CI secret scan + redaction tests | zero raw provider secrets | IMPLEMENTED_UNVERIFIED; scan evidence pending |
| Data authority | malicious content changes authorization | payload never enters authority calculation | ingestion/tool boundary | injection requests Policy/scope bypass | permissions unchanged; Policy still wins | TEST_AUTHORED |
| Idempotency | duplicate delivery repeats mutation | tenant+connection+key claim + fingerprint | mutation gateway | same key x10 + changed fingerprint | one execution; mismatch rejected | TEST_AUTHORED |
| Recovery | crash/retry duplicates work | durable idempotency + checkpoint/reconciliation contract | sync runtime/adapter | interrupted sync/restart | resume without duplicate mutation | IMPLEMENTED_UNVERIFIED; real adapter evidence pending |
| Blast radius | runaway agent/mass mutation | action/record/cost/envelope ceilings | write boundary | projected usage exceeds limits | deny/pause path | TEST_AUTHORED for deny; operational quarantine evidence pending |
| Webhook trust | forged/replayed webhook triggers action | signature verifier + timestamp + nonce claim | webhook ingress | bad signature/replay/stale timestamp | untrusted/rejected | TEST_AUTHORED for signature/replay |
| Webhook authority | authentic webhook treated as business authorization | webhook trust separated from Policy/Approval | ingress + execution boundary | valid signature with Policy deny | no business action | IMPLEMENTED_UNVERIFIED; explicit combined test pending |
| Tool trust | changed tool silently keeps authority | Tool Registry fingerprint/version/risk governance | existing Tool Registry | fingerprint/risk change | authorization re-evaluated | IMPLEMENTED_UNVERIFIED; owned by existing registry |
| Audit lineage | action cannot be reconstructed | request/correlation/trace + security/evidence ledger | decision/execution boundary | successful + denied action | complete lineage | IMPLEMENTED_UNVERIFIED; release evidence pending |
| Emergency stop | compromised connector continues writing | emergencyStop/writesDisabled/agentAccessDisabled/status suspension | pre-adapter/write boundary | activate each control | future action denied | TEST_AUTHORED |

## Certification gates
- P0: tenant breach, secret leak, Policy/Approval bypass, authority escalation, uncontrolled destructive mutation — no silent waiver.
- P1: unsafe replay/recovery, incomplete sensitive lineage, webhook trust failure, broken effective-access representation, missing containment — blocks release unless a formally owned exception is recorded and allowed by governance.
- Documentation alone never upgrades a row to TESTED/EVIDENCED/CERTIFIED.

## Evidence package per release
- `contract-version.json`
- `requirement-matrix.json`
- `conformance-results.json`
- `tenant-isolation-results.json`
- `authz-results.json`
- `agent-security-results.json`
- `secret-scan-results.json`
- `recovery-results.json`
- `threat-model-version.json`
- `exceptions.json`
- `provenance.json`

Every evidence record must identify the exact commit/release SHA that produced it.
