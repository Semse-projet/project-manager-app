---
id: "ui.mobile-admin-reputation"
title: "Mobile Admin Reputation — Fase 7h de apps/mobile"
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
  - apps/mobile/src/screens/admin/AdminReputationScreen.tsx
  - apps/mobile/src/api/reputation.ts
  - apps/api/src/modules/ratings/ratings.controller.ts
  - apps/api/src/modules/ratings/reputation.service.ts
  - packages/schemas/src/reputation.schema.ts
related_tests:
  - apps/mobile/src/screens/admin/AdminReputationScreen.test.tsx
related_endpoints:
  - v1/ratings
related_events: []
related_agents: []
last_verified: "2026-08-26"
---

# Spec: Mobile Admin Reputation — Fase 7h de `apps/mobile`

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

## 1. Problema y resultado

**Para quién:** usuarios con rol `OPS_ADMIN` que usan `apps/mobile`.

**Problema:** el resto de Fase 7 dejó `AdminTabNavigator` con `Dashboard`,
`Disputes`, `Labor`, `Users`, `Contractors` y `Trust`, pero un `OPS_ADMIN`
no tiene forma de ver la reputación calculada de los profesionales del
tenant desde mobile — tiene que abrir `apps/web/app/(app)/admin/reputation`
para eso, aunque el mismo backend (`GET /v1/ratings/reputation`) ya está
expuesto y ya usa un permiso (`ratings:read`) que `OPS_ADMIN` tiene
otorgado.

**Resultado esperado:** un `OPS_ADMIN` autenticado en `apps/mobile` puede,
sin salir de la app, ver la reputación de todos los profesionales del
tenant (no solo de su org — mismo alcance que `Disputes`/`Trust`, ver §3),
ordenados por puntaje, con su tier y señales agregadas. **Esta fase es
estrictamente de lectura** — no hay ninguna acción, ni el detalle de
ratings individuales por profesional (ver §2).

## 2. Alcance

### Incluido

- Nuevo tab `Reputation` en `AdminTabNavigator`, una sola pantalla
  (`AdminReputationScreen`) — sin stack/detalle.
- `GET /v1/ratings/reputation` (nuevo cliente `src/api/reputation.ts`,
  mismo patrón sin-BFF que el resto de `apps/mobile`), mostrando cards de
  conteo (`total` de profesionales, puntaje promedio, cantidad `trusted`)
  y la lista ordenada por `score` descendente: identificador truncado,
  tier (badge), puntaje, y un resumen de señales (`totalRatings`,
  `completionRate`, `disputeResilienceRate`).
- Estados UI explícitos: `loading`, `empty`, `ready`, `error` (mismo
  estándar que el resto de Fase 7).
- `AdminTabParamList` (`src/navigation/types.ts`) gana `Reputation: undefined`.
- `apps/mobile/README.md`: sección Admin actualizada.

### Fuera de alcance

- **Detalle de ratings individuales por profesional** — `apps/web`'s
  Reputation page también llama `GET /v1/ratings` y permite seleccionar un
  profesional para ver sus reseñas una por una. Es una superficie de
  lectura separada y más grande (potencialmente muchas filas por
  profesional); esta fase no la construye, mismo criterio que excluir el
  trust-passport en Fase 7f.
- **Cualquier acción sobre una reputación o rating** — no existe hoy
  ningún endpoint de escritura para reputación en `ratings.controller.ts`
  más allá de crear un rating nuevo (`ratings:create`, ya cubierto por el
  flujo de calificación de Worker/Client existente); nada que excluir más
  allá de "no se agrega".
- **Filtro o búsqueda en la UI** — el dataset es tenant-wide pero acotado a
  profesionales con al menos una reserva de trabajo
  (`computeBatchForTenant` solo itera `JobReservation` distintas); sin
  necesidad urgente de filtro con listas de este tamaño.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` | `ratings:read` | `reputation.service.ts:computeBatchForTenant` filtra únicamente por `tenantId` (vía `JobReservation` del tenant) — tenant-wide, igual que `Disputes`/`Trust` (verificado leyendo el código) | Ver la reputación de todos los profesionales del tenant | Ver reputación de otro tenant; mutar cualquier score (no hay endpoint de escritura que alcanzar) |

- **Tenant/org boundary:** idéntico al resto de `/v1` —
  `resolveRequestContext` inyecta `tenantId` del token de sesión;
  `ratings.controller.ts` lo pasa tal cual a `ReputationService`, sin
  excepción de rol.
- **Ownership/resource policy:** sin cambios — esta fase no introduce ni
  relaja ninguna política, solo consume el `GET` que ya implementa el
  scoping tenant-wide.
- **Step-up o aprobación humana:** ninguna acción de esta fase la
  requiere (solo lectura).
- **Datos `privacyCritical`:** `userId` se muestra truncado, no el email
  completo — de hecho, el backend nunca adjunta ni email ni nombre a esta
  respuesta (ver §5), así que hay *menos* superficie de PII expuesta aquí
  que en la propia página de `apps/web`, no más.
- **Requisitos de auditoría:** ninguno nuevo — `GET /v1/ratings/reputation`
  no emite `AuditLog` (es lectura); no se agrega logging nuevo.

## 4. Escenarios y criterios de aceptación

### P1 — Ver la reputación de todo el tenant

```gherkin
DADO un usuario OPS_ADMIN autenticado en apps/mobile, con profesionales con
  reputación calculada en más de una org del tenant
CUANDO abre el tab Reputation
ENTONCES ve la lista completa (GET /v1/ratings/reputation), ordenada por
  score descendente, con cards de conteo — tenant-wide, no solo su org
```

Casos borde:

- [ ] Tenant sin profesionales con reputación calculada — estado `empty`
      explícito.
- [ ] `GET /v1/ratings/reputation` falla (network/5xx) — estado `error`
      visible, sin crashear la UI (mismo patrón que el resto de Fase 7).
- [ ] Profesional sin `totalRatings` (recién asignado, reputación en 0) —
      se renderiza igual que cualquier otro, sin caso especial que rompa
      el layout.

## 5. Contratos

Ningún contrato Zod nuevo — se reusa `reputationScoreViewSchema`/
`ReputationScoreView` (`packages/schemas/src/reputation.schema.ts`), ya
exportado por el barrel del paquete, mismo patrón de reuso que
`TrustOverview` en Fase 7f.

**Drift verificado en `apps/web`, no replicado aquí:** `apps/web/app/(app)/
admin/reputation/page.tsx` declara un tipo local `ReputationScore` con un
campo opcional `user?: { email?: string; name?: string }` que el backend
**nunca puebla** — verificado leyendo `reputation.service.ts:computeForUser`,
cuyo `return` solo arma `{ userId, score, tier, signals, decayHalfLifeDays,
algorithmVersion, computedAt }`, sin ningún `user`. Como consecuencia, la UI
de `apps/web` siempre cae al fallback (`rep.user?.email ?? rep.userId...`)
y muestra un id truncado en vez de un email — no un crash, pero sí una
degradación de UX no documentada hasta ahora. Esta fase no la corrige en
`apps/web` (fuera de alcance) pero usa el mismo fallback honesto en mobile
en vez de aparentar que el campo existe.

### UI

```yaml
surfaces:
  - apps/mobile AdminTabNavigator (bottom tabs: ..., Trust, Reputation, Settings)
  - apps/mobile AdminReputationScreen (una sola pantalla, sin stack)
states:
  - loading
  - empty
  - ready
  - error
required_behavior:
  - Nuevo src/api/reputation.ts (fetchReputationBatch), mismo patrón
    sin-BFF que src/api/trust.ts
  - src/navigation/types.ts: AdminTabParamList gana Reputation: undefined
  - Cero botones de acción o de detalle de ratings en esta pantalla
```

### Agente/Prometeo

No aplica.

## 6. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** ninguno — la reputación se calcula
  dinámicamente por `ReputationService.computeForUser` a partir de señales
  existentes (ratings/jobs/disputas), sin FSM propio, y esta fase no
  dispara ningún recálculo.
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
  una cuenta `OPS_ADMIN` real que tenga profesionales con reputación
  calculada en más de una org, para confirmar visualmente el escenario P1
  — antes de `VERIFIED`.
- **Owner operativo:** `semse-core`.

## 9. Tests requeridos

- [ ] `AdminReputationScreen.test.tsx` — loading/empty/ready/error, cards
      de conteo, listado ordenado con tier+score+señales, fallback de id
      truncado, ausencia de acciones mutantes/detalle de ratings.
- [ ] `pnpm --filter @semse/mobile test` verde, sin regresiones.
- [ ] `pnpm --filter @semse/mobile check` (`tsc --noEmit`) limpio.
- [ ] Canary/smoke autenticado en producción antes de marcar `VERIFIED`.

## 10. Mapa de implementación

### Mobile (`apps/mobile`)

- `src/api/reputation.ts` — nuevo.
- `src/screens/admin/AdminReputationScreen.tsx` — nuevo.
- `src/navigation/AdminTabNavigator.tsx` — agregar tab `Reputation`.
- `src/navigation/types.ts` — `AdminTabParamList` gana `Reputation`.
- `apps/mobile/README.md` — actualizar sección Admin.

### Tests

- `apps/mobile/src/screens/admin/AdminReputationScreen.test.tsx` — nuevo.

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
