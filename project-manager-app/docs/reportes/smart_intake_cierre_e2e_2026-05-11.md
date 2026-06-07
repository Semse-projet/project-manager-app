# Smart Intake Cierre E2E

## Fecha
2026-05-11

## Estado final
cerrado

## Alcance validado

Se cerró el flujo real:

- landing/public intake
- draft anónimo
- sesión `httpOnly`
- login
- `claim` del draft
- recuperación del wizard en paso 3
- publish
- limpieza de estado
- no duplicación de publicación

## Contexto de entrada

Punto de partida documentado en:

- `docs/reportes/smart_intake_reanudacion_2026-05-11.md`

## Comandos ejecutados

```bash
docker compose -f infra/docker/compose.semse-mvp.yml up -d postgres
cd /home/yoni/labsemse/project-manager-app && npm exec --workspace @semse/db prisma migrate status
cd /home/yoni/labsemse/project-manager-app && npm exec --workspace @semse/db prisma migrate deploy
npm run prisma:generate --workspace @semse/db
npm run dev:api
npm run dev:web
node ./scripts/smart-intake-e2e-smoke.mjs
```

Validaciones previas ya confirmadas antes del smoke:

```bash
node --experimental-strip-types --test tests/unit/smart-intake.test.mjs
npm run typecheck
npm run build:api
npm run build:web
```

## Migración aplicada

Migración aplicada en la DB local activa:

- `packages/db/prisma/migrations/20260511000000_project_intake/migration.sql`

Resultado:

- `All migrations have been successfully applied.`

## Smoke ejecutado

Se agregó y ejecutó el smoke:

- `scripts/smart-intake-e2e-smoke.mjs`

El smoke usa:

- `Playwright` headless para flujo navegador real;
- `browserContext.request` para compartir cookies reales del navegador;
- `PrismaClient` para validar estado final en DB.

## Evidencia del flujo

### 1. Draft creado antes del login

Se generó intake público:

- `intakeId`: `intk_1778529005784_cf87u7`

Se persistió en navegador:

- `localStorageBeforeLogin`: `intk_1778529005784_cf87u7`

### 2. Cookie `httpOnly` real del intake

La cookie usada por el draft quedó así:

```json
{
  "name": "semse_intake_session",
  "httpOnly": true,
  "sameSite": "Lax"
}
```

Esto confirma que el token del intake no es legible desde JS cliente.

### 3. Redirección al login preservando el wizard

Al entrar a la ruta protegida, el sistema redirigió a login con `from` intacto:

```txt
/client/jobs/new?...&step=3
```

Evidencia:

- `loginRedirectFrom` incluyó `/client/jobs/new`
- `loginRedirectFrom` preservó `step=3`

### 4. Claim del draft desde servidor

Después del login se llamó:

- `POST /api/semse/intake/:id/claim`

con body vacío:

```json
{}
```

Resultado:

```json
{
  "intakeId": "intk_1778529005784_cf87u7",
  "claimed": true,
  "userId": "usr_client_001"
}
```

Esto demuestra el punto crítico del fix:

- el `claim` funcionó sin leer la cookie `httpOnly` en cliente;
- el servidor resolvió la sesión y la cookie del intake.

### 5. Wizard recuperado en paso 3

El smoke esperó y confirmó:

- `Paso 3 de 4`

Además:

- el draft quedó reclamado por `usr_client_001`;
- el `intake_draft_id` se limpió tras la recuperación del wizard.

Evidencia:

- `localStorageAfterRecovery`: `null`

### 6. Publish correcto

Trabajo publicado:

- `jobId`: `cmp1m9rsk0002d4jas54e89v5`

Resultado del publish repetido:

```json
{
  "jobId": "cmp1m9rsk0002d4jas54e89v5",
  "status": "published",
  "jobUrl": "/client/jobs/cmp1m9rsk0002d4jas54e89v5",
  "attachedEvidenceCount": 0
}
```

### 7. Limpieza de `intake_draft_id`

Estado observado:

- antes del login: `intk_1778529005784_cf87u7`
- después de recuperación: `null`
- después de publish: `null`

Conclusión:

- el draft no queda pegado en `localStorage`;
- no se reinyecta estado viejo tras publicar.

### 8. No duplicación de publicación

Se probó explícitamente re-publicando el mismo intake ya publicado.

Resultado:

- devolvió el mismo `jobId`
- no creó un segundo job

Evidencia en DB:

```json
{
  "sameTitleCount": 1
}
```

## Validación en DB

Estado final leído desde Prisma:

```json
{
  "intakeStatus": "published",
  "intakeUserId": "usr_client_001",
  "publishedJobId": "cmp1m9rsk0002d4jas54e89v5",
  "sameTitleCount": 1
}
```

Confirmaciones:

- `ProjectIntake.status = published`
- `ProjectIntake.userId = usr_client_001`
- `ProjectIntake.claimedAt != null`
- `ProjectIntake.publishedAt != null`
- `ProjectIntake.publishedJobId = jobId`
- existe un solo `Job` para el título único del smoke

## Bugs encontrados durante este cierre

### 1. Restricción del sandbox para Prisma

Síntoma:

- `prisma migrate status` devolvía `P1001` aunque Postgres estaba arriba

Causa:

- restricción del sandbox hacia la conexión local del binario Prisma

Resolución:

- reintento fuera del sandbox

### 2. Restricción del sandbox para Playwright

Síntoma:

- `sandbox_host_linux.cc` al lanzar navegador headless

Causa:

- permisos del sandbox para ciclo de vida del proceso del navegador

Resolución:

- ejecución del smoke fuera del sandbox

### 3. Bug menor en el smoke script

Síntoma:

- `ReferenceError: baseURL is not defined`

Causa:

- typo local en el script de smoke

Resolución:

- corregido a `baseUrl`

## Warnings no bloqueantes

Persisten warnings viejos de hooks en `build:web`, ajenos al frente `smart-intake`:

- `app/(app)/admin/travel/page.tsx`
- `app/(app)/client/disputes/page.tsx`
- `app/(app)/client/leads/page.tsx`
- `app/(app)/layout.tsx`
- `app/(app)/worker/disputes/page.tsx`
- `app/(app)/worker/evidence/page.tsx`
- `app/components/disputes/DisputeResolutionWorkspace.tsx`

No bloquearon:

- typecheck
- build API
- build Web
- smoke `smart-intake`

## Veredicto

El frente `smart-intake` queda cerrado para este alcance.

Criterio de aceptación cumplido:

- el flujo real `landing -> intake -> login -> claim -> publish` funciona con DB activa y sesión real;
- el `claim` usa cookie `httpOnly` resuelta en servidor;
- el wizard vuelve al `step 3`;
- el publish crea el recurso esperado;
- `intake_draft_id` no queda colgado;
- no hay duplicación de publicación.
