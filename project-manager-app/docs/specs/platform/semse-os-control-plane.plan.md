---
type: plan
feature: "SEMSE OS Capability Control Plane"
domain: "platform"
spec: "docs/specs/platform/semse-os-control-plane.spec.md"
version: "1.0"
status: "APPROVED"
branch: "feat/semse-os-control-plane"
date: "2026-07-19"
approval_scope: "tasks-only"
approved_review_digest: "dc1edb5973bf6b51b3ff6708ec21d9cae7cf314d5f42dab4b0b893afb630f6b0"
approved_spec_digest: "54e8506324049e9defc2b0ca8118656520b4e0f4a7b09d2ff79ec32dc3460431"
approved_draft_digest: "644c2b21ff24264d4623494286cac314e9574cec8566dd7baff166303beabfd7"
approved_f0_tasks_digest: "62eeb221dcf408e61df085d73aaf26428bf44d29275e3f83cb1f50fb5c4d3714"
f0_review_status: "COMPLETE_WITH_ENV_BLOCKER"
---

# Plan técnico: SEMSE OS Capability Control Plane

> Este plan fue aprobado únicamente para generar `tasks.md`. No autoriza
> ejecutar tareas, escribir código, cambiar Prisma, instalar dependencias,
> desplegar ni mutar producción.

## 1. Resumen técnico

**Estrategia:** agregar un plano de control modular que reutiliza identidad,
RBAC, Event Backbone, BullMQ, Mission Control y patrones de approval existentes,
pero incorpora un modelo propio de approval para infraestructura. El núcleo de
dominio será puro y compartido; API conserva autoridad transaccional y el worker
ejecuta operaciones aprobadas mediante adapters cerrados.

**Complejidad:** alta.  
**Riesgo:** critical por autoridad de infraestructura, secretos y multi-tenant.  
**Primer slice propuesto:** activar, observar y revertir Ollama local como
capability `local-ai-runtime`, sin datos productivos ni acceso cloud.

## 2. Constitution check

- [x] Spec aprobado antes del plan.
- [x] Evidence/Payments están fuera del primer slice.
- [x] Toda transición material exige AuditLog + Domain Event v2.
- [x] Datos y secretos sensibles usan handles; no viajan en prompts/logs.
- [x] Tests se definen antes del código en cada fase.
- [x] Monolito modular primero; no microservicios por defecto.
- [x] Ningún agente obtiene autoridad de merge, deploy o shell libre.

## 3. Decisiones de arquitectura

### 3.1 Ownership

```text
packages/schemas
  contratos Zod de API, manifests, operations y receipts

packages/control-plane (nuevo, puro y sin I/O)
  FSM, planner, compatibilidad, digests, policy inputs y RuntimeAdapter contract

apps/api/src/modules/capabilities
  endpoints, tenant/ownership, repository, approvals, audit y outbox

apps/worker/src/modules/capabilities
  consumer de operaciones autorizadas y verification orchestration

scripts/capability-runtime
  executor local explícito para Compose; no se despliega en Railway

apps/web
  lectura de estado/approvals en Mission Control en una fase posterior
```

El paquete nuevo se justifica porque API, worker y executor local deben compartir
FSM/planner sin importar NestJS, Prisma, Docker ni BullMQ.

### 3.2 Relación con sistemas existentes

- Forge gobierna ingeniería; no activa capabilities empresariales.
- Developer Runtime puede preparar/verificar trabajo, pero su shell abierto no
  se reutiliza como adapter de infraestructura.
- `AgentApprovalService` aporta patrones, pero Control Plane requiere approval
  ligada a `planDigest`, target y configuration revision.
- Event Backbone v2 transporta eventos; no se crea otro bus.
- BullMQ ejecuta operaciones; PostgreSQL conserva verdad e idempotencia.
- Mission Control observa; no ejecuta Docker directamente.

### 3.3 Seguridad del adapter Compose

El adapter inicial no acepta una cadena de shell. Consume un plan estructurado y
solo permite operaciones registradas:

```text
compose.observe
compose.activate_profile
compose.verify_service
compose.stop_service
compose.rollback_revision
```

La implementación futura usará `spawn(executable, args[])`, cwd permitido,
allowlist de archivos Compose y servicio, timeout, output redaction y receipt.
No se monta el socket Docker dentro de agentes. El executor local opera bajo
acción humana o broker dedicado con execution grant de corta vida.

## 4. Modelo de datos propuesto

Cambios Prisma aditivos, sujetos a plan de migración separado:

```text
CapabilityDefinition
  id, name, version, publisher, manifestJson, manifestDigest, status
  unique(name, version)

RuntimeTarget
  id, tenantId, workspaceId, kind, name, configRef, status
  unique(tenantId, workspaceId, name)

CapabilityInstallation
  id, tenantId, orgId, workspaceId, definitionId, runtimeTargetId
  desiredState, observedState, desiredVersion, resolvedVersion
  configurationRevision, lastOperationId, observedAt

CapabilityOperation
  id, tenantId, workspaceId, installationId, intent, status, risk
  idempotencyKey, policyDecisionJson, planJson, planDigest
  correlationId, requestedByType, requestedById, timestamps
  unique(tenantId, idempotencyKey)

CapabilityExecutionReceipt
  id, operationId, stepId, adapterKind, status, outputJsonRedacted
  startedAt, completedAt
  unique(operationId, stepId)

CapabilityOperationApproval
  id, tenantId, operationId, approvalMode, status
  planDigest, configurationRevision, runtimeTargetId
  requestedByUserId, decidedByUserId, expiresAt, decidedAt, reason
  unique(operationId, approvalMode, decidedByUserId)
```

No se guardan secretos; `RuntimeTarget.configRef` apunta al broker/configuración.
`CapabilityOperationApproval` no reutiliza `AgentApproval` ni
`DeveloperRuntimeApprovalStore`: ambos pertenecen a otros runtimes y no prueban
doble control de infraestructura. El servicio exige que solicitante y aprobador
sean distintos y, para riesgo critical, dos decisiones aprobatorias de actores
humanos independientes.

## 5. API propuesta

| Método | Ruta | Permiso | Riesgo |
| --- | --- | --- | --- |
| GET | `/v1/capability-definitions` | `capabilities:read` | low |
| GET | `/v1/workspaces/:workspaceId/capabilities` | `capabilities:read` | low |
| POST | `/v1/workspaces/:workspaceId/capabilities/:name/operations` | `capabilities:operate` | medium+ |
| GET | `/v1/capability-operations/:operationId` | `capabilities:read` | low |
| POST | `/v1/capability-operations/:operationId/approve` | `capabilities:approve` | high |
| POST | `/v1/capability-operations/:operationId/reject` | `capabilities:approve` | high |
| POST | `/v1/capability-operations/:operationId/rollback` | `capabilities:rollback` | high/critical |

Los schemas exactos vivirán en
`packages/schemas/src/capability-control-plane.schema.ts`. Todo lookup incluye
tenant + workspace ownership; conocer un ID no concede acceso.

Asignación mínima propuesta:

```text
OPS_ADMIN
  capabilities:read
  capabilities:operate
  capabilities:approve
  capabilities:rollback

CAPABILITY_EXECUTOR
  capabilities:execute
```

La identidad técnica `CAPABILITY_EXECUTOR` no hereda `OPS_ADMIN` ni puede
aprobar operaciones. El endpoint interno de claim/execute exige simultáneamente
rol de servicio y permiso `capabilities:execute`, siguiendo el patrón del
consumer interno de Domain Events. Las credenciales son cortas, rotables y
limitadas al tenant/target autorizado.

## 6. Eventos y FSM

Antes de implementar se incorporarán al catálogo las transiciones y eventos
candidatos definidos en `semse-os-control-plane.contracts.md`. La escritura de
estado y outbox será atómica. El worker recibe `operationId`, reconstruye el plan
durable y no confía en payload arbitrario de Redis.

## 7. Fases de implementación propuestas

### Fase 0 — Gates y contratos

- aceptar ADR-023;
- revisar threat model;
- incorporar FSM/eventos canónicos;
- cerrar permisos, identidad de servicio y primer slice;
- aceptar el modelo propio de approval y doble control;
- plan aprobado para generar tasks sobre el digest registrado;
- generar tasks solo después de esa aprobación.

### Fase 1 — Tests y schemas

- escribir tests de manifests, FSM, digests, compatibilidad y tenancy;
- crear schemas Zod y exports;
- agregar fixtures válidos, inválidos y maliciosos;
- sin Prisma ni adapter todavía.

### Fase 2 — Núcleo puro

- crear `@semse/control-plane`;
- implementar planner determinista, FSM y policy input;
- probar dependencia incompatible, digest drift e idempotencia lógica;
- sin I/O ni conocimiento de Docker.

### Fase 3 — Persistencia aditiva

- diseñar migración Prisma y rollback operacional;
- repository tenant-scoped;
- constraints de idempotencia y receipts;
- transacción estado + outbox;
- integration tests con PostgreSQL real.

### Fase 4 — API y approvals

- módulo NestJS `capabilities`;
- endpoints read/operation/decision;
- RBAC default-deny y ownership;
- approval ligada a planDigest y revision;
- dual control con actores independientes, expiración y binding al target;
- tests 400/403/404/409 e IDOR.

### Fase 5 — Queue y executor local

- queue de operationId y consumer idempotente;
- executor Compose local de comandos cerrados;
- execution grant temporal;
- receipts, timeout, redaction y cancellation;
- kill switch `SEMSE_CAPABILITY_EXECUTION_ENABLED=false` por defecto.

### Fase 6 — Primer slice local

- registrar `local-ai-runtime`;
- fijar Ollama por versión o digest aprobado; nunca usar `latest`;
- planear profile `local-ai` de Ollama;
- aprobación humana;
- activate -> readiness -> ACTIVE;
- fallo inducido -> rollback -> ROLLED_BACK;
- sin Railway ni producción.

### Fase 7 — Mission Control y hardening

- vista read-only de installations/operations/approvals;
- SLO, alertas, drift e incidentes;
- replay/rollback gobernados;
- canary local documentado.

## 8. Secuencia de tests obligatoria

1. schemas y manifest validation;
2. FSM transitions válidas/inválidas;
3. planner y digest deterministas;
4. policy deny no invoca adapter;
5. approval obsoleta por digest/revision;
6. tenant/ownership negativos;
7. idempotency y leases concurrentes;
8. state + outbox atómicos;
9. worker retry/receipt sin doble apply;
10. adapter allowlist y command injection negativos;
11. redacción de secretos;
12. readiness, fault injection y rollback local.

## 9. Observabilidad y SLO

Métricas iniciales:

```text
semse_capability_operations_total{intent,status,adapter}
semse_capability_operation_duration_seconds
semse_capability_reconcile_lag_seconds
semse_capability_drift_total{reason}
semse_capability_rollbacks_total{reason}
semse_capability_stuck_operations_total
```

Logs: operationId, installationId, correlationId, planDigest, targetId redactado,
adapter, step y policy decision. Nunca manifest completo, secrets o stdout sin
filtrar.

## 10. Rollout y rollback

```text
schemas/tests
 -> núcleo puro
 -> tablas sin ejecución
 -> API read-only
 -> planning dry-run
 -> executor local OFF
 -> canary local allowlisted
 -> rollback probado
 -> cierre de evidencia
```

Rollback por fase:

- apagar kill switch;
- detener nuevos claims;
- conservar operations/receipts/outbox;
- liberar leases vencidas mediante reconciler;
- volver instalación a revisión previa direccionable;
- no ejecutar down migration destructiva durante incidente.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Duplicar Forge/Developer Runtime | ownership explícito y adapters, no segundo agente |
| Shell injection | operaciones cerradas + spawn args + allowlists |
| Docker socket comprometido | executor humano/broker; nunca en agente |
| Cross-tenant | actor context + repository scope + tests IDOR |
| Doble apply | unique idempotency + lease + receipt |
| Approval replay | digest/revision/target binding + expiry |
| Autoaprobación o doble control ficticio | modelo propio + requester != approver + dos actores humanos para critical |
| Drift | observe before apply + incidente, no adopción silenciosa |
| Big-bang microservices | primer slice local y monolito modular |

## 12. Archivos previstos

La lista es propuesta y debe congelarse al generar tasks:

```text
packages/schemas/src/capability-control-plane.schema.ts
packages/control-plane/package.json
packages/control-plane/src/{types,manifest,fsm,planner,policy,index}.ts
apps/api/src/modules/capabilities/**
apps/worker/src/modules/capabilities/**
scripts/capability-runtime/**
tests/unit/capability-*.test.*
apps/api/test/capability-*.test.ts
docs/foundation/{STATE_MACHINES,EVENT_CATALOG}.md
docs/architecture/SEMSE_API_SURFACE_V1.md
```

T-007 reservó la ruta futura
`packages/db/prisma/migrations/20260719000000_semse_os_capability_control_plane/migration.sql`.
La carpeta/SQL no existen y requieren T-008/T-009 antes de crearse.

## 13. Gates para aprobar el plan

- [x] ADR-023 aceptado por Architecture.
- [x] Threat model aceptado por Security.
- [x] FSM/eventos aceptados por Domain Architecture.
- [x] Permisos y dual control aceptados por Governance.
- [x] Primer slice `local-ai-runtime` aceptado por Product/Ops.
- [ ] Docker Desktop disponible para prueba local.
- [x] Owner humano autorizó generar tasks sobre el digest
      `644c2b21ff24264d4623494286cac314e9574cec8566dd7baff166303beabfd7`;
      implementación continúa prohibida hasta una autorización posterior
      explícita.
