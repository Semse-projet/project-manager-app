# Post Deploy Validation

**Fecha:** 2026-05-14
**Commit objetivo main:** `0a8ac2f chore(main): harden monetizable flow and change orders`
**Commit objetivo dev:** `efcb9a5 feat(semse): harden monetizable flow and change orders`

## Resultado ejecutivo

```txt
Codigo en GitHub: PASS
Migracion ChangeOrderCandidate: PASS
Validacion local previa: PASS
Railway CLI/logs: BLOCKED - CLI no autenticado
Dominios publicos Railway: BLOCKED - api/app no sirven la app esperada
```

El codigo correcto esta en `origin/main` y contiene el frente completo:

```txt
MilestoneTrackerCard live
AlgorithmRun dashboard
Change Orders API/BFF/UI
ChangeOrderCandidate migration
RBAC change-orders:*
Smoke monetizable extendido 23/23
```

El bloqueo post-deploy no esta en el codigo validado localmente. Esta en la capa de deploy/dominios:

- `https://api.semseproject.com/v1/health` no devuelve la API SEMSE.
- `https://app.semseproject.com/api/semse/healthz` no devuelve el Web SEMSE.
- `https://app.semseproject.com/login` no sirve la app.
- Railway CLI local existe pero no esta autenticado, por lo que no se pudieron leer logs internos.

## Verificaciones realizadas

### 1. Commit correcto en main

Comando:

```bash
git log --oneline --decorate -5 origin/main origin/dev
```

Resultado:

```txt
0a8ac2f (origin/main) chore(main): harden monetizable flow and change orders
efcb9a5 (origin/dev, dev) feat(semse): harden monetizable flow and change orders
```

Estado: `PASS`

### 2. Migracion Prisma presente

Archivo confirmado en `origin/main`:

```txt
packages/db/prisma/migrations/20260514010000_change_order_candidate/migration.sql
```

Incluye:

```sql
CREATE TABLE "ChangeOrderCandidate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "buildOpsProjectId" TEXT,
  "jobId" TEXT,
  "milestoneId" TEXT,
  "algorithmRunId" TEXT,
  "title" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'predicted'
);
```

Estado: `PASS`

### 3. Railway CLI

Comando:

```bash
railway status
```

Resultado:

```txt
Unauthorized. Please login with `railway login`
```

Estado: `BLOCKED`

Impacto:

- No se pudo confirmar deployment ID desde Railway CLI.
- No se pudieron leer logs de build/deploy.
- No se pudo confirmar desde CLI si el servicio activo esta usando `0a8ac2f`.

### 4. Dominios publicos

Endpoints esperados segun `infra/railway/DEPLOY.md`:

```txt
API: https://api.semseproject.com/v1/health
Web: https://app.semseproject.com/api/semse/healthz
```

Resultados observados:

```txt
https://api.semseproject.com/v1/health     -> 404 openresty o DNS unresolved
https://api.semseproject.com/health        -> 404 openresty o DNS unresolved
https://api.semseproject.com/              -> 404 openresty o DNS unresolved
https://app.semseproject.com/api/semse/healthz -> 404 o DNS unresolved
https://app.semseproject.com/login         -> 404 o DNS unresolved
https://semseproject.com/login             -> 302 a WordPress wp-login.php
```

Estado: `BLOCKED`

Lectura:

- El root domain `semseproject.com` esta sirviendo WordPress.
- `app.semseproject.com` y `api.semseproject.com` no estan sirviendo los servicios Railway esperados.
- Esto puede ser DNS incompleto, custom domains no adjuntos a Railway, deploy aun no promovido, o servicios Railway caidos sin dominio publico correcto.

### 5. Rutas nuevas

No se pudieron validar contra produccion por el bloqueo de dominio.

Rutas presentes en `origin/main`:

```txt
/client/milestones
/admin/algorithm-engine
/client/change-orders

GET   /api/semse/milestones/:milestoneId/evidence-items
POST  /api/semse/milestones/:milestoneId/evidence-items/seed
PATCH /api/semse/milestones/:milestoneId/evidence-items/:itemId
GET   /api/semse/milestones/:milestoneId/payment-readiness

GET  /api/semse/admin/algorithm-runs
GET  /api/semse/admin/algorithm-runs?trade=painting

GET  /api/semse/change-orders
POST /api/semse/change-orders
POST /api/semse/change-orders/:id/submit
POST /api/semse/change-orders/:id/approve
POST /api/semse/change-orders/:id/reject

GET  /v1/change-orders
POST /v1/change-orders
POST /v1/change-orders/:id/submit
POST /v1/change-orders/:id/approve
POST /v1/change-orders/:id/reject
```

Estado produccion: `BLOCKED`

### 6. Validacion local previa del mismo frente

Antes del push a `main`, se valido:

```txt
API TypeScript: PASS
Web TypeScript: PASS
@semse/auth build: PASS
Prisma validate: PASS
Prisma migrate deploy local: PASS
API tests: 323/323 PASS
Monetizable flow smoke: 23/23 PASS
```

Smoke extendido validado:

```txt
Tool calculation
-> AlgorithmRun persisted
-> Milestone created
-> Evidence items seeded
-> Payment readiness not_ready
-> Professional submit
-> Evidence approved
-> Client approval
-> Payment readiness ready_to_release
-> Change Order predicted
-> Change Order submitted
-> Change Order approved
```

Estado: `PASS`

## Riesgo actual

El riesgo activo es de release/infra, no de feature:

```txt
El codigo esta en main, pero los dominios publicos no demuestran que Railway este sirviendo ese codigo.
```

Mientras `api.semseproject.com` y `app.semseproject.com` no respondan correctamente, no se puede hacer demo comercial publica ni validar RBAC real en produccion.

## Acciones requeridas en Railway/DNS

1. Entrar a Railway dashboard.
2. Confirmar que el deployment de `semse-api` usa commit `0a8ac2f`.
3. Confirmar que el deployment de `semse-web` usa commit `0a8ac2f`.
4. Revisar build logs de API y Web.
5. Confirmar que migraciones Prisma corrieron sin error.
6. Confirmar que API healthcheck `/v1/health` esta green.
7. Confirmar que Web healthcheck `/api/semse/healthz` esta green.
8. Adjuntar/verificar custom domains:

```txt
api.semseproject.com -> semse-api
app.semseproject.com -> semse-web
```

9. Revisar DNS:

```txt
api.semseproject.com debe resolver hacia Railway
app.semseproject.com debe resolver hacia Railway
```

10. Reintentar:

```bash
curl https://api.semseproject.com/v1/health
curl https://app.semseproject.com/api/semse/healthz
```

## Criterio para cerrar post-deploy

Post-deploy queda cerrado cuando:

```txt
GET https://api.semseproject.com/v1/health -> 200
GET https://app.semseproject.com/api/semse/healthz -> 200
GET https://app.semseproject.com/login -> 200/redirect esperado de app SEMSE
Smoke monetizable corre contra SEMSE_API_URL publico o interno Railway
```

