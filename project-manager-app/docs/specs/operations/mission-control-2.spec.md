---
id: "operations.mission-control-2"
title: "Mission Control 2.0 F4"
domain: "operations"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "critical"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "VERIFIED"
feature_flags:
  - SEMSE_MISSION_CONTROL_V2_ENABLED
  - SEMSE_MISSION_CONTROL_V2_CANARY_TENANT_IDS
production_evidence: []
related_files:
  - apps/api/src/modules/ops/ops.controller.ts
  - apps/api/src/modules/ops/ops.service.ts
  - apps/api/src/modules/ops/mission-control/mission-control.controller.ts
  - apps/api/src/modules/ops/mission-control/mission-control.service.ts
  - apps/api/src/modules/ops/mission-control/mission-control.policy.ts
  - apps/api/src/modules/ops/loops.service.ts
  - apps/api/src/modules/ops/observer.service.ts
  - apps/api/src/modules/operational-intelligence/operational-signals.service.ts
  - apps/api/src/modules/domain-events/domain-events.controller.ts
  - apps/api/src/modules/domain-events/outbox-ops.service.ts
  - apps/api/src/modules/health/health.service.ts
  - apps/api/src/infrastructure/sse/sse.controller.ts
  - apps/web/app/(app)/admin/mission-control/page.tsx
  - apps/web/app/api/semse/ops/mission-control/summary/route.ts
  - apps/web/app/api/semse/ops/mission-control/exceptions/route.ts
  - apps/web/app/api/semse/ops/mission-control/runbooks/route.ts
  - apps/web/app/api/semse/ops/mission-control/actions/route.ts
  - apps/web/app/api/semse/sse/mission-control/route.ts
  - packages/db/prisma/migrations/20260731033000_mission_control_2/migration.sql
  - docs/runbooks/MISSION_CONTROL_2.md
related_tests:
  - apps/api/test/mission-control-2.test.ts
  - apps/api/test/ops-mission-control.test.ts
  - apps/api/test/operational-intelligence.controller.test.ts
  - apps/api/test/domain-events.controller.test.ts
  - tests/unit/web-bff-auth-policy.test.ts
  - tests/unit/mission-control-2-web.test.ts
related_endpoints:
  - v1/ops/mission-control/summary
  - v1/ops/mission-control/exceptions
  - v1/ops/mission-control/runbooks
  - v1/ops/mission-control/actions
  - v1/operational-intelligence/signals
  - v1/domain-events/outbox
  - v1/ops/agent-runtime
  - v1/ops/loops
  - v1/ops/observer/latest
  - v1/ops/worker/metrics
related_events: []
related_agents:
  - prometeo
last_verified: "2026-07-31"
---

# Spec: Mission Control 2.0 F4

> Child SDD 2.0 del programa
> `platform.production-convergence-f3-f9`. Este contrato autoriza una
> implementación reversible; no afirma que F4 ya esté desplegado o activo.

## 1. Problema y resultado

**Para quién:** operador `OPS_ADMIN` responsable de recuperar una operación
degradada sin saltarse la autoridad de los dominios.

**Problema:** SEMSE ya expone señales, incidentes AI, colas, loops, AgentRuns,
approvals y eventos, pero los presenta en superficies separadas. Varias acciones
operativas no exigen motivo/runbook, no generan un receipt idempotente y no
permiten reconstruir de forma uniforme quién actuó, sobre qué target y con qué
resultado.

**Resultado esperado:** `/admin/mission-control` presenta una cola
tenant-safe de excepciones y permite `pause`, `resume`, `retry`, `requeue`,
`replay`, `acknowledge`, `resolve`, `dismiss` y `escalate` sólo mediante una
acción gobernada con permiso backend, motivo, runbook permitido, idempotency key,
correlation y receipt durable.

## 2. Alcance

### Incluido

- Read model paginado de excepciones de `OperationalSignal`,
  `DomainOutboxEvent`/`DomainEventConsumption`, `AgentRun`, `AgentApproval`,
  `PermanentLoopState`/`AgentDecision`, `MissionControlIncident`, readiness,
  Observer e indicadores de cola Worker.
- Catálogo de runbooks versionado en código y enlazado a documentación.
- Comando único de acción gobernada con receipt durable e idempotencia.
- Adaptadores hacia las autoridades existentes; Mission Control no escribe
  directamente estados de pagos, disputas, Evidence ni proyectos.
- Escalación durable a `MissionControlIncident`.
- UI exception-first con estados loading/empty/ready/forbidden/degraded/error.
- SSE tenant-safe para altas y cambios de receipts/incidentes/señales.
- Canary default-off limitado por allowlist a `tenant_default`.

### Fuera de alcance

- Mutar servicios o deployments de Railway desde la aplicación. F4 presenta
  health/readiness y un deep link operacional; Railway conserva autoridad.
- Liberar pagos, resolver disputas o aprobar Evidence desde Mission Control.
- Reemplazar los endpoints operativos existentes en el primer release.
- Unificar AI Mission Control, Cortex y todas las páginas Admin.
- OTel end-to-end, SLO global F9 o promoción global de F3.
- Ejecutar shell, SQL arbitrario o instrucciones libres desde un runbook.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` lector | `ops:dashboard:read` | tenant de sesión | listar excepciones/receipts/runbooks | ejecutar acciones |
| `OPS_ADMIN` operador | `ops:dashboard:write` | tenant; loops globales sólo por allowlist | solicitar acción gobernada | saltar reason/runbook/idempotencia |
| Replay adapter | `domain-events:replay` + rol `OPS_ADMIN` | evento del tenant | replay terminal | alterar envelope original |
| Worker/event consumer | permisos de servicio existentes | job/evento asignado | ejecutar efecto en cola | usar la UI de operador |

- Tenant boundary: toda fuente tenant-scoped filtra por `tenantId` derivado de
  la sesión; ningún `tenantId` del body tiene autoridad.
- Scope global: `PermanentLoopState` es global. Sólo IDs declarados en
  `@semse/autonomy` pueden pausarse/reanudarse y el receipt registra
  `scope=platform`.
- Step-up humano: toda mutación exige confirmación UI, reason de 10-500
  caracteres, `runbookId` permitido e `idempotencyKey`.
- Payment/Evidence: sólo se presentan como excepciones/enlaces; F4 no aprueba ni
  libera valor económico.
- Auditoría: actor, target, acción, before/result, reason, runbook, requestId,
  correlation, idempotency y timestamps, sin secretos ni payload completo.
- SSE: un evento con `tenantId` nunca se publica en un canal global. Los eventos
  globales deben usar un DTO sanitizado sin tenant/entity payload.

## 4. Escenarios y criterios de aceptación

### P1 — Cola unificada tenant-safe

```gherkin
DADO un OPS_ADMIN del tenant A con excepciones en varias fuentes
CUANDO consulta GET /v1/ops/mission-control/exceptions
ENTONCES recibe items normalizados, ordenados por severidad/edad y paginados
Y cada item declara availableActions, runbookIds y deepLink
Y no recibe IDs, counts ni SSE del tenant B
```

### P1 — Acción gobernada e idempotente

```gherkin
DADO una excepción con una acción permitida
CUANDO el operador envía action, target, reason, runbookId e idempotencyKey
ENTONCES el backend valida permiso, tenant, estado y catálogo
Y persiste un MissionControlActionReceipt
Y delega el efecto al módulo propietario
Y repetir la misma key devuelve el mismo receipt sin segundo efecto
```

### P1 — Conflicto, fallo y recuperación

```gherkin
DADO un target inexistente, no terminal o ya convergido
CUANDO se solicita una acción incompatible
ENTONCES no se inventa éxito y se responde 404 o 409 con código estable
Y el receipt termina FAILED o NO_OP con detalle sanitizado
Y un receipt RUNNING sólo puede reclamarse después de expirar su lease
```

### P1 — Escalación durable

```gherkin
DADO una excepción crítica que requiere coordinación humana
CUANDO OPS_ADMIN ejecuta ESCALATE con motivo y runbook
ENTONCES se crea/reutiliza un MissionControlIncident tenant-scoped
Y el receipt enlaza el incidente y la excepción original
Y la UI y SSE muestran el incidente sin duplicarlo a otros tenants
```

### P2 — Activación canary segura

```gherkin
DADO F4 apagado globalmente y tenant_default en allowlist
CUANDO se prueba el canary autenticado
ENTONCES lectura, runbooks y receipt funcionan sólo en ese tenant
Y una señal sintética se acknowledge/resolve una vez aunque se repita la key
Y las acciones de alto impacto pueden validarse en dry-run antes del efecto real
```

Casos borde:

- [ ] key duplicada con payload distinto produce 409.
- [ ] target cross-tenant produce 404, no fuga 403 descriptiva.
- [ ] retry/requeue valida `AgentRun.tenantId`; conocer un run ID ajeno no
  autoriza mutarlo.
- [ ] action no permitida por target/estado produce 409.
- [ ] error del adapter no deja receipt `SUCCEEDED`.
- [ ] lease vencido se recupera de forma auditable.
- [ ] SSE sin sesión/tenant no recibe canales tenant-scoped.

## 5. Contratos

### API — `GET /v1/ops/mission-control/exceptions`

```yaml
auth: required
permissions: [ops:dashboard:read]
query:
  status: open | acknowledged | failed | dead_letter | pending_approval
  source: signal | event | agent_run | approval | loop | incident | service_health | worker_queue
  severity: info | low | medium | high | critical
  cursor: opaque
  limit: 1..100
output:
  items:
    - exceptionId
    - source
    - targetType
    - targetId
    - severity
    - status
    - title
    - summary
    - occurredAt
    - correlationId
    - availableActions
    - runbookIds
    - deepLink
  nextCursor: string | null
  counts: object
errors:
  401: unauthenticated
  403: missing ops:dashboard:read
```

### API — `GET /v1/ops/mission-control/runbooks`

```yaml
auth: required
permissions: [ops:dashboard:read]
output:
  runbooks:
    - id
    - version
    - title
    - allowedActions
    - targetTypes
    - documentationPath
    - risk
```

### API — `POST /v1/ops/mission-control/actions`

```yaml
auth: required
permissions: [ops:dashboard:write]
input:
  action: ACKNOWLEDGE | RESOLVE | DISMISS | PAUSE | RESUME | RETRY | REQUEUE | REPLAY | ESCALATE
  targetType: OperationalSignal | PermanentLoop | AgentRun | DomainEvent | MissionControlException
  targetId: string
  reason: string(10..500)
  runbookId: string
  idempotencyKey: string(8..128)
  dryRun: boolean = false
  options:
    consumerName: string?
output:
  receipt:
    id: string
    status: RUNNING | SUCCEEDED | FAILED | NO_OP
    action: string
    targetType: string
    targetId: string
    incidentId: string | null
    result: object
    correlationId: string
    createdAt: ISO-8601
    completedAt: ISO-8601 | null
errors:
  400: schema/reason/runbook inválido
  401: unauthenticated
  403: permiso o action policy denegada
  404: target fuera de tenant o inexistente
  409: estado incompatible, key con intención diferente o lease activo
  503: adapter no disponible
effects:
  audit_log: ops.mission-control.action
  domain_event: ninguno nuevo en F4; cada dominio conserva sus eventos
  sse: mission-control-action:updated y mission-control-incident:created
```

Los errores nuevos exponen un `code` estable y detalle sanitizado. Adoptar
globalmente RFC 9457 queda fuera de scope; F4 no reescribe el envelope de error
de todo SEMSE.

### UI

```yaml
surfaces:
  - /admin/mission-control
states:
  - loading
  - empty
  - ready
  - forbidden
  - degraded
  - error
  - action_confirm
  - action_running
  - action_succeeded
  - action_failed
required_behavior:
  - una falla parcial identifica la fuente degradada
  - cada acción muestra efecto, riesgo, runbook y reason requerido
  - el resultado visible proviene del receipt del servidor
  - resolve no afirma que la causa real fue corregida sin evidencia
  - deep links abren el workspace propietario
```

### Agente/Prometeo

```yaml
tools: []
source_citations_required: true
approval_policy: Prometeo puede resumir/priorizar; no invoca acciones F4 en este slice
forbidden_behavior:
  - cambiar estados operativos
  - crear reason en nombre del operador
  - ejecutar runbooks
```

## 6. FSM, eventos y reconstrucción

```text
REQUESTED -> RUNNING -> SUCCEEDED
                    -> FAILED
                    -> NO_OP
RUNNING --lease vencido--> RUNNING (reclaim auditado)
```

- Invariantes: la autoridad de escritura permanece en cada módulo; receipt no
  equivale por sí solo a éxito del target.
- Idempotencia: unique `(tenantId, idempotencyKey)` y hash de intención. Mismo
  hash retorna receipt; hash diferente responde 409.
- Replay: el adapter reutiliza `OutboxOpsService.replay`; no edita el envelope.
- Rebuild: la cola de excepciones se recalcula desde fuentes canónicas; receipts
  e incidentes son durables.
- DLQ: F4 la hace visible/operable, pero no sustituye la FSM del Event Backbone.
- SSE es notificación best-effort; reconnect siempre reconstruye por GET.

## 7. Datos y migración

- Nuevo modelo `MissionControlActionReceipt`.
- Extensión aditiva de `MissionControlIncident` con campos operativos opcionales:
  `kind`, `orgId`, `status`, `actorUserId`, `targetType`, `targetId`, `reason`,
  `runbookId`, `actionReceiptId`, `resolvedAt`, `updatedAt`.
- Unique/indexes: `(tenantId,idempotencyKey)`, tenant/status/createdAt,
  targetType/targetId y correlationId.
- No backfill destructivo: incidentes AI existentes reciben defaults/nullable.
- Compatibilidad: endpoints actuales permanecen; la UI canary usa los nuevos.
- Producción usa `prisma migrate deploy`; nunca `db push`.
- Rollback: apagar flags y volver a UI/endpoints previos; conservar tabla y
  columnas para auditoría. Si el schema falla, forward-fix aditivo.

## 8. Observabilidad, despliegue y activación

- Métricas: actions por tipo/status, duplicate/no-op, duration, stale leases,
  exceptions por source/severity y SSE reconnects.
- Correlation: `requestId` de entrada + correlation de target/receipt en logs,
  AuditLog y adapter.
- Flags default-off; allowlist exacta `tenant_default` para el primer canary.
- Health/readiness no activa F4.
- Canary:
  1. listar runbooks/excepciones con OPS_ADMIN;
  2. probar 404 cross-tenant sin revelar existencia;
  3. crear una señal sintética identificada y ejecutar ACK/RESOLVE con duplicate
     key;
  4. ejecutar dry-run de PAUSE/RESUME/RETRY/REQUEUE/REPLAY/ESCALATE;
  5. ejecutar ESCALATE real y cerrar el incidente sintético;
  6. comprobar receipts, audit, SSE y cero efecto duplicado.
- Señal de rollback: fuga cross-tenant, receipt exitoso sin efecto, efecto
  duplicado, adapter fuera de allowlist o aumento de 5xx.

## 9. Tests requeridos

- [ ] Unitarios del normalizador, catálogo y policy por acción.
- [ ] Servicio real de summary/nextAction; retirar la prueba que copia lógica.
- [ ] Contrato GET exceptions/runbooks y POST actions.
- [ ] Permisos, rol OPS_ADMIN y 404 cross-tenant.
- [ ] Regresión de retry/requeue por `id + tenantId`.
- [ ] Idempotency key igual/diferente y reclaim de lease.
- [ ] Estados target incompatibles, adapter failure y no-op.
- [ ] Migración desde schema previo con incidentes AI existentes.
- [ ] SSE tenant isolation; no duplicación tenant→global.
- [ ] UI loading/empty/forbidden/degraded/error y confirmación.
- [ ] Canary autenticado y rollback por flags.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/ops/mission-control/*`
- `apps/api/src/modules/ops/ops.module.ts`
- `apps/api/src/infrastructure/sse/sse.controller.ts`
- adaptadores en `ops`, `operational-intelligence` y `domain-events`

### Web

- `apps/web/app/(app)/admin/mission-control/page.tsx`
- `apps/web/app/api/semse/ops/mission-control/**`
- `apps/web/app/api/semse/sse/mission-control/route.ts`

### DB/Packages

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/*_mission_control_2`
- schemas Zod compartidos donde aplique

### Tests

- `apps/api/test/mission-control-2*.test.ts`
- `tests/unit/mission-control-2*.test.ts`

## 11. Investigación externa

1. AWS Builders' Library,
   <https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/>
2. Google SRE, Managing Incidents,
   <https://sre.google/sre-book/managing-incidents/>
3. OpenTelemetry Context,
   <https://opentelemetry.io/docs/specs/otel/context/>
4. RFC 9457, Problem Details for HTTP APIs,
   <https://www.rfc-editor.org/rfc/rfc9457.html>

- Aplicado ahora: idempotency key con intención estable; command post único sin
  absorber autoridad; reason/actor/live state; correlation propagada.
- Backlog: roles formales incident commander/communications y OTel end-to-end.
- Descartado: retry ciego, runbook arbitrario y reescritura global de errores.

## 12. Gates de cierre

- [x] Spec enlazado por `pnpm spec:index`.
- [x] Spec, plan, tasks, analyze y checklist coherentes antes de código.
- [x] Tests derivados del spec y verdes localmente.
- [x] Migración reproducible y rollback/forward-fix documentado.
- [ ] CI `PASS`, PR fusionado y SHA registrado.
- [ ] Deployment terminal de API/Web y migración aplicada.
- [ ] Canary `tenant_default` verificado separado de health.
- [ ] `production_evidence`, `last_verified`, índice, matriz, roadmap y API
  surface actualizados.
- [ ] Sólo entonces `status: VERIFIED`.
