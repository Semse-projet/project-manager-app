# Hardening API y tests backend — 2026-04-08

## Objetivo de esta ronda

Cerrar primero el frente crítico que estaba abierto en el backend NestJS antes de seguir con el resto del bloque de auditoría:

1. seguridad HTTP básica ausente;
2. rate limiting inexistente;
3. controllers nuevos sin validación de input consistente;
4. backend sin tests propios.

## Repositorio trabajado

- Monorepo canónico: `/home/yoni/labsemse/project-manager-app`

## Cambios implementados

### 1. Seguridad HTTP en `apps/api`

Se endureció el bootstrap en:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/main.ts`

Cambios:

- registro de `@fastify/helmet`
- registro de `@fastify/cors`
- CSP explícita
- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`

Dependencias añadidas en:

- `/home/yoni/labsemse/project-manager-app/apps/api/package.json`

Paquetes nuevos:

- `@fastify/helmet`
- `@fastify/cors`
- `@nestjs/throttler`

### 2. Rate limiting global

Se añadió `ThrottlerModule` y `ThrottlerGuard` global en:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/app.module.ts`

Además, `/v1/auth/token` quedó con throttle más estricto en:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/auth/auth.controller.ts`

### 3. Validación de variables de entorno

Se creó:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/config/env.schema.ts`

Ahora el API valida:

- `DATABASE_URL`
- `NODE_ENV`
- `PORT`
- `HOST`
- `RATE_LIMIT_TTL_SECONDS`
- `RATE_LIMIT_LIMIT`
- `CORS_ORIGINS`
- `AUTH_SECRET` obligatorio en `production`

### 4. Validación Zod en controllers rezagados

Se creó contrato compartido en:

- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/api-input.schema.ts`

Y helper común en:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/zod-validation.ts`

Controllers endurecidos:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/auth/auth.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/milestones/milestones.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ops/ops.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/users/users.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/organizations/organizations.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ratings/ratings.controller.ts`

También se exportaron los nuevos schemas desde:

- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/index.ts`

### 5. Backend tests reales

Se añadió base unitaria para `apps/api`:

- `/home/yoni/labsemse/project-manager-app/apps/api/test/auth-token.test.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/test/env.schema.test.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/test/zod-validation.test.ts`

Y script nuevo:

- `npm run test:unit --workspace @semse/api`

## Verificación ejecutada

### Build

Ejecutado:

- `npm run build --workspace @semse/schemas`
- `npm run build --workspace @semse/api`
- `npm run build:api`

Resultado:

- `OK`

### Tests

Ejecutado:

- `npm run test:unit --workspace @semse/api`

Resultado:

- `3/3` tests pasando

### Runtime real

Se levantó el API compilado en `127.0.0.1:4101` y se validó:

- `GET /v1/health`
- `POST /v1/auth/token`
- `POST /v1/ops/incidents` con payload inválido

Hallazgos comprobados:

1. `GET /v1/health` ahora responde con headers de hardening:
   - `Content-Security-Policy`
   - `Strict-Transport-Security`
   - `X-Frame-Options`
   - `X-Content-Type-Options`
2. El throttler ya está activo:
   - primeras 5 llamadas a `/v1/auth/token` devolvieron `500` por falta de `AUTH_SECRET` local
   - la sexta devolvió `429`
   - esto confirma que el límite ya se aplica en runtime
3. La validación de input ya bloquea payloads malos antes del service:
   - `POST /v1/ops/incidents` con `severity = "broken"` devolvió `400`

## Ajuste al diagnóstico original

Hay partes del bloque original que sí eran correctas y otras que necesitan matiz:

- `Seguridad HTTP`: sí faltaba realmente.
- `Rate limiting`: sí faltaba realmente.
- `Validación de input`: faltaba de forma parcial, no total. Algunos módulos ya usaban Zod, pero varios controllers nuevos seguían abiertos.
- `Índices Prisma`: parte del diagnóstico estaba desactualizada. Por ejemplo, `Job @@index([tenantId, status])`, `AuditLog @@index([tenantId, occurredAt])` y `AgentRun @@index([tenantId, status])` ya existen en el schema actual. El gap de índices hay que re-auditar con el schema real antes de abrir migraciones.

## Estado después de esta ronda

### Cerrado

- hardening HTTP básico
- CORS explícito
- rate limiting global
- throttle específico en auth token
- validación de env
- validación Zod en controllers rezagados
- backend tests iniciales

### Pendiente del bloque grande

- lifecycle completo de auth: refresh, revocación, reset
- cobertura amplia de tests por módulos
- observabilidad estructurada
- lint/quality gates en CI
- seed de base de datos
- Swagger/OpenAPI
- soft deletes
- BullMQ real en worker
- Dockerfiles de producción

## Siguiente paso recomendado

El siguiente frente con más retorno es:

1. `auth lifecycle`
2. `observabilidad`
3. `quality gates + CI`

Ese orden evita seguir construyendo producto sobre autenticación frágil y logs pobres.
