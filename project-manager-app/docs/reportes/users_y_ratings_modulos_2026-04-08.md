# Users y Ratings Modules

Fecha: 2026-04-08
Ruta objetivo: `/home/yoni/labsemse/project-manager-app`

## Objetivo

Cerrar los dos gaps siguientes del backend operativo:

1. formalizar `users` como módulo de identidad operable;
2. crear `ratings` como módulo de reputación real, no como CRUD vacío.

## Fuentes de diseño usadas

Se tomó como referencia:

- `satellites-archive/project-manager-copi` para el patrón `controller + service + repository + policy`;
- `infclaude` para mantener surfaces observables, acciones auditables y contratos de runtime claros;
- `packages/schemas/src/domain-events.schema.ts` del core como fuente formal de eventos.

## 1. Users module

Archivos activos:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/users/users.module.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/users/users.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/users/users.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/users/users.repository.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/users/users.policy.ts`

Endpoints activos:

- `GET /v1/users`
- `GET /v1/users/:userId`
- `GET /v1/users/:userId/memberships`
- `POST /v1/users/:userId/verify`

Reglas operativas:

- lectura de detalle y memberships: `self` o `OPS_ADMIN`;
- verificación: solo `OPS_ADMIN`;
- `verify` escribe audit log;
- `verify` emite `user.verified`.

## 2. Ratings module

Archivos creados:

- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ratings/ratings.module.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ratings/ratings.controller.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ratings/ratings.service.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ratings/ratings.repository.ts`
- `/home/yoni/labsemse/project-manager-app/apps/api/src/modules/ratings/ratings.policy.ts`

Registro:

- `RatingsModule` agregado en `/home/yoni/labsemse/project-manager-app/apps/api/src/app.module.ts`
- permisos `ratings:read` y `ratings:create` agregados en `/home/yoni/labsemse/project-manager-app/apps/api/src/common/rbac.ts`

Endpoints activos:

- `GET /v1/ratings`
- `GET /v1/ratings/:ratingId`
- `GET /v1/ratings/users/:userId/summary`
- `POST /v1/ratings`

Reglas operativas implementadas:

- solo `CLIENT`, `PRO` y `OPS_ADMIN` pueden crear rating;
- el job debe existir en el tenant y estar en `COMPLETED`;
- se bloquean duplicados por `jobId + fromUserId`;
- el actor debe ser parte real del trabajo;
- la contraparte se resuelve desde `Contract` o, si falta, desde `JobReservation`;
- el `toUserId` debe coincidir con esa contraparte;
- `create` escribe audit log;
- `create` emite `rating.submitted`.

## 3. Efecto arquitectónico

Con este cierre, el eje identidad/reputación ya no depende solo de Prisma y schema:

- `users` ya puede verificarse con surface formal, audit y evento;
- `ratings` ya puede alimentar trust con una entrada transaccional válida;
- el backend empieza a cubrir dos piezas que el dominio ya declaraba pero no exponía.

## Verificación

Comando ejecutado:

- `npm run build:api`

Resultado:

- pasa completo

## Próximo paso recomendado

El siguiente hueco con más retorno sigue siendo:

1. agregar `policy.ts` explícitas a módulos que todavía dependen solo de RBAC;
2. revisar `jobs`, `bids`, `payments`, `reservations`, `contracts`;
3. alinear después el frontend con `users` y `ratings` si esas surfaces van a entrar a admin/trust.
