---
id: "ui.mobile-admin-trust"
title: "Mobile Admin Trust — Fase 7f de apps/mobile"
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
  - apps/mobile/src/navigation/types.ts
  - apps/mobile/src/screens/admin/AdminTrustScreen.tsx
  - apps/mobile/src/api/trust.ts
  - apps/api/src/modules/ops/ops.controller.ts
  - apps/api/src/modules/ops/ops.service.ts
  - apps/api/src/modules/ops/ops.repository.ts
  - packages/schemas/src/ops.schema.ts
related_tests:
  - apps/mobile/src/screens/admin/AdminTrustScreen.test.tsx
related_endpoints:
  - v1/ops/trust-overview
related_events: []
related_agents: []
last_verified: "2026-08-26"
---

# Spec: Mobile Admin Trust — Fase 7f de `apps/mobile`

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

## 1. Problema y resultado

**Para quién:** usuarios con rol `OPS_ADMIN` que usan `apps/mobile`.

**Problema:** el resto de Fase 7 dejó `AdminTabNavigator` con `Dashboard`,
`Disputes`, `Labor`, `Users` y `Contractors`, pero un `OPS_ADMIN` no tiene
forma de ver los trust/risk scores de jobs y proyectos desde mobile — tiene
que abrir `apps/web/app/(app)/admin/trust` para eso, aunque el mismo backend
(`GET /v1/ops/trust-overview`) ya está expuesto y ya usa un permiso
(`ops:risk:read`) que `OPS_ADMIN` tiene otorgado.

**Resultado esperado:** un `OPS_ADMIN` autenticado en `apps/mobile` puede,
sin salir de la app, ver los trust scores de todo el tenant (no solo su
org — mismo alcance que `Disputes`, ver §3), con conteos agregados por
nivel de riesgo y filtro por nivel. **Esta fase es estrictamente de
lectura** — no hay ninguna acción, ni el detalle de "trust passport" por
usuario (ver §2).

## 2. Alcance

### Incluido

- Nuevo tab `Trust` en `AdminTabNavigator`, una sola pantalla
  (`AdminTrustScreen`) — sin stack/detalle.
- `GET /v1/ops/trust-overview` (nuevo cliente `src/api/trust.ts`, mismo
  patrón sin-BFF que el resto de `apps/mobile`), mostrando cards de
  conteo (`total`, `highRisk`, `mediumRisk`, `lowRisk`) y la lista de
  entradas (`scopeType`+`scopeId` truncado, `score`, `level`,
  `primaryReason`, `flags` si existen).
- Filtro por nivel (`low`/`medium`/`high`) en la propia pantalla — el
  dataset es pequeño (el backend limita a los 12 jobs más recientes con
  proyecto, ver §5) así que un filtro client-side simple es suficiente,
  sin paginación ni búsqueda.
- Estados UI explícitos: `loading`, `empty`, `ready`, `error` (mismo
  estándar que el resto de Fase 7).
- `AdminTabParamList` (`src/navigation/types.ts`) gana `Trust: undefined`.
- `apps/mobile/README.md`: sección Admin actualizada.

### Fuera de alcance

- **Trust Passport por usuario** — `apps/web`'s Trust page tiene un botón
  expandible "Pasaporte" que renderiza `TrustPassportCard` para un
  `scopeType === "user"`. Esa condición nunca se cumple contra el
  contrato real (`trustOverviewItemSchema.scopeType` es
  `"job" | "project"`, nunca `"user"` — verificado en
  `packages/schemas/src/ops.schema.ts`), así que ese botón en `apps/web`
  jamás se muestra hoy. Esta fase no construye un trust-passport view
  para mobile — es una superficie de lectura propia (perfil de confianza
  completo de un usuario), fuera de alcance de un listado agregado.
- **Cualquier acción sobre un trust score o sus flags** — no existe hoy
  ningún endpoint de escritura para trust scores en `ops.controller.ts`;
  no hay nada que excluir explícitamente más allá de "no se agrega
  ninguno".
- **Búsqueda o paginación** — el dataset ya viene acotado a 12 jobs
  recientes por el propio backend (`listRecentJobsWithProject`, límite
  hardcoded), sin caso de uso claro para paginar un listado tan chico
  desde mobile todavía.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` | `ops:risk:read` | `ops.repository.ts:listRecentJobsWithProject` filtra únicamente por `tenantId` (sin condición de `orgId`) — tenant-wide, igual que `Disputes` (verificado leyendo el código) | Ver los trust scores de todo el tenant, no solo de su org | Ver trust scores de otro tenant; mutar cualquier score o flag (no hay endpoint de escritura que alcanzar) |

- **Tenant/org boundary:** idéntico al resto de `/v1` —
  `resolveRequestContext` inyecta `tenantId`/`orgId`/`roles` del token de
  sesión; `ops.controller.ts` los pasa tal cual a `OpsService.trustOverview`,
  que a su vez llama `TrustService.byJob` por cada uno de los jobs
  recientes del tenant.
- **Ownership/resource policy:** sin cambios — esta fase no introduce ni
  relaja ninguna política, solo consume el `GET` que ya implementa el
  scoping tenant-wide.
- **Step-up o aprobación humana:** ninguna acción de esta fase la
  requiere (solo lectura).
- **Datos `privacyCritical`:** `scopeId` (un `jobId`/`projectId`, no un
  identificador de persona directo) y `primaryReason`/`flags` (texto
  descriptivo del motivo del score) — mismo nivel de sensibilidad que ya
  expone `apps/web`'s Trust page al mismo rol.
- **Requisitos de auditoría:** ninguno nuevo — `GET /v1/ops/trust-overview`
  no emite `AuditLog` (es lectura); no se agrega logging nuevo.

## 4. Escenarios y criterios de aceptación

### P1 — Ver los trust scores de todo el tenant

```gherkin
DADO un usuario OPS_ADMIN autenticado en apps/mobile, con jobs/proyectos en
  más de una org del tenant con trust scores calculados
CUANDO abre el tab Trust
ENTONCES ve las cards de conteo (total, alto/medio/bajo riesgo) y la lista
  completa de entradas (GET /v1/ops/trust-overview) — tenant-wide, no solo
  las de su propia org
```

### P2 — Filtrar por nivel de riesgo

```gherkin
DADO la lista de trust scores ya cargada, con entradas en más de un nivel
CUANDO el admin toca el chip "Alto"
ENTONCES la lista se acota a las entradas con level === "high", sin volver
  a pedir datos al backend (filtro client-side)
```

Casos borde:

- [ ] Tenant sin jobs/proyectos con trust score — estado `empty` explícito.
- [ ] `GET /v1/ops/trust-overview` falla (network/5xx) — estado `error`
      visible, sin crashear la UI (mismo patrón que el resto de Fase 7).
- [ ] Entrada sin `flags` — no se renderiza la línea de flags (mismo
      patrón condicional que `AdminUsersScreen`).
- [ ] Filtro sin resultados en un nivel — mensaje "Sin entradas en este
      nivel", no una lista vacía sin contexto.

## 5. Contratos

Ningún contrato Zod nuevo — se reusa `trustOverviewSchema`/
`trustOverviewItemSchema` (`packages/schemas/src/ops.schema.ts`), ya
exportado por el barrel del paquete (`export * from "./ops.schema.js"`),
mismo patrón de reuso que `DisputeRecordView` en Fase 7b.

**Drift verificado en `apps/web`, no replicado aquí:** `apps/web/app/(app)/
admin/trust/page.tsx` declara un tipo local `TrustOverview` con un campo
`entries` que la API nunca devuelve (el contrato real usa `items`), un
nivel `"critical"` que `trustOverviewItemSchema` nunca produce (solo
`"low" | "medium" | "high"`), y compara `entry.scopeType === "user"`
cuando el contrato real solo permite `"job" | "project"` — como
consecuencia, la tabla de esa página en `apps/web` nunca se puebla (lee
`data.entries`, siempre `undefined`) y su botón "Pasaporte" nunca aparece.
Verificado leyendo `ops.service.ts:trustOverview` y
`packages/schemas/src/ops.schema.ts` directamente, no asumido. Esta fase
no corrige `apps/web` (fuera de alcance) pero documenta que
`apps/mobile`'s cliente se construyó contra el contrato real, no contra
ese tipo local.

### UI

```yaml
surfaces:
  - apps/mobile AdminTabNavigator (bottom tabs: ..., Contractors, Trust, Settings)
  - apps/mobile AdminTrustScreen (una sola pantalla, sin stack)
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - Nuevo src/api/trust.ts (fetchTrustOverview), mismo patrón sin-BFF que
    src/api/disputes.ts
  - src/navigation/types.ts: AdminTabParamList gana Trust: undefined
  - Cero botones de acción o de trust-passport en esta pantalla
```

### Agente/Prometeo

No aplica.

## 6. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** ninguno — trust scores se calculan
  dinámicamente por `TrustService.byJob` a partir de señales existentes
  (jobs/ratings/disputas), sin FSM propio, y esta fase no dispara ningún
  recálculo.
- **Invariantes:** `docs/foundation/DOMAIN_INVARIANTS.md` — sin cambios.
- **Eventos:** ninguno — lectura pura.

## 7. Datos y migración

No aplica — sin modelos Prisma nuevos, sin migración.

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna nueva — mismo endpoint ya usado por
  `apps/web`.
- **Feature flags:** ninguno.
- **Plan de canary:** build interno (`eas build --profile preview`) —
  misma limitación ya documentada en `apps/mobile/README.md` (sandbox sin
  Xcode/Android SDK/simulator).
- **Evidencia de producción requerida:** run real en device/simulador con
  una cuenta `OPS_ADMIN` real que tenga jobs/proyectos con trust scores
  calculados en más de una org, para confirmar visualmente el escenario
  P1 — antes de `VERIFIED`.
- **Owner operativo:** `semse-core`.

## 9. Tests requeridos

- [ ] `AdminTrustScreen.test.tsx` — loading/empty/ready/error, cards de
      conteo, listado con nivel+score+flags, filtro por nivel, ausencia
      del filtro fantasma "crítico" y de cualquier acción de
      trust-passport/mutación.
- [ ] `pnpm --filter @semse/mobile test` verde, sin regresiones.
- [ ] `pnpm --filter @semse/mobile check` (`tsc --noEmit`) limpio.
- [ ] Canary/smoke autenticado en producción antes de marcar `VERIFIED`.

## 10. Mapa de implementación

### Mobile (`apps/mobile`)

- `src/api/trust.ts` — nuevo.
- `src/screens/admin/AdminTrustScreen.tsx` — nuevo.
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Trust`.
- `src/navigation/types.ts` — `AdminTabParamList` gana `Trust`.
- `apps/mobile/README.md` — actualizar sección Admin.

### Tests

- `apps/mobile/src/screens/admin/AdminTrustScreen.test.tsx` — nuevo.

## 11. Investigación externa

No aplica — reusa componentes, patrones y contrato Zod 100% internos ya
existentes.

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
