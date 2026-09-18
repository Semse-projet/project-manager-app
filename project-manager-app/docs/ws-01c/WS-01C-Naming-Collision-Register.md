# WS-01C — Naming Collision Register

**Fecha:** 2026-09-18
**Contra:** `main@5d1c4b24`
**Método:** grep real + lectura de archivo para cada término, no inferencia desde el nombre solo.

No se congela ningún nombre de producción hasta que este registro esté cerrado y el ADR-040 lo confirme.

---

## Colisión A — `OperatorContext` / `workspaceId` (runtime de agentes)

- **Significado existente:** contexto de ejecución de agentes/herramientas internas (Prometeo, runs de agente). Definido en `packages/shared/src/operator-context.ts`, consumido por `packages/auth/src/operator-context.ts` y el runtime de agentes (`packages/agents/`).
- **Forma:** `OperatorContextInput = Pick<RequestIdentity, "tenantId"|"orgId"|"roles"> & { scope: "workspace"|"repo"|"run"|"task"; workspaceId?: string; ... }`.
- **Reutilización prohibida:** contexto activo de negocio del usuario (lo que WS-01C llama `ActorContext`).
- **Acción:** preservar el significado existente sin tocarlo. No renombrar. No agregar un segundo campo `workspaceId` con otro significado al mismo tipo ni a tipos adyacentes.

## Colisión B — `Workspace` (módulo completo, no solo el string) — **hallazgo nuevo, más severo que lo documentado en el G1 original**

El G1 original (`docs/reportes/2026-09-18_ws01c_gate0_as-is_reconciliation.md`) ya marcó `OperatorContext.workspaceId` como falso amigo. Esta pasada encontró algo más grave: **existe un módulo entero, en producción, llamado literalmente `Workspace`**, con su propio `WorkspaceContext`, `WorkspaceActor`, `WorkspaceContextResponse`, y una API real bajo el prefijo `v1/workspace`.

- **Significado existente:** coordinador de estado de la UI shell de tres paneles de Prometeo/Mission Control (`apps/api/src/modules/workspace/workspace.service.ts`, docstring propio: *"Workspace state coordination. State models the three-panel UI shell (left = navigation, center = active mission, right = operational vs configuration context)"*). Persiste por `(tenantId, userId)` — navegación activa, misión cargada (`project|conversation|budget|evidence|planning`), modo del panel derecho.
- **API real ya expuesta:**
  - `GET/POST v1/workspace/context` (`apps/api/src/modules/workspace/workspace.controller.ts`)
  - `v1/workspace/navigation`
  - `v1/workspace/mission/load`, `v1/workspace/mission/unload`
  - Espejadas en el BFF web: `apps/web/app/api/semse/workspace/context/route.ts`, `.../navigation/route.ts`, `.../mission/{load,unload}/route.ts`.
- **Consumido en frontend por:** `apps/web/lib/bff/workspace.ts` (`getWorkspaceContext()`), `apps/web/lib/stores/workspaceStore.ts`.
- **Tipos:** `WorkspaceContextResponse` en `packages/schemas/src/workspace.schema.ts` (contrato Zod real, no borrador).
- **Por qué es más grave que la colisión de `workspaceId` sola:** WS-01C sección 06 propone literalmente `GET /v1/me/context` para el actor context de negocio y usa `Workspace`/`WorkspaceMembership` como los nombres de tipo canónicos del modelo de dominio (sección 01). Si se implementa tal cual, el nombre `Workspace` — módulo, servicio, tipo Zod, ruta API — ya está ocupado por un sistema **no relacionado, ya en producción, con su propio contrato de API estable**. No es un nombre libre para el concepto de tenancy de negocio.
- **Reutilización prohibida:** cualquier concepto de negocio (tenancy, membership, contexto operativo elegible por el usuario) no puede llamarse `Workspace`, `WorkspaceContext`, `WorkspaceActor`, ni usar el prefijo de ruta `v1/workspace` sin namespacing explícito.
- **Acción:** preservar el módulo existente sin tocarlo. El nombre `Workspace` queda inhabilitado para el vocabulario de negocio de WS-01C — ver la propuesta de terminología más abajo.

## Colisión C — `ActorContextService` (ya existe, con otro propósito)

- **Significado existente:** servicio de bootstrap idempotente que hace `upsert` de `Tenant`/`Org`/`User` la primera vez que se ve un `tenantId`/`orgId`/`userId`, con caché en memoria + de-dupe de escrituras concurrentes (`apps/api/src/infrastructure/persistence/actor-context.service.ts`, método `ensureActorContext`). Usado por `AuditService`, el módulo de agentes (`agent-approval.service.ts`, `agents.repository.ts`) para garantizar que las FKs existan antes de escribir, no para resolver identidad/autorización.
- **Por qué importa especialmente:** WS-01C sección 10 (Claude Implementation Handoff, paso 3 de la secuencia sugerida) le pide textualmente al agente crear un `ActorContextService` — el nombre exacto que ya existe, con un propósito completamente distinto (bootstrap de filas, no resolución de contexto/autorización).
- **Reutilización prohibida:** no renombrar ni sobrescribir este servicio. Si el nuevo servicio de resolución de contexto de negocio necesita también garantizar la existencia de filas, debe **inyectar/llamar** al `ActorContextService` existente para ese sub-paso, no duplicarlo ni ocupar su nombre.
- **Acción:** el servicio nuevo de WS-01C necesita un nombre distinto — ver propuesta de terminología.

## Colisión D — `/v1/capabilities` (Capability Reality Registry de agentes)

- **Significado existente:** metadata de ingeniería sobre qué capacidades de agentes/herramientas Prometeo existen y su estado de madurez (`apps/api/src/modules/capability-registry/`, ver también `ADR-032-capability-reality-registry.md`). No tiene relación con autorización de usuarios.
- **Reutilización prohibida:** el "capability manifest" que WS-01C sección 04 propone para el shell de UI (`GET /v1/shell/manifest` o similar) no puede llamarse `/v1/capabilities` ni reusar ese nombre de endpoint.
- **Acción:** cualquier endpoint nuevo de manifest de UI debe elegir un nombre que no colisione — ej. namespacing explícito bajo `/v1/me/` o `/v1/shell/`, nunca `/v1/capabilities` a secas.

## Colisión E — `Role` / `Permission` / `RolePermission` (Prisma, vestigial)

- **Significado existente:** tablas reales en `schema.prisma` (líneas 540-562), con seed, pero **no gatean ninguna decisión de autorización real** — confirmado por grep: `prisma.role.*` solo se usa como `findUnique`/`create` para satisfacer la FK de `Membership.roleId` en `bids.repository.ts` y `reservations.repository.ts`. La autorización real vive en `packages/auth/src/rbac.ts` (mapa en memoria).
- **Riesgo:** bajo (no hay dos sistemas compitiendo por lectura), pero confuso — alguien que lea el schema esperando encontrar ahí la fuente de autorización se equivoca.
- **Acción:** no construir el `RoleTemplate` de WS-01C sobre estas tablas asumiendo que ya gatean algo. Si se decide usarlas como base de `RoleTemplate`, hay que conectar primero su lectura real a la autorización o documentar explícitamente que siguen siendo bookkeeping de FK.

## Colisión F — "Workspace" como concepto de infraestructura de sesión de agente (fuera del repo, mención únicamente)

- **Significado existente:** `docs/WORKSPACE_GOVERNANCE.md` en este repo es solo un puntero — define qué *checkout en disco* (`Documents\project-manager-app` vs `Desktop\project-manager-app`) es canónico vs. sandbox, a nivel de convención cross-proyecto de sesiones de agente. No tiene nada que ver con el dominio de producto.
- **Riesgo:** bajo, confusión solo si alguien busca "workspace governance" esperando encontrar la política de tenancy de negocio.
- **Acción:** ninguna — mencionado solo para que quede registrado como el tercer sentido distinto de "workspace" que coexiste en este ecosistema (junto con Colisión A/B).

## Búsqueda adicional de términos (grep real, sin colisión material más allá de A-F)

| Término | Resultado |
|---|---|
| `context` | Extremadamente sobrecargado (26 archivos con `ActorContext`, más `RequestContext`, `WorkspaceContext`, `OperatorContext`). Ningún nombre nuevo debe usar `Context` a secas sin prefijo específico. |
| `tenant` | Consistente — siempre `tenantId`/`Tenant`, sin colisión de significado. |
| `organization` / `org` | `Org` (Prisma) y `orgId` en todos lados — significado consistente ("lado cliente o profesional de una relación comercial"), pero **no** es sinónimo directo de "contexto operativo elegible" que pide WS-01C (ver G1 fila `Workspace`/`Org`). |
| `actor` | Muy usado (`ActorContextService`, `WorkspaceActor`, `actor.tenantId` en decenas de controllers) — siempre en el sentido "quien hace la request", consistente con lo que WS-01C también llama actor. Sin colisión de significado, pero el sufijo `ActorContext` específicamente ya está tomado (Colisión C). |
| `principal` | Aparece solo como palabra suelta en dominios no relacionados (smart-intake config, liens, ops/consciousness) — no hay un tipo `Principal`/`PrincipalContext` definido. Término libre. |
| `membership` | Consistente — siempre `Membership` (Prisma) o `membershipId`. Sin colisión. |
| `owner` | No auditado en profundidad esta pasada — uso disperso en varios dominios (ej. `ownerId` en Agro). Sin evidencia de colisión con el sentido de "dueño de workspace", pero no se descarta sin un grep dedicado. |
| `professional` | Uso de producto (rol `PRO`), no de arquitectura — sin colisión con el vocabulario de contexto/identidad. |
| `operator` | Ver Colisión A (`OperatorContext`). |
| `session` | `SessionPayload` existe **dos veces con formas distintas** (ver G1 actualizado, fila "Sesión/cookies") — no es una colisión de dominio de negocio, pero sí un riesgo de confusión real si WS-01C introduce un tercer tipo `Session*`. |

`TenantContext`, `PrincipalContext`, `OrgContext`: **0 usos** — libres.
`ActorContext` (como tipo, no como servicio): 1 uso puntual y local en `apps/api/src/modules/change-orders/change-orders.service.ts:9` (`type ActorContext = {...}`, ámbito de archivo, no exportado) — riesgo bajo pero real de sombra de nombre si el tipo nuevo de WS-01C se llama igual y se importa en el mismo árbol de módulos.

---

## Propuesta de terminología canónica de negocio

Dado que `Workspace` (Colisión B) y `ActorContext` como nombre de servicio (Colisión C) están ambos ocupados por sistemas no relacionados y ya en producción, **no se recomienda usar "Workspace" como nombre del concepto de tenancy de negocio en este repo**, a pesar de que el documento WS-01C original lo usa como término de diseño.

### Evaluación previa obligatoria: ¿hace falta una tabla `Workspace` nueva?

**No, con evidencia de este slice.** `Org` (Prisma) ya cumple el rol de "boundary operativo/de seguridad que una identidad puede habitar" en casi todos los aspectos: tiene `tenantId`, tiene `type`, tiene una relación N:M con `User` vía `Membership`. Lo que le falta no es una tabla nueva, sino:
- extender `Org.type` de su rango actual (`"CLIENT"`, y presumiblemente algo tipo `"PRO"`/`"CONTRACTOR"` — no confirmado exhaustivamente en esta pasada, ver BLOCKED en el G1 actualizado) a un eje explícito `PERSONAL | BUSINESS | PLATFORM` si el producto lo requiere, o mantener el eje actual si ya es semánticamente equivalente (pendiente de decisión de producto, no de arquitectura);
- agregar `status` a `Membership` (`INVITED|ACTIVE|SUSPENDED|REVOKED`) — cambio aditivo simple.

Construir una tabla `Workspace` paralela a `Org` duplicaría el límite de tenancy real y crearía una tercera fuente de verdad de a qué "espacio" pertenece un usuario (después de `Org` y del `Workspace` de UI-shell ya existente) — exactamente el resultado que el control pack pide evitar.

### Opciones de nombre evaluadas

| Candidato | A favor | En contra |
|---|---|---|
| `ActiveOrganizationContext` | Describe con precisión lo que es hoy (`Org` + `Membership` activa); no colisiona con nada encontrado; se lee igual en API/backend/UI. | Algo largo para uso repetido en código (`ActiveOrganizationContext` vs. abreviaturas). |
| `OrgAccessContext` | Corto, sin colisión, deja explícito que es sobre acceso/autorización, no solo "qué org". | Menos obvio que incluye identidad+sesión, no solo el eje org. |
| `BusinessTenantContext` | Distingue explícitamente de `OperatorContext`/`Workspace` (ninguno de los dos es "de negocio"). | Introduce la palabra "Tenant" en un contexto que en este repo ya significa específicamente el aislamiento multi-cliente (`Tenant` Prisma) — riesgo de sugerir que es al nivel de `Tenant` y no de `Org`, cuando el eje real que cambia con el switch es `Org`, no `Tenant` (un usuario no cambia de tenant al hacer context-switch, cambia de org dentro del mismo tenant en el caso típico). |
| `RequestPrincipalContext` | Ninguna colisión (`principal` está libre); consistente con el uso ya establecido de "actor"/"principal" en seguridad. | Menos legible para alguien de producto/UX que no viene de un fondo de seguridad; no menciona "org" explícitamente. |

### Recomendación

**`ActiveOrganizationContext`** como nombre del tipo de dominio (equivalente al `ActorContext` de WS-01C sección 01.6), y **`OrgContextService`** (no `WorkspaceResolver`, no `ActorContextService`) como nombre del servicio que lo resuelve — evita las tres colisiones confirmadas (B, C, y el nombre genérico `*Context` sin prefijo) y refleja que el eje real que cambia es `Org`, con `tenantId` fijo dentro de ese cambio en el caso común.

Alternativa aceptable si el equipo prefiere un nombre más corto para uso repetido en código: `OrgAccessContext` / `OrgAccessService`.

**No usar** `Workspace*` para nada de este dominio de negocio, y **no reusar** el nombre `ActorContextService` para el nuevo servicio de resolución — aunque el tipo de dato pueda llamarse informalmente "el actor context de negocio" en conversación, el símbolo de código no puede coincidir con el servicio de bootstrap ya existente.

Esta recomendación es una propuesta, no una decisión final — la decisión formal y su razonamiento completo quedan en `ADR-040-ws01c-identity-organization-context.md`.
