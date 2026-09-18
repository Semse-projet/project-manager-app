---
id: "core.org-membership-status"
title: "Membership lifecycle status (INVITED/ACTIVE/SUSPENDED/REVOKED)"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "medium"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "APPLIED_LOCAL"
feature_flags: []
production_evidence: []
related_files:
  - packages/db/prisma/schema.prisma
  - apps/api/src/modules/auth/auth.repository.ts
  - apps/api/src/modules/users/users.repository.ts
  - apps/api/src/modules/users/users.service.ts
related_tests:
  - apps/api/test/auth-login-membership-status.service.test.ts
  - apps/api/test/users.service.test.ts
related_endpoints:
  - POST /v1/auth/login
  - GET /v1/users/me/capabilities
related_events: []
related_agents: []
last_verified: "2026-09-18"
---

# Spec: Membership lifecycle status (INVITED/ACTIVE/SUSPENDED/REVOKED)

> Reduced-scope descendant of `docs/architecture/ADR-040-ws01c-identity-organization-context.md`'s
> first compatibility slice. The slice's other half — a session-level
> "switch active org" mechanism (`OrgContextService`, `POST /v1/me/context/switch`,
> `GET /v1/me/organizations`) — is **not** covered by this spec and is
> explicitly `BLOCKED`; see "Out of scope / blocked" below and the ADR's
> 2026-09-18 addendum for why.

## 1. Problema y resultado

**Para quién:** cualquier org/tenant que necesita poder suspender o revocar
el acceso de un usuario a una organización específica sin borrar su cuenta
ni sus otras membresías.

**Problema:** `Membership` (`packages/db/prisma/schema.prisma`) no tiene
ningún campo de estado — una fila existe o no existe, sin punto intermedio.
Hoy es estructuralmente imposible representar "este usuario tuvo acceso a
esta org pero se le suspendió/revocó" sin borrar la fila (perdiendo el
historial) o dejarla activa para siempre (sin forma de bloquear login/lectura
de capacidades). WS-01C (documento externo, no versionado en este repo) y su
Journey D asumen que la revocación de membership existe; el AS-IS
reconciliation (`docs/ws-01c/WS-01C-G1-AS-IS-Reconciliation.md`) confirmó que
no existe en ningún punto del código hoy.

**Resultado esperado:** `Membership` tiene un campo `status` (`INVITED |
ACTIVE | SUSPENDED | REVOKED`), y dos puntos de lectura reales ya lo
respetan: (1) login excluye memberships no-`ACTIVE` al resolver la org por
defecto y los roles de sesión, fallando cerrado con el mismo error ya
existente ("Usuario sin membresía activa") si no queda ninguna; (2)
`GET /v1/users/me/capabilities` expone el `status` de cada membership en vez
de tratarlas todas como igualmente válidas.

## 2. Alcance

### Incluido

- Columna `Membership.status`, aditiva, default `"ACTIVE"`, backfill
  automático para todas las filas existentes.
- `AuthRepository.findUserByEmail` filtra `memberships` por `status:
  "ACTIVE"` a nivel de query — ninguna membership no-activa llega a
  `AuthService.loginWithPassword`.
- `UsersRepository.findMembershipsByUser` / `UsersService.getMyCapabilities`
  exponen `status` por membership (sin filtrar — la decisión de qué hacer
  con una capacidad no-activa queda del lado del caller/UI, consistente con
  que este endpoint ya es de solo lectura y sin side effects).

### Fuera de alcance / BLOCKED

- **`OrgContextService`, `POST /v1/me/context/switch`, `GET /v1/me/context`,
  `GET /v1/me/organizations`** — la mitad "switch" del slice original de
  ADR-040. Bloqueado el 2026-09-18 al descubrir
  `docs/specs/core/universal-identity-multi-role.spec.md` (`APPROVED`,
  Fase 1-2 `MERGED`/`DEPLOYED` vía PR #539): esa spec ya tiene una decisión
  explícita del owner (2026-08-04) de que "la capacidad activa se deriva
  100% del proyecto/org abierto, nunca de una preferencia guardada", y ya
  expone `GET /v1/users/me/capabilities` con el mismo payload que
  `GET /v1/me/organizations` hubiera producido. Construir el mecanismo de
  switch sin decidir explícitamente cómo convive con esa regla arriesga
  reintroducir el problema de "capacidad pegada" que esa spec ya rechazó una
  vez. Ver el addendum de ADR-040 (2026-09-18) para el detalle completo y
  las dos resoluciones posibles — ninguna de las dos se elige acá, queda
  para una decisión explícita del owner.
- No se cambia `Membership`'s clave primaria compuesta
  (`@@id([userId, orgId, roleId])`) — un usuario puede seguir teniendo
  varias filas (una por rol) para la misma org; `status` se guarda por fila,
  no por par `(userId, orgId)` agregado. Ver "Datos y migración" para la
  implicación de esto en usuarios con más de un rol en la misma org.
- No se agrega UI para que un admin cambie el `status` de una membership —
  el campo existe y se respeta en lectura; el flujo de escritura (quién
  puede suspender/revocar, con qué permiso) es una spec propia, no incluida
  acá.
- No se toca `payment-governance.service.ts` ni el boundary `@Public()` de
  SSE (riesgos P0 ya documentados por separado en ADR-040, sin relación con
  este campo).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Usuario con membership `SUSPENDED`/`REVOKED` en una org | ninguno nuevo | esa org específica | seguir usando cualquier otra org donde tenga membership `ACTIVE` | iniciar sesión con esa org como default, ni que sus roles ahí cuenten hacia `roles` de sesión |
| Cualquier usuario autenticado | `GET /v1/users/me/capabilities` (sin cambio de permiso) | sus propias memberships | ver el `status` real de cada una de sus capacidades | ver memberships de otro usuario (sin cambio, ya acotado por `tenantId`+`userId` propio) |

- Tenant boundary: sin cambio — el filtro nuevo es adicional al `tenantId`
  ya existente en ambas queries.
- Ownership/resource policy: sin cambio.
- Step-up o aprobación humana: no aplica (este slice no agrega ninguna
  escritura de `status`, solo el campo y su lectura).
- Datos `privacyCritical`: no aplica.
- Requisitos de auditoría: no aplica en este slice — no hay ninguna acción
  nueva que mute `status` todavía (ver "Fuera de alcance").

## 4. Escenarios y criterios de aceptación

### P1 — Login excluye memberships no-ACTIVE al elegir la org por defecto

```gherkin
DADO un usuario con una membership ACTIVE en org_a y una membership SUSPENDED en org_b
CUANDO inicia sesión con email/password correctos
ENTONCES la sesión emitida usa org_a como org activa y sus roles se calculan solo sobre org_a
Y la membership de org_b no aparece en ningún cálculo de roles de esa sesión
```

### P2 — Usuario con todas sus memberships no-ACTIVE falla cerrado

```gherkin
DADO un usuario cuya única membership tiene status REVOKED
CUANDO intenta iniciar sesión con email/password correctos
ENTONCES el login falla con el mismo error ya existente "Usuario sin membresía activa" (401)
Y no se emite ningún token de sesión
```

Casos borde:

- [x] usuario sin ninguna membership (comportamiento preexistente, no debe
      regresionar — cubierto porque el filtro por `status` sobre un array ya
      vacío sigue vacío).
- [ ] usuario con dos roles en la misma org, uno con status `ACTIVE` y otro
      `SUSPENDED` (fila por rol, no por org) — comportamiento documentado en
      "Datos y migración", no bloqueante para este slice pero señalado como
      hallazgo abierto.
- [x] `GET /v1/users/me/capabilities` sigue devolviendo el mismo shape más
      el campo nuevo `status` — no rompe ningún consumidor existente que
      ignore campos desconocidos (contrato JSON aditivo).

## 5. Contratos

### API — `POST /v1/auth/login` (sin cambio de firma, cambio de comportamiento interno)

```yaml
auth: public
permissions: []
input_schema: "{ email: string, password: string }"
output_schema: sin cambio (token/session response existente)
errors:
  401: "Usuario sin membresía activa" — ahora también cubre "todas las membresías son no-ACTIVE", antes solo cubría "cero membresías"
effects:
  audit_log: sin cambio (auth.session.issued ya existente)
  domain_event: none
  sse: none
  payment_governance: none
```

### API — `GET /v1/users/me/capabilities` (aditivo)

```yaml
auth: required
permissions: []
input_schema: none
output_schema: "{ capabilities: [{ role: string, orgId: string, status: string, verifiedAt: string|null }] }"
errors:
  401: no autenticado
effects:
  audit_log: no (solo lectura, sin cambio respecto a la spec original)
  domain_event: none
  sse: none
  payment_governance: none
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: `Membership.status` es un campo de estado nuevo, sin
  transiciones automatizadas en este slice (no hay ninguna escritura nueva
  que lo mute — ver "Fuera de alcance"). Transiciones previstas a futuro:
  `INVITED -> ACTIVE -> SUSPENDED -> ACTIVE`, `-> REVOKED` (terminal),
  `INVITED -> REVOKED` — documentadas en el documento externo WS-01C §07
  como referencia de diseño, no implementadas acá.
- Invariantes: no contradice ninguna de `docs/foundation/DOMAIN_INVARIANTS.md`
  (campo nuevo, aditivo, sin cambio de transición de ningún FSM ya
  modelado).
- Eventos declarados: ninguno nuevo — no hay escritura de `status` en este
  slice, por lo tanto no hay evento de dominio que emitir todavía.
- Productor + outbox atómico: no aplica.
- Consumidores + idempotencia: no aplica.
- Replay/rebuild: no aplica.
- DLQ/compensación: no aplica.

## 7. Datos y migración

- Modelos Prisma: `Membership` — un campo nuevo, `status String @default("ACTIVE")`.
- Migración: `packages/db/prisma/migrations/<timestamp>_add_membership_status/migration.sql`,
  generada con `prisma migrate dev --name add_membership_status` (nunca
  `db push`), aplicada localmente contra `postgresql://semse:semse@127.0.0.1:5433/semse`
  (contenedor Docker local `semse-postgres`, ya corriendo al momento de esta
  sesión).
- Estrategia expand/contract: expand-only — columna nueva con default,
  ninguna columna existente se toca ni se elimina.
- Backfill: automático vía el `DEFAULT "ACTIVE"` de Postgres — toda fila
  preexistente queda `ACTIVE` sin necesitar un `UPDATE` separado.
- Compatibilidad hacia atrás: total — cualquier código que no seleccione
  `status` explícitamente sigue funcionando idéntico; Prisma `findMany` sin
  `select` ya devolvía todos los escalares, así que ningún otro call site de
  `Membership` necesita cambio de firma para seguir compilando.
- Verificación de drift: pendiente — no se corrió `prisma migrate status`
  contra ningún entorno más allá del local de esta sesión (ver Gates de
  cierre).
- Rollback de código: revertir los 4 archivos de `related_files`, sin tocar
  la columna (dejarla sin uso es inocuo).
- Rollback/forward-fix de datos: `DROP COLUMN "status"` sería el rollback
  de datos completo si hiciera falta; no se probó en esta sesión al no haber
  necesidad (migración aditiva sin incidentes).

> Nunca usar `prisma db push` para producción. Una migración aplicada no se
> edita: se restaura el archivo exacto o se reconcilia con el flujo oficial.

**Hallazgo abierto (no bloqueante):** `Membership` tiene PK compuesta
`(userId, orgId, roleId)` — un usuario con dos roles en la misma org tiene
dos filas independientes, cada una con su propio `status`. Este slice no
resuelve qué pasa si quedan en estados distintos (p. ej. una `ACTIVE` y otra
`SUSPENDED` para la misma org) — hoy el filtro de login simplemente excluye
la fila `SUSPENDED` y sigue contando la `ACTIVE`, efecto equivalente a
"suspender solo ese rol, no toda la org". Si el intento real era "suspender
toda la org", eso requiere un flujo de escritura que actualice todas las
filas `(userId, orgId, *)` a la vez — explícitamente fuera de este slice de
solo lectura.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: ninguna nueva en este slice (no hay endpoint nuevo, solo
  comportamiento de query modificado en dos endpoints existentes).
- Logs/traces/correlation: sin cambio.
- Health/readiness: sin cambio.
- Feature flags/allowlists: ninguno — el cambio es puramente aditivo y de
  bajo riesgo (afecta solo memberships no-`ACTIVE`, que hoy no existen en
  ningún dato real porque el campo nunca existió).
- Plan de canary: no aplica dado lo anterior — no hay comportamiento nuevo
  observable hasta que algo empiece a escribir `status != "ACTIVE"`.
- Evidencia de producción requerida: ninguna para este slice; sí será
  necesaria para cualquier spec futura que agregue el flujo de escritura de
  `status`.
- Señal de rollback: ninguna esperada — ver nota de canary.
- Owner operativo: semse-core.

## 9. Tests requeridos

- [x] Unitarios del dominio/proyección — `auth-login-membership-status.service.test.ts`
      (P1/P2 de §4).
- [x] Contrato API/BFF — cambio de `getMyCapabilities` cubierto por lectura
      de código; sin test de contrato nuevo dedicado (ver Gates de cierre,
      hallazgo pendiente).
- [ ] Permiso denegado y aislamiento tenant/org — sin cambio de permisos en
      este slice, no aplica un test nuevo.
- [x] Validación y conflicto de estado — P2 de §4 (falla cerrado si no
      queda ninguna membership activa).
- [ ] Idempotencia/reintento/concurrencia — no aplica (sin escritura nueva).
- [x] Migración y compatibilidad — migración aplicada y verificada
      localmente (ver §7).
- [ ] UI loading/empty/forbidden/degraded/error — no aplica, sin UI nueva
      en este slice.
- [ ] Canary o smoke autenticado en producción — pendiente de deploy.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/auth/auth.repository.ts` (filtro `status: "ACTIVE"`)
- `apps/api/src/modules/users/users.repository.ts` (expone `status`)
- `apps/api/src/modules/users/users.service.ts` (expone `status` en `getMyCapabilities`)

### Web

- Ninguno — no hay UI nueva en este slice.

### Worker/Packages/DB

- `packages/db/prisma/schema.prisma` (`Membership.status`)

### Tests

- `apps/api/test/auth-login-membership-status.service.test.ts`

## 11. Investigación externa

No se realizó investigación externa nueva para este slice reducido — es una
extensión directa y mecánica del trabajo de investigación ya hecho para
ADR-040 (que sí incluyó investigación externa vía los forks previos de esta
sesión, documentada en `docs/ws-01c/WS-01C-G1-AS-IS-Reconciliation.md`).

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index` — pendiente, no ejecutado en esta
      sesión.
- [x] Spec, plan, tasks coherentes — `.plan.md`/`.tasks.md` derivados
      directamente de este spec.
- [x] Tests derivados del spec y verdes — verificados directamente con
      `node --experimental-strip-types --test` (18 tests en 2 archivos,
      18/18 verdes; el runner de suite completa falla en este worktree por
      `ENAMETOOLONG`, no relacionado con este cambio — ver reporte de
      sesión). El resto de la suite (~190 archivos) no se corrió.
- [ ] `pnpm spec:validate:strict` verde — pendiente, no ejecutado.
- [x] Migración reproducible y rollback/forward-fix documentado (§7).
- [ ] CI `PASS` — sin PR abierto todavía.
- [ ] PR fusionado y SHA registrado — pendiente.
- [ ] Deployment terminal `DEPLOYED` — pendiente.
- [ ] Activación/canary verificada por separado — no aplica hasta que exista
      un flujo de escritura de `status` (ver "Fuera de alcance").
- [ ] `production_evidence` y `last_verified` actualizados — `last_verified`
      refleja la fecha de esta sesión, no verificación en producción.
- [ ] Sólo entonces `status: VERIFIED` — este spec permanece `DRAFT` hasta
      cerrar los puntos de arriba.
