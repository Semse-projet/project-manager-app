# Monetizable Flow Hardening + Change Orders

**Fecha:** 2026-05-14
**Estado:** validado localmente

## Flujo validado

```txt
Tool calculation
  -> AlgorithmRun
  -> Milestone
  -> Evidence checklist
  -> Evidence approval
  -> Client milestone approval
  -> Payment readiness
  -> Change Order create/submit/approve
```

Caso de prueba:

```txt
Painting interior room
Estimate: $2,208
Algorithm: painting-v1.1.0
Confidence: 85
Risk: 14
Price bands: $1,722 -> $2,208 -> $2,980
```

## Cambios implementados

### Milestone Tracker live

Se integro `MilestoneTrackerCard` en `/client/milestones`.

Ahora la vista de milestones del cliente carga:

- evidence items por milestone
- payment readiness por milestone
- estado visible del pago
- acciones de submit/approve/reject/request changes a traves del tracker

Endpoints BFF agregados:

```txt
GET   /api/semse/milestones/:milestoneId/evidence-items
POST  /api/semse/milestones/:milestoneId/evidence-items/seed
PATCH /api/semse/milestones/:milestoneId/evidence-items/:itemId
GET   /api/semse/milestones/:milestoneId/payment-readiness
```

### AlgorithmRun Dashboard

Se agrego dashboard admin en:

```txt
/admin/algorithm-engine
```

Muestra:

- total de corridas
- trades registrados
- risk promedio
- confidence promedio
- corridas recientes por trade
- `canPublish`
- version de algoritmo
- price band medio

Endpoints API agregados:

```txt
GET /v1/ops/algorithm-engine/stats
GET /v1/ops/algorithm-engine/runs/:trade
```

BFF:

```txt
GET /api/semse/admin/algorithm-runs
GET /api/semse/admin/algorithm-runs?trade=painting
```

### Permission matrix

Se ajustaron permisos para cubrir el flujo operativo:

```txt
CLIENT
- change-orders:read
- change-orders:approve

PRO
- change-orders:read
- change-orders:create

OPS_ADMIN
- change-orders:read
- change-orders:create
- change-orders:approve
```

Nota: `milestones:approve` se usa tambien para revisar evidence items porque el acto equivale a aprobar/rechazar evidencia que desbloquea pago. Por eso queda en CLIENT y OPS_ADMIN, no en PRO.

### Change Order Flow

Se agrego el modelo `ChangeOrderCandidate`.

Estados:

```txt
predicted -> submitted -> approved
predicted -> submitted -> rejected
```

Endpoints API:

```txt
GET  /v1/change-orders
POST /v1/change-orders
POST /v1/change-orders/:id/submit
POST /v1/change-orders/:id/approve
POST /v1/change-orders/:id/reject
```

BFF:

```txt
GET  /api/semse/change-orders
POST /api/semse/change-orders
POST /api/semse/change-orders/:id/submit
POST /api/semse/change-orders/:id/approve
POST /api/semse/change-orders/:id/reject
```

UI cliente:

```txt
/client/change-orders
```

Permite revisar change orders sometidos, aprobarlos o rechazarlos con nota obligatoria para rechazo.

## Smoke test

Script:

```bash
DATABASE_URL="postgresql://semse:semse@127.0.0.1:5433/semse?schema=public" \
SEMSE_API_URL="http://127.0.0.1:4000" \
node scripts/monetizable-flow-smoke.mjs
```

Resultado:

```txt
23/23 checks passed
Result: PASS
```

Validaciones incluidas:

- tool calculation responde con estimate y AlgorithmRun metrics
- AlgorithmRun queda persistido
- milestone se crea
- evidence items se crean en `missing`
- payment readiness inicial es `not_ready`
- evidencia real se simula en DB
- profesional somete milestone
- evidence items pasan a `approved`
- cliente aprueba milestone
- payment readiness final es `ready_to_release`
- DB confirma milestone `APPROVED`
- DB confirma `paymentReadiness=ready_to_release`
- Change Order se crea en `predicted`
- Change Order pasa a `submitted`
- Change Order pasa a `approved`
- DB confirma `changeOrder.status=approved`

## Verificacion tecnica

```txt
API TypeScript: PASS
Web TypeScript: PASS
@semse/auth build: PASS
Prisma validate: PASS
Prisma migrate deploy local: PASS
API tests: 323/323 PASS
Monetizable flow smoke: 23/23 PASS
```

## Archivos principales

```txt
apps/api/src/modules/change-orders/*
apps/api/src/app.module.ts
apps/api/src/modules/milestones/milestones.controller.ts
apps/api/src/modules/ops/ops.controller.ts
apps/api/src/modules/ops/ops.module.ts
apps/web/app/(app)/client/milestones/page.tsx
apps/web/components/milestones/MilestoneTrackerCard.tsx
apps/web/app/(app)/admin/algorithm-engine/page.tsx
apps/web/app/(app)/client/change-orders/page.tsx
apps/web/app/api/semse/change-orders/*
apps/web/app/api/semse/admin/algorithm-runs/route.ts
apps/web/app/api/semse/milestones/:milestoneId/*
packages/auth/src/rbac.ts
packages/db/prisma/schema.prisma
packages/db/prisma/migrations/20260514010000_change_order_candidate/migration.sql
scripts/monetizable-flow-smoke.mjs
```

## Riesgos pendientes

- El Change Order aprobado aun no ajusta automaticamente milestone amount, escrow o contrato.
- Falta UI profesional para crear Change Orders desde evidencia subida, aunque el API ya lo soporta.
- Falta enlazar `ChangeOrderCandidate` con `BuildOpsProject` cuando el origen venga del bridge completo.
- Falta dashboard de conversion: tool run -> BuildOps -> milestone approval -> payment ready -> change order.

## Recomendacion siguiente

El siguiente frente debe convertir el Change Order aprobado en impacto operacional:

```txt
approved ChangeOrder
  -> adjust milestone/payment amount
  -> append contract addendum
  -> record audit event
  -> update BuildOps scope
```
