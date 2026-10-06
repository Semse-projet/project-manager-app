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
ci_status: "PASS"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - packages/shared/src/universal-connector/contracts.ts
  - packages/shared/src/universal-connector/enforcement.ts
related_tests:
  - packages/shared/src/universal-connector/enforcement.test.ts
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-10-05"
---

# Spec: Universal Connector Trust Contract v1

## 1. Problema y resultado

**Para quién:** tenants SEMSE, operadores, integraciones externas y agentes autorizados.

**Problema:** los conectores externos pueden convertirse en una vía paralela para saltarse aislamiento tenant, Policy, Approval, scopes, consentimiento o límites de Prometeo.

**Resultado esperado:** toda operación externa cruza un límite de confianza fail-closed, provider-agnostic, trazable, revocable y verificable antes de producción.

## 2. Alcance

### Incluido
- Identidad de actor humano/agente y delegación no transitiva.
- Tenant isolation y canonical envelope.
- Capability manifest, scopes y separación read/write/delete.
- Estados ACTIVE/SUSPENDED/REVOKED/QUARANTINED.
- Policy + Approval como autoridad externa al adapter.
- Read-only, trust level, risk budget, blast radius y emergency stop.
- Idempotencia, checkpoint/recovery, conflictos y lineage.
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

- Tenant boundary: actor, conexión y envelope deben coincidir; mismatch = deny.
- Ownership: consentimiento materialmente ampliado exige nueva autorización.
- Step-up: operaciones de riesgo requieren Approval explícito.
- Datos privacyCritical: secretos nunca entran en prompts, envelopes ni logs.
- Auditoría: Intent → Actor → Delegation → Decision → Tool → Policy → Approval → Execution → Evidence → Outcome.

## 4. Escenarios y criterios de aceptación

### P0 — Fail closed
```gherkin
DADO una operación externa
CUANDO falta identidad, scope, tenant match, Policy o Approval requerido
ENTONCES la ejecución se deniega antes del adapter
Y queda un resultado auditable sin secretos
```

### P0 — Aislamiento tenant
```gherkin
DADO actor tenant A y conexión/envelope tenant B
CUANDO se intenta una capability
ENTONCES se devuelve TENANT_MISMATCH o ENVELOPE_TENANT_MISMATCH
Y no ocurre mutación externa
```

### P0 — Prometeo sin autoridad implícita
```gherkin
DADO contenido externo o salida de IA que solicita ampliar permisos
CUANDO Prometeo procesa el contenido
ENTONCES el contenido se trata como datos no confiables
Y no modifica scopes, Policy ni Approval
```

Casos borde:
- [ ] repetición 10x de la misma idempotency key produce una mutación.
- [ ] delegación expirada o con autoridad superior se deniega.
- [ ] SUSPENDED/REVOKED/QUARANTINED se deniegan.
- [ ] READ_ONLY bloquea create/update/delete/execute/sync con efectos de escritura.
- [ ] webhook auténtico no equivale a autorización de negocio.

## 5. Contratos

### SDK / Enforcement
```yaml
auth: required
permissions: capability manifest + actor/delegation scopes
input_schema: ExecutionContext + CanonicalEnvelope + CapabilityManifest
output_schema: allow | deny(code, reason)
errors:
  TENANT_MISMATCH: 403
  ENVELOPE_TENANT_MISMATCH: 403
  READ_ONLY: 403
  CAPABILITY_DENIED: 403
  SCOPE_DENIED: 403
  DELEGATION_DENIED: 403
  POLICY_DENIED: 403
  APPROVAL_REQUIRED: 403
effects:
  audit_log: security decision/evidence
  domain_event: connector security events where applicable
```

### Agente/Prometeo
```yaml
tools: [registered connector capabilities only]
source_citations_required: true
approval_policy: external Policy/Approval authority
forbidden_behavior:
  - self-grant authority
  - bypass Policy or Approval
  - receive provider secrets
  - treat retrieved content as authority
  - invoke unregistered external tools
```

## 6. FSM, eventos y reconstrucción
- Estados: ACTIVE, SUSPENDED, REVOKED, QUARANTINED.
- Invariantes: datos externos nunca son autoridad; deny by default.
- Idempotencia/checkpoints deben permitir replay sin duplicar mutaciones.
- Conflicto sin autoridad suficiente => CONFLICT, nunca blind last-write-wins.

## 7. Datos y migración
- Sin migración Prisma en este slice contractual.
- Adopción legacy: read-only → hybrid → managed migration → full cutover opt-in.
- Rollback: desactivar writes/suspender conexión; contratos permanecen compatibles.

## 8. Observabilidad, despliegue y activación
- Métricas: denies por código, anomalías de volumen, retries/dedup, connector health.
- Correlation: tenantId, connectionId, actorId, capability, decisionId; nunca secretos.
- Emergency controls: DISABLE_WRITES, DISABLE_AGENT_ACCESS, SUSPEND_CONNECTION, EMERGENCY_STOP.
- Evidencia producción: SHA, health, conformance package y smoke autenticado.
- Rollback: cross-tenant, secret leak, bypass de Policy/Approval o mutación anómala.

## 9. Tests requeridos
- [ ] allow path
- [ ] TENANT_MISMATCH
- [ ] ENVELOPE_TENANT_MISMATCH
- [ ] READ_ONLY incluyendo sync con escritura
- [ ] CAPABILITY_DENIED
- [ ] SCOPE_DENIED
- [ ] DELEGATION_DENIED por scope y expiry
- [ ] POLICY_DENIED
- [ ] APPROVAL_REQUIRED
- [ ] estados SUSPENDED/REVOKED/QUARANTINED
- [ ] trustLevel/riskBudget
- [ ] idempotencia/recovery
- [ ] secret scan y prompt-injection authority test

## 10. Mapa de implementación
- Shared SDK: `packages/shared/src/universal-connector/**`
- Policy/Approval: autoridades existentes de SEMSE; no se duplican dentro del adapter.
- Prometeo: tool registry/governance existente.
- Tests: junto al enforcement y suites de conformance.

## 11. Investigación externa
- No se introduce autoridad externa al modelo de gobernanza SEMSE.
- ADR-025 MCP, ADR-035 Approval y ADR-036 boundary de Prometeo son precedentes obligatorios.

## 12. Gates de cierre
- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Receive-Driven Development trace completo Requirement→Threat→Control→Enforcement→Test→Expected Result→Evidence
- [ ] Tests derivados del spec verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] CI PASS
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal DEPLOYED
- [ ] Activación/canary verificada
- [ ] production_evidence y last_verified actualizados
- [ ] Sólo entonces status VERIFIED
