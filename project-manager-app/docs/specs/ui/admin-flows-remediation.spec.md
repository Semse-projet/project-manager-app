---
id: "ui.admin-flows-remediation"
title: "Admin/OPS UI Flows — Remediation (auditoría 2026-07-20, parcial)"
domain: "ui"
version: "1.5"
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
  - apps/web/app/(app)/admin/compliance/page.tsx
  - apps/web/lib/admin/compliance-checks.ts
  - apps/web/lib/navigation-registry.ts
  - apps/web/lib/admin/admin-navigation.ts
  - apps/web/middleware.ts
  - apps/web/app/api/semse/_server.ts
  - apps/api/src/infrastructure/storage/uploads.controller.ts
  - apps/api/src/modules/governance/governance.controller.ts
  - apps/api/src/modules/governance/governance.service.ts
  - apps/web/app/api/semse/governance
  - apps/api/src/modules/anatomy
  - apps/api/src/modules/knowledge
  - apps/api/src/modules/repo-knowledge
  - apps/api/src/modules/runtime-knowledge
  - packages/auth/src/rbac.ts
related_tests:
  - apps/api/test/domain-rbac-permissions.test.ts
  - apps/api/test/uploads.controller.test.ts
  - apps/api/test/governance.controller.test.ts
  - apps/api/test/governance.service.test.ts
  - tests/unit/auth.test.ts
  - tests/unit/governance-tenant-boundary.test.ts
  - tests/unit/internal-architecture-boundary.test.ts
  - tests/unit/admin-compliance-checks.test.ts
related_endpoints:
  - v1/uploads/plan
  - v1/anatomy
  - v1/knowledge
  - v1/governance
related_events: []
related_agents: []
last_verified: "2026-07-25"
---

# Spec: Admin/OPS UI Flows — Remediation

> **Límite de aprobación v1.2.** El análisis estático y los contratos explícitos
> autorizan fixes correctivos acotados, por eso el estado es `APPROVED`. La
> ausencia de credencial `OPS_ADMIN` bloquea elevarlo a `VERIFIED`, no su
> aprobación. Dinero, auth, cross-tenant, verificación y Travel requieren
> además la spec API del bounded context indicada en
> `governance.audit-remediation-program`.
>
> A diferencia del spec de Cliente y PRO, `docs/specs/ui/admin-flows.spec.md` sí apunta al directorio correcto (`apps/web/app/(app)/admin`) — el problema aquí no es un spec desactualizado de ruta, es que nunca se verificó contra producción.

## Problem Statement

El panel de Admin comparte la causa raíz de estado incorrecto de los otros dos módulos (por lectura de código, sin confirmar en pantalla), y tiene además hallazgos propios de seguridad de acceso: rutas internas de arquitectura del sistema abiertas a cualquier rol, escrituras de archivos que confiaban en un header y Governance que aceptaba tenant/actor del cliente o consultaba propuestas solo por ID.

## Scope

- In scope: `apps/web/app/(app)/admin/**` (58 páginas), la navegación/registro de módulos admin, Governance y los endpoints internos de arquitectura (anatomy/knowledge/repo-map/runtime-map) que — aunque no viven bajo `/admin/*` en la URL — están pensados para uso interno/operativo.
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

**Cierre local (2026-07-23):** `internal:architecture:read` quedó exclusivo de
OPS_ADMIN; controllers, las 18 rutas BFF y las cuatro páginas aplican el mismo
boundary sin fallback a identidad estática. Falta confirmación en vivo con las
cuatro clases de sesión.

### G-ADM-08 — CRÍTICO (seguridad, superficie usada desde Admin y otros roles) — Un header del cliente decide en qué tenant se escribe un archivo
**Archivo:** `apps/api/src/infrastructure/storage/uploads.controller.ts:174-175,237-238` — el emisor de planes de subida lee `tenantId` de `x-tenant-id` (header del cliente) en vez de `resolveRequestContext(req)`; la ruta de descarga es pública sin firma ni expiración.

**Cierre local:** el emisor usa `resolveRequestContext(req).tenantId`; la
regresión del controller confirma que un header falsificado no decide el
tenant. La política separada de descarga pública no se altera con este cierre.

### G-ADM-09 — CRÍTICO — Governance permitía lectura y escritura cross-tenant

**Causa raíz:** create/vote aceptaban `tenantId` del body, list/credits lo
aceptaban del query y detail/results/close buscaban propuestas solo por ID. Un
OPS_ADMIN de un tenant podía operar otro tenant y crear un voto cuyo tenant no
coincidía con el de la propuesta.

**Cierre local (plan 3.10b):** controller deriva tenant/actor exclusivamente de
la sesión; service acota propuesta y votos por `{id, tenantId}`, persiste el
tenant de la propuesta y cierra con update condicionado por tenant+estado. Las
cinco rutas BFF usan identidad autenticada sin fallback. Contrato primario:
`api.governance-tenant-boundary`.

**Follow-up v1.4:** `_count.votes` también filtra por tenant; votar y cerrar
comparten un row lock transaccional antes de insertar o contar; el duplicate
vote responde 409. RBAC usa permisos dedicados por acción y reserva
`governance:close` para OPS_ADMIN.

### G-ADM-10 — ALTO — Compliance declaraba verde ante fuentes caídas

`/admin/compliance` convertía cada error de jobs, disputas, organizaciones,
reseñas o viajes en `[]`. Los conteos cero resultantes producían “Cumple” y una
tasa general válida sin datos. La identidad cubría solo cinco organizaciones y
dos obligaciones manuales se presentaban con fechas hardcodeadas sin una fuente
regulatoria/fiscal.

**Cierre local v1.5 (plan 3.45):** cada fuente conserva disponibilidad; sus
fallos producen `pending`, copy “No se asume cumplimiento”, un banner de
incompletitud y tasa no verificable. Se consultan todas las organizaciones y
cualquier fallo parcial de membresía bloquea el verde. Los dos controles sin
integración se etiquetan como revisión manual y no inventan fechas.

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
  - Ninguna resolución de disputa ejecuta sin confirmación explícita
  - Todo módulo "COMPLETE" según CLAUDE.md debe ser alcanzable desde el sidebar de Admin
  - Governance nunca permite elegir tenant o actor desde body/query y un ID foráneo responde como no encontrado
  - Un fallo de fuente en Compliance nunca se presenta como control cumplido ni produce una tasa verde
```

## Security / RBAC

- G-ADM-07, G-ADM-08 y G-ADM-09 son fugas de control de acceso reales, no solo gaps de UX.
- Antes de `VERIFIED`: confirmar con una sesión OPS_ADMIN real si existe alguna ruta de mitigación o divergencia no visible en el análisis estático.

## Tests Required

- [x] CLIENT, PRO y WORKER reciben 403 en anatomy/repo/runtime y en
  `knowledge/domains|overview`; OPS_ADMIN pasa. Las 18 rutas BFF internas usan
  identidad de sesión sin fallback estático y las cuatro páginas top-level son
  admin-only (regresión directa de G-ADM-07)
- [x] El emisor de planes de subida usa `resolveRequestContext(req)`, no `x-tenant-id` (regresión de G-ADM-08)
- [x] Governance deriva tenant/actor de sesión, filtra votos/conteos por tenant, serializa vote/close, aplica RBAC por acción y usa BFF sin fallback (regresión de G-ADM-09/3.10b)
- [x] Resolver una disputa desde Admin requiere un paso de confirmación explícito antes de notificar a las partes
- [x] `/admin/labor-engine` aparece en `ADMIN_MODULES` o `navigation-registry.ts`
- [x] Las alertas QualityGuard en `/admin/labor-engine` muestran un acción visible (perfil del worker; pausar/detener timers olvidados) y confirman antes de mutar
- [x] `/admin/labor-engine`, `/admin/disputes` y `/admin/users` reemplazan IDs crudos por nombres legibles y paginan listas largas
- [x] `/admin/labor-engine`, `/admin/disputes`, `/admin/users`, `/admin/settings`, `/admin/coordinator`, `/admin/field-ops`, `/admin/change-orders`, `/admin/contractors`, `/admin/agents`, `/admin/qa`, `/admin/reports`, `/admin/dashboard`, `/admin/compliance`, `/admin/travel`, `/admin/memory`, `/admin/algorithm-engine`, `/admin/prometeo`, `/admin/ai-mission-control`, `/admin/trust`, `/admin/reputation`, `/admin/governance`, `/admin/marketplace`, `/admin/ecosystem`, `/admin/tools`, `/admin/worker`, `/admin/browser-agent`, `/admin/verticals/construction`, `/admin/llm-metrics`, `/admin/jobs`, `/admin/intelligence-rooms`, `/admin/pmo`, `/admin/product-intelligence`, `/admin/ops/loops`, `/admin/verticals/maintenance`, `/admin/verticals/cleaning`, `/admin/verticals/agro`, `/admin/html-in-canvas`, `/admin/browser-agent/missions`, `/admin/users/[id]`, `/admin/trust/worker-applications`, `/admin/verticals/vision`, `/admin/developer-runtime`, `/admin/finance`, `/admin/consciousness`, `/admin/vision`, `/admin/mission-control`, `/admin/travel/[travelId]`, `/admin/autonomy`, `/admin/communications`, `/admin/domain-events`, `/admin/ops`, `/admin/jobs/[jobId]` y `/admin/intelligence-rooms/[id]` usan un `AdminPageHeader` compartido en vez de header propio
- [x] `/admin/semse-x` conserva su logo de sidebar custom por diseño de interfaz inmersiva; no es un header de página y queda fuera del scope de `AdminPageHeader`
- [x] `/admin/settings` persiste los ajustes en `TenantSettings` (`GET/PUT /v1/admin/settings` + BFF `/api/semse/admin/settings`) y muestra honestamente el estado de guardado/errores; los toggles de MFA/session log/integraciones incluyen texto que aclara que el enforcement real depende de configuración del servidor
- [x] `POST /v1/prometeo/ingest`, `/ingest-file` y `DELETE /v1/prometeo/documents/:id` requieren `knowledge:manage` (OPS_ADMIN-only); lecturas RAG (search, rag-query, etc.) siguen disponibles con `agents:run:create`
- [x] `GET /v1/agents/delegations`, `/delegations/:id` y `/coordinator/snapshot` requieren `ops:coordinator:read` (OPS_ADMIN-only) en vez de `agents:run:create` compartido
- [x] `/admin/compliance` distingue fuente vacía de fuente caída, falla cerrado a `pending`, consulta todas las organizaciones y etiqueta controles manuales sin fechas inventadas

## Implementation Map

### Web
- `apps/web/lib/navigation-registry.ts`
- `apps/web/lib/admin/admin-navigation.ts`
- `apps/web/middleware.ts`
- `apps/web/app/api/semse/{anatomy,knowledge,repo-knowledge,runtime-knowledge}`
- `apps/web/app/api/semse/_server.ts`
- `apps/web/app/(app)/admin/disputes/page.tsx`
- `apps/web/app/(app)/admin/compliance/page.tsx`
- `apps/web/lib/admin/compliance-checks.ts`
- `apps/web/app/api/semse/governance`

### API
- `apps/api/src/infrastructure/storage/uploads.controller.ts`
- `apps/api/src/modules/governance/governance.controller.ts`
- `apps/api/src/modules/governance/governance.service.ts`
- `packages/auth/src/rbac.ts` (`internal:architecture:read` y `governance:close`, OPS_ADMIN-only)
- `apps/api/src/modules/{anatomy,knowledge,repo-knowledge,runtime-knowledge}`

## Acceptance Criteria

- [ ] **Bloqueante para `VERIFIED`:** conseguir credencial OPS_ADMIN y repetir la navegación completa.
- [x] La ronda estática dedicada a `apps/web/app/(app)/admin/**` quedó documentada en la sección 3 del plan.
- [x] El seguimiento 3.45 impide estados falsamente verdes en Compliance con regresión unitaria.
- [x] `node scripts/spec-validate.mjs --strict` pasa.
- [x] Este spec y `docs/specs/ui/admin-flows.spec.md` permanecen referenciados; el anterior no se elimina hasta completar verificación en vivo.

## Rollback Considerations

- G-ADM-07 mantiene `knowledge:read` para workspace memory y skills; solo los
  mapas/overview de arquitectura usan el permiso interno. Un rollback no puede
  reabrirlos ni restaurar el fallback BFF a identidad estática.
- G-ADM-09 depende de scoping API y BFF estricto; no se debe revertir una sola
  capa y asumir que la otra sustituye el boundary completo.
