---
id: "ui.mobile-admin-disputes"
title: "Mobile Admin Disputes — Fase 7b de apps/mobile"
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
  - apps/mobile/src/navigation/AdminDisputesStackNavigator.tsx
  - apps/mobile/src/navigation/types.ts
  - apps/mobile/src/screens/admin/AdminDisputesScreen.tsx
  - apps/mobile/src/screens/admin/AdminDisputeDetailScreen.tsx
  - apps/mobile/src/screens/worker/jobStatus.ts
  - apps/mobile/src/api/disputes.ts
  - apps/api/src/modules/disputes/disputes.controller.ts
  - apps/api/src/modules/disputes/disputes.repository.ts
related_tests:
  - apps/mobile/src/screens/admin/AdminDisputesScreen.test.tsx
  - apps/mobile/src/screens/admin/AdminDisputeDetailScreen.test.tsx
related_endpoints:
  - v1/disputes
related_events: []
related_agents: []
last_verified: "2026-08-17"
---

# Spec: Mobile Admin Disputes — Fase 7b de `apps/mobile`

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

## 1. Problema y resultado

**Para quién:** usuarios con rol `OPS_ADMIN` que usan `apps/mobile`.

**Problema:** Fase 7a dejó `AdminTabNavigator` con `Dashboard` (resumen
agregado de jobs) y `Settings` (logout), pero un `OPS_ADMIN` no tiene forma
de ver las disputas activas del tenant desde mobile — tiene que abrir
`apps/web/app/(app)/admin` para eso, aunque el mismo dato ya es visible
indirectamente en el Dashboard como un conteo (`stats.disputes.length`) sin
poder abrir el detalle de ninguna.

**Resultado esperado:** un `OPS_ADMIN` autenticado en `apps/mobile` puede,
sin salir de la app, ver la lista completa de disputas del tenant (no solo
las de su propia org — a diferencia de `CLIENT`/`PRO`, `OPS_ADMIN` ya ve
todas server-side, ver §3) y abrir el detalle de una para ver motivo, estado,
asignación y resolución si ya la tiene. **Esta fase es estrictamente de
lectura** — no se puede asignar, resolver, archivar ni adjuntar evidencia
desde aquí (ver §2).

## 2. Alcance

### Incluido

- Nuevo tab `Disputes` en `AdminTabNavigator`, con su propio stack
  (`AdminDisputesStackNavigator`): `AdminDisputesScreen` (lista) →
  `AdminDisputeDetailScreen` (detalle).
- Lista: `GET /v1/disputes` (ya usado por Worker vía
  `fetchDisputes()` — se reusa tal cual, sin cliente nuevo), mostrando
  motivo (`reason`), estado (`status`, reusando
  `DISPUTE_STATUS_LABEL`/`DISPUTE_STATUS_COLOR_KEY` de
  `src/screens/worker/jobStatus.ts` — ya importado cross-role por
  `client/JobsListScreen.tsx`/`JobDetailScreen.tsx`, mismo patrón
  establecido, no uno nuevo).
- Detalle: motivo, estado, `assigneeUserId` (si existe), `resolution` +
  `resolutionType` (si ya está resuelta) — mismos campos que
  `DisputeRecordView` (`packages/schemas/src/dispute.schema.ts`) ya expone,
  sin contrato nuevo.
- Estados UI explícitos: `loading`, `empty`, `ready`, `error` (mismo
  estándar que Fase 7a).

### Fuera de alcance

- **Asignar una disputa** (`POST /v1/disputes/:disputeId/assign`,
  `disputes:assign`) — acción de gestión real, necesita su propio flujo de
  confirmación (a quién se asigna, de una lista de usuarios `OPS_ADMIN`) que
  esta fase no construye.
- **Resolver una disputa** (`POST /v1/disputes/:disputeId/resolve`,
  `disputes:resolve`) — la más sensible de todas: determina
  `resolutionType` (`client_favor`/`pro_favor`/`partial_50_50`/
  `escalated_legal`), que en la práctica destraba movimientos de escrow
  aguas abajo. `risk: medium` de este spec es precisamente porque se
  excluye esto explícitamente, no porque se toque — cualquier acción que
  determine el resultado de una disputa necesita su propio spec con
  revisión de `paymentGovernance` dedicada, igual que se excluyó
  fund/release en Fase 2 (`mobile-client-tab.spec.md`).
- **Marcar en revisión** (`POST /v1/disputes/:disputeId/mark-under-review`,
  `disputes:assign`) — mismo motivo que asignar, acción de gestión.
- **Archivar/restaurar** (`disputes:archive`/`disputes:restore`) — fuera de
  alcance, sin caso de uso claro desde mobile todavía.
- **Ver evidencia adjunta** (`evidenceBundleIds`) — el detalle muestra que
  existen (o no) bundles de evidencia, pero no los renderiza; abrir/ver
  archivos de evidencia es una superficie propia (mismo patrón que
  `EvidenceScreen`/`EvidenceCapture` de Worker) que esta fase no construye
  para no mezclar una feature de lectura de archivos con esta de listado.
- **Crear una disputa** (`POST /v1/disputes`, `disputes:create`) — `OPS_ADMIN`
  sí tiene el permiso (ver §3), pero no hay caso de uso real de que un
  admin abra una disputa contra sí mismo; Worker ya cubre la creación desde
  el lado que sí tiene sentido.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` | `disputes:read` | tenant completo — `disputes.repository.ts:307` (`buildOwnershipWhere`) devuelve `{}` sin filtro de org cuando `roles.includes("OPS_ADMIN")`, a diferencia de `CLIENT`/`PRO` que quedan acotados a su propia org (`clientOrgId`/`assignedProOrgId`) | Ver todas las disputas del tenant, no solo las de su org | Ver disputas de otro tenant (scoping por `tenantId` sigue aplicando siempre) |

- **Tenant boundary:** idéntico al resto de `/v1` —
  `resolveRequestContext` inyecta `tenantId` del token de sesión;
  `disputesRepository.list` filtra por `tenantId` sin excepción para ningún
  rol (`disputes.repository.ts:49`).
- **Ownership/resource policy:** `OPS_ADMIN` es el único rol con
  `buildOwnershipWhere` vacío (ver arriba) — verificado leyendo el código,
  no asumido. Esta fase no introduce ni relaja ninguna política de
  ownership, solo consume el `GET` que ya implementa esto.
- **Step-up o aprobación humana:** ninguna acción de esta fase la requiere
  (solo lectura). Assign/resolve, cuando se implementen en una fase
  posterior, sí deberían evaluarlo — no se asume aquí.
- **Datos `privacyCritical`:** ninguno.
- **Requisitos de auditoría:** ninguno nuevo — `GET /v1/disputes` no emite
  `AuditLog` (es lectura); no se agrega logging nuevo.

## 4. Escenarios y criterios de aceptación

### P1 — Ver todas las disputas del tenant

```gherkin
DADO un usuario OPS_ADMIN autenticado en apps/mobile, con disputas abiertas
  en más de una org del tenant
CUANDO abre el tab Disputes
ENTONCES ve la lista completa (GET /v1/disputes), no solo las de su propia
  org — a diferencia de lo que vería un CLIENT o PRO con el mismo endpoint
```

### P2 — Ver el detalle de una disputa

```gherkin
DADO una disputa existente, en cualquier estado
CUANDO el admin la toca desde la lista
ENTONCES ve motivo, estado, asignación (si existe) y resolución (si ya está
  resuelta) — sin ningún botón de acción que mute su estado
```

Casos borde:

- [ ] Tenant sin disputas — estado `empty` explícito, no una lista vacía
      sin contexto.
- [ ] `GET /v1/disputes` falla (network/5xx) — estado `error` visible, sin
      crashear la UI (mismo patrón que `AdminDashboardScreen`).
- [ ] Disputa `RESOLVED`/`REJECTED` — el detalle debe distinguir visualmente
      de `OPEN`/`ASSIGNED`/`UNDER_REVIEW` (reusa
      `DISPUTE_STATUS_COLOR_KEY`, ya cubre los 5 estados).
- [ ] Navegar a una disputa y volver, luego refrescar la lista — sin estado
      obsoleto (mismo patrón `useFocusEffect` ya usado en Fase 7a).

## 5. Contratos

Ningún contrato nuevo — se reusa `GET /v1/disputes` tal cual ya está
definido (`apps/api/src/modules/disputes/disputes.controller.ts:19-30`,
`packages/schemas/src/dispute.schema.ts` vía `DisputeRecordView`).

### UI

```yaml
surfaces:
  - apps/mobile AdminTabNavigator (bottom tabs: Dashboard, Disputes, Settings)
  - apps/mobile AdminDisputesStackNavigator (DisputesList -> DisputeDetail)
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - Reusado src/api/disputes.ts (fetchDisputes) tal cual, sin cliente nuevo
  - Reusado DISPUTE_STATUS_LABEL/DISPUTE_STATUS_COLOR_KEY de
    src/screens/worker/jobStatus.ts (mismo patrón cross-role que
    client/JobsListScreen.tsx ya usa)
  - Nuevo src/navigation/AdminDisputesStackNavigator.tsx, mismo patrón que
    ClientJobsStackNavigator.tsx
  - src/navigation/types.ts: AdminTabParamList gana Disputes; nuevo
    AdminDisputesStackParamList
  - Cero botones de acción (assign/resolve/archive/submit evidence) en
    ninguna pantalla de esta fase
```

### Agente/Prometeo

No aplica.

## 6. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** ninguno nuevo — se lee el estado de Dispute
  (`OPEN`/`ASSIGNED`/`UNDER_REVIEW`/`RESOLVED`/`REJECTED`) ya definido, sin
  transiciones nuevas (esta fase no dispara ninguna).
- **Invariantes:** `docs/foundation/DOMAIN_INVARIANTS.md` — sin cambios.
- **Eventos:** ninguno — lectura pura.

## 7. Datos y migración

No aplica — sin modelos Prisma nuevos, sin migración.

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna nueva — mismo endpoint ya monitoreado.
- **Feature flags:** ninguno.
- **Plan de canary:** build interno (`eas build --profile preview`) —
  misma limitación ya documentada en `apps/mobile/README.md` (sandbox sin
  Xcode/Android SDK/simulator).
- **Evidencia de producción requerida:** run real en device/simulador con
  una cuenta `OPS_ADMIN` real que tenga acceso a disputas de más de una
  org, para confirmar visualmente el escenario P1 (el caso interesante de
  esta fase, ver §3) — antes de `VERIFIED`.
- **Owner operativo:** `semse-core`.

## 9. Tests requeridos

- [ ] `AdminDisputesScreen.test.tsx` — loading/empty/ready/error, mismo
      patrón que `AdminDashboardScreen.test.tsx`.
- [ ] `AdminDisputeDetailScreen.test.tsx` — disputa encontrada (con y sin
      resolución) / no encontrada / error de carga.
- [ ] `pnpm --filter @semse/mobile test` verde, sin regresiones.
- [ ] `pnpm --filter @semse/mobile check` (`tsc --noEmit`) limpio.
- [ ] Canary/smoke autenticado en producción antes de marcar `VERIFIED`.

## 10. Mapa de implementación

### Mobile (`apps/mobile`)

- `src/navigation/AdminDisputesStackNavigator.tsx` — nuevo.
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Disputes`.
- `src/navigation/types.ts` — `AdminTabParamList` + nuevo
  `AdminDisputesStackParamList`.
- `src/screens/admin/AdminDisputesScreen.tsx`,
  `AdminDisputeDetailScreen.tsx` — nuevos.
- `apps/mobile/README.md` — actualizar sección Admin.

### Tests

- `apps/mobile/src/screens/admin/AdminDisputesScreen.test.tsx`,
  `AdminDisputeDetailScreen.test.tsx` — nuevos.

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
