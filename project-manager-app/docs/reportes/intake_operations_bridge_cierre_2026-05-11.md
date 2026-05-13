# Intake Operations Bridge Cierre

## Fecha
2026-05-11

## Estado final
cerrado para este alcance

## Resumen ejecutivo

Se implemento un puente operativo e idempotente entre el `Job` publicado por `smart-intake` y una operacion `BuildOps` accionable.

El flujo validado queda asi:

```txt
ProjectIntake publicado
-> Job existente
-> snapshot de Marketplace Matching
-> BuildOpsProject ligado al Job
-> BuildOpsTask base
-> estimate/scope inicial
-> milestone plan sugerido
-> evidence checklist sugerido
-> payment readiness inicial
```

Este frente no fuerza la creacion del `Project` legacy. Los milestones, evidence requirements y payment/escrow plan previos a assignment se persisten como metadata operacional dentro de `BuildOpsProject.sourceToolResult`, que es el punto correcto para esta fase.

## Entidades conectadas

- `ProjectIntake`
  - origen del contexto publicado
  - se resuelve por `publishedJobId`
- `Job`
  - entidad canonica del trabajo publicado
- `BuildOpsProject`
  - ahora puede ligarse de forma unica a `Job` via `jobId`
- `BuildOpsTask`
  - recibe tareas base idempotentes via `templateKey`
- `MatchingService`
  - aporta snapshot de matching marketplace listo para uso
- `ToolsService`
  - aporta estimate/scope, milestone plan, evidence checklist y escrow plan cuando hay infraestructura utilizable
- `PaymentsService`
  - aporta `paymentReadiness` resumido a nivel `Job`

## Implementacion realizada

### Schema / persistencia

Archivo: `packages/db/prisma/schema.prisma`

- `BuildOpsProject.jobId` agregado como campo opcional unico para ligar un `Job` a una sola operacion `BuildOps`.
- `Job.buildOpsProject` agregado para navegacion relacional.
- `BuildOpsTask.templateKey` agregado para que el bridge pueda reintentar sin duplicar tareas.
- indice unico agregado en `BuildOpsTask(projectId, templateKey)`.

Migracion aplicada:

```txt
packages/db/prisma/migrations/20260511020000_intake_operations_bridge/
```

### Servicio nuevo

Archivo: `apps/api/src/modules/intake-operations-bridge/intake-operations-bridge.service.ts`

Se creo `IntakeOperationsBridgeService` con el metodo:

```ts
bridgePublishedJobToOperations({
  jobId,
  tenantId,
  orgId,
  userId,
  roles,
})
```

Responsabilidades:

- resolver `Job`
- resolver `ProjectIntake` asociado si existe
- autorizar acceso del cliente propietario u operador admin
- crear o reutilizar `BuildOpsProject`
- crear o reutilizar 6 tareas base
- derivar estimate/scope desde `ToolsService` o desde los artefactos ya generados por `smart-intake`
- producir milestone plan, evidence checklist y escrow plan sugeridos
- adjuntar snapshot de matching
- adjuntar `paymentReadiness`
- devolver resumen operacional con informacion de idempotencia

### Endpoint nuevo

Archivo: `apps/api/src/modules/intake-operations-bridge/intake-operations-bridge.controller.ts`

Ruta expuesta:

```txt
POST /v1/jobs/:jobId/operations/bridge
```

Permiso aplicado:

```txt
jobs:create
```

### Smoke reutilizable

Archivo: `scripts/intake-operations-bridge-smoke.mjs`

Hace:

1. crea y completa un `ProjectIntake`
2. lo reclama
3. publica y obtiene `jobId`
4. ejecuta el bridge una primera vez
5. ejecuta el bridge una segunda vez
6. valida reutilizacion de `BuildOpsProject`
7. valida no duplicacion de tareas
8. valida que exista plan de milestones y checklist de evidencia en DB

## Estrategia de idempotencia

El bridge fue cerrado con reintentos seguros:

- `BuildOpsProject` se busca y reutiliza por `jobId`
- `BuildOpsTask` base se busca y reutiliza por `templateKey`
- la segunda ejecucion no duplica tareas ni crea otra operacion
- milestones/evidence/payment pre-assignment no se duplican porque viven como snapshot/version actual dentro de `BuildOpsProject.sourceToolResult`

Resumen practico:

```txt
mismo jobId
-> mismo BuildOpsProject
-> mismas tareas base
-> mismo resumen operacional actualizado
```

## Comandos ejecutados

```bash
npm run prisma:generate --workspace @semse/db
npm run typecheck
npm run build:api
node --experimental-strip-types --test apps/api/test/intake-operations-bridge.service.test.ts
npm run build:web
npm exec --workspace @semse/db prisma migrate deploy
/bin/bash -lc "HOST=127.0.0.1 PORT=4000 node apps/api/dist/main.js"
node ./scripts/intake-operations-bridge-smoke.mjs
```

## Resultado de validaciones

- `npm run prisma:generate --workspace @semse/db`: OK
- `npm run typecheck`: OK
- `npm run build:api`: OK
- `node --experimental-strip-types --test apps/api/test/intake-operations-bridge.service.test.ts`: OK
- `npm run build:web`: OK
- `prisma migrate deploy`: OK en DB local activa
- smoke E2E del bridge: OK

## Evidencia del smoke

Resultado resumido del smoke local:

```json
{
  "ok": true,
  "jobId": "cmp1rk69s0002d4z7itoj4ga8",
  "buildOpsProjectId": "cmp1rk748000cd4z7b2vjo7aj",
  "firstBridge": {
    "tasksCreated": 6,
    "estimateStatus": "ready",
    "paymentStatus": "draft"
  },
  "secondBridge": {
    "tasksCreated": 0,
    "tasksReused": 6,
    "reusedBuildOpsProject": true,
    "reusedTasks": true
  },
  "db": {
    "taskCount": 6,
    "milestoneCount": 2,
    "evidenceCount": 9
  }
}
```

## Warnings y notas operativas

- `build:web` sigue mostrando warnings viejos de hooks en pantallas no relacionadas; no bloquean este frente.
- En el entorno local usado para el smoke, el login tradicional no estaba habilitado porque `AUTH_SECRET` no estaba configurado. Para validar el bridge se usaron headers de identidad del entorno local (`x-tenant-id`, `x-org-id`, `x-user-id`, `x-roles`). Esto no es bug del bridge.
- `smart-intake` expone semantica `published` en API, mientras que el `Job` persistido sigue usando el estado canonico existente del modulo de jobs. No bloqueo el puente, pero conviene alinear semantica en un frente posterior.

## Limitaciones aceptadas en este alcance

- No se crean filas legacy de `Project`, `Milestone`, `Evidence` ni `PaymentEscrow` en esta fase.
- El milestone/evidence/payment plan previo a assignment queda como plan operacional dentro de `BuildOpsProject.sourceToolResult`.
- El adaptador enriquecido de estimate/scope esta mas fuerte para painting, porque `smart-intake` hoy aterriza mejor esa categoria.
- El matching sigue siendo snapshot calculado; no existe persistencia dedicada de matching.

## Proximos pasos

1. Promover el plan operacional de `BuildOpsProject.sourceToolResult` a entidades legacy `Project/Milestone/Evidence/PaymentEscrow` cuando exista assignment, reservation aceptada o contrato equivalente.
2. Extender los adaptadores de estimate/scope a mas trades aparte de painting.
3. Persistir matching si el marketplace necesita auditoria historica o colas de asignacion.
4. Conectar proposal flow para que el `BuildOpsProject` bridgeado pueda convertirse en propuesta, reserva y monetizacion real.

## Criterio de aceptacion cumplido

Se cumple el criterio del frente para este alcance:

```txt
un jobId generado por smart-intake puede convertirse o vincularse a una operacion BuildOps accionable,
con tareas iniciales, estimate/scope status, milestones, evidence requirements y payment readiness,
sin duplicar datos en reintentos.
```
