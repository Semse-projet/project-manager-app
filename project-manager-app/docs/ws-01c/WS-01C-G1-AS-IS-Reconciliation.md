# WS-01C — G1 AS-IS Reconciliation (canonical mapping)

**Fecha:** 2026-09-18
**Contra:** `main@5d1c4b24`
**Relación con el reporte anterior:** este documento **extiende**, no reemplaza, `docs/reportes/2026-09-18_ws01c_gate0_as-is_reconciliation.md` (primer Gate 0 de la misma sesión). Ese reporte sigue siendo válido para los puntos 1-9 que ya cubrió; acá se agrega la tabla canónica de 25 filas pedida por el control pack, se cierran algunos de sus "no verificado en esta pasada", y se agregan los 5 conceptos que no había cubierto en detalle (Job/Estimate/BuildOps/Change Orders, `workspaceId` de Prometeo, SSE, modelos Prisma involucrados).

## Novedades respecto al reporte anterior (léase primero)

1. **Hallazgo nuevo y más importante que cualquiera del reporte previo:** existe un módulo `Workspace` completo y en producción (`apps/api/src/modules/workspace/`, API real `v1/workspace/*`) que es un coordinador de estado de UI (navegación de tres paneles + misión activa de Prometeo/Mission Control), sin relación con tenancy de negocio. Detalle completo en [`WS-01C-Naming-Collision-Register.md`](./WS-01C-Naming-Collision-Register.md), Colisión B. Esto invalida cualquier plan de usar el nombre `Workspace` tal cual lo usa el documento WS-01C original.
2. **`ActorContextService` ya existe**, con un propósito de bootstrap/upsert de filas (`Tenant`/`Org`/`User`), no de resolución de identidad. Ver Colisión C del registro de nombres. El paso 3 de la secuencia sugerida en la sección 10 del documento WS-01C original ("crear `ActorContextService`") colisiona directo con esto.
3. **Cerrado:** cuál cookie usa producción realmente. Confirmado por lectura completa de `apps/web/lib/auth.ts` — el cookie real (`semse_session`) usa `encodeSession`/`decodeSession` de `apps/web/lib/auth.ts`, que **sí está firmado con HMAC-SHA256** (`Path=/; SameSite=Lax; HttpOnly` + `Secure` condicional). El `encodeSession` sin firmar de `packages/auth/src/session.ts` que el reporte anterior señaló como riesgo **tiene cero call sites reales** en `apps/api` o `apps/web` — es código muerto, no la ruta de producción. Corrección al reporte anterior: no hay cookie sin firmar en producción, hay dos utilidades de sesión con el mismo nombre de función y forma de `SessionPayload` distinta, una de las cuales nunca se usa.
4. **Parcialmente cerrado:** scoping org-level en pagos. Confirmado por lectura de `payment-governance.service.ts` completo: **el scoping es exclusivamente por `tenantId`, nunca por `orgId`**, en las 4 queries del método `evaluate()`. Esto ya no es una pregunta abierta de "no se verificó" — es un hecho confirmado. Lo que sigue sin confirmar es si es explotable en la práctica (requiere que un actor de una org dentro de un tenant pueda obtener el `milestoneId` de otra org del mismo tenant por otra vía) — eso sí queda `BLOCKED`, requiere una pasada de seguridad dedicada fuera del alcance de una reconciliación de arquitectura.
5. **Nuevo:** `Evidence` sí pasa `orgId` además de `tenantId` en varios de sus writes (`evidence.controller.ts`), a diferencia de `payment-governance.service.ts`. Es decir, **el nivel de scoping no es uniforme entre dominios** — Evidence está más cerca del patrón correcto que Payments en este eje específico.
6. **Nuevo:** `Tenant.orgs: Org[]` confirma que **un tenant puede tener más de una `Org`** (no es 1:1) — el seed de ejemplo (`packages/db/prisma/seed.ts:145-151`) crea exactamente ese caso: `ACME Corp (Cliente)` tipo `CLIENT` y `ProServicios SRL` tipo `PRO`, mismo `TENANT_ID`. Esto hace que el gap del punto 4 sea estructuralmente real, no hipotético — dos partes de una misma relación comercial (cliente y profesional) están, en el modelo de datos actual, en el mismo tenant pero distinta org.
7. **Nuevo:** `Org.type` en el seed real solo toma 2 valores (`"CLIENT"`, `"PRO"`) — confirma la fila del reporte anterior, sin un tercer valor tipo `"PLATFORM"`/admin.
8. **Nuevo:** hay un tercer tipo de forma casi idéntica a `SessionPayload`/`WorkspaceActor` flotando suelto: `type ActorContext = { tenantId, userId, orgId, roles }` local (no exportado) en `apps/api/src/modules/change-orders/change-orders.service.ts:9`. Tres shapes casi iguales (`SessionPayload` de `packages/auth`, `WorkspaceActor` del módulo Workspace, este `ActorContext` local de change-orders), ninguna es la fuente canónica — refuerza la necesidad de un tipo único, con un nombre que no colisione (ver registro de nombres).

---

## Tabla canónica — 25 conceptos objetivo de WS-01C

Clasificación: `REUSE | WRAP | EXTEND | NEW | CONFLICT | DEFER`

| # | Target concept | Current implementation | Files/modules | Current semantics | Gap | Classification | Risk | Compatibility path |
|---|---|---|---|---|---|---|---|---|
| 1 | Identity/User | `User` Prisma model | `packages/db/prisma/schema.prisma:259` | Identidad global, sin campo de rol permanente | Ninguno — ya cumple D-01/D-02 | **REUSE** | Bajo | Directo |
| 2 | Organization/company/tenant | `Tenant` + `Org` (2 niveles reales) | `schema.prisma:131` (`Tenant`), `:234` (`Org`) | `Tenant` = aislamiento multi-cliente; `Org` = lado cliente o profesional de una relación comercial, `type: "CLIENT"\|"PRO"` | `Org.type` no distingue "contexto operativo elegible por el usuario" de "rol comercial de la org en una transacción" | **EXTEND** | Medio | Aditivo: nuevo campo o mapeo, no tocar `Tenant` |
| 3 | Membership | `Membership { userId, orgId, roleId }`, PK compuesta | `schema.prisma:564` | Existe/no existe, sin ciclo de vida | Sin `status` (`INVITED\|ACTIVE\|SUSPENDED\|REVOKED`) | **EXTEND** | Medio | Columna aditiva + backfill `ACTIVE` |
| 4 | Active organization selection | `memberships[0]` en login (primer membership, sin orden definido) | `apps/api/src/modules/auth/auth.service.ts` (login), confirmado en reporte previo §punto 4 | Fija org activa una sola vez, al login; sin mecanismo de cambio | No existe selección posterior a login, ni explícita ni por preferencia guardada | **CONFLICT** — **superado por la Reconciliación 2026-09-18** (ver sección al final de este documento): no se resuelve como "context switch" de autorización; se separa en resource-derived authorization (ya cubierto por el punto 6/7 + `universal-identity-multi-role.spec.md`) y una preferencia de UX sin autoridad, todavía no construida | Alto (era la pieza que Journeys B/C/D asumían que faltaba; parte de esa necesidad ya está cubierta por `universal-identity-multi-role.spec.md`, la parte de UX sigue pendiente) | Ver Reconciliación 2026-09-18 — no "construir desde cero" un switch de autorización |
| 5 | Session/cookie model | Doble implementación: `apps/web/lib/auth.ts` (real, HMAC-firmado) + `packages/auth/src/session.ts` (sin firmar, código muerto) | Ver Novedad 3 arriba | Cookie real: `semse_session`, HMAC-SHA256, `HttpOnly`/`SameSite=Lax`/`Secure` condicional | Ninguno de seguridad; sí de claridad (dos `SessionPayload` con forma distinta) | **WRAP** (real) / **DEFER** (limpiar la utilidad muerta, fuera de alcance de WS-01C) | Bajo | Envolver `apps/web/lib/auth.ts`, ignorar `packages/auth/src/session.ts` |
| 6 | Current role model | `roles: string[]` en `SessionPayload`, normalizado vía `rbac.ts` | `packages/auth/src/rbac.ts` | Roles reales: `CLIENT`/`PRO`/`WORKER`/`EVENT_CONSUMER`/`OPS_ADMIN`/`DEMO_AGRO` + `roleAliases` | Ninguno funcional | **REUSE** | Bajo | Directo |
| 7 | Current authorization checks | `rolePermissions: Record<string,string[]>`, ~150 permisos | `packages/auth/src/rbac.ts`, `getPermissionsForRoles`/`hasPermission` | Mapa hardcodeado en memoria, gateado vía `@RequirePermissions` | Resuelve sobre `roles` sueltos, no sobre membership activa resuelta server-side | **REUSE** (base directa de `CapabilityService`) | Bajo | Directo, extender el input (de `roles[]` a membership resuelta) |
| 8 | Route guards | `apps/web/middleware.ts` (prefijo fijo) + `apps/api/src/common/rbac.guard.ts` (`@RequirePermissions`) | `apps/web/middleware.ts:185` (`ownedPrefixes`), `apps/api/src/common/permissions.decorator.ts` | Web: 1 rol → 1 prefijo. API: por permiso, más fino | Sin concepto de "workspace/org activa" en el guard web | **EXTEND** | Medio | Agregar resolución de org activa al guard existente, no reemplazar |
| 9 | Client routes | `/client/*` | `apps/web/app/(app)/client/` | Rol `CLIENT`/`worker`-role-mapped, prefijo fijo | Ninguno de arquitectura — depende del punto 8 | **REUSE** (preservar tal cual) | Bajo | No tocar en el primer slice |
| 10 | Professional routes | `/worker/*` | `apps/web/app/(app)/worker/` | Rol `PRO`/`WORKER` | Igual que 9 | **REUSE** | Bajo | No tocar |
| 11 | Admin routes | `/admin/*` | `apps/web/app/(app)/admin/` | Rol `OPS_ADMIN`, sin workspace/org de tipo `PLATFORM` separado | D-08 de WS-01C ("Admin es explícito") se cumple parcial vía rol, no vía workspace | **EXTEND** (si se decide reforzar separación) / **REUSE** (si el rol actual alcanza) | Bajo-Medio | Decisión de producto, no bloqueante para el primer slice |
| 12 | Return URL / `from` / redirects | `resolveSafeRedirectPath` | `apps/web/lib/safe-redirect.ts`, usado en `middleware.ts:149,166,176` | Redirect post-login, open-redirect-safe por diseño | Sin persistencia server-side, sin TTL, sin `riskClass` — es Intent R0/R1 implícito | **WRAP** | Bajo | Base directa de `IntentService` para R0/R1 |
| 13 | Draft persistence | `localStorage` puro para el wizard de job pre-auth | `apps/web/lib/job-intake.ts:213-281` (`saveJobWizardDraft`/`loadJobWizardDraft`), consumido en `apps/web/app/(app)/client/jobs/new/page.tsx` | Draft vive solo en el navegador del dispositivo, clave fija `semse-job-wizard-draft` | No sobrevive cambio de dispositivo/navegador; no tiene `draftRef` server-side referenciable por un Intent | **WRAP** (para mismo-dispositivo) / **EXTEND** (si se requiere continuidad cross-device, ej. Journey H) | Medio | Envolver ya-existente; agregar persistencia server-side opcional solo si el producto lo pide |
| 14 | Job creation | `JobsController`/`jobs.service` | `apps/api/src/modules/jobs/jobs.controller.ts`, permiso `jobs:create` | Ya scoped por `tenantId`+`orgId` en creación (líneas 63-74) | Ninguno relevante a WS-01C — ya sigue el patrón correcto | **REUSE** | Bajo | Ninguno necesario |
| 15 | Estimate | No existe como entidad Prisma propia | Superficies dispersas: `apps/web/app/api/semse/agents/protools/estimate`, `.../buildops/estimates`, `.../contractor/leads/[id]/create-estimate`, `.../contractor/leads/[id]/suggest-estimate`, `.../public/intake/[id]/estimate` | "Estimate" es una vista/cálculo derivado por dominio (ProTools, BuildOps, Contractor leads), no una entidad canónica única | No hay un concepto unificado de "estimate" para que Intent lo referencie de forma genérica | **DEFER** (fuera del alcance de un slice de identidad/contexto — es un hallazgo de modelo de dominio, no de WS-01C) | Bajo (para WS-01C específicamente) | Ninguna acción en el primer slice; anotar para quien trabaje en unificación de dominio |
| 16 | BuildOps | Módulo propio con proyecto/plan/tarea | `apps/api/src/modules/buildops/`, modelos `BuildOpsProject`/`BuildOpsPlanVersion`/`BuildOpsTask` (`schema.prisma:2799-2975`) | Ya tenant-scoped (no confirmado org-level en esta pasada) | Scoping org-level no auditado línea por línea — `BLOCKED`, fuera de alcance de esta reconciliación | **DEFER** (para la parte no auditada) | Bajo-Medio | Ninguna acción en el primer slice |
| 17 | Evidence | `EvidenceController` + `Evidence`/`MilestoneEvidenceItem`/`TimeEvidence`/`AgroEvidenceItem` | `apps/api/src/modules/evidence/evidence.controller.ts`, `schema.prisma:860` y modelos relacionados | Autorización por permiso (`evidence:read/write`); varios writes ya pasan `tenantId`+`orgId` (líneas 486-572) | Mejor scoped que Payments (ver punto 19), pero no auditado exhaustivamente tras su reescritura reciente de multipart-upload | **REUSE** (como patrón) / **DEFER** (auditoría exhaustiva) | Bajo | Ninguna acción en el primer slice |
| 18 | Change Orders | `ChangeOrderCandidate` + `ChangeOrdersService` | `schema.prisma:2997` (`ChangeOrderCandidate`), `apps/api/src/modules/change-orders/change-orders.service.ts` | Tiene su propio `type ActorContext` local (ver Novedad 8) — shape casi idéntica a `SessionPayload`/`WorkspaceActor`, sin relación entre ellas | Confirma la necesidad de un tipo único de contexto de actor en todo el backend | **EXTEND** (una vez exista el tipo canónico, migrar este `ActorContext` local a importarlo) | Bajo | No bloqueante para el primer slice; anotar como consumidor futuro |
| 19 | Payment governance/release | `PaymentGovernanceService.evaluate()` | `apps/api/src/modules/payments/payment-governance.service.ts:45-100` | Scoped exclusivamente por `tenantId`, nunca por `orgId` (confirmado, ver Novedad 4) | Gap de scoping org-level confirmado estructuralmente posible (`Tenant.orgs: Org[]`, ver Novedad 6); explotabilidad real no confirmada | **CONFLICT** (gap de seguridad potencial, no de diseño) | **Alto** — requiere pasada de seguridad dedicada antes de cualquier cambio de WS-01C que toque este servicio | No tocar en el primer slice de WS-01C; escalar como hallazgo de seguridad independiente |
| 20 | Prometeo runtime context | `OperatorContext` | `packages/shared/src/operator-context.ts`, `packages/auth/src/operator-context.ts` | Runtime de agentes/herramientas internas — scope `workspace\|repo\|run\|task` | Ninguno — no debe tocarse | **DEFER** (preservar, no integrar) | Bajo si se respeta el non-goal | No usar, no renombrar |
| 21 | Prometeo `workspaceId` | Campo de `OperatorContextInput` | `packages/shared/src/operator-context.ts:40` | Identifica el "espacio" de ejecución de un run de agente (no el negocio) | Ninguno funcional; riesgo es solo de colisión de nombre si WS-01C introduce su propio `workspaceId` | **DEFER** (preservar) | Bajo si se respeta el non-goal | No reusar el nombre |
| 22 | Audit events | `AuditLog` | `schema.prisma:956` | `{tenantId, actorUserId, entityType, entityId, action, beforeJson, afterJson, ip, userAgent, occurredAt}` | Sin `correlationId`, sin `membershipId`, sin nivel de seguridad/`authStrength` | **EXTEND** | Bajo | Columnas aditivas |
| 23 | Security events | No hay tabla dedicada distinta de `AuditLog` | — | `AuditLog` cubre ambos usos hoy | WS-01C sección 05 distingue "Audit" de un registro de seguridad más granular (`SecurityEvent`) — no existe esa distinción hoy | **NEW** (si se decide separarlos) / **REUSE** (si `AuditLog` extendido alcanza) | Bajo | Decisión de arquitectura en el ADR, no bloqueante |
| 24 | SSE/realtime assumptions | `SseController` (`v1/sse/*`) | `apps/api/src/infrastructure/sse/sse.controller.ts` | **Hallazgo de seguridad relevante:** los endpoints `@Sse` están marcados `@Public()` — bypasean el guard normal de auth — y dependen de un header `x-tenant-id` enviado por el cliente para el scoping, con un ownership-check adicional ya agregado (ver comentario en el archivo, líneas 33-40, sobre un fix previo de cross-tenant leak) | El modelo de actor context resuelto server-side de WS-01C **no cubre hoy el canal SSE** — cualquier `ActorContext`/`WorkspaceResolver` nuevo debe decidir explícitamente si SSE se resuelve igual o sigue con su propio mecanismo basado en headers | **CONFLICT** (mismo nivel de severidad que el punto 19 — bypasea el modelo de autorización estándar) | Medio-Alto | No tocar en el primer slice; documentar como boundary conocido, evaluar en un slice de seguridad dedicado |
| 25 | Prisma models/migrations involved | Lista confirmada por lectura directa de `schema.prisma` | `Tenant` (131), `TenantSettings` (224), `Org` (234), `Role`/`Permission`/`RolePermission` (540-562), `Membership` (564), `Job` (576), `AuditLog` (956), `DomainOutboxEvent` (975), más 161 modelos adicionales no relacionados directamente | 170 modelos totales en el schema | Ninguno de los modelos centrales de WS-01C (`Tenant`/`Org`/`Membership`) requiere una migración destructiva — solo aditiva (`Membership.status`, posible extensión de `Org.type`) | **EXTEND** | Bajo si se respeta "aditivo primero" | Ver constraints de migración en G0 |

---

## Intent Continuity — reconciliación de primitivas existentes

Grep real de `from`/`returnTo`/`redirect`/callback-URL-state/draft IDs/auth-redirect-state/draft persistence:

| Primitiva | Ubicación | Clasificación |
|---|---|---|
| `resolveSafeRedirectPath` (`from`/return-url post-login) | `apps/web/lib/safe-redirect.ts`, usado en `middleware.ts` | **WRAP** — base de Intent R0/R1, ya open-redirect-safe |
| `saveJobWizardDraft`/`loadJobWizardDraft` (localStorage) | `apps/web/lib/job-intake.ts:213-281` | **WRAP** para same-device; **EXTEND** si se requiere cross-device (no confirmado como requisito de producto) |
| `landing-intake.tsx` (intake público pre-auth) | `apps/web/components/landing/landing-intake.tsx` | **REUSE** — auditado 2026-09-18 (ver `BLOCKED` #5 abajo, ahora resuelto): el componente en sí está limpio (sin secretos en URL, usa el patrón BFF, sin XSS) |
| Callback/`returnTo` en asistente/chat | `apps/api/src/modules/assistant/assistant.controller.ts`, `assistant.service.ts`, `apps/web/components/ai/agent-chat-panel.tsx` | No relacionado con Intent de negocio — es estado de conversación del asistente, **fuera de alcance**, no confundir |
| Resume token / Intent persistido server-side | No existe ningún hallazgo de un `resumeToken`/`pendingIntent` real en el repo | **NEW** — no hay nada que envolver para R2/R3, hay que construirlo desde cero |

**Conclusión de este punto:** para R0/R1 (Journey A, G), las primitivas actuales alcanzan con un WRAP fino. Para R2/R3 (Journey F, pago), **no existe ninguna primitiva reutilizable** — el control pack ya advierte no construir un subsistema de Intent grande si las primitivas actuales alcanzan; para R0/R1 alcanzan, para R2/R3 no alcanzan y no se puede evitar construir algo nuevo, acotado a: persistencia server-side mínima + reautorización obligatoria en el paso final (ya exigido como invariante en G0).

---

## Pendientes explícitamente `BLOCKED` (no resueltos en esta pasada, con próxima acción concreta)

1. ~~**Explotabilidad real del gap de scoping en `payment-governance.service.ts` (punto 19).**~~ **RESUELTO 2026-09-18 — PR #656.** Confirmado explotable (no solo estructural): cualquier actor con `finance:write`/`finance:read` en una org podía bloquear/leer el escrow de otra org del mismo tenant. Arreglado reusando `assertMilestoneReadable` de `milestones.policy.ts`. Ver también el hallazgo hermano abajo (evaluate() en `modules/payments/`).
2. ~~**Scoping org-level exhaustivo en Evidence y en BuildOps (puntos 16-17).**~~ **RESUELTO 2026-09-18 — PR #658 (BuildOps); Evidence confirmado ya correcto.** Evidence: los endpoints reales de lectura/escritura (`register`, `registerPhoto`, `listByJob`, `listByProject`, `detail`) ya pasaban `orgId` — la clasificación **REUSE** original era correcta, los endpoints de mecánica de upload (`presign`/`uploads/plan`/multipart) son correctamente solo-tenant porque no referencian un recurso existente. BuildOps: **confirmado explotable y peor de lo esperado** — `overview`/`listProjects`/`listTasks`/`listMilestones` filtraban listas y agregados **tenant-wide** (no solo IDOR de un solo id) a cualquier actor con `projects:read` (CLIENT y PRO, no solo OPS_ADMIN); `overview().recentActivity` nombraba proyectos de otras orgs directamente. Arreglado en PR #658, que además encontró y cerró dos instancias más del mismo patrón forzadas a la vista al cambiar las firmas: `modules/payments/payment-governance.service.ts`'s `evaluate()` (clase hermana de la de PR #656, mismo nombre, módulo distinto — la colisión de "escritor duplicado" que ya documentaba `ADR-040`) y `modules/prometeo/operational-rag-context.service.ts`'s `build()` (el endpoint `rag-query`, con una fuga peor — el lookup de `evidenceItemId` no verificaba ni siquiera `tenantId`).
3. **Rango completo de valores de `Org.type` en producción real (no solo el seed).** Bloqueo: **técnico, no solo de tiempo.** Las dos queries de solo lectura ya están escritas (`SELECT type, COUNT(*) FROM "Org" GROUP BY type`, ver el par completo en la sesión 2026-09-18) y el procedimiento para correrlas (proxy TCP temporal a Postgres de producción vía Railway CLI, ya usado antes en este proyecto — ver referencia de infra) está documentado. Se intentó ejecutarlo el 2026-09-18 bajo autorización explícita del owner (goal `/goal completa lo que falta`) y **el clasificador de permisos de auto mode lo rechazó** (`Sensitive Remote Exec`) — no es una decisión del agente, es un límite técnico de la sesión que ningún nivel de autorización conversacional puede cruzar. Próxima acción: el owner corre el comando él mismo (`railway tcp-proxy create ...` + las queries) fuera de auto mode, o en una sesión con permisos distintos, y pasa el resultado.
4. **Cuántos usuarios reales tienen hoy más de un `Membership`.** Mismo bloqueo técnico que el punto 3 — mismo intento, mismo rechazo del clasificador, misma próxima acción (el owner lo corre él mismo o cambia el modo de permisos).
5. ~~**Auditoría línea por línea de `landing-intake.tsx`.**~~ **RESUELTO 2026-09-18.** El componente en sí está limpio: sin secretos en la URL de continuación (`buildJobIntakeHref`), usa el patrón BFF correctamente (`/api/semse/public/*`), sin riesgo de XSS (sin `dangerouslySetInnerHTML`), el draft en `localStorage` es solo el id, coherente con el patrón ya clasificado de `job-intake.ts`. **Hallazgo nuevo, de otra clase, no cerrado — requiere decisión de producto, no es un bug de autorización:** los endpoints públicos que llama (`POST /v1/public/professionals/preview`, `POST /v1/public/budget/suggest`, en `apps/api/src/modules/intelligence/intelligence.controller.ts:218-269`) son `@Public()` (sin autenticación, por diseño — visitante anónimo en la landing) y aceptan un header `x-tenant-id` **provisto por el cliente**, sin validarlo contra nada, con fallback a `"tenant_default"` si está ausente. Esto le permite a cualquier visitante anónimo pedir un preview de profesionales/presupuesto para **cualquier tenant que adivine o conozca**, no solo el tenant "canónico" del marketplace público. No lo clasifico como P0 de autorización (es data ya pensada para ser pública/de marketing, similar a lo que ya se ve en `/pro/:slug`), pero si SEMSE no tiene la intención de que exista una landing pública "por tenant" (ej. white-label multi-tenant), este diseño permite enumerar/previsualizar el roster de profesionales de otros tenants sin que sea necesariamente el comportamiento buscado. **Próxima acción:** decisión de producto — ¿el preview público debe ignorar el header y usar siempre "el" tenant del marketplace público de SEMSE, o el multi-tenant-por-landing es intencional? No lo cambié sin esa respuesta.

**Nota sobre el estado de este gate (owner, 2026-09-18, actualizado tras el cierre de los ítems 1, 2 y 5, y el intento fallido de 3/4):** de los 5 `BLOCKED` originales, 3 quedaron resueltos con evidencia real (PRs #656/#658, y la auditoría de `landing-intake.tsx`). Los ítems 3 y 4 siguen abiertos — no por falta de intento, sino porque la única acción que los cierra (query de solo lectura contra producción) está bloqueada por el clasificador de permisos de la sesión de agente, no por el código ni por falta de autorización del owner. El estado del gate sigue siendo **`PASS WITH BLOCKERS FOR DOWNSTREAM`** hasta que 3 y 4 se resuelvan — ya no por los riesgos P0 de payment-governance/BuildOps (cerrados), sino por la falta de datos reales de producción para dimensionar el rollout del primer slice de context switching, y esa falta ahora tiene una causa raíz documentada (límite técnico de permisos, no una decisión pendiente). El hallazgo nuevo de `public/professionals/preview` (ítem 5) es una pregunta de producto abierta, no un blocker de seguridad confirmado.

---

## Reconciliación 2026-09-18 (owner) — `universal-identity-multi-role.spec.md` cambia la clasificación

Durante la implementación del primer slice se encontró `docs/specs/core/universal-identity-multi-role.spec.md` — spec `APPROVED` el 2026-08-04 por el owner, con Fase 1-2 `MERGED`/`DEPLOYED` (PR #539) — que ninguna pasada anterior de este G1 había detectado. Resuelve, con otro mecanismo, el mismo problema de fondo que motivó el punto 4 de la tabla ("Active organization selection"). El owner cerró la reconciliación separando explícitamente autorización de preferencia de experiencia (ver `ADR-040`, sección "Reconciliation decision 2026-09-18 (owner)", para el razonamiento completo). Reclasificación resultante:

| Concepto | Clasificación | Nota |
|---|---|---|
| Universal identity / multi-role (`universal-identity-multi-role.spec.md`) | **REUSE** | Ya `APPROVED`, parcialmente desplegado; es la autoridad de producto sobre "una cuenta, múltiples roles" — WS-01C no la reemplaza, la complementa |
| Resource-derived capability resolution | **REUSE/EXTEND** | `rbac.ts` + `Membership` por `orgId` del recurso ya es el mecanismo correcto (REUSE); se extiende solo para incorporar `Membership.status` en la resolución (ver punto 3 de la tabla principal) |
| Sticky authorization context (sesión con "org activa" que determina permisos) | **REJECTED** | No es un gap a cerrar ni un `DEFER` — es un mecanismo explícitamente rechazado por el owner, dos veces (2026-08-04 y 2026-09-18). Ningún slice futuro debe reintroducirlo, ni con otro nombre |
| Preferred organization / experience context (UX) | **EXTEND/NEW** — **sin autoridad de autorización** | No existe hoy. Es legítimo y queda pendiente de diseño; debe nombrarse de forma que su falta de autoridad sea obvia en el call site (ver ADR-040 para candidatos de nombre) y nunca ser input de un check de `rbac.ts`, un scope de query Prisma, ni un guard |
| Intent continuity | **REUSE/WRAP para R0-R1, NEW para R2-R3 — ver reconciliación abajo** | Resuelto en la sección "Intent continuity — reconciliación 2026-09-18" más abajo |

Esta reconciliación **no cierra** los dos riesgos P0 (payment-governance, SSE) — siguen como workstreams de seguridad separados, sin relación con esta decisión de arquitectura.

---

## Intent continuity — reconciliación 2026-09-18

Pregunta que quedaba abierta: la reconciliación de autorización-vs-experiencia
(sección anterior) resuelve cómo se autoriza un recurso, pero no dice
explícitamente cómo un `Intent` (WS-01C sección 03) debe referenciar "a qué
org vuelve" tras una interrupción de auth/sesión — sin que esa referencia se
convierta en autorización por la puerta de atrás. Esta sección cierra esa
pregunta usando el mismo modelo de cuatro conceptos de `ADR-040`.

### Regla general

Un `Intent` nunca lleva autoridad. Lo único que un `Intent` puede llevar,
respecto a organización, es **una referencia**, nunca una decisión ya tomada:

- Si el `Intent` ya está atado a un recurso concreto (`resourceRef` en el
  modelo original de WS-01C — ej. un `milestoneId`, un `escrowId`, un
  `jobId` ya creado), **la org se deriva del recurso al resumir**, exactamente
  igual que cualquier otra operación sobre ese recurso (ver `ADR-040`). El
  `Intent` no necesita cargar ningún campo de org — sería información
  redundante y, peor, una segunda fuente de verdad que podría divergir de la
  real si el recurso cambió de dueño entre que se creó el Intent y se
  resume.
- Si el `Intent` **todavía no tiene recurso** (ej. "publicar un job" antes de
  que el job exista — Journey A del documento original), la única org
  disponible en ese momento es una **sugerencia**, no una decisión: la misma
  `preferredOrganizationId` no-autoritativa de
  `docs/specs/core/preferred-organization-context.spec.md`. El flujo de
  creación la usa para pre-rellenar, el usuario puede cambiarla, y el
  backend valida membership/capability sobre la org que efectivamente se
  envíe al crear — nunca sobre lo que el Intent "recordaba".

### Por qué esto no reabre el gap que `ADR-040` cerró

Es tentador agregar `orgId`/`workspaceId` al modelo de `Intent` "para no
perder contexto". Eso es exactamente el error que la reconciliación de
autorización-vs-experiencia ya identificó una vez (un campo con forma de
contexto que termina leyéndose como autoridad) — aplicado esta vez a un
objeto que además cruza el límite de una interrupción de sesión, que es
justo el escenario que **D-06** ("Consent is never resumed") del documento
original ya cubre para consentimiento. La misma lógica aplica a org: un
`Intent` que "recuerda" una org y la usa para saltarse la revalidación al
resumir es tan peligroso como uno que recuerda que el usuario "ya autorizó"
algo.

### Mapeo contra las primitivas ya encontradas (tabla principal, punto "Draft persistence" e Intent primitives)

| Risk class | Primitiva hoy | Cambia con esta reconciliación? |
|---|---|---|
| R0 (explorar, reabrir resultado) | `resolveSafeRedirectPath` (`from`/return-url) | No — sigue **WRAP**, no toca org en absoluto |
| R1 (draft reversible — job/estimate/evidence) | `saveJobWizardDraft`/`loadJobWizardDraft` (localStorage) | No cambia su clasificación (**WRAP** same-device); al resumir, si el draft es pre-recurso, se pre-llena con `preferredOrganizationId` per la regla de arriba — eso es nuevo pero es del lado de la spec de preferencia, no del Intent mismo |
| R2 (commit operacional — publicar job, submit evidence) | No existe primitiva reutilizable (confirmado en la pasada anterior) | Sigue **NEW** — y ahora con la regla explícita: si ya hay `resourceRef`, la org se deriva de ahí al reautorizar; si no, aplica la regla de preferencia de arriba |
| R3 (sensible — liberar pago) | No existe primitiva reutilizable | Sigue **NEW** — reforzado: el resume nunca debe cargar ni implicar una org; la reautorización en el paso final (ya exigida por G0) deriva la org 100% del `escrowId`/recurso real, ignorando cualquier estado de sesión/preferencia por completo |

### Consecuencia práctica para cuando se implemente el `IntentService`

El campo `desiredWorkspaceType` que el documento externo WS-01C proponía
originalmente (sección 03, modelo mínimo de Intent) **no debe implementarse
tal cual** — asumía el modelo de "workspace"/context-switch ya rechazado. Si
hace falta alguna señal de org al crear un Intent pre-recurso, es
exactamente `preferredOrganizationId` (una lectura, no un campo propio del
Intent) en el momento de la creación del recurso real, nunca persistida
dentro del propio registro de Intent.
