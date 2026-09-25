# WS-01C — Gate 0: AS-IS reconciliation (identidad / workspace / capability / Intent / shell)

**Fecha:** 2026-09-18
**Tipo:** revisión de solo lectura contra `main@5d1c4b24`. Sin cambios de código, sin migraciones, sin implementación de `ActorContextService`/`CapabilityService`/etc. Responde al "Gate 0 — Repository truth audit" y a la sección 10 ("Claude Implementation Handoff") de `SEMSE_WS-01C_Master.md` (documento de diseño entregado por el usuario, no versionado en el repo).

## Resumen ejecutivo

WS-01C describe una arquitectura de identidad global + workspaces + capabilities + Intent continuity que **en buena parte ya existe en el repo, con otros nombres** — el patrón "ya está armado pero no conectado" que se repitió en auditorías anteriores (ver `docs/reportes/` de julio/agosto). Lo que SÍ falta genuinamente es la pieza central que WS-01C llama "context switching": hoy **no existe ningún mecanismo para que una identidad opere en más de un workspace por sesión** — el login fija la org activa a `memberships[0]` (el primer membership encontrado, sin orden definido) y ahí queda hasta el próximo login. Journeys B, C y D del documento (switch de contexto, revocación mid-session) no tienen ningún soporte hoy, ni en backend ni en frontend.

Segundo hallazgo grande: hay **dos sistemas de autorización con el mismo nombre pero contenido distinto** que no hay que confundir al implementar WS-01C — ver punto 9.

## 1. Modelo de identidad/usuario en Prisma

`packages/db/prisma/schema.prisma`:

- `User` (línea 259) — **sin campo de rol**. Confirma D-01/D-02 de WS-01C ya vigentes: la identidad es global, no hay `client`/`pro`/`admin` como tipo permanente de usuario.
- `Tenant` (línea 131) — el tenant es el límite de aislamiento de datos multi-cliente (todas las tablas de dominio cuelgan de `tenantId`).
- `Org` (línea 234) — `{ id, tenantId, type: String, name }`. `type` ya toma valores como `"CLIENT"` (ver `packages/db/prisma/seed.ts:145-146`) — el mismo eje que WS-01C llama `PERSONAL`/`BUSINESS`/`PLATFORM`, pero con semántica distinta: hoy un `Org` es "el lado cliente" o "el lado profesional" de una relación comercial, no "el contexto operativo que una identidad puede habitar". No se encontró un `Org` de tipo admin/plataforma — la vía admin es un rol (`OPS_ADMIN`), no un workspace separado.
- `Membership` (línea 564) — `{ userId, orgId, roleId }`, PK compuesta, **sin campo `status`**. No hay `INVITED`/`ACTIVE`/`SUSPENDED`/`REVOKED` — un membership existe o no existe, no tiene ciclo de vida.
- `Role`/`Permission`/`RolePermission` (líneas 540-562) — tablas DB reales pero **no son la fuente de autorización real** (ver punto 9).

**Clasificación:** `Tenant`/`User`/`Membership` → **reusable** como base de `Identity`/`Workspace`(parcial)/`WorkspaceMembership`. `Org.type` → **extend** (hoy es un enum de 2 valores atado a rol comercial, no a "tipo de workspace operativo"). Falta `Membership.status` → **extend**, cambio de schema aditivo simple.

## 2. `@semse/auth`

`packages/auth/src/`:

- `rbac.ts` — mapa de capacidades por rol hardcodeado en memoria (ver punto 9). Ya expone `getPermissionsForRoles`, `hasPermission`, `normalizeRoles` — esto **es**, funcionalmente, el `CapabilityService` que pide WS-01C sección 10, solo que sin ese nombre y sin resolución dinámica por membership (opera sobre `roles: string[]` sueltos, no sobre un `ActorContext` resuelto server-side por membership activa).
- `session.ts` — `SessionPayload = { sid, userId, tenantId, orgId, roles, expiresAt }`. **Ya tiene forma de `ActorContext`**: identidad + workspace (orgId) + rol resuelto + sesión, casi calcado del tipo `ActorContext` que propone WS-01C sección 01.6.
- `operator-context.ts` + `packages/shared/src/operator-context.ts` — **falso amigo importante**: existe un `OperatorContext` con campo `workspaceId` y `scope: "workspace"|"repo"|"run"|"task"`, pero es para runtime de **agentes/herramientas internas** (Prometeo, ejecuciones de agente), no para el contexto multi-tenant de negocio que describe WS-01C. No confundir al nombrar el `ActorContext`/`WorkspaceResolver` nuevos — ya hay un `workspaceId` en el código con un significado completamente distinto.

**Clasificación:** `rbac.ts` → **reusable** directo como base de `CapabilityService`. `session.ts` → **reusable** como base de `ActorContext`, necesita extenderse con `membershipId`/`authStrength`/`capabilityVersion` (ninguno existe hoy). `operator-context.ts` → no tocar, es de otro dominio — riesgo de colisión de nombres si se implementa WS-01C sin revisar esto primero.

## 3. Sesión / cookies

- Cookie de sesión (`SESSION_COOKIE`, `apps/web/lib/auth.ts`) — el valor es `encodeSession()` (`packages/auth/src/session.ts:23`), **base64url plano, no firmado** según el propio comentario del archivo ("NOT signed — pair with auth-token.ts signToken for tamper-proof tokens"). Hay que confirmar en `apps/web/lib/auth.ts` si el cookie que realmente se setea usa un JWT firmado (`auth-token.ts`) o el encode plano — no se verificó en esta pasada si hay una ruta donde se usa el encode sin firmar en producción.
- API (`apps/api/src/modules/auth/auth.service.ts:105-148`, `authenticateRequest`) — valida JWT firmado (`verifyToken` + `AUTH_SECRET`), exige `claims.sid`, bloquea identidades demo deshabilitadas. **Punto crítico, ya documentado como decisión deliberada** (ver skill `semse-rbac-permissions` y comentario en el propio archivo, líneas 137-139): *"Skip DB session lookup — JWT signature verification is sufficient for auth... DB lookup was causing 15s hangs when Postgres is slow... Token revocation relies on short TTLs."* Esto significa que **hoy la revocación de membership NO falla cerrado en la siguiente request**, como exige WS-01C sección 02 ("Revocation") y la Journey D — falla cerrado solo cuando expira el access token de corta vida. Este es un trade-off ya evaluado y revertido una vez por un incidente de producción real; cualquier cambio para WS-01C tiene que negociar con esa restricción, no ignorarla.
- Sin `localStorage` para tokens de larga vida detectado en esta pasada (no se auditó exhaustivamente el código de `apps/web`, pero el patrón cookie+middleware es el único visto).

**Clasificación:** mecanismo de sesión → **wrap** (envolver con la semántica de `authStrength`/freshness que pide WS-01C, sin tocar el JWT/cookie subyacente). Revalidación de membership en cada request → **extend**, y requiere decisión de producto/infra explícita porque ya causó un incidente cuando se intentó antes.

## 4. Route guards actuales (client/pro/admin)

`apps/web/middleware.ts` (completo, 218 líneas):

- Deriva un único `AppRole` (`worker`/`client`/`admin`) de `session.roles` vía `roleFromRoles` (alias de `appRoleFromRoles` en `rbac.ts:274`).
- Enforcement es por **prefijo de path fijo** (`/worker`, `/client`, `/admin`, `/agents`) contra un mapa `ownedPrefixes` de 3 entradas (línea 185) — no hay concepto de "workspace activo" en absoluto, solo "rol único derivado de la sesión".
- Ya tiene lógica de `from`/return-url (`resolveSafeRedirectPath`, líneas 149, 166, 176) — esto es exactamente el "Intent" mínimo (R0/R1) que pide WS-01C sección 03, aunque solo para redirect post-login, sin persistencia server-side ni TTL ni `riskClass`.
- Ruta huérfana `/dashboard` (líneas 102-122) ya redirige a `defaultDashboardForRole` — coherente con D-07 ("Home is not a redirect trash can"), aunque via redirect genérico por rol, no por Intent específico.

En backend: `apps/api/src/common/rbac.guard.ts` + `permissions.decorator.ts` (`@RequirePermissions`) gatean por permiso, no por prefijo — más fino que el guard de web.

**Clasificación:** middleware de rutas → **extend** (agregar resolución de workspace activo, no reemplazar el guard de rol). `from`/return-url → **wrap** como base de `IntentService` R0/R1; **no reusable tal cual para R2/R3** porque no persiste server-side ni tiene expiración ni revalidación de estado — es solo un query param.

## 5. Lógica de `from` / return-url

Cubierta en el punto 4. Vive en `apps/web/lib/safe-redirect.ts` (`resolveSafeRedirectPath`) — no se auditó el archivo línea por línea en esta pasada, pero se confirmó su uso en 3 puntos del middleware. Es open-redirect-safe por diseño (nombre de función lo indica), lo cual es un requisito correcto para cualquier Intent futuro que incluya una URL de retorno.

## 6. Autorización de pagos y evidencia

- **Pagos/escrow** — `apps/api/src/modules/payments/payment-governance.service.ts:45-100`, `evaluate()` ya scoped por `tenantId` en cada query (`project: { tenantId }`, `where: { tenantId, milestoneId, ... }`). Esto es el fix reciente de `PR #609` (F02a, ver memoria del proyecto) que cerró el IDOR de `getEscrow`. **Ojo:** el scoping es a nivel `tenantId`, no `orgId` — dentro de un mismo tenant con múltiples orgs (cliente vs. profesional), no se verificó en esta pasada si hay algún cruce posible entre orgs del mismo tenant a nivel de payment-governance. No confirmado como vulnerabilidad, queda como pregunta abierta para una auditoría de seguridad dedicada, no para esta reconciliación.
- **Evidence** — `evidence.controller.ts` recibió cambios grandes en el último pull (líneas +181/-*, commit reciente de multipart-upload); no se leyó en profundidad en esta pasada. Autorización por permiso (`evidence:read`/`evidence:write`, presentes en los 3 roles de negocio en `rbac.ts`) confirmada solo a nivel de rol, no se verificó scoping por proyecto/tenant línea por línea.

**Clasificación:** ambos → **reusable** como ejemplo de patrón correcto (tenant-scoped query) que WS-01C sección 05 pide generalizar; **no se puede afirmar "extend" ni "reusable" para el nivel org/workspace** sin una pasada de seguridad dedicada — fuera de alcance de este Gate 0.

## 7. Audit / security events

- `AuditLog` (schema.prisma:956) — `{ tenantId, actorUserId, entityType, entityId, action, beforeJson, afterJson, ip, userAgent, occurredAt }`. Cubre casi todo lo que pide WS-01C sección 05 ("Audit"), **salvo**: no tiene `correlationId`/`requestId`, no tiene `membershipId`, no tiene nivel de seguridad (`authStrength`/risk).
- `DomainOutboxEvent` (schema.prisma:975) — sistema de eventos de dominio separado, con `tenantId + orgId + module + entityType + entityId + actorType` — más granular en el eje workspace que `AuditLog`, pero es para el event bus/outbox, no para audit trail de seguridad.
- `apps/api/src/common/request-id.ts` + `api-response.ts` — **ya existe un `requestId` por request** (`ok(requestId, data)` envuelve toda respuesta 2xx), reusable directo para el campo `correlationId` que pide el contrato de error de WS-01C sección 06. Hoy no se ve propagado hacia `AuditLog`.

**Clasificación:** `AuditLog` → **extend** (agregar `correlationId`/`membershipId`, no rehacer). `request-id.ts` → **reusable** directo.

## 8. Concepto "workspace"/"org"/"empresa" ya existente

Ya cubierto en los puntos 1 y 2. Resumen: existe `Org` (relación comercial, no contexto operativo elegible) y existe `OperatorContext.workspaceId` (runtime de agentes, no de negocio). **Ninguno de los dos es el `Workspace` que pide WS-01C** — ambos son "falsos amigos" de nombre. El concepto real más cercano a `Workspace` + `WorkspaceMembership` es la combinación `Org` + `Membership`, pero le falta el eje `type: PERSONAL|BUSINESS|PLATFORM` (hoy es `CLIENT`/`PROFESSIONAL`-ish) y el ciclo de vida de membership.

## 9. Capability/permission checks — el hallazgo de los dos sistemas paralelos

Hay **dos cosas llamadas "capability" en este repo, sin relación entre sí**:

1. **Autorización real (RBAC):** `packages/auth/src/rbac.ts` — mapa hardcodeado `rolePermissions: Record<string, string[]>`, ~150 strings de permiso, roles reales `CLIENT`/`PRO`/`WORKER`/`EVENT_CONSUMER`/`OPS_ADMIN`/`DEMO_AGRO`, con `roleAliases` (`ADMIN→OPS_ADMIN`, etc.). Gateado en API vía `@RequirePermissions(...)` (`apps/api/src/common/permissions.decorator.ts`). **Esto es la fuente de verdad de autorización.** El permiso `internal:architecture:read` que menciona la memoria del proyecto (auditoría de julio) es solo uno más de esta lista (línea 206 de `rbac.ts`), no un patrón aparte.
2. **`Role`/`Permission`/`RolePermission` en Prisma** (schema.prisma:540-562) — tablas reales, con seed, pero **no gatean nada**. Se confirmó por grep que `prisma.role.*` solo se usa en `bids.repository.ts:581-592` y `reservations.repository.ts:550-554`, como `findUnique`-o-`create` para satisfazer la FK de `Membership.roleId` al crear un bid/reservation — nunca se lee `RolePermission` para autorizar una acción. Es infraestructura vestigial/de soporte, no un motor de permisos paralelo activo (no hay riesgo de "cuál gana" porque uno de los dos simplemente no se consulta), pero **sí es confuso para quien lea el schema esperando que ahí viva la autorización real**.
3. **`/v1/capabilities` (Capability Reality Registry)** — `apps/api/src/modules/capability-registry/` (agregado esta semana, ver `PR` reciente de "agent-capability-registry-seed"). Es metadata de ingeniería sobre qué *capacidades de agentes/herramientas Prometeo* existen y su estado ("Phase 1... engineering/platform metadata"), **no tiene nada que ver con autorización de usuarios**. Nombre colisiona directamente con el "capability manifest" que WS-01C sección 04 propone para el shell — si se implementa un `GET /v1/shell/manifest` o similar, hay que nombrarlo para no chocar con este endpoint ya existente y con propósito distinto.

**Clasificación:** `rbac.ts` → **reusable** como `CapabilityService`. `Role`/`Permission` DB → **obsolete/duplicate, no tocar** (no está causando daño, pero no hay que construir sobre él pensando que es la fuente real). `/v1/capabilities` → no relacionado, **cuidado con colisión de nombres**, no clasifica en esta lista.

## Tabla resumen — WS-01C target concept → estado actual → clasificación

| Concepto target WS-01C | Estado actual en el repo | Clasificación |
|---|---|---|
| `Identity` / `User` | `User` en Prisma, sin campo de rol, ya global | **reusable** |
| `Workspace` | `Org` (semántica de "lado cliente/profesional", no de "contexto operativo elegible"); sin `type: PERSONAL/BUSINESS/PLATFORM` | **extend** |
| `WorkspaceMembership` | `Membership { userId, orgId, roleId }`, sin `status` (INVITED/ACTIVE/SUSPENDED/REVOKED) | **extend** |
| `RoleTemplate` | `Role`/`Permission`/`RolePermission` en Prisma, existen pero no gatean nada real | **obsolete/duplicate** (no tocar aún) |
| `Capability` (autorización real) | `rolePermissions` en `packages/auth/src/rbac.ts`, gateado vía `@RequirePermissions` | **reusable** |
| `ActorContext` | `SessionPayload` (`sid, userId, tenantId, orgId, roles, expiresAt`) — le faltan `membershipId`, `authStrength`, `capabilityVersion` | **wrap** |
| Context switching (sección 02 completa) | **No existe.** Login fija `memberships[0]` como org activa; sin endpoint de switch, sin UI, sin revalidación mid-session | **no existe — construir desde cero** |
| Revocación fail-closed | JWT de corta vida sin lookup a DB por request (decisión deliberada, revertida una vez por incidente de perf) — revocación real solo al expirar el access token | **extend, con restricción de infraestructura ya conocida** |
| `Intent` (Journey A/G) | `from`/return-url en `middleware.ts` vía `resolveSafeRedirectPath` — solo redirect post-login, sin persistencia server-side, TTL ni `riskClass` | **wrap** para R0/R1; R2/R3 **no existen** |
| SEMSE OS Shell / capability manifest | No existe un `GET /v1/shell/manifest`; existe `/v1/capabilities` pero es Capability Reality Registry de agentes, **no relacionado** — riesgo de colisión de nombre | **no existe — construir desde cero, cuidado con el nombre** |
| Correlation ID / `SemseError.code` | `requestId` ya viaja en cada respuesta (`ok()` en `api-response.ts`); no hay enum de códigos de error estructurado, NestJS exceptions devuelven forma genérica | **wrap** el requestId, **extend** el contrato de error |
| Audit/Security events | `AuditLog` cubre actor/tenant/entidad/acción/before-after; sin `correlationId` ni `membershipId` ni nivel de seguridad | **extend** |
| Admin como workspace separado | No existe — admin es un rol (`OPS_ADMIN`), no un `Org` de tipo `PLATFORM` | **no existe, pero D-08 ya se cumple parcialmente vía rol** |

## No verificado en esta pasada (fuera de alcance de Gate 0, anotar para después)

- Si el cookie de sesión real en producción usa `encodeSession()` (sin firmar) o un JWT firmado — requiere leer `apps/web/lib/auth.ts` completo, no solo el middleware.
- Scoping org-level (no solo tenant-level) en `payment-governance.service.ts` y en `evidence.controller.ts` tras su reescritura reciente de multipart-upload — necesita una pasada de seguridad dedicada, no una reconciliación de diseño.
- Si `Membership` permite hoy más de un registro activo por usuario (multi-org real) en la práctica, o si el producto nunca lo ejercita — el código lo permite (`user.memberships` es un array, `bids.repository.ts` ya filtra por `roles?.includes("OPS_ADMIN")` para cruzar de org), pero no se confirmó con datos reales de producción cuántos usuarios tienen >1 membership hoy.
