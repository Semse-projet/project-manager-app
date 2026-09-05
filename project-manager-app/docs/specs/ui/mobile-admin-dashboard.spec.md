---
id: "ui.mobile-admin-dashboard"
title: "Mobile Admin Dashboard — Fase 7a de apps/mobile"
domain: "ui"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "low"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/mobile/src/navigation/AdminTabNavigator.tsx
  - apps/mobile/src/navigation/RoleGate.tsx
  - apps/mobile/src/navigation/types.ts
  - apps/mobile/src/screens/admin/AdminDashboardScreen.tsx
  - apps/mobile/src/screens/admin/AdminSettingsScreen.tsx
  - apps/mobile/src/api/jobs.ts
  - apps/mobile/src/context/AuthContext.tsx
related_tests:
  - apps/mobile/src/screens/admin/AdminDashboardScreen.test.tsx
  - apps/mobile/src/screens/admin/AdminSettingsScreen.test.tsx
related_endpoints:
  - v1/jobs
related_events: []
related_agents: []
last_verified: "2026-08-17"
---

# Spec: Mobile Admin Dashboard — Fase 7a de `apps/mobile`

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

## 1. Problema y resultado

**Para quién:** usuarios con rol `OPS_ADMIN` que usan `apps/mobile`.

**Problema:** `AdminTabNavigator` es un stub de una sola pantalla
(`AdminHomeScreen`, texto fijo "La app de Admin todavía se está
construyendo.") — un usuario `OPS_ADMIN` que abre la app no puede ver nada
útil, ni siquiera cerrar sesión desde ese tab. Mientras tanto,
`AdminDashboardScreen.tsx` (jobs activos, en disputa, completados, total,
presupuesto activo, alertas de disputa — un `GET /v1/jobs` client-side
derivado, espejo del dashboard de `apps/web/app/(app)/admin/dashboard`) y su
test (`AdminDashboardScreen.test.tsx`, 2 casos, ambos verdes) ya existen en
el árbol desde PR #550 pero **no están montados en ningún navigator** —
código completo y probado, simplemente huérfano.

**Resultado esperado:** un usuario `OPS_ADMIN` autenticado en `apps/mobile`
ve, sin salir de la app, un tab `Dashboard` con el resumen de jobs ya
construido, y un tab `Settings` para cerrar sesión (hoy no existe ninguna
forma de logout para este rol en mobile). No se agrega ninguna pantalla
nueva de negocio — solo se conecta lo que ya existe y se cierra el gap de
logout.

## 2. Alcance

### Incluido

- Montar `AdminDashboardScreen` (ya existente, ya probado, sin cambios de
  lógica) como tab `Dashboard` de un `AdminTabNavigator` real
  (`createBottomTabNavigator`), reemplazando el placeholder `AdminHomeScreen`.
- `AdminSettingsScreen` nuevo — únicamente logout, mismo patrón mínimo que
  `ClientSettingsScreen.tsx` (`apps/mobile/src/screens/client/ClientSettingsScreen.tsx`).
  No es una réplica de `SettingsScreen` (Worker), que es 100%
  `proximityCheckInMode` y no aplica a Admin, igual que ya no aplica a Client.
- `AdminTabParamList` (`src/navigation/types.ts`) actualizado: `AdminHome`
  (nombre existente, mal etiquetado ya que deja de ser un home genérico) se
  reemplaza por `Dashboard: undefined` + `Settings: undefined`.
- `RoleGate.tsx`: comentario de `TARGET_PRIORITY` corregido (Admin deja de
  ser "placeholder" sin matices — pasa a "dashboard real, resto de Fase 7
  pendiente").
- `apps/mobile/README.md`: sección "Admin tab is still a placeholder"
  actualizada para reflejar que el dashboard + logout ya existen, y que el
  resto de Fase 7 (contractors, finance, disputes management, labor-engine
  overview) sigue pendiente.

### Fuera de alcance

- **Gestión de contractors, finance, disputes (acciones, no solo lectura),
  labor-engine overview** — resto de Fase 7 (ver comentario original de
  `AdminTabNavigator.tsx`), cada uno necesita su propio spec por el volumen
  de superficie y, en el caso de finance/disputes, revisión de
  `paymentGovernance`/`disputes:resolve` dedicada.
- **Cualquier acción de escritura desde Admin mobile** (`ops:dashboard:write`,
  `disputes:resolve`, `users:status:update`, etc.) — este spec es
  estrictamente de lectura (mismo único endpoint `GET /v1/jobs` que ya
  consume Worker/Client) más logout. `OPS_ADMIN` tiene permisos de escritura
  amplios en `packages/db/prisma/seed.ts` (`disputes:resolve`,
  `projects:financials:write`, `ops:dashboard:write`, `users:status:update`,
  etc.) — ninguno de esos endpoints se toca aquí.
- **Modificar `AdminDashboardScreen.tsx` en sí** — se monta tal cual existe;
  cualquier cambio de UI/lógica al dashboard es un spec aparte.
- **Cambiar permisos de `OPS_ADMIN`** en `packages/db/prisma/seed.ts` — no
  se necesita ninguno nuevo (`jobs:read` ya está otorgado).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` | `jobs:read` | ya otorgado, sin scoping adicional por tenant en el service (`JobsService.list`) | Ver el dashboard agregado de jobs | Ver datos de finance/disputes (no se leen en esta fase) |

- **Tenant/org boundary:** idéntico al resto de `/v1` —
  `resolveRequestContext` inyecta `tenantId`/`orgId` del token de sesión;
  sin cambios aquí, se reusa `fetchJobsList` (`src/api/jobs.ts`) tal cual.
- **Ownership/resource policy:** sin cambios — `AdminDashboardScreen` ya
  hace exactamente lo mismo que hace hoy contra el mismo endpoint que Worker
  y Client ya consumen.
- **Step-up o aprobación humana:** ninguna — solo lectura + logout.
- **Datos `privacyCritical`:** ninguno.
- **Auditoría:** ninguna nueva — `GET /v1/jobs` no emite `AuditLog` (es una
  lectura), logout ya usa el flujo existente de `AuthContext.logout()`
  (mismo que Worker/Client).

## 4. Escenarios y criterios de aceptación

### P1 — Ver el dashboard

```gherkin
DADO un usuario OPS_ADMIN autenticado en apps/mobile
CUANDO abre el tab Dashboard
ENTONCES ve las 4 stat cards (activos/disputa/completados/total),
  presupuesto activo, y alertas de disputa (GET /v1/jobs, ya cubierto por
  AdminDashboardScreen.test.tsx)
```

### P2 — Cerrar sesión

```gherkin
DADO un usuario OPS_ADMIN autenticado en apps/mobile
CUANDO abre el tab Settings y toca "Cerrar sesión"
ENTONCES AuthContext.logout() se ejecuta y el usuario vuelve a LoginScreen
  (mismo comportamiento ya verificado para Worker/Client)
```

Casos borde:

- [ ] `GET /v1/jobs` falla (network/5xx) — `AdminDashboardScreen` ya
      maneja esto con su propio `error` state (ver componente); no hay
      trabajo nuevo aquí, solo confirmar que sigue así montado en el tab.
- [ ] Usuario con `OPS_ADMIN` y otro rol simultáneo — el switcher de
      `RoleGate` ya existe; sin comportamiento nuevo que verificar más allá
      de que el nombre de ruta (`Dashboard` en vez de `AdminHome`) no rompa
      el switcher (no depende del nombre de ruta, solo de `RoleTarget`).

## 5. Contratos

Ningún contrato nuevo — se reusa `GET /v1/jobs` tal cual ya está definido
para Worker/Client (`apps/api/src/modules/jobs/jobs.controller.ts`,
`packages/schemas/src/job.schema.ts` vía `JobRecordView`).

### UI

```yaml
surfaces:
  - apps/mobile AdminTabNavigator (bottom tabs: Dashboard, Settings)
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - Reusado AdminDashboardScreen.tsx tal cual (sin cambios de lógica)
  - Nuevo AdminSettingsScreen.tsx, mismo patrón mínimo que ClientSettingsScreen.tsx
  - src/navigation/types.ts: AdminTabParamList.AdminHome -> Dashboard + Settings
  - RoleGate.tsx: comentario de TARGET_PRIORITY actualizado
  - apps/mobile/README.md actualizado
```

### Agente/Prometeo

No aplica.

## 6. FSM, eventos y reconstrucción

No aplica — sin transiciones de estado nuevas, sin eventos nuevos (lectura
pura + logout ya existente).

## 7. Datos y migración

No aplica — sin modelos Prisma nuevos, sin migración.

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna nueva — mismo endpoint ya monitoreado.
- **Feature flags:** ninguno.
- **Plan de canary:** build interno (`eas build --profile preview`) —
  misma limitación ya documentada en `apps/mobile/README.md` (sandbox sin
  Xcode/Android SDK/simulator).
- **Evidencia de producción requerida:** run real en device/simulador con
  una cuenta `OPS_ADMIN` real antes de `VERIFIED`, mismo estándar que Worker
  y Client.
- **Owner operativo:** `semse-core`.

## 9. Tests requeridos

- [x] `AdminDashboardScreen.test.tsx` — ya existe, ya verde, sin cambios.
- [ ] `AdminSettingsScreen.test.tsx` — nuevo, mismo patrón que el test de
      `ClientSettingsScreen` si existe uno equivalente, si no, un test mínimo
      que confirme que tocar "Cerrar sesión" llama `logout()`.
- [ ] `pnpm --filter @semse/mobile test` verde, sin regresiones.
- [ ] `pnpm --filter @semse/mobile check` (`tsc --noEmit`) limpio.
- [ ] Canary/smoke autenticado en producción antes de marcar `VERIFIED`.

## 10. Mapa de implementación

### Mobile (`apps/mobile`)

- `src/navigation/AdminTabNavigator.tsx` — reemplazar el stub por tabs
  reales (Dashboard, Settings).
- `src/screens/admin/AdminSettingsScreen.tsx` — nuevo.
- `src/navigation/types.ts` — `AdminTabParamList` actualizado.
- `src/navigation/RoleGate.tsx` — comentario actualizado.
- `apps/mobile/README.md` — sección Admin actualizada.

### Tests

- `apps/mobile/src/screens/admin/AdminSettingsScreen.test.tsx` — nuevo.

## 11. Investigación externa

No aplica — reusa componentes y patrones 100% internos ya existentes.

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED` (build EAS)
- [ ] Activación/canary verificada por separado (build real en device/simulador)
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
