# WS-01C — primera porción de implementación: `Membership.status`

**Fecha:** 2026-09-18
**Rama:** `feat/ws01c-org-context-switch-slice1` (worktree local, sin push)
**Spec:** `docs/specs/core/org-membership-status.spec.md`
**ADR:** `docs/architecture/ADR-040-ws01c-identity-organization-context.md` (con addendum de esta sesión)

## Qué se pidió

El usuario aprobó ("continua") el checkpoint de `CLAUDE_WS-01C_CONTROL_PACK.md`
que recomendaba `GO — first compatibility slice only` para el primer slice de
implementación de WS-01C descrito en ADR-040: un `OrgContextService` nuevo,
tres endpoints (`GET /v1/me/context`, `GET /v1/me/organizations`,
`POST /v1/me/context/switch`), extensión de sesión/middleware, y la columna
`Membership.status`.

## Qué se encontró antes de escribir código (cambia el alcance)

Al arrancar la Fase 1 (spec) del flujo SDD que exige `AGENTS.md`, se descubrió
`docs/specs/core/universal-identity-multi-role.spec.md` — una spec **ya
`APPROVED`** por el owner (2026-08-04), con Fase 1-2 **ya `MERGED`/`DEPLOYED`**
(PR #539), que el pase de investigación de ADR-040 nunca encontró. Dos
hechos de esa spec cambian el plan:

1. **`GET /v1/users/me/capabilities` ya existe y ya devuelve exactamente lo
   que `GET /v1/me/organizations` iba a devolver** (`{role, orgId,
   verifiedAt}` por cada `Membership` del usuario). Construir un segundo
   endpoint hubiera sido la misma duplicación que el propio Naming Collision
   Register de ADR-040 existe para prevenir.
2. **El owner ya tomó una decisión explícita el 2026-08-04**: "la capacidad
   activa se deriva 100% del proyecto/org abierto, nunca de una preferencia
   guardada" — justo para evitar que una selección de org a nivel de sesión
   pise el contexto real de un recurso. El mecanismo "switch" de WS-01C no la
   contradice necesariamente, pero **interactúa con ella de una forma que
   nadie decidió todavía**, y construirlo sin esa decisión arriesga
   reintroducir el mismo problema que el owner ya rechazó una vez.

**Decisión tomada en esta sesión:** no implementar `OrgContextService` ni los
tres endpoints `/v1/me/*` todavía. Quedan `BLOCKED`, documentados en el
addendum de ADR-040 (2026-09-18) y en la sección "Fuera de alcance / BLOCKED"
de la spec nueva, con las dos resoluciones posibles planteadas para que el
owner decida. Se implementó solo la mitad del slice que no depende de esa
decisión: la columna `Membership.status`.

## Qué se implementó

- `packages/db/prisma/schema.prisma`: `Membership.status String @default("ACTIVE")`
  — aditivo, backfill automático. Migración `20260918145817_add_membership_status`
  generada con `prisma migrate dev` (nunca `db push`) y aplicada contra el
  Postgres local de Docker (`semse-postgres`, puerto 5433, ya corriendo en
  esta máquina).
- `apps/api/src/modules/auth/auth.repository.ts`: `findUserByEmail` ahora
  filtra `memberships` por `status: "ACTIVE"` a nivel de query de Prisma —
  ninguna membership `SUSPENDED`/`REVOKED`/`INVITED` llega a
  `AuthService.loginWithPassword`. `AuthService` no necesitó ningún cambio:
  su comportamiento de fallo cerrado existente ("Usuario sin membresía
  activa") ya cubre correctamente el caso de que el array llegue vacío.
- `apps/api/src/modules/users/users.repository.ts` y `users.service.ts`:
  `UsersRepository.findMembershipsByUser`/`UsersService.getMyCapabilities`
  ahora exponen `status` por membership (sin filtrar — de solo lectura, la
  decisión de qué hacer con una capacidad no-activa queda del lado del
  caller).

**Explícitamente no tocado:** `apps/web/lib/auth.ts` y `apps/web/middleware.ts`
— no hicieron falta cambios para este slice reducido (el gap real era
switching de sesión, que quedó `BLOCKED`); `OperatorContext`/`workspaceId` de
Prometeo; `payment-governance.service.ts`; el boundary `@Public()` de SSE.

## Hallazgo abierto no resuelto (documentado, no bloqueante)

`Membership` tiene PK compuesta `(userId, orgId, roleId)` — un usuario con
dos roles en la misma org tiene dos filas, cada una con su propio `status`
independiente. Si alguien más adelante construye un flujo de "suspender esta
org completa", va a necesitar actualizar todas las filas `(userId, orgId, *)`
a la vez, no solo una. No se resolvió acá porque este slice es de solo
lectura (no hay ningún flujo de escritura de `status` todavía).

## Verificación real (no inferida)

- **Build:** `pnpm --filter @semse/api build` (`nest build`) — verde.
- **Tests:** el runner de la suite completa (`pnpm --filter @semse/api
  test:unit`) **falla con `ENAMETOOLONG`** en este worktree — la ruta de
  Windows (`...\.claude\worktrees\agent-a90807f1c317e0e2e\project-manager-app\...`)
  hace que el argv de `node --test` con ~200 archivos de test supere el
  límite de longitud de línea de comando de Windows. Confirmado que **no es
  una regresión de este cambio** (mismo error con o sin los archivos
  tocados). Verificado en su lugar de forma directa y acotada:
  - `node --experimental-strip-types --test test/auth-login-membership-status.service.test.ts test/auth-demo-mode.service.test.ts test/auth-password-change.service.test.ts test/auth-password.test.ts test/auth-token.test.ts` → **16/16 verdes**.
  - `node --experimental-strip-types --test test/users.service.test.ts` → **16/16 verdes**, después de corregir un test preexistente (`getMyCapabilities returns the actor's own memberships, mapped to role/orgId`) que hacía `deepEqual` estricto contra el shape viejo sin `status` — se actualizó el fixture y la aserción explícitamente (no se lo descartó ni se lo dejó fallando).
  - **No verificado:** el resto de la suite (~190 archivos restantes) no corrió en esta sesión por la limitación de `ENAMETOOLONG` — no hay evidencia directa de que no haya ninguna otra regresión fuera de los módulos tocados, aunque el cambio es pequeño, aditivo, y no toca ningún otro módulo.
- **Typecheck:** `pnpm typecheck` (workspace completo) fue **terminado por
  el harness por presión de memoria del sistema**, no por un error de tipos
  — instrucción explícita de no reintentarlo en esta sesión. Riesgo
  residual: bajo (el build de `@semse/api` vía `tsc` sí pasó, y el diff es
  chico con tipos explícitos en los 3 archivos tocados), pero **no
  verificado** para el resto del workspace (`apps/web` en particular).
- **Migración:** aplicada y confirmada localmente; no verificada contra
  staging/producción (sin deploy en esta sesión).
- **`pnpm spec:validate`/`spec:index`:** no ejecutados en esta sesión.

## Estado real de la rama

Todo commiteado localmente en `feat/ws01c-org-context-switch-slice1` dentro
de un worktree aislado (`C:\Users\SEMSEproject\Documents\project-manager-app\.claude\worktrees\agent-a90807f1c317e0e2e`).
**Sin push, sin PR** — instrucción explícita de esta sesión. El usuario
decide si se pushea y se abre PR.

## Qué falta antes de que este slice pueda llamarse `VERIFIED`

1. Correr la suite completa de tests contra un checkout con ruta más corta
   (fuera del worktree anidado) o resolver el `ENAMETOOLONG` del test
   runner en sí (fuera de alcance de este slice).
2. Correr `pnpm typecheck` completo cuando haya memoria disponible.
3. `pnpm spec:validate:strict`, `pnpm spec:index`.
4. Decisión del owner sobre la mitad `BLOCKED` del slice original (switch de
   contexto vs. `universal-identity-multi-role.spec.md`) — sin eso, el resto
   de ADR-040 sigue parado.
5. PR, CI, deploy — ninguno ocurrió en esta sesión por directiva explícita.
