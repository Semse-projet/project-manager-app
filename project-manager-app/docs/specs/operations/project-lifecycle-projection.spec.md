---
id: "operations.project-lifecycle-projection"
title: "Project Lifecycle Projection F3"
domain: "operations"
sdd_version: "2.0"
version: "1.2"
status: "VERIFIED"
owner: "semse-core"
risk: "critical"
code_status: "COMPLETE"
ci_status: "PASS"
merge_status: "MERGED"
deploy_status: "DEPLOYED"
activation_status: "CANARY"
migration_status: "VERIFIED"
verification_scope: "production-canary:tenant_default"
feature_flags:
  - SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED
  - SEMSE_PROJECT_LIFECYCLE_PERSIST_ENABLED
  - SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS
  - SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED
  - SEMSE_EVENT_OUTBOX_DISPATCH_ENABLED
  - SEMSE_EVENT_CONSUMERS_ENABLED
  - SEMSE_EVENT_CONSUMER_ALLOWLIST
  - SEMSE_EVENT_TYPE_ALLOWLIST
production_evidence:
  - github:pr:472:sha:19472b7892e0fe56975c2d618bf50dc6e0091922:checks-passed
  - github:pr:472:merge:d065a2f21127a808ee640354a1840baf5605a47d
  - railway:api:deployment:b676b5e4-6249-4952-b0ed-8918ad62423e:success
  - railway:web:deployment:ed9e4238-24d9-486b-a3b6-91cef022a2f1:success
  - railway:api:canary:calculation:500:evidence-tenant-column-drift
  - railway:api:rollback:537892e7-f6b9-4cee-a972-ceacd8e7ab77:success
  - railway:postgres:repair-transaction:two-runs-verified-then-rolled-back
  - github:pr:473:sha:96318d8f4fc6800fc52fb74fa7e2015506f42292:checks-passed
  - github:pr:473:merge:35f6bda3387e6d17b8dcf094f2e790e43b751021
  - github:actions:production-health-gate:30509069492:success
  - railway:api:deployment:2b0cb689-5bf8-42c0-a86a-b6076a1be36d:success
  - railway:web:deployment:239ea013-84b5-48cc-90dd-eed3e76b2c99:success
  - railway:worker:deployment:4e91525c-20f5-406a-9d59-d1fbeaf365b0:success
  - railway:vision:deployment:174e569e-d79e-41ac-a414-96ee2bd11fda:success
  - railway:postgres:migration:20260730010000_repair_evidence_canonical_schema:finished
  - railway:postgres:evidence-context:columns=9:null-tenant=0:fks=2:indexes=3
  - railway:api:canary-calculation:85299c98-c84e-4c07-b8f2-d17c3e1a44f9:success
  - railway:api:canary-persistence:7450784e-c6e2-44c6-82ae-61c3a567fe15:success
  - railway:api:canary:client=200x2:pro=403:outside-tenant=404:revision-stable
  - railway:postgres:ProjectLifecycleProjection:rows=1:mismatch=0
  - railway:health:api=200:web=200:2026-07-30
  - railway:postgres:migration:20260728000000_project_lifecycle_projection:finished
  - railway:postgres:table:ProjectLifecycleProjection:baseline-before-canary:rows=0
  - railway:postgres:migration:20260729000000_evidence_updated_at_for_lifecycle_projection:finished
  - railway:api:variables:f3-projection-persistence-off:2026-07-29
  - github:pr:477:head:b77b45f9b60171a8f8c826368f27662a6a959f14:checks-passed
  - github:pr:477:merge:f1234291fc190c6611d3f2258630ac08315bd060
  - github:actions:railway-deploy:30542950757:success
  - railway:api:deployment:5d4a79ae-6c70-4e0f-b65b-3998e5d29523:success
  - railway:web:deployment:55100d11-e811-4bf3-bba0-7c9b89c91771:success
  - railway:worker:deployment:60f2662e-ee70-4ab0-bffe-65d642b09c0d:success
  - railway:vision:deployment:eb3d3eef-0e81-4cf9-981b-8fb233011f00:success
  - railway:api:activation-deployment:d896be44-4b27-48b8-8324-159599ab8e1a:sha:62c69537f62515bbaabbfa0b29d2750d9d9c5b0e:success
  - railway:worker:activation-deployment:d706d7ad-3661-437c-8492-18b7791a0345:sha:62c69537f62515bbaabbfa0b29d2750d9d9c5b0e:success
  - railway:worker:roles:OPS_ADMIN,WORKER,EVENT_CONSUMER:consumer-enabled
  - railway:f3:outbox:published=5:pending=0:claimed=0:failed=0:dead-letter=0
  - railway:f3:consumer:completed=5:failed=0:dead-letter=0
  - railway:f3:role-gap:events=f893805f-6cd9-4ded-8a75-c3ee58dd4a37,dab442a8-c747-45c2-9f5a-fef3869fd935:http=403:reconciled-once
  - railway:f3:automatic-consumption:events=d48cf482-4e38-4fd2-a222-5e558db3b41a,0b114154-f26b-4569-90e3-8cf8d79fce15,5173120d-f312-4d8e-880e-2d2adee8d3b8
  - railway:f3:replay:event=5173120d-f312-4d8e-880e-2d2adee8d3b8:replay-count=1:attempts=1:duplicate=true:effect=no_op
  - railway:f3:replay:revision=project-lifecycle.v1:0f8f7c9fb7c45d9fbd55bb733bb3b06e5265782b6113a1e622a675679a7d244d:last-error=null
  - railway:health:api-railway=200:web-custom=200:web-railway=200:2026-07-31
  - railway:current-production:sha:3c2ac45d4f5d3c43a081767c54405eb08d31c788:contains-f3
  - railway:current-production:api=425b8526-4374-450b-ae75-53881791e6bc:web=00a3e13b-c86c-4edf-b2a2-a2e1f4f274f7:success
  - railway:current-production:worker=7d5f6279-3554-4a03-bd9d-2960722bce97:vision=5e1155a6-9efc-46f6-95da-6552798994fc:success
  - github:pr:481:merge:114cb9ca4007d32bf3fbbfc9c36d54b1e862236a
  - github:actions:railway-deploy:30597913257:success
  - railway:current-production:sha:114cb9ca4007d32bf3fbbfc9c36d54b1e862236a:contains-f3
  - railway:current-production:api=575a82f1-ac99-4d60-a5d2-e6aeb645e096:web=3ffb51d5-6dd1-4fd3-afa2-b7c6b1cff489:success
  - railway:current-production:worker=8fe3b3fc-c10a-4843-82cf-d4a2e79297ec:vision=bf804e3b-9a56-4b94-b1ad-6e6bcafd57cd:success
  - railway:custom-domain:api.semseproject.com:tls-valid:health=200
related_files:
  - apps/api/src/modules/projects/project-lifecycle-projection.ts
  - apps/api/src/modules/projects/projects.repository.ts
  - apps/api/src/modules/projects/projects.service.ts
  - apps/api/src/modules/projects/projects.controller.ts
  - apps/api/src/modules/domain-events/project-lifecycle-projection-event-producer.service.ts
  - apps/api/src/modules/domain-events/domain-event-consumer.service.ts
  - apps/api/src/modules/domain-events/domain-event-bus.service.ts
  - apps/api/src/modules/domain-events/domain-events.module.ts
  - apps/api/src/modules/milestones/milestones.repository.ts
  - apps/api/src/modules/evidence/evidence.repository.ts
  - apps/api/src/modules/disputes/disputes.service.ts
  - apps/api/src/modules/payments/payments.service.ts
  - apps/api/src/modules/finance/finance.service.ts
  - apps/api/src/modules/intelligence/risk-scoring.service.ts
  - apps/api/src/modules/buildops/buildops.service.ts
  - apps/api/src/modules/buildops/buildops-legacy-promotion.service.ts
  - apps/web/components/projects/ProjectLifecycleProjectionPanel.tsx
  - apps/web/app/(app)/buildops/projects/[projectId]/page.tsx
  - apps/web/app/(app)/client/projects/[projectId]/page.tsx
  - apps/web/app/api/semse/projects/[projectId]/projection/route.ts
  - packages/db/prisma/schema.prisma
  - packages/schemas/src/project.schema.ts
  - packages/schemas/src/domain-events-v2.schema.ts
  - packages/shared/src/index.ts
  - packages/db/prisma/migrations/20260728000000_project_lifecycle_projection/migration.sql
  - packages/db/prisma/migrations/20260729000000_evidence_updated_at_for_lifecycle_projection/migration.sql
  - packages/db/prisma/migrations/20260730010000_repair_evidence_canonical_schema/migration.sql
  - docs/runbooks/F3_PROJECT_LIFECYCLE_EVENT_CANARY.md
  - docs/foundation/EVENT_CATALOG.md
  - docs/architecture/SEMSE_API_SURFACE_V1.md
related_tests:
  - apps/api/test/project-lifecycle-projection.test.ts
  - apps/api/test/project-lifecycle-projection-persistence.test.ts
  - apps/api/test/project-lifecycle-projection-events.test.ts
  - apps/api/test/project-lifecycle-projection-events-integration.test.ts
  - apps/api/test/evidence-outbox-producer.test.ts
  - apps/api/test/projects.controller.test.ts
  - apps/api/test/buildops-project-canonical-link.test.ts
  - tests/unit/project-lifecycle-migration.test.mjs
related_endpoints:
  - GET /v1/projects/:projectId/projection
  - GET /api/semse/projects/:projectId/projection
  - GET /v1/domain-events/outbox
  - GET /v1/domain-events/:eventId/deliveries
  - POST /v1/domain-events/:eventId/process
  - POST /v1/domain-events/:eventId/replay
related_events:
  - project.lifecycle-source-changed.v1
related_agents:
  - prometeo
last_verified: "2026-07-31"
---

# Spec: Project Lifecycle Projection F3

## 1. Problema y resultado

Cliente, Operaciones, BuildOps y Prometeo reconstruyen por separado el estado de
un proyecto desde Job, Contract, Project, Milestones, Evidence, Disputes,
Payments, gastos y riesgo. Eso produce números y próximas acciones
inconsistentes.

F3 entrega una vista tenant-safe, versionada y durable con etapa, progreso de
trabajo, evidencia faltante, dinero, riesgo, bloqueadores y próxima acción. Las
tablas de dominio siguen siendo la autoridad y la proyección es reconstruible.

## 2. Alcance

### Incluido

- Contrato Zod `schemaVersion: 1`.
- Cálculo determinista desde fuentes canónicas.
- Snapshot durable con compare-and-swap por `revision`.
- `GET /v1/projects/:projectId/projection`.
- BFF y panel compartido para Cliente/BuildOps canónico.
- Enlace `BuildOpsProject -> Project` sólo mediante
  `promotedFromBuildOpsProjectId`.
- Read-through/rebuild controlado y preparado para eventos.
- Flags server-side, allowlist de tenant, canary y rollback.
- Riesgo de proyecto, gastos aprobados y evidencia requerida.

### Fuera de alcance

- Modificar estados de Project/Milestone/Payment desde la proyección.
- Reemplazar Payment Governance, Evidence review, Trust o Ledger.
- Convertir todos los productores de F1-F2 en este mismo PR.
- Mostrar finanzas a la organización profesional.

## 3. Actores, permisos y límites

| Actor | Permiso | Scope | Resultado |
|---|---|---|---|
| Cliente owner | `projects:financials:read` | tenant + `clientOrgId` | vista completa |
| OPS_ADMIN | `projects:financials:read` | tenant | vista completa |
| Profesional asignado | `projects:read` | tenant + `assignedProOrgId` | no recibe campos financieros en v1 |
| Otro actor | ninguno | — | 403/404 sin fuga |

El primer endpoint completo exige `projects:financials:read` y
`assertProjectFinancialsReadable`; por tanto sólo Cliente owner y OPS_ADMIN.
Una vista redacted para profesionales requiere contrato posterior.

## 4. Escenarios P1

### P1 — Vista coherente

```gherkin
DADO un proyecto del tenant con hitos, evidencia, gastos, escrow y riesgo
CUANDO un actor autorizado consulta la proyección
ENTONCES recibe un snapshot schemaVersion 1 validado
Y el snapshot identifica sus fuentes, revision y sourceUpdatedAt
Y ninguna transacción FAILED o REVERSED cuenta como liberada/gastada
```

### P1 — Bloqueador prioritario

```gherkin
DADO una disputa activa y trabajo rechazado
CUANDO se calcula la proyección
ENTONCES active_dispute es el bloqueador crítico superior
Y nextAction asigna owner ops
```

### P1 — Tenant/ownership

```gherkin
DADO un projectId válido de otro tenant u organización no autorizada
CUANDO se consulta la proyección
ENTONCES no se devuelve snapshot ni se crea persistencia
```

### P1 — Idempotencia y concurrencia

```gherkin
DADO dos reconstrucciones simultáneas del mismo proyecto
CUANDO intentan persistir la misma o distinta revision
ENTONCES existe una sola fila por projectId
Y compare-and-swap evita sobrescribir una revision nueva con una antigua
```

## 5. Contrato API

### `GET /v1/projects/:projectId/projection`

```yaml
auth: required
permission: projects:financials:read
ownership: client org or OPS_ADMIN
output_schema: projectLifecycleProjectionSchema
errors:
  403: actor without financial ownership
  404: project absent, deleted job, feature disabled or tenant not allowlisted
effects:
  domain_write: none
  read_model_write: optional CAS when persistence flag is enabled
  payment_write: none
  audit_log: none
```

Campos mínimos:

```yaml
schemaVersion: 1
revision: project-lifecycle.v1:<sha256>
generatedAt: ISO-8601
sourceUpdatedAt: ISO-8601
project:
  id:
  tenantId:
  jobId:
  title:
  commercialStage:
  executionStage:
  ownerOrgId:
  startAt:
  dueAt:
progress:
  percentage:
  milestones: { total, completed, paid, pending, awaitingReview, rejected }
  evidence: { total, passed, pending, failed, missingRequired, rejectedRequired }
financial:
  currency:
  planned:
  actualExpenses:
  expensesByCurrency:
  forecastAtCompletion:
  forecastMethod:
  deposited:
  released:
  holdback:
  fees:
  refunded:
  available:
  fundingGap:
  unreleased:
risk:
  overallScore:
  level:
  disputeRisk:
  budgetOverrunRisk:
  scheduleRisk:
  calculatedAt:
blockers: []
nextAction: { code, label, owner }
sources:
  complete:
  missing: []
```

Reglas:

- `progress.percentage` usa hitos `APPROVED` o `PAID`, no sólo pagos.
- `actualExpenses` suma gastos `approved` o `reimbursed`, no duplicados.
- `forecastAtCompletion = max(planned, actualExpenses)` en v1 y declara método.
- `available = deposited - released - holdback - fees - refunded`.
- `sourceUpdatedAt` es el timestamp máximo de todas las fuentes consultadas.
- `revision` es SHA-256 de input normalizado, no sólo timestamp de Project.
- Sin datos de riesgo no equivale a riesgo cero; `risk` es `null` y la fuente
  aparece en `sources.missing`.

## 6. Persistencia y migración

Tabla:

```text
ProjectLifecycleProjection
  id, tenantId, projectId unique, schemaVersion, revision,
  snapshotJson, sourceUpdatedAt, generatedAt, createdAt, updatedAt
```

La migración `20260728000000_project_lifecycle_projection` está aplicada en
producción. La tabla partió vacía y contiene exactamente un snapshot después
del canary durable de `tenant_default`. El archivo SQL se restauró byte por
byte desde Git y su SHA-256 coincide con
`1616b63c7c44bfa0526e5ce2e4857565c9375b6c48eed5ed1b3a7389832f6699`.

No se ejecuta otra `CREATE TABLE`. El Prisma schema incorpora el modelo y sus
relaciones. `migrate status` debe quedar reconciliado antes del deploy.

`Evidence.validationStatus` es mutable y el modelo previo no tenía reloj de
actualización. La migración aditiva
`20260729000000_evidence_updated_at_for_lifecycle_projection` agrega
`Evidence.updatedAt`; la consulta F3 usa ese valor para que `sourceUpdatedAt` y
el guard CAS distingan validaciones nuevas de snapshots antiguos.

El primer canary reveló drift histórico: la migración canónica de Evidence
figuraba aplicada, pero faltaban nueve columnas tenant/context. La migración
idempotente `20260730010000_repair_evidence_canonical_schema` quedó aplicada y
verificada en producción: nueve columnas, cero `tenantId` nulos sobre cuatro
filas, dos claves foráneas y tres índices. No se alteraron checksums históricos.

## 7. Flags y activación

- Los dos flags booleanos conservan `false` como valor seguro por defecto.
- Producción está en canary con cálculo y persistencia habilitados únicamente
  para `SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS=tenant_default`.
- El productor F3 exige además
  `SEMSE_PROJECT_LIFECYCLE_EVENTS_ENABLED=true`; dispatcher y consumo conservan
  sus kill switches globales y allowlists de consumer/event type.
- Producción permite `project-lifecycle-projection.v1` y
  `project.lifecycle-source-changed.v1` junto al slice Evidence existente.
- El Worker debe incluir el rol de servicio `EVENT_CONSUMER` además de
  `OPS_ADMIN,WORKER`; sin ese rol el endpoint interno responde 403.
- Primero habilitar cálculo para un tenant allowlisted.
- Después habilitar persistencia y comparar snapshot calculado/durable.
- Después habilitar producer, dispatcher y consumer sólo para el evento y
  consumer allowlisted; verificar outbox, receipt, duplicado y replay.
- Activación global sólo con error rate, latencia y mismatch dentro de SLO.
- Rollback: apagar producer, dispatcher/consumer o los flags de proyección; la
  tabla aditiva y los receipts permanecen para forward-fix/replay.

## 8. Eventos y reconstrucción

El contrato canónico es `project.lifecycle-source-changed.v1`; transporta el
proyecto afectado, fuente, actor, tenant/org, correlation, causation e
idempotency key. Los hooks adoptados cubren Project, Milestone/Evidence,
Dispute, Payments, Finance, Risk y promoción BuildOps.

`project-lifecycle-projection.v1` recupera el evento durable por `eventId`,
recalcula desde las tablas propietarias y fuerza persistencia tenant-scoped con
CAS aunque el flag de persistencia read-through esté apagado. Una revisión ya
persistida produce `no_op`; una entrega ya completada devuelve
`duplicate: true`; effect, AuditLog y receipt terminal se confirman juntos.

El producer de Evidence registra Evidence + sus eventos de outbox en la misma
transacción. Los demás hooks F3 se emiten post-commit y son best-effort; no se
declara atomicidad inexistente. La recuperación de ese límite es cálculo
read-through, rebuild idempotente y un evento posterior. Convertir cada dominio
propietario a outbox atómica sigue perteneciendo a la adopción progresiva del
Event Backbone, no a la autoridad de escritura de esta proyección.

Canary de producción: cinco eventos quedaron `PUBLISHED` y cinco receipts
`COMPLETED`, sin pending/failed/dead-letter. Los dos primeros jobs revelaron un
403 por rol faltante; tras agregar `EVENT_CONSUMER` se reconciliaron una sola
vez. Tres eventos posteriores se consumieron automáticamente. El replay del
evento `5173120d-f312-4d8e-880e-2d2adee8d3b8` terminó `no_op`, `replayCount=1`,
`attempts=1`, `duplicate=true` y sin errores, conservando una sola proyección.

## 9. Tests requeridos

- [x] Cálculo determinista y revision hash
- [x] Progress cuenta APPROVED/PAID
- [x] FAILED/REVERSED excluidos
- [x] Gastos duplicados/rechazados excluidos
- [x] Evidencia requerida faltante/rechazada
- [x] Riesgo ausente no se convierte en cero
- [x] Prioridad de disputa/bloqueo/vencimiento/evidencia/funding
- [x] Endpoint y permiso
- [x] Cross-tenant/cross-org sin persistencia
- [x] CAS concurrente e idempotente
- [x] BFF y UI states
- [x] Migración/checksum
- [x] Canary autenticado
- [x] Schema/event producer y allowlists default-off
- [x] Rebuild tenant-scoped forzado y CAS
- [x] Consumer/receipt/audit idempotentes
- [x] Integración PostgreSQL: primera entrega, duplicado y replay
- [x] Canary de outbox, consumo automático y replay en producción

## 10. Gates de cierre

- [x] SQL/checksum reconciliado
- [x] Tests y regresión verdes
- [x] API surface y event catalog actualizados
- [x] CI/merge/deploy registrados
- [x] Flags documentados OFF por defecto
- [x] Canary tenant verificado
- [x] Persistencia verificada y mismatch durable/calculado = 0
- [x] Rebuild/event invalidation/replay verificados en canary de producción
- [x] Alcance de verificación limitado explícitamente a `tenant_default`
