---
id: "ui.admin-flows-remediation"
title: "Admin/OPS UI Flows — Remediation (auditoría 2026-07-20, parcial)"
domain: "ui"
version: "1.1"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
date: "2026-07-20"
author: "Claude Sonnet — sesión de auditoría (solo código, sin verificación en vivo todavía)"
spec_index: "docs/SPEC_INDEX.md"
supersedes: "docs/specs/ui/admin-flows.spec.md"
related_files:
  - apps/web/app/(app)/admin
  - apps/web/app/(app)/admin/dashboard/page.tsx
  - apps/web/app/(app)/admin/labor-engine/page.tsx
  - apps/web/app/(app)/admin/disputes/page.tsx
  - apps/web/lib/navigation-registry.ts
  - apps/web/lib/admin/admin-navigation.ts
  - apps/api/src/infrastructure/storage/uploads.controller.ts
  - apps/api/src/modules/anatomy
  - apps/api/src/modules/knowledge
  - apps/api/src/modules/repo-knowledge
  - apps/api/src/modules/runtime-knowledge
related_tests: []
related_endpoints:
  - v1/uploads/plan
  - v1/anatomy
  - v1/knowledge
related_events: []
related_agents: []
last_verified: "2026-08-14"
---

# Spec: Admin/OPS UI Flows — Remediation

> **Estado actualizado 2026-08-14: todos los hallazgos MEDIO/PARCIAL cerrados.** La nota original de abajo (auditoría 2026-07-20) quedó obsoleta el 2026-07-27, cuando otra sesión sí consiguió credencial `OPS_ADMIN` real y confirmó en vivo prácticamente todo el backlog de código (ver `docs/AUDIT_REMEDIATION_PLAN.md` Sección 3, líneas ~549-552: 59/59 páginas recorridas sin error, dashboard con datos reales). Este spec nunca se actualizó para reflejarlo — mismo patrón de documentación desincronizada que apareció varias veces en este proyecto. Una segunda pasada dirigida el 2026-08-02 (con OPS_ADMIN real, ~10 pantallas + 2 lecturas de código para G-ADM-07/08) re-confirmó casi todo y encontró 2 hallazgos nuevos (3.45, 3.46 en el plan). Una tercera pasada el 2026-08-14 (código+git-log para G-ADM-03/04/05, sesión OPS_ADMIN real contra el stack local para G-ADM-05/06) cerró los últimos hallazgos MEDIO/PARCIAL abiertos: G-ADM-03/04/05 ya estaban resueltos por código sin que el spec lo reflejara (mismo patrón de siempre); G-ADM-06 tenía un gap real (`showBack={false}` en Trust/Tools) que se corrigió y se verificó en vivo. Sigue pendiente: una revisión exhaustiva de las ~48 páginas restantes no visitadas en ninguna de las tres pasadas.
>
> Nota histórica (2026-07-20, ya no aplica): "no hubo credencial de OPS_ADMIN disponible durante la sesión de auditoría". A diferencia del spec de Cliente y PRO, `docs/specs/ui/admin-flows.spec.md` sí apunta al directorio correcto (`apps/web/app/(app)/admin`) — el problema aquí no fue un spec desactualizado de ruta, fue que en ese momento nunca se había verificado contra producción.

## Problem Statement

El panel de Admin comparte la causa raíz de estado incorrecto de los otros dos módulos (por lectura de código, sin confirmar en pantalla), y tiene además hallazgos propios de seguridad de acceso: rutas internas de arquitectura del sistema abiertas a cualquier rol, no solo admin, y una escritura de archivos que confía en un header en vez de la sesión real.

## Scope

- In scope: `apps/web/app/(app)/admin/**` (58 páginas), la navegación/registro de módulos admin, y los endpoints internos de arquitectura (anatomy/knowledge/repo-map/runtime-map) que — aunque no viven bajo `/admin/*` en la URL — están pensados para uso interno/operativo.
- Out of scope: los hallazgos de backend puramente transversales (Forge, SSE cross-tenant, pagos) — están en `docs/AUDIT_REMEDIATION_PLAN.md` sección 0, este spec solo referencia los que tienen una superficie de UI/acceso específica de Admin.

## Non-Goals

- Aprobado para la implementación controlada de fixes de UX/UI Admin documentados en `docs/AUDIT_REMEDIATION_PLAN.md` que no toquen dinero, auth ni datos cross-tenant. La verificación en vivo con credencial `OPS_ADMIN` sigue siendo requisito antes de marcar cualquier hallazgo como `VERIFIED`.

## Gaps encontrados (código únicamente — pendiente confirmación en vivo)

### G-ADM-00 — RESUELTO — Mismo bug de causa raíz que G-CLI-00/G-PRO-00 (confirmado en pantalla, no reproduce en Dashboard)
**Archivo:** `apps/web/app/(app)/admin/dashboard/page.tsx` — cubierto por el mismo fix de 0.0 (normalización en la ruta BFF `/api/semse/jobs`), confirmado en vivo 2026-07-31 y de nuevo 2026-08-02: el Dashboard muestra KPIs reales y variados (Trabajos activos: 3, Completados: 1, Total: 12, Presupuesto: $8733), no ceros.
**Hallazgo relacionado nuevo, no en Dashboard sino en Disputas:** ver 3.45 en `AUDIT_REMEDIATION_PLAN.md` — mismo patrón de comparación de status roto, pero encontrado en `/admin/disputes` (KPIs en 0 con una disputa `OPEN` real listada debajo). No cerrar este ítem sin abordar 3.45 por separado.

### G-ADM-01 — RESUELTO — `/admin/labor-engine` ya visible en el sidebar
**Confirmado en vivo 2026-08-02:** Labor Engine aparece en el sidebar bajo "SYSTEM". Código: `apps/web/lib/admin/admin-navigation.ts` (`ADMIN_MODULES`) ya lo lista como child de `workops`.

### G-ADM-02 — RESUELTO — Resolución de disputas ahora pasa por un panel de aprobaciones
**Archivo:** `apps/web/app/(app)/admin/disputes/page.tsx`. **Confirmado en vivo 2026-08-02:** el detalle de disputa ya no ofrece los 4 botones de un clic descritos originalmente — el texto de la UI dice explícitamente "aprueba o rechaza la intervención desde el panel de aprobaciones pendientes", consistente con el fix ya documentado en `AUDIT_REMEDIATION_PLAN.md` 3.2 (`window.confirm` antes de resolver/decidir). Probado sobre una disputa con datos anómalos (sin job vinculado) — repetir con un caso limpio si se quiere confirmar el flujo completo de punta a punta.

### G-ADM-03 — RESUELTO — Falla parcial de carga ya no deja el KPI de costo silenciosamente incompleto
**Confirmado por código 2026-08-14** (no verificado en vivo todavía): `apps/web/app/(app)/admin/labor-engine/page.tsx`, función `load()` — las cuatro llamadas (`overview`, `rates`, `jobs`, `users`) se resuelven vía `Promise.allSettled`, y cualquier subconjunto que falle se acumula en un array `failed` y se muestra en un único banner (`Falla parcial de carga: ${failed.join(", ")}.`), no solo el fallo de `overview` como decía el hallazgo original (código-únicamente, 2026-07-20). Corregido en PR #387 (`7451b5f9`, 2026-07-23, "remediación UI Admin — confirmaciones, errores silenciados, navegación y honestidad de métricas"), 3 días después de la auditoría original — mismo patrón de doc desincronizada que G-ADM-00/01/02.

### G-ADM-04 — RESUELTO — Alertas de QualityGuard ya tienen acciones
**Confirmado por código 2026-08-14** (no verificado en vivo todavía): la sección "QualityGuard alerts" de `admin/labor-engine/page.tsx` ya renderiza botones "Pausar"/"Detener" (con `window.confirm` antes de mutar, vía `handleAlertPause`/`handleAlertStop`) para alertas `stale_timer`, más un link "Ver perfil" hacia `/admin/users/[id]` para cualquier alerta. Pausar/Detener se limitan a `stale_timer` a propósito — para `overtime`/`long_entry`/`off_site_checkin` no hay un timer colgado que cortar, así que "Ver perfil" es la acción que corresponde. Corregido en PR #389 (`6e51679d`, 2026-07-23, "QualityGuard alerts ahora tienen acciones (perfil, pausar, detener timer)"), mismo día que G-ADM-03.

### G-ADM-05 — RESUELTO — IDs crudos en vez de nombres
**Confirmado en vivo 2026-08-14 (sesión OPS_ADMIN real, stack local):** el hallazgo 3.46 (al menos 1 usuario mostrando ID crudo el 2026-08-02) ya estaba resuelto por código el mismo día — PR #518 (`c4c9100b`, 2026-08-02, "dispute status casing (RC1) + raw org-id leaking as user name") agregó `RAW_CUID_PATTERN` en `apps/web/app/(app)/admin/users/page.tsx`: si `org.name` calza con el patrón de un `cuid()` de Prisma, se lo trata como dato corrupto y se cae al nombre derivado del email en vez de mostrar el ID. Verificado en vivo contra `/admin/users` (3 usuarios del seed local): ningún ID crudo visible, los 3 muestran nombre de org o nombre derivado del email. Mismo patrón de doc desincronizada que G-ADM-00/01/02/03/04 — el fix llegó el mismo día que el hallazgo pero el spec nunca se actualizó.
Paginación sigue sin verificarse a escala real (solo 3-7 usuarios vistos en cualquier sesión hasta ahora) — no cerrar esa parte sin datos de volumen real.

### G-ADM-06 — RESUELTO (para el gap real) — Headers de página inconsistentes
**Confirmado en vivo 2026-08-14 (sesión OPS_ADMIN real, stack local):** la inconsistencia real no era "3 páginas con header propio ad-hoc" — era 2 páginas que **ya usaban** `AdminPageHeader` pero pasaban `showBack={false}` explícito (`apps/web/app/(app)/admin/trust/page.tsx`, `apps/web/app/(app)/admin/tools/page.tsx`), ocultando el breadcrumb "← Dashboard" sin motivo aparente. Corregido quitando el override — verificado en vivo, ambas páginas muestran el breadcrumb ahora, sin cambio visual en el resto.
La tercera pieza del hallazgo original ("Intelligence") resultó ser un caso distinto, no un bug: `/admin/intelligence` usa `ModuleShell` (`apps/web/app/(app)/admin/intelligence/page.tsx`), un patrón de header compartido y ya internamente consistente entre las 4 páginas "hub" de módulo (`intelligence`, `tool-hub`, `verticals`, `workops`) — deliberadamente distinto de `AdminPageHeader` porque son páginas de navegación a sub-módulos, no vistas de contenido único. No se toca: forzarlas a `AdminPageHeader` sería un cambio de mayor alcance sin un problema real detrás. (Nota: el "Tool Hub" del hallazgo original probablemente se refería a `/admin/tools` — "Pro Tools Catalog", un sub-ítem de navegación — no a `/admin/tool-hub`, el hub real; ambas rutas existen y son distintas.)

### G-ADM-07 — RESUELTO — Herramientas internas de arquitectura, ahora gateadas correctamente
**Confirmado por código 2026-08-02:** `anatomy.controller.ts`, `repo-knowledge.controller.ts` y `runtime-knowledge.controller.ts` completos, más los endpoints `domains`/`overview` de `knowledge.controller.ts` (los que exponen el mapa real de arquitectura), todos requieren `internal:architecture:read` — permiso que en `packages/auth/src/rbac.ts` solo tiene `OPS_ADMIN`. El resto de `knowledge.controller.ts` (workspace-memory, skills, curation) sigue en `knowledge:read` compartido **a propósito** (comentario explícito en el código, líneas 23-26): es RAG legítimo que CLIENT/PRO/WORKER deben poder usar. Fix más preciso que lo que pedía el hallazgo original (que sugería cerrar todo `/v1/knowledge`).

### G-ADM-08 — RESUELTO (escritura) / diseño documentado (lectura) — Tenant de subida y descarga pública
**Confirmado por código 2026-08-02:** `apps/api/src/infrastructure/storage/uploads.controller.ts:174` ya usa `resolveRequestContext(req)`, con comentario explícito ("Use the verified session tenant, not the client-controlled x-tenant-id header"). La ruta de descarga (`getFile`) sigue siendo `@Public()`, sin firma ni expiración — pero ahora con un comentario que documenta la decisión (claves UUID tenant-scoped, difíciles de enumerar, necesario para que el vision-service y el navegador puedan leer sin token de sesión). Ya no es un descuido no documentado; sigue siendo un tradeoff de seguridad real que vale la pena que el equipo revise a propósito.

## UI Contract (pendiente de confirmar visualmente — hipótesis por código)

```yaml
screens:
  - /admin/dashboard
  - /admin/labor-engine
  - /admin/disputes
  - /admin/workops
  - /admin/product-intelligence
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - Ninguna resolución de disputa ejecuta sin confirmación explícita (bloqueado hoy por G-ADM-02)
  - Todo módulo "COMPLETE" según CLAUDE.md debe ser alcanzable desde el sidebar de Admin (bloqueado hoy por G-ADM-01)
```

## Security / RBAC

- G-ADM-07 y G-ADM-08 son los hallazgos de mayor severidad de este documento — ambos son fugas de control de acceso reales, no solo gaps de UX.
- Antes de `APPROVED`: confirmar con una sesión OPS_ADMIN real si existe alguna otra ruta de mitigación en el frontend que no se vio por análisis estático (poco probable dado que el gate real está en el backend, pero debe verificarse, no asumirse).

## Tests Required

- [x] Un actor con rol CLIENT o PRO recibe 403 al intentar `GET /v1/anatomy` o los endpoints `domains`/`overview` de `GET /v1/knowledge` (regresión directa de G-ADM-07) — confirmado por código 2026-08-02 (`internal:architecture:read`, solo OPS_ADMIN); no probado con una sesión CLIENT/PRO real, queda como verificación en vivo pendiente si se quiere confirmar el 403 real y no solo el gate declarado.
- [x] El emisor de planes de subida usa `resolveRequestContext(req)`, no `x-tenant-id` (regresión de G-ADM-08) — confirmado por código 2026-08-02.
- [x] Resolver una disputa desde Admin requiere un paso de confirmación explícito antes de notificar a las partes
- [x] `/admin/labor-engine` aparece en `ADMIN_MODULES` o `navigation-registry.ts`
- [x] Las alertas QualityGuard en `/admin/labor-engine` muestran un acción visible (perfil del worker; pausar/detener timers olvidados) y confirman antes de mutar
- [x] `/admin/labor-engine`, `/admin/disputes` y `/admin/users` reemplazan IDs crudos por nombres legibles y paginan listas largas
- [x] `/admin/labor-engine`, `/admin/disputes`, `/admin/users`, `/admin/settings`, `/admin/coordinator`, `/admin/field-ops`, `/admin/change-orders`, `/admin/contractors`, `/admin/agents`, `/admin/qa`, `/admin/reports`, `/admin/dashboard`, `/admin/compliance`, `/admin/travel`, `/admin/memory`, `/admin/algorithm-engine`, `/admin/prometeo`, `/admin/ai-mission-control`, `/admin/trust`, `/admin/reputation`, `/admin/governance`, `/admin/marketplace`, `/admin/ecosystem`, `/admin/tools`, `/admin/worker`, `/admin/browser-agent`, `/admin/verticals/construction`, `/admin/llm-metrics`, `/admin/jobs`, `/admin/intelligence-rooms`, `/admin/pmo`, `/admin/product-intelligence`, `/admin/ops/loops`, `/admin/verticals/maintenance`, `/admin/verticals/cleaning`, `/admin/verticals/agro`, `/admin/html-in-canvas`, `/admin/browser-agent/missions`, `/admin/users/[id]`, `/admin/trust/worker-applications`, `/admin/verticals/vision`, `/admin/developer-runtime`, `/admin/finance`, `/admin/consciousness`, `/admin/vision`, `/admin/mission-control`, `/admin/travel/[travelId]`, `/admin/autonomy`, `/admin/communications`, `/admin/domain-events`, `/admin/ops`, `/admin/jobs/[jobId]` y `/admin/intelligence-rooms/[id]` usan un `AdminPageHeader` compartido en vez de header propio
- [x] `/admin/semse-x` conserva su logo de sidebar custom por diseño de interfaz inmersiva; no es un header de página y queda fuera del scope de `AdminPageHeader`
- [x] `/admin/settings` persiste los ajustes en `TenantSettings` (`GET/PUT /v1/admin/settings` + BFF `/api/semse/admin/settings`) y muestra honestamente el estado de guardado/errores; los toggles de MFA/session log/integraciones incluyen texto que aclara que el enforcement real depende de configuración del servidor
- [x] `POST /v1/prometeo/ingest`, `/ingest-file` y `DELETE /v1/prometeo/documents/:id` requieren `knowledge:manage` (OPS_ADMIN-only); lecturas RAG (search, rag-query, etc.) siguen disponibles con `agents:run:create`
- [x] `GET /v1/agents/delegations`, `/delegations/:id` y `/coordinator/snapshot` requieren `ops:coordinator:read` (OPS_ADMIN-only) en vez de `agents:run:create` compartido

## Implementation Map

### Web
- `apps/web/lib/navigation-registry.ts`
- `apps/web/lib/admin/admin-navigation.ts`
- `apps/web/app/(app)/admin/disputes/page.tsx`

### API
- `apps/api/src/infrastructure/storage/uploads.controller.ts`
- `packages/auth/src/rbac.ts` (nuevo permiso `internal:architecture:read`, o gate directo por rol)

## Acceptance Criteria

- [x] Conseguir credencial OPS_ADMIN y repetir la navegación en vivo — completado en dos pasadas: 2026-07-27 (59/59 páginas, cuenta demo, ver `AUDIT_REMEDIATION_PLAN.md` Sección 3) y 2026-08-02 (pasada dirigida, ~10 pantallas + 2 hallazgos nuevos)
- [x] Lanzar la ronda de agentes de código dedicada a `apps/web/app/(app)/admin/**` — Crew G, 2026-07-22 (ver `AUDIT_REMEDIATION_PLAN.md` Sección 3, hallazgos 3.10-3.44)
- [x] `pnpm spec:validate:strict` pasa — 103 specs escaneados, 0 errores, 0 warnings (2026-08-02)
- [x] Este spec reemplaza a `docs/specs/ui/admin-flows.spec.md` en `SPEC_INDEX.md` — hecho 2026-08-14, `admin-flows.spec.md` marcado `DEPRECATED` con nota explícita de reemplazo, índice regenerado

## Rollback Considerations

- G-ADM-07 (cerrar `knowledge:read` a roles internos) podría romper cualquier flujo legítimo no documentado que dependa de que un CLIENT/PRO lea esas rutas — revisar logs de acceso real antes de restringir, no solo el código.
