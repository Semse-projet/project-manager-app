---
id: "ui.mobile-admin-contractors"
title: "Mobile Admin Contractors — Fase 7e de apps/mobile"
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
  - apps/mobile/src/navigation/RoleGate.tsx
  - apps/mobile/src/screens/admin/AdminContractorsScreen.tsx
  - apps/mobile/src/api/contractor.ts
  - apps/api/src/modules/contractor/contractor.controller.ts
  - apps/api/src/modules/contractor/contractor.service.ts
related_tests:
  - apps/mobile/src/screens/admin/AdminContractorsScreen.test.tsx
related_endpoints:
  - v1/contractor/leads
  - v1/contractor/leads/stats
related_events: []
related_agents: []
last_verified: "2026-08-26"
---

# Spec: Mobile Admin Contractors — Fase 7e de `apps/mobile`

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

## 1. Problema y resultado

**Para quién:** usuarios con rol `OPS_ADMIN` que usan `apps/mobile`.

**Problema:** Fase 7a/7b dejaron `AdminTabNavigator` con `Dashboard`,
`Disputes` y `Settings`, pero un `OPS_ADMIN` no tiene forma de ver ni crear
leads de contractors/CRM desde mobile — tiene que abrir
`apps/web/app/(app)/admin/contractors` para eso, aunque el mismo backend
(`GET`/`POST /v1/contractor/leads`) ya está expuesto y ya usa permisos
(`jobs:read`/`jobs:create`) que `OPS_ADMIN` tiene otorgados desde Fase 7a.

**Resultado esperado:** un `OPS_ADMIN` autenticado en `apps/mobile` puede,
sin salir de la app, ver la lista de leads de su org (no tenant-wide — a
diferencia de `Disputes`, ver §3), ver conteos agregados por status, y crear
un lead nuevo. **No se puede cambiar el status de un lead, eliminarlo, ni
generar un estimado/factura desde aquí** (ver §2).

## 2. Alcance

### Incluido

- Nuevo tab `Contractors` en `AdminTabNavigator`, una sola pantalla
  (`AdminContractorsScreen`) — sin stack/detalle, mismo alcance de superficie
  que `apps/web`'s Contractors page (tampoco tiene una ruta de detalle).
- Lista: `GET /v1/contractor/leads` (nuevo cliente `src/api/contractor.ts`,
  mismo patrón sin-BFF que `src/api/disputes.ts`/`src/api/jobs.ts`), mostrando
  nombre, status (badge) y rubro/teléfono si existen.
- Stats: `GET /v1/contractor/leads/stats` — cards de total, nuevos, en
  proceso (agregado de `contacted`+`estimate_sent`+`estimate_approved`+
  `in_progress`), completados y perdidos.
- Crear lead: `POST /v1/contractor/leads` con nombre (requerido), teléfono y
  rubro (`jobType`) opcionales — mismo patrón de formulario-toggle que
  `worker/DisputesScreen.tsx` ya usa para crear una disputa.
- Estados UI explícitos: `loading`, `empty`, `ready`, `error` (mismo estándar
  que Fase 7a/7b).
- `AdminTabParamList` (`src/navigation/types.ts`) gana `Contractors: undefined`.
- `RoleGate.tsx`: comentario de `TARGET_PRIORITY` actualizado — Contractors
  deja de estar en la lista de "resto de Fase 7 pendiente".
- `apps/mobile/README.md`: sección Admin actualizada.

### Fuera de alcance

- **Cambiar el status de un lead** (`PATCH /v1/contractor/leads/:id`,
  `jobs:create`) — mutación de flujo de venta real (mover un lead entre
  `new`/`contacted`/`estimate_sent`/etc.), necesita su propio flujo de UI
  (selector de próximo status, posible `nextAction`/`nextActionAt`) que esta
  fase no construye.
- **Eliminar un lead** (`DELETE /v1/contractor/leads/:id`, `jobs:create`) —
  acción destructiva, sin caso de uso claro desde mobile todavía.
- **Sugerir/crear un estimado desde un lead**
  (`POST /v1/contractor/leads/:id/suggest-estimate` /
  `/create-estimate`, `jobs:create`) — flujo de negocio propio (genera un
  `Invoice`/`Job` real vía `ContractorEstimateService`), con su propio
  volumen de superficie y validación; no es una vista de lectura+creación
  simple como el resto de esta fase.
- **Ver/editar el detalle completo de un lead** (`GET`/`PATCH
  /v1/contractor/leads/:id`) — la lista ya muestra los campos con los que
  un `OPS_ADMIN` decide next-steps desde mobile; un detalle editable es
  una superficie más grande, deferida.
- **Filtro por status o búsqueda en la UI** — el cliente (`src/api/contractor.ts`)
  soporta los query params (`status`/`search`) porque el backend ya los
  expone, pero esta fase no agrega los controles de filtro en pantalla; es
  UI adicional sin necesidad urgente con listas cortas por org.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` | `jobs:read` | `contractor.service.ts:listLeads`/`getStats` filtran siempre por `tenantId` + `orgId` del contexto del request — a diferencia de `disputes.repository.ts`, no hay excepción tenant-wide para `OPS_ADMIN` aquí (verificado leyendo el código) | Ver/contar los leads de su propia org | Ver leads de otra org del mismo tenant, o de otro tenant |
| `OPS_ADMIN` | `jobs:create` | mismo scoping — `createLead` graba `orgId`/`tenantId`/`createdBy` del contexto del request | Crear un lead nuevo en su propia org | Cambiar el status, eliminar, o generar un estimado de un lead existente (endpoints correspondientes no se consumen desde esta fase) |

- **Tenant/org boundary:** idéntico al resto de `/v1` —
  `resolveRequestContext` inyecta `tenantId`/`orgId` del token de sesión;
  `contractor.controller.ts` los pasa tal cual a `ContractorService`
  (`listLeads`, `getStats`, `createLead`), sin excepción de rol.
- **Ownership/resource policy:** sin cambios — esta fase no introduce ni
  relaja ninguna política, solo consume los endpoints `GET`/`POST` ya
  existentes con el scoping que ya implementan.
- **Step-up o aprobación humana:** ninguna acción de esta fase la requiere.
  Crear un lead es aditivo (no muta ningún registro existente, no mueve
  dinero, no afecta disputas/escrow) — a diferencia de resolver una disputa
  o liberar un pago, no necesita revisión de `paymentGovernance` dedicada.
- **Datos `privacyCritical`:** nombre/teléfono/email de un lead son PII de
  contacto — mismo nivel de sensibilidad que ya expone `apps/web`'s
  Contractors page al mismo rol; esta fase no agrega logging ni
  persistencia nueva.
- **Requisitos de auditoría:** ninguno nuevo — ni `GET` ni `POST
  /v1/contractor/leads` emiten `AuditLog` hoy (verificado leyendo
  `contractor.service.ts`); no se agrega logging nuevo en esta fase.

## 4. Escenarios y criterios de aceptación

### P1 — Ver los leads y stats de la propia org

```gherkin
DADO un usuario OPS_ADMIN autenticado en apps/mobile, con leads en varios
  status en su org
CUANDO abre el tab Contractors
ENTONCES ve la lista de leads de su org (GET /v1/contractor/leads) y las
  cards de conteo por status (GET /v1/contractor/leads/stats) — ambos
  scoped a su propia org, no tenant-wide
```

### P2 — Crear un lead nuevo

```gherkin
DADO un OPS_ADMIN en el tab Contractors
CUANDO toca "+ Nuevo lead", completa el nombre (mínimo) y confirma
ENTONCES el lead se crea en status "new" en su propia org (POST
  /v1/contractor/leads) y la lista se refresca para mostrarlo
```

Casos borde:

- [ ] Org sin leads — estado `empty` explícito.
- [ ] `GET /v1/contractor/leads`/`/stats` falla (network/5xx) — estado
      `error` visible, sin crashear la UI (mismo patrón que
      `AdminDashboardScreen`/`AdminDisputesScreen`).
- [ ] Formulario sin nombre — el botón "Crear lead" queda deshabilitado,
      sin request al backend.
- [ ] `POST /v1/contractor/leads` falla — error visible, el formulario no se
      cierra silenciosamente ni pierde lo ya tecleado.
- [ ] Navegar fuera del tab y volver — refresca vía `useFocusEffect`, mismo
      patrón que Fase 7a/7b, sin estado obsoleto.

## 5. Contratos

Ningún contrato Zod nuevo — el backend expone tipos TypeScript planos
(`contractor.controller.ts`/`contractor.service.ts`), sin `packages/schemas`
dedicado para leads. **Importante:** `apps/mobile/src/api/contractor.ts` se
escribió contra el contrato real del backend
(`LeadStatus = "new" | "contacted" | "estimate_sent" | "estimate_approved" |
"in_progress" | "completed" | "lost"`, `LeadSource` con el enum real,
`getStats` sin `conversionRate`), **no** contra los tipos locales de
`apps/web/app/(app)/admin/contractors/page.tsx`, que están desalineados del
backend (usa `LeadStatus` con `"won"`/`"archived"` que el backend nunca
produce, envía `trade` en el body que `createLead` nunca lee — solo lee
`jobType` —, y renderiza `stats.conversionRate`, un campo que
`getStats` no devuelve). Esta fase no corrige ese drift en `apps/web`
(fuera de alcance, requiere su propio cambio) pero documenta que no se
replica en mobile.

### UI

```yaml
surfaces:
  - apps/mobile AdminTabNavigator (bottom tabs: Dashboard, Disputes, Contractors, Settings)
  - apps/mobile AdminContractorsScreen (una sola pantalla, sin stack)
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - Nuevo src/api/contractor.ts (fetchLeads, fetchLeadStats, createLead),
    mismo patrón sin-BFF que src/api/disputes.ts
  - src/navigation/types.ts: AdminTabParamList gana Contractors: undefined
  - Cero botones de acción de status/delete/estimate en esta pantalla
```

### Agente/Prometeo

No aplica.

## 6. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** ninguno nuevo. `ContractorLead.status` tiene su
  propio ciclo de vida en el backend (`new` → `contacted` → ... → `lost`),
  pero esta fase no dispara ninguna transición (crear siempre entra en
  `new`, sin selector de status en el formulario).
- **Invariantes:** `docs/foundation/DOMAIN_INVARIANTS.md` — sin cambios.
- **Eventos:** ninguno — lectura + una creación aditiva simple.

## 7. Datos y migración

No aplica — sin modelos Prisma nuevos, sin migración. `ContractorLead` ya
existe.

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna nueva — mismos endpoints ya usados por
  `apps/web`.
- **Feature flags:** ninguno.
- **Plan de canary:** build interno (`eas build --profile preview`) — misma
  limitación ya documentada en `apps/mobile/README.md` (sandbox sin
  Xcode/Android SDK/simulator).
- **Evidencia de producción requerida:** run real en device/simulador con
  una cuenta `OPS_ADMIN` real: ver leads existentes de su org, crear uno
  nuevo y confirmar que aparece en la lista — antes de `VERIFIED`.
- **Owner operativo:** `semse-core`.

## 9. Tests requeridos

- [ ] `AdminContractorsScreen.test.tsx` — loading/empty/ready/error, listado
      con status+stats, creación de lead, ausencia de acciones fuera de
      alcance. Mismo patrón que `AdminDisputesScreen.test.tsx` +
      `worker/DisputesScreen.test.tsx` (creación).
- [ ] `pnpm --filter @semse/mobile test` verde, sin regresiones.
- [ ] `pnpm --filter @semse/mobile check` (`tsc --noEmit`) limpio.
- [ ] Canary/smoke autenticado en producción antes de marcar `VERIFIED`.

## 10. Mapa de implementación

### Mobile (`apps/mobile`)

- `src/api/contractor.ts` — nuevo.
- `src/screens/admin/AdminContractorsScreen.tsx` — nuevo.
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Contractors`.
- `src/navigation/types.ts` — `AdminTabParamList` gana `Contractors`.
- `src/navigation/RoleGate.tsx` — comentario actualizado.
- `apps/mobile/README.md` — actualizar sección Admin.

### Tests

- `apps/mobile/src/screens/admin/AdminContractorsScreen.test.tsx` — nuevo.

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
