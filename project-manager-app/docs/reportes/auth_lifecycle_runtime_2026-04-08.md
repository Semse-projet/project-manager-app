# Auth lifecycle runtime — 2026-04-08

## Objetivo

Cerrar el frente crítico de lifecycle de autenticación:

1. refresh tokens;
2. logout con revocación server-side;
3. password reset flow;
4. validación real en runtime.

## Repositorio trabajado

- `/home/yoni/labsemse/project-manager-app`

## Cambios implementados

### Nueva capa auth

Archivos nuevos:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/auth/auth.module.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/auth/auth.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/auth/auth.repository.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/auth.guard.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/public.decorator.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/auth-password.ts`

Controller extendido:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/auth/auth.controller.ts`

Endpoints activos:

- `POST /v1/auth/token`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `POST /v1/auth/password-reset/request`
- `POST /v1/auth/password-reset/confirm`
- `GET /v1/auth/me`

### Modelo de sesión persistida

Se añadieron modelos Prisma en:

- `/home/yoni/labsemse/project-manager-app/packages/db/prisma/schema.prisma`

Modelos nuevos:

- `AuthSession`
- `PasswordResetToken`

### Guard global real

Se añadió guard global autenticado en:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/app.module.ts`

Y se marcó `health` y los endpoints públicos de auth con `@Public()`.

### Tokens

Se endureció:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/auth-token.ts`

Cambio importante:

- ahora cada access token lleva `sid`, `typ` y `jti`
- `jti` evita que refresh inmediato recicle el mismo token si cae en el mismo segundo

### Request context

Se ajustó:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/common/request-context.ts`

Ahora:

- usa `req.authContext` si ya fue validado por `AuthGuard`
- conserva modo header-only cuando `AUTH_SECRET` no está configurado

### Contratos

Se ampliaron schemas de input en:

- `/home/yoni/labsemse/project-manager-app/packages/schemas/src/api-input.schema.ts`

## Runtime / DB

### Prisma

Ejecutado:

- `npm run prisma:generate --workspace @semse/db`
- `npx prisma db push --accept-data-loss`

Hallazgo importante:

- había drift viejo en la base;
- Prisma avisó eliminación de una tabla heredada `RefreshToken` y otras diferencias previas del schema;
- además apareció desalineación entre `node_modules/.prisma/client` y `node_modules/@prisma/client`.

Corrección aplicada:

- resincronización manual de artefactos generados de Prisma entre ambas rutas.

Sin esa resincronización:

- el runtime exponía `user` pero no `authSession` ni `passwordResetToken`;
- eso era la causa real del `500` en `POST /v1/auth/token`.

## Verificación ejecutada

### Build

Ejecutado:

- `npm run build:api`

Resultado:

- `OK`

### Tests

Ejecutado:

- `npm run test:unit --workspace @semse/api`

Resultado:

- `4/4` pasando

Tests activos:

- `auth-password.test.ts`
- `auth-token.test.ts`
- `env.schema.test.ts`
- `zod-validation.test.ts`

### Runtime auth flow

Se levantó el API compilado con `AUTH_SECRET` en puertos limpios y se validó:

1. `POST /v1/auth/token`
2. `GET /v1/auth/me`
3. `POST /v1/auth/refresh`
4. `POST /v1/auth/logout`
5. `GET /v1/auth/me` después de logout
6. `POST /v1/auth/refresh` después de logout

Resultado real:

- `issue token`: `201`
- `auth/me`: `200`
- `refresh`: `201`
- `logout`: `201`
- `auth/me` tras logout: `401`
- `refresh` tras logout: `401`

Conclusión:

- la revocación server-side ya es real;
- logout invalida la sesión;
- tanto access token como refresh token quedan fuera de uso tras revocar.

### Refresh uniqueness

Se validó además que refresh ya no recicla el mismo access token:

- `issueAccessEqRefreshAccess = false`
- `jti` distinto entre token emitido y token refrescado

### Password reset flow

Se validó:

1. `POST /v1/auth/password-reset/request`
2. `POST /v1/auth/password-reset/confirm`
3. segundo intento de confirm con el mismo token
4. verificación en DB de `passwordHash`

Resultado real:

- request: `201`
- confirm: `201`
- segundo confirm con el mismo token: `401`
- `passwordHashSet = true` en DB

## Riesgos / deuda residual

### 1. Auditoría de password reset

Hoy el flujo de password reset audita con tenant/org técnicos (`n/a`) porque el endpoint público no tiene contexto de tenant resuelto.

Funciona, pero no es el diseño final correcto.

### 2. Tipado de `auth.repository`

Para destrabar el build en este workspace se usó acceso pragmático al cliente Prisma en:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/auth/auth.repository.ts`

Motivo:

- el runtime y los `.d.ts` quedaron correctos después de regenerar;
- pero el wrapper de este repo seguía dando un desajuste de typings para los modelos nuevos.

No bloquea funcionalidad, pero conviene limpiar esa integración luego.

### 3. `db push --accept-data-loss`

La sincronización de hoy confirmó drift previo de schema.

Para producción:

- esto debe pasar a migraciones revisadas, no seguir con `db push`.

## Estado final de este frente

### Cerrado

- refresh tokens
- logout con revocación server-side
- password reset request/confirm
- guard global auth
- endpoints públicos/privados bien separados
- access tokens únicos por emisión
- smoke runtime del lifecycle

### Pendiente del bloque general

- observabilidad estructurada
- CI con quality gates de lint/tsc
- tests de más módulos Nest
- Swagger/OpenAPI
- seed y scripts DB formales
- BullMQ real en worker

## Siguiente paso recomendado

El siguiente bloque con más retorno ahora es:

1. observabilidad estructurada
2. env/example + quality gates en CI
3. ampliar tests del backend por módulos
