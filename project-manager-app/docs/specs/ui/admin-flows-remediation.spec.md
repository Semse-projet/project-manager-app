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
last_verified: "2026-07-20"
---

# Spec: Admin/OPS UI Flows — Remediation

> **Estado de esta pasada: PARCIAL, código únicamente.** A diferencia de `client-flows-remediation.spec.md` y `pro-flows-remediation.spec.md`, este documento **no tiene ninguna verificación en vivo** — no hubo credencial de `OPS_ADMIN` disponible durante la sesión de auditoría del 2026-07-20. Todo lo que sigue es análisis estático de código, con la misma rigurosidad (archivo:línea) pero sin la confirmación visual que sí se hizo en los otros dos módulos. No promover este spec a `APPROVED` sin completar esa verificación — es justo el tipo de brecha que este mismo proyecto de SDD existe para cerrar.
>
> A diferencia del spec de Cliente y PRO, `docs/specs/ui/admin-flows.spec.md` sí apunta al directorio correcto (`apps/web/app/(app)/admin`) — el problema aquí no es un spec desactualizado de ruta, es que nunca se verificó contra producción.

## Problem Statement

El panel de Admin comparte la causa raíz de estado incorrecto de los otros dos módulos (por lectura de código, sin confirmar en pantalla), y tiene además hallazgos propios de seguridad de acceso: rutas internas de arquitectura del sistema abiertas a cualquier rol, no solo admin, y una escritura de archivos que confía en un header en vez de la sesión real.

## Scope

- In scope: `apps/web/app/(app)/admin/**` (58 páginas), la navegación/registro de módulos admin, y los endpoints internos de arquitectura (anatomy/knowledge/repo-map/runtime-map) que — aunque no viven bajo `/admin/*` en la URL — están pensados para uso interno/operativo.
- Out of scope: los hallazgos de backend puramente transversales (Forge, SSE cross-tenant, pagos) — están en `docs/AUDIT_REMEDIATION_PLAN.md` sección 0, este spec solo referencia los que tienen una superficie de UI/acceso específica de Admin.

## Non-Goals

- Aprobado para la implementación controlada de fixes de UX/UI Admin documentados en `docs/AUDIT_REMEDIATION_PLAN.md` que no toquen dinero, auth ni datos cross-tenant. La verificación en vivo con credencial `OPS_ADMIN` sigue siendo requisito antes de marcar cualquier hallazgo como `VERIFIED`.

## Gaps encontrados (código únicamente — pendiente confirmación en vivo)

### G-ADM-00 — CRÍTICO — Mismo bug de causa raíz que G-CLI-00/G-PRO-00 (sin confirmar en pantalla)
**Archivo:** `apps/web/app/(app)/admin/dashboard/page.tsx` — mismo patrón de comparación de `JobStatus` en minúsculas contra el enum real en mayúsculas (ver `client-flows-remediation.spec.md` G-CLI-00 para el detalle completo del mecanismo).
**Pendiente:** confirmar en pantalla con credencial OPS_ADMIN si el efecto visible es el mismo (KPI en cero) o distinto (Admin podría tener una fuente de datos distinta que compense el bug — no asumir sin verificar).

### G-ADM-01 — ALTO — `/admin/labor-engine` (pantalla insignia) invisible en el propio menú de Admin
**Archivos:** ni `apps/web/lib/navigation-registry.ts` ni `apps/web/lib/admin/admin-navigation.ts` (`ADMIN_MODULES`) incluyen esta ruta. Único camino: una tarjeta enterrada en `/admin/workops`.
**Contradicción documental:** `CLAUDE.md` del repo marca este módulo como "COMPLETE (API + Worker UI + Admin UI)" — la pantalla existe y funciona, pero un admin que escanee el sidebar nunca la encontraría.

### G-ADM-02 — ALTO — Resolución de disputas en Admin: un clic, sin confirmación, notifica de inmediato
**Archivo:** `apps/web/app/(app)/admin/disputes/page.tsx` — `RESOLVE_OPTIONS:658-673`, `handleApprovalDecide:351`.
**Contrato roto:** las cuatro opciones de resolución (favor cliente/favor pro/50-50/escalar) llaman `handleResolve` directo al clic, sin paso de confirmación, y notifican a ambas partes de inmediato. Es una decisión financiera irreversible con cero fricción.

### G-ADM-03 — MEDIO — Falla parcial de carga deja el KPI de costo estimado silenciosamente incompleto
**Archivo:** `apps/web/app/(app)/admin/labor-engine/page.tsx:139-157` — llamadas de tarifas/jobs envueltas en `.catch(() => null)`/`.catch(() => [])`; solo el fallo de `overview` muestra banner de error visible.

### G-ADM-04 — MEDIO — Alertas de QualityGuard son de solo lectura
**Archivo:** `admin/labor-engine/page.tsx:246-267` — sin botón para actuar (forzar corte, marcar entrada, contactar al trabajador) desde la misma pantalla.

### G-ADM-05 — MEDIO — IDs crudos en vez de nombres; ninguna lista de Admin tiene paginación
Verificado en `labor-engine`, `disputes`, `users`. Funciona a escala de demo, se rompe con decenas de timers/registros simultáneos reales.

### G-ADM-06 — MEDIO — Solo 4 de ~55 páginas de Admin usan `ModuleShell`
El resto arma su propio header y breadcrumb a mano — navegación inconsistente entre secciones.

### G-ADM-07 — ALTO (seguridad, superficie relacionada con Admin) — Herramientas internas de arquitectura abiertas a cualquier rol
**Archivos:** `apps/api/src/modules/{anatomy,knowledge,repo-knowledge,runtime-knowledge}/*.controller.ts` — gateadas por `knowledge:read`, permiso que `packages/auth/src/rbac.ts` otorga a **todos los roles** (CLIENT, PRO, WORKER, OPS_ADMIN), no solo interno/admin.
**Impacto:** `/anatomy`, `/knowledge`, `/repo-map`, `/runtime-map` — mapas globales de arquitectura del repo y estado de servicios — son visibles para cualquier cliente o profesional autenticado, no solo para operación interna.
**Contraste (control positivo):** `/admin/product-intelligence` sí está correctamente gateado (`ops:dashboard:read`, solo OPS_ADMIN, más kill switch) — confirma que el patrón correcto ya existe en el propio código, solo falta aplicarlo aquí.

### G-ADM-08 — CRÍTICO (seguridad, superficie usada desde Admin y otros roles) — Un header del cliente decide en qué tenant se escribe un archivo
**Archivo:** `apps/api/src/infrastructure/storage/uploads.controller.ts:174-175,237-238` — el emisor de planes de subida lee `tenantId` de `x-tenant-id` (header del cliente) en vez de `resolveRequestContext(req)`; la ruta de descarga es pública sin firma ni expiración.

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

- [ ] Un actor con rol CLIENT o PRO recibe 403 al intentar `GET /v1/anatomy` o `GET /v1/knowledge` (regresión directa de G-ADM-07)
- [ ] El emisor de planes de subida usa `resolveRequestContext(req)`, no `x-tenant-id` (regresión de G-ADM-08)
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

- [ ] **Bloqueante:** conseguir credencial OPS_ADMIN y repetir la navegación en vivo completa (Dashboard, WorkOps, Trust/Finance, Intelligence/AI, Tool Hub, Verticals — dividir en más de una pasada dado el tamaño, 58 páginas) antes de mover cualquier gap de este documento a `APPROVED`
- [ ] Lanzar la ronda de agentes de código dedicada a `apps/web/app/(app)/admin/**` (la que sí se hizo para Cliente, y parcialmente para PRO)
- [ ] `pnpm spec:validate:strict` pasa
- [ ] Este spec reemplaza a `docs/specs/ui/admin-flows.spec.md` en `SPEC_INDEX.md` solo cuando la verificación en vivo esté completa — hasta entonces, mantener ambos referenciados

## Rollback Considerations

- G-ADM-07 (cerrar `knowledge:read` a roles internos) podría romper cualquier flujo legítimo no documentado que dependa de que un CLIENT/PRO lea esas rutas — revisar logs de acceso real antes de restringir, no solo el código.
