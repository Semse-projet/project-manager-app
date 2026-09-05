---
id: "ui.mobile-admin-users"
title: "Mobile Admin Users Directory — Fase 7d de apps/mobile"
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
  - apps/mobile/src/screens/admin/AdminUsersScreen.tsx
  - apps/mobile/src/api/users.ts
  - apps/api/src/modules/users/users.controller.ts
  - apps/api/src/modules/users/users.repository.ts
  - packages/schemas/src/user.schema.ts
related_tests:
  - apps/mobile/src/screens/admin/AdminUsersScreen.test.tsx
related_endpoints:
  - v1/users
related_events: []
related_agents: []
last_verified: "2026-08-26"
---

# Spec: Mobile Admin Users Directory — Fase 7d de `apps/mobile`

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

## 1. Problema y resultado

**Para quién:** usuarios con rol `OPS_ADMIN` que usan `apps/mobile`.

**Problema:** el comentario original de `AdminTabNavigator.tsx` (Fase 7)
lista "contractors" entre lo pendiente. La página web con ese nombre
(`apps/web/app/(app)/admin/contractors`) resultó ser, al leer su código,
un CRM de leads de venta (`/api/semse/contractor/leads`) — no un
directorio de profesionales/usuarios. El directorio real de usuarios
(profesionales, clientes, admins) del tenant vive en
`apps/web/app/(app)/admin/users`, consumiendo `GET /v1/users`
(`users:read`). Esa es la superficie que un `OPS_ADMIN` móvil
razonablemente esperaría bajo "contractors": ver el estado de
verificación, trust score y riesgo de cada usuario del tenant.

**Resultado esperado:** un `OPS_ADMIN` autenticado en `apps/mobile` puede
ver, sin salir de la app, la lista de usuarios del tenant (todos los
roles — `CLIENT`, `PRO`/`WORKER`, `OPS_ADMIN`) con su estado
(`active`/`pending`/`suspended`), estado de verificación, trust score y
nivel de riesgo. **Esta fase es estrictamente de lectura.**

## 2. Alcance

### Incluido

- Nuevo tab `Users` en `AdminTabNavigator`, pantalla única
  `AdminUsersScreen` (sin stack — mismo patrón que `AdminLaborOverviewScreen`,
  sin un "detalle" separado en esta fase).
- `GET /v1/users` (ya existe, ya usado por `apps/web/admin/users`) —
  `UsersRepository.findUsersByTenant` filtra **solo por `tenantId`** (via
  `memberships.some.org.tenantId`), sin scoping adicional por rol — a
  diferencia de disputes, no hay una condición especial para `OPS_ADMIN`
  porque no hace falta: la query ya es tenant-wide para cualquier actor
  con `users:read`.
- Por usuario: `email`, `phone` (si existe), `status`, `verificationStatus`,
  `trustScore` (formateado como porcentaje, mismo patrón que
  `apps/web/admin/users/page.tsx:378` — `Math.round(score * 100)}%`),
  `riskLevel` (mostrado tal cual, en mayúsculas — el propio `apps/web` no
  lo mapea a un label fijo, es texto libre del backend), `flags` (si hay
  alguna).
- Nuevo `UserRecordView` en `packages/schemas/src/user.schema.ts` — tipo de
  salida nuevo (archivo nuevo, no existía ninguno para `User` todavía en
  `packages/schemas`), sin mapper de vista nuevo en `apps/api` (el
  controller ya devuelve `UserRecord` tal cual).
- Estados UI explícitos: `loading`, `empty`, `ready`, `error`.

### Fuera de alcance

- **Cambiar el status de un usuario** (`PATCH /v1/users/:userId/status`,
  `users:status:update`) — mutación real (activar/suspender una cuenta),
  necesita su propio flujo de confirmación.
- **Revisar/aprobar una solicitud de verificación**
  (`GET /v1/users/verify-requests`, acción de aprobar/rechazar,
  `users:verify`) — cola de trabajo real con sus propios estados y
  decisión (`approved`/`rejected` + nota), fuera de alcance de esta fase
  de solo lectura.
- **Editar el perfil de un usuario** (`PATCH /v1/users/:userId/profile`) —
  mutación, no aplica a una vista de solo lectura.
- **Ver memberships/organización por usuario**
  (`GET /v1/users/:userId/memberships`) — `apps/web` hace un fetch por
  usuario para poder filtrar por rol/org; esta fase no reproduce ese
  patrón N+1 ni agrega un filtro por rol, para mantener el alcance a un
  único `GET /v1/users` sin llamadas adicionales. Ver detalle de un
  usuario individual (con sus memberships) es una fase posterior si hace
  falta.
- **Búsqueda o filtros** — `apps/web` tiene búsqueda por nombre/email y
  filtro por rol/estado; esta fase muestra la lista completa sin filtrar,
  mismo criterio de "primera pasada de lectura mínima" que
  `AdminDisputesScreen` (Fase 7b) usó antes de tener paginación/filtros.
- **El CRM de leads** (`apps/web/app/(app)/admin/contractors`,
  `/api/semse/contractor/leads`) — a pesar del nombre "contractors" en el
  comentario original de Fase 7, este spec cubre el directorio de
  usuarios real, no el CRM de leads (que es mutación-first: crear/mover
  leads por estado, sin valor real como vista de solo lectura). Si se
  decide que el CRM de leads también hace falta en mobile, es un spec
  aparte.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` | `users:read` | tenant completo — `findUsersByTenant` filtra solo por `tenantId`, sin condición de rol | Ver todos los usuarios del tenant, cualquier rol | Cambiar status, verificar, o editar el perfil de ningún usuario (endpoints no alcanzables desde esta fase) |

- **Tenant boundary:** `resolveRequestContext` inyecta `tenantId` del
  token de sesión; la query de `apps/api` filtra por
  `memberships.some.org.tenantId`, sin excepción.
- **Ownership/resource policy:** sin scoping adicional del lado cliente —
  la lista ya es tenant-wide en el backend para cualquier actor con
  `users:read` (verificado en código, `users.repository.ts:110-130`).
- **Step-up o aprobación humana:** ninguna — solo lectura.
- **Datos `privacyCritical`:** `email`/`phone` son PII — ya visibles hoy
  para este mismo rol en `apps/web/admin/users`, sin cambio de exposición;
  no se agrega ningún dato nuevo que hoy no vea un `OPS_ADMIN`.
- **Requisitos de auditoría:** ninguno nuevo — `GET /v1/users` no emite
  `AuditLog` (es lectura).

## 4. Escenarios y criterios de aceptación

### P1 — Ver el directorio de usuarios del tenant

```gherkin
DADO un tenant con usuarios de distintos roles (CLIENT, PRO, OPS_ADMIN)
CUANDO el admin abre el tab Users
ENTONCES ve la lista completa (GET /v1/users), con email, status,
  verificationStatus, trust score (%) y riskLevel de cada uno
```

Casos borde:

- [ ] Tenant sin usuarios (caso teórico, siempre hay al menos el propio
      admin) — estado `empty` explícito.
- [ ] `GET /v1/users` falla (network/5xx) — estado `error` visible, sin
      crashear la UI.
- [ ] Usuario sin `phone` — no debe romper el render (campo opcional).
- [ ] Usuario con `flags` no vacío — se muestran, sin ocultar por diseño
      (son señales operativas reales, no ruido).

## 5. Contratos

Ningún contrato de API nuevo — `GET /v1/users` ya existe
(`apps/api/src/modules/users/users.controller.ts:19-30`). Tipo de salida
nuevo `UserRecordView` en `packages/schemas/src/user.schema.ts` (archivo
nuevo), reflejando `UserRecord` (`apps/api/src/modules/users/users.repository.ts:53-62`)
tal cual, sin mapper de vista nuevo en `apps/api`.

### UI

```yaml
surfaces:
  - apps/mobile AdminTabNavigator (bottom tabs: Dashboard, Disputes, Users, Settings)
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - Nuevo src/api/users.ts (fetchUsers), un único GET /v1/users
  - Nuevo src/screens/admin/AdminUsersScreen.tsx
  - src/navigation/types.ts: AdminTabParamList gana Users: undefined
  - Cero botones de acción (status/verify/profile) en esta fase
```

### Agente/Prometeo

No aplica.

## 6. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** ninguno — se lee `User.status`/`verificationStatus`
  ya existentes, sin transiciones nuevas.
- **Invariantes:** sin cambios.
- **Eventos:** ninguno — lectura pura.

## 7. Datos y migración

No aplica — sin modelos Prisma nuevos, sin migración.

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna nueva — mismo endpoint ya en uso por `apps/web`.
- **Feature flags:** ninguno.
- **Plan de canary:** build interno (`eas build --profile preview`) —
  misma limitación ya documentada en `apps/mobile/README.md`.
- **Evidencia de producción requerida:** run real en device/simulador con
  cuenta `OPS_ADMIN` real, con usuarios de más de un rol visibles — antes
  de `VERIFIED`.
- **Owner operativo:** `semse-core`.

## 9. Tests requeridos

- [ ] `AdminUsersScreen.test.tsx` — loading/empty/ready/error, usuario sin
      `phone`, usuario con `flags`.
- [ ] `pnpm --filter @semse/mobile test` verde, sin regresiones.
- [ ] `pnpm --filter @semse/mobile check` (`tsc --noEmit`) limpio.
- [ ] `pnpm --filter @semse/api build` limpio tras el cambio en
      `packages/schemas`.
- [ ] Canary/smoke autenticado en producción antes de marcar `VERIFIED`.

## 10. Mapa de implementación

### Packages

- `packages/schemas/src/user.schema.ts` — nuevo, `UserRecordView`.

### Mobile (`apps/mobile`)

- `src/api/users.ts` — nuevo, `fetchUsers()`.
- `src/screens/admin/AdminUsersScreen.tsx` — nuevo.
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Users`.
- `src/navigation/types.ts` — `AdminTabParamList` gana `Users`.
- `apps/mobile/README.md` — actualizar sección Admin.

### Tests

- `apps/mobile/src/screens/admin/AdminUsersScreen.test.tsx` — nuevo.

## 11. Investigación externa

No aplica — reusa un endpoint ya existente y patrones de tipos ya
establecidos.

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
