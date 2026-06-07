# Env Centralizado Shared - 2026-04-08

## Objetivo

Cerrar el frente de validación de entorno fuera de `apps/api` y moverlo a una capa compartida reutilizable por todo el monorepo:

1. `api`
2. `web`
3. `worker`

## Cambios realizados

### 1. Validación de entorno centralizada en `@semse/shared`

Se extendió `packages/shared/src/index.ts` para exponer schemas y validadores compartidos:

- `apiEnvSchema`
- `validateApiEnv()`
- `webServerEnvSchema`
- `validateWebServerEnv()`
- `workerEnvSchema`
- `validateWorkerEnv()`

También se agregó `zod` como dependencia real de `@semse/shared`, para que la validación no dependa de lógica local duplicada en cada app.

### 2. API alineada al paquete compartido

`apps/api/src/config/env.schema.ts` dejó de mantener su propia implementación y ahora reexporta:

- `ApiEnv`
- `validateApiEnv`

desde `@semse/shared`.

Con esto el backend conserva el mismo punto de entrada local, pero la fuente de verdad ya no vive duplicada en `apps/api`.

### 3. Web endurecido con validación explícita de runtime server-side

En `apps/web/app/api/semse/_server.ts` se integró `validateWebServerEnv()`.

Ahora el proxy server-side valida explícitamente:

- `SEMSE_API_BASE_URL`
- `SEMSE_TENANT_ID`
- `SEMSE_ORG_ID`
- `SEMSE_USER_ID`
- `SEMSE_ROLES`
- `NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED`

Eso evita que el web server arranque con configuración parcial y falle después en fetches ambiguos hacia la API.

### 4. Worker endurecido con validación compartida

En `apps/worker/src/main.mjs` se integró `validateWorkerEnv(process.env)`.

Ahora el worker valida en bootstrap:

- `SEMSE_API_URL`
- `SEMSE_WORKER_ID`
- `SEMSE_TENANT_ID`
- `SEMSE_USER_ID`
- `SEMSE_ORG_ID`
- `SEMSE_ROLES`
- `SEMSE_POLL_MS`
- `SEMSE_HEARTBEAT_MS`
- `SEMSE_RUN_SIM_MS`
- `SEMSE_FAIL_RATE`
- `SEMSE_RECLAIM_MS`
- `SEMSE_STALE_AFTER_MS`
- `SEMSE_AGENT_TYPE`

Con esto deja de depender de defaults dispersos y de parseo manual ad hoc.

### 5. `.env.example` alineado al runtime real

Se actualizó `.env.example` del monorepo para reflejar las variables operativas reales de:

- API
- Web
- Worker
- observabilidad y servicios auxiliares

Se incorporaron o dejaron explícitas variables clave como:

- `HOST`
- `PORT`
- `DATABASE_URL`
- `AUTH_SECRET`
- `CORS_ORIGINS`
- `RATE_LIMIT_TTL_SECONDS`
- `RATE_LIMIT_LIMIT`
- `SEMSE_API_URL`
- `SEMSE_WORKER_ID`
- `SEMSE_TENANT_ID`
- `SEMSE_USER_ID`
- `SEMSE_ORG_ID`
- `SEMSE_ROLES`
- `SEMSE_POLL_MS`
- `SEMSE_HEARTBEAT_MS`
- `SEMSE_RUN_SIM_MS`
- `SEMSE_FAIL_RATE`
- `SEMSE_RECLAIM_MS`
- `SEMSE_STALE_AFTER_MS`
- `SEMSE_AGENT_TYPE`
- `SEMSE_API_BASE_URL`
- `NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `LOG_LEVEL`

## Ajustes estructurales relacionados

Para que `web` y `worker` no dependan de `.ts` crudo en runtime:

- `packages/shared` y `packages/auth` quedaron buildables con `dist/`
- el root build chain ya construye `@semse/shared`, `@semse/auth` y `@semse/schemas` antes de `api` o `web`

Esto era necesario porque el worker consume `@semse/shared` desde JS runtime real.

## Validación local

Matriz verde al cierre:

```bash
npm run build --workspace @semse/shared
npm run lint --workspace @semse/api
npm run lint --workspace @semse/web
npm exec tsc --workspace @semse/web -- --noEmit
npm run build:api
```

## Nota operativa

Durante la puesta al día del workspace se ejecutó:

```bash
npm install --workspaces
```

Eso dejó el monorepo consistente para resolver `@semse/shared` y `@semse/auth` como paquetes reales.

`npm` reportó vulnerabilidades pendientes del ecosistema, pero no bloquearon esta fase ni se atacaron todavía:

- `5` moderadas
- `3` altas

Ese frente queda como hardening posterior de dependencias, no como bloqueo de compilación o runtime del cambio actual.

## Resultado

- la validación de entorno dejó de estar fragmentada
- `api`, `web` y `worker` ahora comparten contratos de configuración reales
- el monorepo falla temprano cuando faltan variables críticas
- `.env.example` ya describe mejor el runtime actual del sistema
