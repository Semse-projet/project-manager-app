---
id: "ui.mobile-admin-disputes-resolution"
title: "Mobile Admin Disputes Resolution — Fase 7g de apps/mobile"
domain: "ui"
sdd_version: "2.0"
version: "1.0"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/mobile/src/navigation/AdminDisputesStackNavigator.tsx
  - apps/mobile/src/screens/admin/AdminDisputeDetailScreen.tsx
  - apps/mobile/src/api/disputes.ts
  - apps/api/src/modules/disputes/disputes.controller.ts
  - apps/api/src/modules/disputes/disputes.service.ts
  - apps/web/app/(app)/admin/disputes/page.tsx
related_tests: []
related_endpoints:
  - v1/disputes
related_events:
  - dispute.resolved
related_agents: []
last_verified: "2026-08-26"
---

# Spec: Mobile Admin Disputes Resolution — Fase 7g de `apps/mobile`

> **`status: DRAFT`, `risk: critical`. Este documento NO está aprobado y NO
> autoriza implementación.** Existe para que el owner revise §3b
> (Payment Governance) punto por punto y decida `APPROVED` o cambios,
> conforme a `.specify/memory/constitution.md` Artículo IV y
> `docs/SDD_GOVERNANCE.md` §7 "Economía". Ningún código de esta fase se
> escribe hasta ese sign-off explícito.

## 1. Problema y resultado

**Para quién:** usuarios con rol `OPS_ADMIN` que usan `apps/mobile`.

**Problema:** `docs/specs/ui/mobile-admin-disputes.spec.md` (Fase 7b, ya
`IMPLEMENTED`) dejó el tab `Disputes` de mobile estrictamente de lectura,
excluyendo explícitamente resolver una disputa "porque en la práctica
destraba movimientos de escrow aguas abajo" y "necesita su propio spec con
revisión de `paymentGovernance` dedicada" (Fase 7b §2). Este documento es
ese spec dedicado — para resolver, no para asignar/marcar-en-revisión (ver
§2 "Fuera de alcance").

**Resultado esperado (si se aprueba):** un `OPS_ADMIN` autenticado en
`apps/mobile` puede abrir el detalle de una disputa `OPEN`/`ASSIGNED`/
`UNDER_REVIEW` y resolverla — eligiendo un `resolutionType`
(`client_favor`/`pro_favor`/`partial_50_50`/`escalated_legal`) y escribiendo
un motivo — con una confirmación deliberadamente más estricta que la que
`apps/web` ya tiene en producción (ver §3b, punto 4).

## 2. Alcance

### Incluido (si se aprueba)

- Botón "Resolver" en `AdminDisputeDetailScreen` (Fase 7b), visible solo
  para disputas en estado `OPEN`/`ASSIGNED`/`UNDER_REVIEW` — nunca sobre
  una ya `RESOLVED`/`REJECTED`.
- Selector de `resolutionType` (4 opciones, ver §1) + campo de texto para
  `resolution` (motivo, mínimo 5 caracteres, mismo mínimo que
  `worker/DisputesScreen.tsx` usa para crear una disputa).
- Confirmación de dos pasos antes de enviar `POST
  /v1/disputes/:disputeId/resolve` (ver §3b punto 4 para el diseño exacto
  — pendiente de aprobación, no un `window.confirm()` de un solo toque
  como `apps/web`).
- `AuditLog` ya se emite server-side (`dispute.resolve`, verificado en
  `disputes.service.ts:331-341`) — sin cambios necesarios ahí.

### Fuera de alcance

- **Asignar una disputa** (`POST /v1/disputes/:disputeId/assign`,
  `disputes:assign`) y **marcar en revisión**
  (`POST /v1/disputes/:disputeId/review`, `disputes:assign`) — ambos
  permisos ya están otorgados a `OPS_ADMIN`, pero **ninguna de las dos
  tiene hoy una UI en `apps/web`** (verificado: solo existe el BFF
  passthrough `app/api/semse/disputes/[disputeId]/review/route.ts`, sin
  ninguna página que lo consuma) — construir esto en mobile sería la
  primera UI de este flujo en todo el producto, sin precedente que
  auditar. Selección de assignee necesita además una fuente de usuarios
  elegibles (candidato: reusar `fetchUsers()` de Fase 7d, filtrado a
  `OPS_ADMIN`), que este documento no diseña. Ambas quedan para un spec
  separado si se decide construirlas.
- **Cualquier acción de pago (`Finance`)** — fuera de alcance total, con
  un hallazgo aparte que bloquea esa superficie por sí sola: `POST
  /v1/payments/release` y el flujo de reembolso están gateados por
  `finance:write`/`finance:read`, y **ningún rol tiene ese permiso
  otorgado en `packages/db/prisma/seed.ts` hoy** (verificado con grep
  sobre el archivo completo — cero resultados) — los botones de
  liberar/reembolsar de `apps/web`'s Finance page devolverían 403 para
  cualquier usuario real actualmente. Resolver esa laguna de RBAC es su
  propia decisión (a quién otorgar el permiso, con o sin aprobación
  dual), no algo que este documento decida de paso.
- **Cambiar el resultado de una disputa ya resuelta** — no existe ese
  endpoint hoy; no hay nada que excluir más allá de "no se agrega".

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` | `disputes:resolve` | ya otorgado en `packages/db/prisma/seed.ts`; `disputes.repository.ts` scopea tenant-wide para `OPS_ADMIN` (mismo hallazgo que Fase 7b) | Resolver cualquier disputa del tenant | Liberar o reembolsar fondos directamente — `resolve` no llama a `PaymentsService`; solo graba `resolutionType`+`resolution` y emite `dispute.resolved` (verificado en `disputes.service.ts:315-355`) |

- **Lo que `resolve` NO hace, verificado leyendo el código:** no mueve
  dinero. Emite un evento de dominio (`dispute.resolved`) que consumidores
  aguas abajo pueden usar para decidir una liberación — pero el mecanismo
  de liberación real (`Finance`/`payment-governance`) es una acción manual
  separada que, hoy, nadie puede ejecutar (ver §2, hallazgo de RBAC). Esto
  reduce el riesgo inmediato de esta fase específica (no hay un camino
  automático de "tocar este botón → el dinero se mueve") pero no elimina
  el riesgo de producto: el valor de `resolutionType` es el registro de
  intención que, cuando la laguna de Finance se resuelva, determinará
  quién recibe qué.

### 3b. Payment Governance — gate crítico (Constitución Art. IV, SDD_GOVERNANCE §7)

> **Cada punto requiere revisión y marca explícita del owner. Ningún punto
> se auto-aprueba por el agente.** Formato tomado de
> `docs/specs/core/originador-referral-program.spec.md` (spec `critical`
> ya aprobado, mismo patrón de gate).

- [ ] **Punto 1 — ¿Se quiere paridad mobile para esta acción, o debe
      quedar deliberadamente web-only?** `apps/web` ya la tiene en
      producción (con una sola confirmación `window.confirm()`); mobile
      no tiene hoy ningún flujo equivalente. Decisión del owner.
- [ ] **Punto 2 — Ledger/provider separados.** `resolve` no toca
      `PaymentsService` ni ningún ledger — verificado. Sin acción
      requerida en este punto salvo confirmar que se mantiene así (no se
      agrega ninguna llamada a pagos en esta fase).
- [ ] **Punto 3 — Reversals/fallos no cuentan como dinero movido.** No
      aplica directamente (esta fase no libera ni revierte fondos), pero
      el owner debe confirmar que el copy de la UI mobile no implica lo
      contrario (p. ej. no debe decir "fondos liberados", debe decir algo
      como "resolución registrada — la liberación de fondos es un paso
      manual aparte").
- [ ] **Punto 4 — Fricción/confirmación mínima requerida.** Propuesta a
      revisar: confirmación de dos pasos (revisar resumen de la
      resolución elegida antes de confirmar, sin valor pre-seleccionado
      para `resolutionType`) — estrictamente más fricción que el
      `window.confirm()` de un toque que `apps/web` ya tiene en
      producción, nunca menos. El owner decide si esto es suficiente o si
      se requiere además re-autenticación / un segundo aprobador.
- [ ] **Punto 5 — Auditoría.** `dispute.resolve` ya emite `AuditLog`
      server-side (verificado). El owner confirma que no se necesita
      señal adicional específica de mobile (p. ej. device/session id) más
      allá de lo que el token de sesión ya provee.
- [ ] **Punto 6 — Alcance de "assign"/"review".** El owner decide si
      quedan fuera de esta fase (recomendado, ver §2) o si se piden en un
      spec separado.
- [ ] **Punto 7 — Laguna de RBAC en `Finance`.** El owner decide si se
      abre un spec/ticket aparte para otorgar `finance:write`/`read` (a
      qué rol, con qué gate) — no bloquea esta fase (que no usa ese
      permiso), pero queda documentado aquí porque se descubrió en la
      misma investigación.

**Sólo cuando los 7 puntos estén marcados por el owner, `status` puede
pasar a `APPROVED` y este documento continúa al flujo `plan` → `tasks` →
`implement`.**

## 4. Escenarios y criterios de aceptación (borrador, sujeto a §3b)

### P1 — Resolver una disputa abierta

```gherkin
DADO un OPS_ADMIN viendo el detalle de una disputa OPEN/ASSIGNED/UNDER_REVIEW
CUANDO toca "Resolver", elige un resolutionType, escribe un motivo (≥5
  caracteres) y confirma en el paso de confirmación
ENTONCES POST /v1/disputes/:disputeId/resolve se envía con esos datos, la
  disputa pasa a RESOLVED, y la UI dice explícitamente que la liberación de
  fondos (si aplica) es un paso manual aparte en Finance
```

Casos borde (borrador):

- [ ] Disputa ya `RESOLVED`/`REJECTED` — sin botón "Resolver" visible.
- [ ] `POST .../resolve` falla (network/5xx/403) — error visible, la
      disputa no cambia de estado en la UI hasta confirmación del backend.
- [ ] Motivo `< 5` caracteres o sin `resolutionType` elegido — botón de
      confirmar deshabilitado, sin request al backend.

## 5. Contratos

Ningún contrato Zod nuevo — se reusa `resolveProjectDisputeSchema`/
`DisputeRecordView` (`packages/schemas/src/dispute.schema.ts`), mismos que
`apps/web` ya usa.

## 6. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** `Dispute.status` transiciona a `RESOLVED` vía
  el mismo mecanismo que `apps/web` ya usa — sin transición nueva.
- **Eventos:** `dispute.resolved`, ya definido y emitido — sin evento
  nuevo.

## 7. Datos y migración

No aplica.

## 8. Observabilidad, despliegue y activación

- Pendiente de diseñar en el `.plan.md` una vez `APPROVED` — candidato a
  feature flag apagado por defecto dado `risk: critical`, siguiendo el
  patrón ya usado en `SEMSE_ORIGINATOR_REGISTRATION_ENABLED`.

## 9. Tests requeridos

Pendiente — se define en `.tasks.md` una vez `APPROVED` (Fase A precede
código, mismo estándar que el resto de Fase 7).

## 10. Mapa de implementación

Pendiente — no aplica hasta `APPROVED`.

## 11. Investigación externa

No aplica.

## 12. Gates de cierre

- [ ] **§3b revisado punto por punto por el owner — prerrequisito de
      `APPROVED`, no posterior a él.**
- [ ] Spec enlazado por `pnpm spec:index`
- [ ] `.plan.md`/`.tasks.md`/`.checklist.md` creados después de `APPROVED`
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
