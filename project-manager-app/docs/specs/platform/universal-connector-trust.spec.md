---
id: "platform.universal-connector-trust"
title: "Universal Connector Trust Contract v1"
domain: "platform"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "FAIL"
merge_status: "MERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - packages/shared/src/universal-connector/contracts.ts
  - packages/shared/src/universal-connector/enforcement.ts
  - packages/shared/src/universal-connector/runtime-trust.ts
  - packages/shared/src/universal-connector/idempotency.ts
  - packages/shared/src/universal-connector/webhook-trust.ts
  - packages/shared/src/index.ts
related_tests:
  - tests/unit/universal-connector-trust.test.ts
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-10-06"
---

# Spec: Universal Connector Trust Contract v1

## 1. Problema y resultado

**Para quién:** tenants SEMSE, operadores, integraciones externas y agentes autorizados.

**Problema:** los conectores externos pueden convertirse en una vía paralela para saltarse aislamiento tenant, Policy, Approval, scopes, consentimiento o límites de Prometeo.

**Evidencia parcial reconciliada (2026-10-15):** PR #797 MERGED el 2026-10-06 con merge SHA `3ffa1be99bc6e3c22873a70776e8eaaaeee6a6c6`. Este hecho solo acredita `merge_status: MERGED`. `ci_status: FAIL`, `deploy_status: NOT_DEPLOYED` y `activation_status: INACTIVE` se conservan hasta nueva evidencia; no implica certificación.

**Resultado esperado:** toda operación externa cruza un límite de confianza fail-closed, provider-agnostic, trazable, revocable y verificable antes de producción.

## 2. Alcance

### Incluido
- Identidad de actor humano/agente y delegación no transitiva.
- Tenant isolation y canonical envelope.
- Capability manifest, scopes y separación read/write/delete/execute.
- Ciclo completo de estados; sólo ACTIVE ejecuta.
- Policy + Approval como autoridad externa al adapter.
- Read-only, trust level por capability, risk budget, blast radius y emergency controls.
- Idempotencia/dedupe durable por contrato, checkpoint/recovery, conflictos y lineage.
- Webhook signature/timestamp/nonce/replay boundary por contrato provider-specific.
- Prometeo selecciona capacidades registradas pero no puede concederse autoridad ni recibir secretos del proveedor.

### Fuera de alcance
- Reescribir todos los adapters existentes en un único cambio.
- Migración forzada de datos legacy.
- Convertir datos externos o salida de IA en autoridad.

## 3. Actores, permisos y límites

| Actor | Permiso | Alcance | Puede | No puede |
|---|---|---|---|---|
| Owner/Admin | scopes concedidos | tenant/conexión | consentir, revocar, suspender | cruzar tenant |
| Servicio | manifest + scopes | tenant/conexión | ejecutar capability registrada | auto-escalar scopes |
| Prometeo/Agent | delegación + Policy | tenant/purpose/expiry | proponer/invocar capability autorizada | auto-aprobar, obtener secretos, modificar Policy |

- Tenant boundary: actor, conexión, runtime y envelope deben coincidir; mismatch = deny.
- Trusted runtime state proviene del control plane; el payload externo no decide status/trust/adoption.
- Step-up: operaciones de riesgo requieren Approval explícito.
- Secretos se representan sólo mediante referencias opacas; nunca entran en envelopes/prompts/logs.
- Auditoría objetivo: Intent → Actor → Delegation → Decision → Tool → Policy → Approval → Execution → Evidence → Outcome.

## 4. Criterios de aceptación P0
- Falta de identity/scope/tenant/Policy/Approval => deny antes del adapter.
- Actor/runtime/resource/envelope cross-tenant => deny.
- REQUESTED/AUTHORIZED/VERIFIED/DEGRADED/QUARANTINED/SUSPENDED/REVOKED => deny; ACTIVE => evaluable.
- READ_ONLY bloquea operaciones con efectos de escritura.
- La misma idempotency key repetida 10x no produce una segunda mutación.
- Reuso de key con fingerprint distinto => deny/error.
- Webhook con timestamp inválido, firma inválida o nonce repetido => no trusted.
- Contenido externo que ordene ignorar Policy o ampliar scopes sigue siendo datos sin autoridad.
- Blast radius, delegation budget y emergency controls fallan cerrados.

## 5. Contratos y códigos
`ConnectorRuntimeState` es la fuente confiable para tenant/conexión/provider/status/trust/adoption y controles de emergencia. `CapabilityManifest` define operaciones habilitadas, Approval y minimumTrustLevel. `ConnectorExecutionContext` transporta actor/scopes/delegación/idempotency, pero no puede sobrescribir runtime state.

Códigos principales: `RUNTIME_MISMATCH`, `CONNECTOR_INACTIVE`, `EMERGENCY_STOP`, `WRITES_DISABLED`, `AGENT_ACCESS_DISABLED`, `TRUST_LEVEL_DENIED`, `RISK_BUDGET_EXCEEDED`, `BLAST_RADIUS_EXCEEDED`, `TENANT_MISMATCH`, `ENVELOPE_TENANT_MISMATCH`, `ENVELOPE_CONTEXT_MISMATCH`, `READ_ONLY`, `CAPABILITY_DENIED`, `SCOPE_DENIED`, `DELEGATION_DENIED`, `IDEMPOTENCY_REQUIRED`, `POLICY_DENIED`, `APPROVAL_REQUIRED`.

## 6. Idempotencia, webhook y recovery
- No se promete exactly-once delivery.
- `IdempotencyStore` exige almacenamiento durable/tenant-isolated en adapters de producción y claim atómico.
- `executeIdempotently` replaya un resultado COMPLETED y rechaza fingerprint distinto o request concurrente.
- `WebhookReplayStore` exige claim atómico de nonce con expiración.
- La autenticidad del webhook sólo autentica origen; Policy/Approval siguen siendo obligatorios para acción de negocio.
- Checkpoints y reconciliation/compensation siguen siendo responsabilidad del runtime/adaptador concreto.

## 7. Observabilidad, despliegue y activación
- Métricas objetivo: denies por código, anomalías de volumen, retries/dedup, connector health.
- Correlation: tenantId, connectionId, actorId, capability, decisionId; nunca secretos.
- Emergency controls: DISABLE_WRITES, DISABLE_AGENT_ACCESS, SUSPEND_CONNECTION, EMERGENCY_STOP.
- Evidencia producción: SHA, health, conformance package y smoke autenticado.
- Rollback: cross-tenant, secret leak, bypass de Policy/Approval o mutación anómala.

## 8. Tests requeridos
- [x] allow path
- [x] tenant/runtime/context mismatch
- [x] matriz completa non-ACTIVE
- [x] READ_ONLY
- [x] capability/scope/delegation/resource boundary
- [x] Policy + Approval
- [x] minimum trust/risk budget/blast radius
- [x] emergency stop/write disable/agent disable
- [x] idempotencia x10 y fingerprint mismatch
- [x] prompt-injection/data-not-authority
- [x] webhook bad signature + replay
- [ ] secret scan CI evidence
- [ ] persistent production adapter recovery/compensation evidence

## 9. Mapa de implementación
- Shared SDK: `packages/shared/src/universal-connector/**`.
- Export público: `packages/shared/src/index.ts`.
- Test runner canónico: `tests/unit/universal-connector-trust.test.ts` con `node:test`; no Vitest dentro de `packages/shared/src`.
- Policy/Approval y Tool Registry permanecen autoridades existentes de SEMSE.
- No se aceptan duplicados fuera del workspace canónico.

## 10. Gates de cierre
- [ ] Spec enlazado por `pnpm spec:index`
- [x] Spec, Plan, Tasks, Analyze, Receive y Checklist existen
- [ ] Receive-Driven trace actualizado con evidencia de CI
- [ ] Tests verdes y descubiertos por runner canónico
- [ ] `pnpm spec:validate:strict` verde
- [ ] CI PASS en HEAD actual
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal DEPLOYED
- [ ] Activación/canary verificada
- [ ] production_evidence y last_verified actualizados
- [ ] Sólo entonces status VERIFIED
