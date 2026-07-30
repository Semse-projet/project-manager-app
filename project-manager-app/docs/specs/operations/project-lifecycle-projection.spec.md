---
id: "operations.project-lifecycle-projection"
title: "Project Lifecycle Projection F3"
domain: "operations"
sdd_version: "2.0"
version: "1.1"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "critical"
code_status: "COMPLETE"
ci_status: "PASS"
merge_status: "MERGED"
deploy_status: "DEPLOYED"
activation_status: "CANARY"
migration_status: "VERIFIED"
feature_flags:
  - SEMSE_PROJECT_LIFECYCLE_PROJECTION_ENABLED
  - SEMSE_PROJECT_LIFECYCLE_PERSIST_ENABLED
  - SEMSE_PROJECT_LIFECYCLE_CANARY_TENANT_IDS
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
related_files:
  - apps/api/src/modules/projects/project-lifecycle-projection.ts
  - apps/api/src/modules/projects/projects.repository.ts
  - apps/api/src/modules/projects/projects.service.ts
  - apps/api/src/modules/projects/projects.controller.ts
  - apps/api/src/modules/buildops/buildops.service.ts
  - apps/web/components/projects/ProjectLifecycleProjectionPanel.tsx
  - apps/web/app/(app)/buildops/projects/[projectId]/page.tsx
  - apps/web/app/(app)/client/projects/[projectId]/page.tsx
  - apps/web/app/api/semse/projects/[projectId]/projection/route.ts
  - packages/db/prisma/schema.prisma
  - packages/schemas/src/project.schema.ts
  - packages/db/prisma/migrations/20260728000000_project_lifecycle_projection/migration.sql
  - packages/db/prisma/migrations/20260729000000_evidence_updated_at_for_lifecycle_projection/migration.sql
  - packages/db/prisma/migrations/20260730010000_repair_evidence_canonical_schema/migration.sql
related_tests:
  - apps/api/test/project-lifecycle-projection.test.ts
  - apps/api/test/project-lifecycle-projection-persistence.test.ts
  - apps/api/test/projects.controller.test.ts
  - apps/api/test/buildops-project-canonical-link.test.ts
  - tests/unit/project-lifecycle-migration.test.mjs
related_endpoints:
  - GET /v1/projects/:projectId/projection
  - GET /api/semse/projects/:projectId/projection
related_events: []
related_agents:
  - prometeo
last_verified: "2026-07-30"
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
- Primero habilitar cálculo para un tenant allowlisted.
- Después habilitar persistencia y comparar snapshot calculado/durable.
- Activación global sólo con error rate, latencia y mismatch dentro de SLO.
- Rollback: flags OFF; la tabla aditiva permanece para forward-fix.

## 8. Eventos y reconstrucción

F3-A/B usa cálculo canónico + persistencia CAS. Para cerrar F3 como
`VERIFIED`, un rebuild debe poder regenerar snapshots y los eventos de Project,
Milestone, Evidence, Dispute, Payments, Expense y Risk deben invalidar o
actualizar la proyección mediante consumer idempotente. Hasta entonces el spec
puede estar `IMPLEMENTED` y activo como read-through, no `VERIFIED`.

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

## 10. Gates de cierre

- [x] SQL/checksum reconciliado
- [x] Tests y regresión verdes
- [x] API surface actualizada; event catalog sin cambios hasta invalidación
- [x] CI/merge/deploy registrados
- [x] Flags documentados OFF por defecto
- [x] Canary tenant verificado
- [x] Persistencia verificada y mismatch durable/calculado = 0
- [ ] Rebuild/event invalidation verificados para elevar a `VERIFIED`
