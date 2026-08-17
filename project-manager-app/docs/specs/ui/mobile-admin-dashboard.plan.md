---
type: plan
feature: "Mobile Admin Dashboard — Fase 7a de apps/mobile"
domain: "ui"
spec: "docs/specs/ui/mobile-admin-dashboard.spec.md"
version: "1.0"
status: "APPROVED"
branch: "claude/mobile-app-f17ci6"
date: "2026-08-17"
---

# Plan técnico: Mobile Admin Dashboard — Fase 7a de apps/mobile

> Prerrequisito: spec `APPROVED`.

## 1. Snapshot de verdad

- Branch de trabajo (`claude/mobile-app-f17ci6`) es idéntico a `origin/main`
  al iniciar esta sesión (mismo SHA `2538127`) — sin trabajo pendiente sin
  commitear, sin PR abierto para esta rama.
- `docs/SPEC_INDEX.md` confirma Fase 1 (Worker) y Fase 2 (Client) ya en
  código en `main`; `ui.mobile-client-tab` figura `merge_status: UNMERGED`
  en su frontmatter pero el código ya está en `main` — metadata desactualizada
  de una sesión anterior, no bloquea este plan (no se corrige aquí, fuera de
  alcance).
- **Estado de servicios:** no verificado en esta sesión — no aplica, esta
  fase no toca `apps/api`/`apps/web`/`apps/worker`.
- **Drift:** `AdminDashboardScreen.tsx` + `AdminDashboardScreen.test.tsx` ya
  existen en `main` (PR #550) pero no están importados por ningún navigator
  — confirmado por grep, único uso es el propio archivo de test.

## 2. Constitution check

- [x] Spec aprobado antes de código — este documento se escribe con spec ya
      `APPROVED` en su frontmatter.
- [x] Tenant/org/ownership y RBAC definidos — spec §3, `jobs:read` ya
      otorgado a `OPS_ADMIN` en `packages/db/prisma/seed.ts:74-98`.
- [x] Evidence/Payment Governance revisados — no aplica, cero endpoints de
      evidencia o pago tocados.
- [x] Audit/events definidos — no aplica, lectura pura + logout existente.
- [x] Tests preceden implementación — `AdminSettingsScreen.test.tsx` se
      escribe junto con el componente (mismo patrón ya usado para
      `ClientSettingsScreen`, que tampoco tiene test dedicado por ser un
      wrapper trivial de `logout()` — se decide caso por caso en Fase A).
- [x] No se expone secreto ni se agrega backend paralelo.
- [x] Código, CI, merge, deploy y activación se miden por separado.

## 3. Arquitectura y autoridad

- **Módulos afectados (API):** ninguno.
- **Contratos Zod:** ninguno nuevo — se reusa `JobRecordView` ya existente.
- **API/BFF/UI:** solo UI, mismo patrón sin-BFF que el resto de `apps/mobile`.
- **ADR requerido:** no — replica el patrón ya establecido por
  `ClientTabNavigator`/`ClientSettingsScreen`.

## 4. Datos y migración

No aplica.

## 5. Seguridad y política

- **Permisos:** `jobs:read`, ya otorgado a `OPS_ADMIN`. Sin permisos nuevos.
- **Tenant/org/resource scope:** delegado 100% al backend existente.
- **Abuse cases:** ninguno nuevo — superficie es de solo lectura + logout.

## 6. Eventos, idempotencia y reconstrucción

No aplica.

## 7. Estrategia de implementación

### Fase A — Tests y contratos

- `AdminSettingsScreen.test.tsx`: confirma que tocar "Cerrar sesión" invoca
  `useAuth().logout`, mock de `AuthContext` (mismo patrón que otros tests
  de screens que consumen `useAuth`).

### Fase B — Datos y dominio

No aplica.

### Fase C — API/BFF/UI

- `src/screens/admin/AdminSettingsScreen.tsx` — nuevo, copia el patrón de
  `ClientSettingsScreen.tsx` (logout-only).
- `src/navigation/AdminTabNavigator.tsx` — reemplazar `AdminHomeScreen`
  stub por `Tab.Navigator` con `Dashboard` (→ `AdminDashboardScreen`) y
  `Settings` (→ `AdminSettingsScreen`).
- `src/navigation/types.ts` — `AdminTabParamList` pasa de `{ AdminHome:
  undefined }` a `{ Dashboard: undefined; Settings: undefined }`.
- `src/navigation/RoleGate.tsx` — actualizar comentario de
  `TARGET_PRIORITY` (Admin ya no es "placeholder" sin matices).
- `apps/mobile/README.md` — actualizar sección Admin.

### Fase D — Verificación local

- `pnpm --filter @semse/mobile test` — suite completa.
- `pnpm --filter @semse/mobile check` (`tsc --noEmit`).
- `pnpm spec:validate:strict`, `pnpm spec:index`.

### Fase E — Integración

- PR con: código + tests + spec/plan/tasks/checklist actualizados + README.

### Fase F — Producción

- Sin servicio backend que desplegar — build EAS `preview` + smoke manual
  con cuenta `OPS_ADMIN` real, mismo estándar que Worker/Client.
- **Rollback:** no promover el build `preview` a `production` hasta smoke
  manual confirmado; sin flag que revertir.

## 8. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación | Señal de rollback |
|---|---|---|---|---|
| Renombrar la ruta `AdminHome` → `Dashboard` rompe algún deep-link/test existente que asuma el nombre viejo | baja | bajo | grep confirmó cero referencias a `"AdminHome"` fuera de `types.ts`/`AdminTabNavigator.tsx` antes de renombrar | Fallo de tsc/test tras el rename |
| Confundir este scope acotado con el resto de Fase 7 (contractors/finance/disputes) | media | medio | Este plan solo cubre lo listado en spec §2 "Incluido"; cualquier pantalla de negocio nueva necesita su propio spec | PR que toca `disputes`/`finance`/`contractors` bajo este cambio → rechazar en review |

## 9. Investigación externa

No aplica.

## 10. Gates antes de tareas

- [x] Archivos exactos identificados (§7 Fase C)
- [x] Migración y rollback definidos — N/A, documentado
- [x] Tests ordenados antes del código (Fase A antes de Fase C)
- [x] Canary/feature flag definidos — sin flag; canary = build EAS preview + smoke manual
- [x] Evidencia requerida para cada estado de entrega
- [x] Scope cabe en un PR reversible — solo `apps/mobile` + docs, revertible con `git revert`
