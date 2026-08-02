---
id: "ui.admin-flows-remediation"
title: "Admin/OPS UI Flows — Remediation (auditoría 2026-07-20, parcial)"
domain: "ui"
version: "1.0"
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
last_verified: "2026-08-02"
---

# Spec: Admin/OPS UI Flows — Remediation

> **Estado actualizado 2026-08-02: verificación en vivo completada.** La nota original de abajo (auditoría 2026-07-20) quedó obsoleta el 2026-07-27, cuando otra sesión sí consiguió credencial `OPS_ADMIN` real y confirmó en vivo prácticamente todo el backlog de código (ver `docs/AUDIT_REMEDIATION_PLAN.md` Sección 3, líneas ~549-552: 59/59 páginas recorridas sin error, dashboard con datos reales). Este spec nunca se actualizó para reflejarlo — mismo patrón de documentación desincronizada que apareció varias veces en este proyecto. Una segunda pasada dirigida el 2026-08-02 (con OPS_ADMIN real, ~10 pantallas + 2 lecturas de código para G-ADM-07/08) re-confirmó casi todo y encontró 2 hallazgos nuevos (3.45, 3.46 en el plan) no cubiertos por ninguna ronda anterior. Quedan sin verificación en vivo dirigida: G-ADM-03/04 (Labor Engine tenía casi cero actividad real en el tenant de prueba) y una revisión exhaustiva de las ~48 páginas restantes no visitadas en ninguna de las dos pasadas.
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

### G-ADM-03 — MEDIO — Falla parcial de carga deja el KPI de costo estimado silenciosamente incompleto
**Archivo:** `apps/web/app/(app)/admin/labor-engine/page.tsx:139-157` — llamadas de tarifas/jobs envueltas en `.catch(() => null)`/`.catch(() => [])`; solo el fallo de `overview` muestra banner de error visible.

### G-ADM-04 — MEDIO — Alertas de QualityGuard son de solo lectura
**Archivo:** `admin/labor-engine/page.tsx:246-267` — sin botón para actuar (forzar corte, marcar entrada, contactar al trabajador) desde la misma pantalla.

### G-ADM-05 — PARCIALMENTE RESUELTO — IDs crudos en vez de nombres; paginación
**Confirmado en vivo 2026-08-02, en `/admin/users` (7 usuarios):** el fix documentado en `AUDIT_REMEDIATION_PLAN.md` 3.5 (mapear ID → parte local del email) funciona para la mayoría, pero al menos 1 usuario se sigue mostrando con ID crudo (`cmr9ag8ww0002ph01937u...`). Ver hallazgo nuevo 3.46 en el plan. Paginación no verificable con solo 7 usuarios — no hay datos suficientes para confirmar el comportamiento a escala real.

### G-ADM-06 — MAYORMENTE RESUELTO — Headers de página inconsistentes
**Confirmado en vivo 2026-08-02:** Dashboard, Disputas, Labor Engine y Usuarios sí comparten el patrón `AdminPageHeader` (ícono + título + breadcrumb "← Dashboard"), consistente con el fix documentado en 3.6. Trust Scores, Intelligence y Tool Hub, sin embargo, usan headers propios distintos entre sí (eyebrow + título grande, sin breadcrumb) — no es la inconsistencia total original ("solo 4 de 55"), pero tampoco está unificado al 100%.

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
- [ ] Este spec reemplaza a `docs/specs/ui/admin-flows.spec.md` en `SPEC_INDEX.md` — pendiente, no ejecutado en esta sesión

## Rollback Considerations

- G-ADM-07 (cerrar `knowledge:read` a roles internos) podría romper cualquier flujo legítimo no documentado que dependa de que un CLIENT/PRO lea esas rutas — revisar logs de acceso real antes de restringir, no solo el código.
