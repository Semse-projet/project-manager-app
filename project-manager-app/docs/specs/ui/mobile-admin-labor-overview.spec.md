---
id: "ui.mobile-admin-labor-overview"
title: "Mobile Admin Labor Engine Overview — Fase 7c de apps/mobile"
domain: "ui"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
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
  - apps/mobile/src/navigation/types.ts
  - apps/mobile/src/screens/admin/AdminLaborOverviewScreen.tsx
  - apps/mobile/src/api/labor.ts
  - apps/api/src/modules/labor-engine/labor-engine.controller.ts
  - apps/api/src/modules/labor-engine/labor-engine.service.ts
  - packages/schemas/src/labor-engine.schema.ts
related_tests:
  - apps/mobile/src/screens/admin/AdminLaborOverviewScreen.test.tsx
related_endpoints:
  - v1/labor/admin/overview
related_events: []
related_agents: []
last_verified: "2026-08-19"
---

# Spec: Mobile Admin Labor Engine Overview — Fase 7b/c de `apps/mobile`

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

## 1. Problema y resultado

**Para quién:** usuarios con rol `OPS_ADMIN` que usan `apps/mobile`.

**Problema:** "labor-engine overview" era uno de los tres ítems
explícitamente listados como pendientes de Fase 7 desde el comentario
original de `AdminTabNavigator.tsx`. Ya existe un endpoint propio,
construido a medida para esta vista (`GET /v1/labor/admin/overview`,
`ops:dashboard:read`), consumido hoy solo por
`apps/web/app/(app)/admin/labor-engine/page.tsx` — un `OPS_ADMIN` no tiene
ninguna forma de ver alertas de QualityGuard (timers olvidados, horas
extra, jornadas largas, check-ins lejos del sitio) ni el resumen semanal
del equipo desde mobile.

**Resultado esperado:** un `OPS_ADMIN` autenticado en `apps/mobile` ve, sin
salir de la app, las alertas activas de QualityGuard y el resumen semanal
de horas/costo conocido por trabajador — mismo dato que ya ve en
`/admin/labor-engine`, sin ninguna acción de escritura.

## 2. Alcance

### Incluido

- Nuevo tab `Labor` en `AdminTabNavigator`, pantalla única
  `AdminLaborOverviewScreen` (sin stack — a diferencia de Disputes, no hay
  un "detalle" separado en esta fase).
- `GET /v1/labor/admin/overview` (ya existe, ya usado por
  `apps/web`) — devuelve `{ period, activeTimers, team, alerts,
  thresholds, generatedAt }`, sin mapper de vista separado (mismo patrón
  que `TimeEntryView`/`FreeProjectView`). Nuevo
  `AdminLaborOverviewView`/`LaborAlertView`/`LaborTeamSummaryView`/
  `LaborQualityGuardThresholds` en `packages/schemas/src/labor-engine.schema.ts`
  — contrato de tipos, sin cambio de runtime en `apps/api`.
- Alertas: tipo (`stale_timer`/`overtime`/`long_entry`/`off_site_checkin`),
  severidad (`warning`/`critical`), `workerId` (sin resolver a nombre, ver
  "Fuera de alcance"), `detail` (texto ya armado server-side).
- Resumen de equipo: `workerId`, `totalMinutes` (formateado a horas),
  `knownCost` (costo conocido, moneda ya resuelta server-side), conteo de
  `activeTimers`.
- Estados UI explícitos: `loading`, `empty` (sin alertas y sin equipo con
  horas en la semana), `ready`, `error`.

### Fuera de alcance

- **Resolver `workerId` a nombre/email** — `apps/web` lo hace vía una
  llamada separada a la lista de usuarios (`displayName()` en
  `admin/labor-engine/page.tsx:269`, deriva el nombre del local-part del
  email). Esta fase muestra el `workerId` truncado tal cual (mismo patrón
  ya usado para `assigneeUserId` en `mobile-admin-disputes.spec.md`) para
  no agregar una dependencia de endpoint nueva en esta pasada — un admin
  puede cruzarlo con `/admin/users/:id` en web si lo necesita.
- **Cualquier acción sobre un timer ajeno** (pausar/detener/editar el
  timer de otro worker) — el endpoint admin de esta fase es
  estrictamente `GET`; `apps/web` tampoco expone esa acción desde esta
  pantalla hoy (confirmado leyendo el código — no hay ningún botón de
  acción sobre `activeTimers`/`team` en `admin/labor-engine/page.tsx` más
  allá de un link de navegación a `/admin/users/:id`).
- **Matching de jobs/workers** (`runMatch` en `admin/labor-engine/page.tsx`)
  — es una superficie de negocio distinta (algoritmo de matching), no
  parte del overview de Labor Engine, fuera de alcance.
- **Ajustar los umbrales de QualityGuard** (`thresholds` se devuelve de
  solo lectura, hardcoded server-side hoy — ni siquiera `apps/web` los
  puede editar) — no aplica a esta fase.
- **Paginación** — `apps/web` pagina `activeTimers`/`team` client-side;
  esta fase muestra las listas completas sin paginar (el volumen esperado
  por tenant en mobile es bajo comparado con web).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` | `ops:dashboard:read` | tenant completo — `getAdminOverview(tenantId)` no filtra por org, mismo alcance que el resto de vistas ops-level | Ver alertas y resumen de equipo de todo el tenant | Mutar ningún timer ajeno (endpoint es `GET`) |

- **Tenant boundary:** `actor(req).tenantId` se pasa directo a
  `getAdminOverview`, mismo patrón que el resto de `/v1/labor/*`.
- **Ownership/resource policy:** sin scoping adicional del lado cliente —
  el servicio ya agrega a nivel de tenant completo (rol ops-level, no
  org-level como `CLIENT`/`PRO`).
- **Step-up o aprobación humana:** ninguna — solo lectura.
- **Datos `privacyCritical`:** ninguno.
- **Requisitos de auditoría:** ninguno nuevo — `GET` no emite `AuditLog`.
- **Datos monetarios mostrados:** `knownCost` es un costo agregado de mano
  de obra ya calculado server-side (tarifa × horas, con 1.5x sobre
  overtime semanal — `labor-engine.repository.ts:361-368`), de la misma
  naturaleza que `activeBudget` que ya muestra `AdminDashboardScreen`
  (Fase 7a) — informativo, sin ninguna acción de liberación de fondos
  alcanzable desde aquí. No requiere revisión de `paymentGovernance`
  dedicada por el mismo motivo que Fase 7a no la requirió.

## 4. Escenarios y criterios de aceptación

### P1 — Ver alertas de QualityGuard

```gherkin
DADO un tenant con al menos un timer corriendo hace más de 12h (umbral
  stale_timer)
CUANDO el admin abre el tab Labor
ENTONCES ve la alerta con su severidad (warning/critical) y el detalle
  ya formateado por el backend
```

### P2 — Ver el resumen semanal de equipo

```gherkin
DADO trabajadores con entradas completadas esta semana
CUANDO el admin abre el tab Labor
ENTONCES ve, por trabajador, horas totales y costo conocido
```

Casos borde:

- [ ] Tenant sin alertas y sin equipo con horas esta semana — estado
      `empty` explícito.
- [ ] `GET /v1/labor/admin/overview` falla (network/5xx) — estado `error`
      visible, sin crashear la UI.
- [ ] Worker con `knownCost: 0` y `minutesWithoutRate > 0` (sin tarifa
      configurada) — mostrar igual, sin dividir por cero ni ocultar la fila.
- [ ] Alerta sin `entryId` (ej. `overtime`, que es por-worker, no
      por-entrada) — no debe romper el `key` de la lista (usar
      `workerId`+`type`+índice como fallback, mismo patrón que
      `admin/labor-engine/page.tsx:367`).

## 5. Contratos

Ningún contrato de API nuevo — `GET /v1/labor/admin/overview` ya existe
(`apps/api/src/modules/labor-engine/labor-engine.controller.ts:322-328`).
Tipos de salida nuevos en `packages/schemas/src/labor-engine.schema.ts`
(`AdminLaborOverviewView` y sus tipos anidados), sin mapper de vista nuevo
en `apps/api` (el controller ya devuelve el shape del servicio tal cual,
mismo patrón que `TimeEntryView`).

### UI

```yaml
surfaces:
  - apps/mobile AdminTabNavigator (bottom tabs: Dashboard, Disputes, Labor, Settings)
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - Reusado src/api/labor.ts (nueva fetchAdminLaborOverview) tal cual, sin cliente nuevo
  - Nuevo src/screens/admin/AdminLaborOverviewScreen.tsx
  - src/navigation/types.ts: AdminTabParamList gana Labor: undefined
  - Cero botones de acción sobre timers/equipo ajenos
```

### Agente/Prometeo

No aplica.

## 6. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** ninguno — se lee el estado agregado de
  `TimeEntry` (`running`/`paused`/`completed`), sin transiciones nuevas.
- **Invariantes:** sin cambios.
- **Eventos:** ninguno — lectura pura.

## 7. Datos y migración

No aplica — sin modelos Prisma nuevos, sin migración. El endpoint ya
existe y ya se consulta contra los mismos modelos (`TimeEntry`) que
`apps/web` usa hoy.

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna nueva — mismo endpoint ya en uso por `apps/web`.
- **Feature flags:** ninguno.
- **Plan de canary:** build interno (`eas build --profile preview`) —
  misma limitación ya documentada en `apps/mobile/README.md`.
- **Evidencia de producción requerida:** run real en device/simulador con
  cuenta `OPS_ADMIN` real, idealmente con al menos una alerta activa
  (stale timer u overtime) para confirmar visualmente el escenario P1 —
  antes de `VERIFIED`.
- **Owner operativo:** `semse-core`.

## 9. Tests requeridos

- [ ] `AdminLaborOverviewScreen.test.tsx` — loading/empty/ready/error,
      alertas de cada tipo, fila de equipo sin tarifa (`knownCost: 0`).
- [ ] `pnpm --filter @semse/mobile test` verde, sin regresiones.
- [ ] `pnpm --filter @semse/mobile check` (`tsc --noEmit`) limpio.
- [ ] `pnpm --filter @semse/api build` limpio tras el cambio en
      `packages/schemas` (confirmar que el tipo nuevo no rompe el consumidor).
- [ ] Canary/smoke autenticado en producción antes de marcar `VERIFIED`.

## 10. Mapa de implementación

### Packages

- `packages/schemas/src/labor-engine.schema.ts` — nuevos tipos de salida
  (`AdminLaborOverviewView` y anidados).

### Mobile (`apps/mobile`)

- `src/api/labor.ts` — nueva `fetchAdminLaborOverview()`.
- `src/screens/admin/AdminLaborOverviewScreen.tsx` — nuevo.
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Labor`.
- `src/navigation/types.ts` — `AdminTabParamList` gana `Labor`.
- `apps/mobile/README.md` — actualizar sección Admin.

### Tests

- `apps/mobile/src/screens/admin/AdminLaborOverviewScreen.test.tsx` — nuevo.

## 11. Investigación externa

No aplica — reusa un endpoint y un patrón de tipos ya existentes.

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
