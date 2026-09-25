---
id: "ui.admin-modular-navigation"
title: "Admin Modular Navigation (SDD Kit Epic A/B/C)"
domain: "ui"
sdd_version: "2.0"
version: "1.0"
status: "VERIFIED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "PASS"
merge_status: "MERGED"
deploy_status: "DEPLOYED"
activation_status: "ACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence:
  - "2026-08-02: sidebar de Admin en producción (app.semseproject.com, sesión OPS_ADMIN real) confirmado como lista plana de 9 módulos + 5 quick-links, sin headers de grupo — visto en /admin/settings, /admin/disputes y /admin/users tras el deploy de PR #513 (commit adbb6716)."
related_files:
  - apps/web/lib/admin/admin-navigation.ts
  - apps/web/app/(app)/layout.tsx
  - apps/web/lib/navigation-shell.ts
  - apps/web/components/admin/module-shell.tsx
  - apps/web/components/admin/context-bridge-panel.tsx
  - apps/web/app/(app)/admin/mission-control/page.tsx
  - apps/web/app/(app)/admin/workops/page.tsx
  - apps/web/app/(app)/admin/intelligence/page.tsx
  - apps/web/app/(app)/admin/tool-hub/page.tsx
  - apps/web/app/(app)/admin/verticals/page.tsx
related_tests:
  - tests/unit/navigation-shell.test.ts
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-08-02"
---

# Spec: Admin Modular Navigation

> Documenta, contra el estado real del repo, el backlog de
> `.semse-sdd/phase_2_execution/backlog/00_master_backlog.md` (Epics A, B, C
> del kit de rediseño de nav de Admin). El checklist de
> `.semse-sdd/phase_2_execution/checklist_phase2_done.md` decía 0/15 antes de
> este spec — desactualizado: casi todo ya estaba construido.

## 1. Problema y resultado

**Para quién:** operadores/admins de SEMSE (rol `admin` en
`apps/web/app/(app)/layout.tsx`).

**Problema:** el Admin tenía dos catálogos de navegación que no coincidían.
`apps/web/lib/admin/admin-navigation.ts` (`ADMIN_MODULES`) definía 9 módulos
con sus rutas hijas y alimentaba las páginas hub (`/admin/workops`, etc.),
pero el sidebar real (`NAV.admin.items` en `layout.tsx`) seguía siendo una
lista de 18 rutas curada a mano por separado, agrupada en 6 buckets vía
`buildAdminSidebarGroups()`/`adminGroupForHref()`
(`apps/web/lib/navigation-shell.ts`) — un sistema de agrupación por `href`
sin relación con `ADMIN_MODULES`.

**Resultado esperado:** el sidebar de Admin deriva su contenido de
`ADMIN_MODULES` — una sola fuente de verdad, coherente con lo que ya
muestran las páginas hub.

## 2. Alcance

### Incluido (este cambio)

- Epic A1 (Navegación centralizada): el sidebar de Admin (`Sidebar` mobile y
  `AppShell` desktop en `layout.tsx`) ahora renderiza una lista plana de 9
  ítems derivados de `ADMIN_MODULES` + 5 quick-links para rutas que
  `ADMIN_MODULES` no cubre (`/admin/account`, `/agro`, `/buildops`, `/tools`,
  `/agents`).
- Retiro de `buildAdminSidebarGroups()`/`adminGroupForHref()`/
  `ADMIN_GROUP_ORDER` de `navigation-shell.ts` (sin más callers) y
  simplificación de `buildShellNavItems()` a un único camino (antes tenía un
  branch separado para `role === "admin"`).
- `tests/unit/navigation-shell.test.ts` actualizado para reflejar que admin
  ahora es una lista plana (`ShellNavLink[]`), no grupos.

### Ya implementado antes de este cambio (Epic A2/A3/B/C — documentado aquí, no tocado)

- A2 — Mission Control como home: `/admin/mission-control` ya muestra los
  módulos principales.
- A3 — Hubs de módulo: `/admin/workops`, `/admin/intelligence`,
  `/admin/tool-hub`, `/admin/verticals` ya existen, renderizan vía
  `ModuleShell` y muestran los `children` de su módulo como cards.
- B1 — External Apps Grid: el Tool Hub ya tiene su grid de 9 herramientas.
- B2 — Context Bridge: `context-bridge-panel.tsx` ya implementado.
- C1 — Sidebar colapsado: ya funcionaba (persistido en `localStorage`),
  validado que sigue funcionando con la nueva lista plana.
- C2 — Mobile fallback: los hubs ya eran responsive antes de este cambio.

### Fuera de alcance, marcado a propósito

- **`apps/web/lib/navigation-registry.ts`** (871 líneas, `navigationRegistry`
  con `layer`/`os`/`roles`/`owner`/`status` por nodo) es un **tercer** sistema
  de navegación, con su propio esquema `os` (`mission-control`/`operations`/
  `marketplace`/`governance`/`ai`/`system` — el mismo vocabulario que el
  `adminGroupForHref` retirado). No se importa desde ningún código de
  producción (confirmado por grep, solo lo usa su propio test
  `navigation-registry.test.ts`). No se consolida en este cambio — queda como
  hallazgo para una sesión futura con alcance propio.
- **Fusión de los 2 renderers JSX restantes** (`Sidebar` inline vs. `AppShell`
  Tailwind) — sigue diferida por la misma razón ya documentada en
  `AUDIT_REMEDIATION_PLAN.md` 1.17 (riesgo de romper el navbar de los 3 roles
  sin QA visual automatizada). Este cambio reduce la duplicación de 3
  renderers a 2 (admin ahora comparte el renderer plano de worker/client) sin
  intentar la fusión final.
- **Cambio de UX aceptado explícitamente:** rutas que antes eran 1 clic desde
  el sidebar (Jobs, Users, Contractors, Change Orders, Disputes, Agents,
  etc.) pasan a 2 clics vía las cards de la página hub de su módulo. Decisión
  de producto confirmada antes de implementar este cambio.

## 3. Actores, permisos y límites

Sin cambios de permisos — este spec es puramente de navegación/UI dentro del
layout ya protegido por `middleware.ts` para rutas `/admin/*` (rol `admin`).

## 4. Escenarios y criterios de aceptación

- DADO un usuario con rol `admin`, CUANDO carga cualquier ruta `/admin/*`,
  ENTONCES el sidebar muestra los 9 módulos de `ADMIN_MODULES` + 5
  quick-links, sin headers de grupo, igual en mobile y desktop.
- DADO un admin en `/admin/workops`, CUANDO mira el sidebar, ENTONCES el
  ítem "WorkOps" está resaltado como activo (`pathname.startsWith(item.href)`).
- DADO un admin que necesita una ruta legacy como `/admin/jobs`, CUANDO no
  la encuentra en el sidebar, ENTONCES la encuentra como card dentro del hub
  "WorkOps" (`/admin/workops`).

## 9. Tests requeridos

- [x] `tests/unit/navigation-shell.test.ts` — `buildShellNavItems({ role: "admin", ... })` devuelve una lista plana de `ShellNavLink[]`, mismo shape que worker/client.
- [x] Verificación visual en vivo del sidebar de Admin en producción
      (2026-08-02, sesión OPS_ADMIN real vía app.semseproject.com, no
      Playwright/local) — confirmado el sidebar plano de 9 módulos sin
      headers de grupo, en varias rutas de Admin distintas.

## 10. Mapa de implementación

### Web

- `apps/web/app/(app)/layout.tsx` — `ADMIN_NAV_ITEMS` derivado de
  `ADMIN_MODULES`, ambos renderers (`Sidebar`, `AppShell`) simplificados a un
  único camino sin branch admin.
- `apps/web/lib/navigation-shell.ts` — retiro de `buildAdminSidebarGroups`/
  `adminGroupForHref`/`ADMIN_GROUP_ORDER`/`AdminNavGroup`; `buildShellNavItems`
  simplificado a un solo camino.

### Tests

- `tests/unit/navigation-shell.test.ts`

## 12. Gates de cierre

- [x] Spec enlazado por `pnpm spec:index`
- [x] `pnpm test:unit` (suite completa) verde
- [x] TypeScript (`apps/web`) sin errores nuevos
- [x] Build web (`next build`) limpio
- [x] Verificación visual en vivo — ver sección 9
- [x] PR fusionado y SHA registrado — PR #513, commit `adbb6716874f30eaef03f2f20ecbbca068835cba`
- [x] `status: VERIFIED`
