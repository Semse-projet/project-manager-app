---
type: tasks
feature: "F10 — Programa de recompensa para originador/facilitador"
domain: "core"
plan: "docs/specs/core/originador-referral-program.plan.md"
version: "1.2"
status: "IN_PROGRESS"
branch: "feat/f10-originator-registration"
date: "2026-08-13"
---

# Tareas: Programa de recompensa para originador/facilitador

> Spec `APPROVED` 2026-08-04, gate de pagos `critical` ya revisado punto
> por punto (spec §12b), incluida la corrección del 2026-08-04 que retiró
> la dependencia dura hacia F5. El owner ya resolvió, el mismo día:
> recompensa **híbrida** (bono fijo + % de `platformFeeCents`), identidad
> fiscal **delegada a Stripe Connect**, alcance **multi-país** con
> **Latinoamérica priorizada** tras EE.UU., y elegibilidad **híbrida**
> (cuenta verificada para registrarse + `StripeConnectAccount` para cobrar).
> Fases 0-2 pueden avanzar tras cerrar T-001..T-004. **Fase 3 sigue
> bloqueada** solo por el gate legal por país (solo EE.UU. investigado,
> spec §11) — no por F5 ni por falta de aprobación.

## Fase 0 — Preflight

Resuelto por el owner (2026-08-04):

- [x] **T-000a** Tipo de recompensa: híbrido — bono fijo en "primer
      milestone financiado" + % de `platformFeeCents` en "proyecto
      completado".
- [x] **T-000b** Identidad fiscal: delegada a `StripeConnectAccount`
      (reutiliza el mecanismo de `PRO`), no se construye recolección
      propia.
- [x] **T-000c** Alcance geográfico: multi-país desde el inicio,
      Latinoamérica priorizada tras EE.UU.
- [x] **T-000d** Elegibilidad: híbrida — cuenta verificada para
      registrarse, `StripeConnectAccount.payoutsEnabled` antes de que
      cualquier hito cuente para recompensa.

Resuelto por el owner, segunda ronda (2026-08-04):

- [x] **T-001** Montos de piloto: US$25 fijo + 30% de `platformFeeCents`
      (corregido tras verificar que `SEMSE_PLATFORM_FEE_RATE` real es
      0.75%, no un supuesto mayor — 5% habría dado ~US$3.75 en un
      milestone de US$10k, casi simbólico).
- [x] **T-003** Nada más allá de cuenta SEMSE verificada para registrarse
      como originador — sin antigüedad mínima.
- [x] **T-004** Primer país de Latinoamérica: México.
- [x] **T-005** Investigación externa para México corrida (spec §11b).
      **Resultado: el gate legal de México NO cierra con esto** — SEMSE
      necesitaría registrarse como plataforma de intermediación ante el
      SAT y resolver retención de ISR/IVA + CFDI mensual antes de activar
      Fase 3 ahí. Ver T-007 nuevo.

Resuelto por investigación de código, tercera ronda (2026-08-04):

- [x] **T-002** El endpoint de onboarding (`POST /v1/payments/connect/
      onboarding-link`) ya es reutilizable sin cambios de payments —
      gateado solo por `projects:read`, no específico de `PRO`. **Pero
      revela un gap nuevo:** `WORKER` no tiene `projects:read` en
      `packages/auth/src/rbac.ts` — un originador cuyo único rol sea
      `WORKER` no podría completar el onboarding hoy. El owner confirmó
      que `WORKER` sí debe poder ser originador sin necesidad de
      `CLIENT`/`PRO` — ver T-009 nuevo.
- [x] Confirmado: "Contratista" no es un rol RBAC separado — es un `PRO`
      administrando una organización con `WORKER`s (`ContractorLead` en
      el schema). No requiere cambios en el modelo de roles.

Implementado (2026-08-04):

- [x] **T-009** Nuevo permiso `payments:connect:self`, otorgado a
      `CLIENT`, `PRO` y `WORKER` en `packages/auth/src/rbac.ts` (no se
      amplió `projects:read` de `WORKER` — habría dado acceso de lectura a
      `buildops`/`marketplace`/`pricing`/`intelligence`/`semse-agents`,
      mucho más de lo necesario). Los 4 endpoints de
      `stripe-connect.controller.ts` (`GET/POST account`,
      `POST onboarding-link`, `POST sync`) ahora exigen
      `payments:connect:self` en vez de `projects:read`. `CLIENT`/`PRO`
      conservan `projects:read` sin cambios (no pierden nada) y ganan el
      permiso nuevo, así que no hay regresión — verificado con
      `pnpm --filter @semse/api build` (limpio) y
      `stripe-connect.service.test.ts` (3/3 verde).

Todavía abierto:

- [ ] **T-007** Conseguir asesoría fiscal mexicana real (contador/abogado
      fiscal) antes de planear activar México en Fase 3 — fuera del
      alcance de lo que investigación web puede resolver (spec §11b).
- [x] **T-008** Confirmar si SEMSE ya tiene `PRO` mexicanos cobrando por
      Stripe Connect hoy. **Resuelto 2026-08-04 (segundo intento).** Causa
      real del `P1000` del primer intento: la URL de conexión no
      especificaba `sslmode=require`, que el proxy público de Postgres
      exige — no era un problema de la contraseña ni de su codificación.
      Con `sslmode=require` agregado, consulta real ejecutada contra
      producción vía Prisma Client (`SELECT country, COUNT(*) ...
      GROUP BY country` sobre `StripeConnectAccount`):

      ```json
      [{ "country": "US", "accounts": 1, "payouts_enabled": 0 }]
      ```

      **SEMSE no tiene ninguna cuenta `StripeConnectAccount` con
      `country = "MX"` hoy** — cero originadores o `PRO` mexicanos
      cobrando por Stripe Connect. Además, la única cuenta que existe
      (EE.UU.) todavía no tiene `payoutsEnabled`, señal de que los payouts
      reales por Stripe Connect apenas están arrancando en producción.
      Esto descarta el riesgo que motivó T-008 (obligación de
      retención/CFDI ya existente sin resolver) — no hay nada que
      reconciliar retroactivamente para México.
- [x] **T-006** Crear rama de implementación — no aplica todavía como
      "rama separada": T-009 se implementó directo (cambio acotado,
      verificado con build+test); el resto de Fase 2/3 sigue esperando
      T-007.

## Fase 1 — Tests antes del código (anti-abuso primero) — IMPLEMENTADA 2026-08-13

`apps/api/test/originator.service.test.ts`, integración contra Postgres real
(no mocks de lógica de negocio), 7/7 verdes + 1 skip explícito (T-016).

- [x] **T-010** Test: publicar sin actividad NO genera recompensa (spec
      §4 P2 — criterio de aceptación central).
- [x] **T-011** Test: rechazo del dueño bloquea toda recompensa futura.
- [x] **T-012** Test: mismo originador en múltiples proyectos sin avance
      se flaguea, no bloquea automáticamente.
- [x] **T-013** Test: `OriginatorReward` permanece `pending_review` 14
      días antes de `released` (spec §4 P1a/P1b, hallazgo §11).
- [ ] **T-014** Test: fallo de liberación deja el evento en
      `release_failed`, nunca ambiguo con `released` (spec §12b) —
      **Fase 3**, no aplica todavía (no hay liberación real que pueda
      fallar sin `payment-governance.service.ts` conectado).
- [x] **T-015** Test: `OriginatorReward` nace en
      `blocked_no_payout_account` si el originador no tiene
      `StripeConnectAccount.payoutsEnabled`, y pasa a `pending_review`
      (arrancando los 14 días) recién al completarse el onboarding (spec
      §4 caso borde, §7).
- [x] **T-016** Test: originador de un país sin gate legal cerrado —
      marcado `test.skip` explícito, documentado como no-aplica-todavía
      (no hay lógica de país hasta Fase 3), no omitido en silencio.
- [x] **T-017** Test: el evento `PLATFORM_FEE_SHARE` calcula el monto
      sobre `platformFeeCents`, nunca sobre el valor bruto del proyecto;
      si `platformFeeCents` es 0 (o negativo), el monto es 0, nunca
      negativo (spec §4 P1b).
- [x] Aislamiento de tenant (no estaba numerado, agregado por consistencia
      con el resto de specs SDD 2.0 de esta sesión): `propose()`/
      `validateForProject()` nunca resuelven un registro de otro tenant.

## Fase 2 — Registro y validación (sin dinero) — IMPLEMENTADA 2026-08-13

Módulo `apps/api/src/modules/originator/` (repository/service/controller/
module), permiso RBAC `project:originate` (CLIENT/PRO/WORKER, mismo patrón
que `payments:connect:self`), migración Prisma aditiva
`20260813142704_add_project_originator`, eventos
`project.originator_proposed.v1`/`project.originator_validated.v1` con
outbox transaccional (mismo patrón que `evidence.repository.ts`). Detrás
de flag `SEMSE_ORIGINATOR_REGISTRATION_ENABLED`/
`SEMSE_ORIGINATOR_CANARY_TENANT_IDS`, apagado por defecto.

- [x] **T-020** Implementado `POST /v1/projects/:projectId/originator`.
- [x] **T-021** Implementado `POST /v1/projects/:projectId/originator/validate`
      (flujo de validación del dueño — sólo el `createdBy` del
      `BuildOpsProject` puede decidir).
- [x] **T-022** Detrás de flag, fase "solo registro" — el endpoint
      devuelve 404 si el tenant no está habilitado; sin pago real en
      ninguna ruta de código de esta fase.
- [x] **T-023** Implementado modelo `OriginatorReward` (spec §7, plan §4)
      + `OriginatorService.createRewardEvent()`/`unblockPendingRewards()`
      — la lógica de monto/estado está completa y testeada (T-013/T-015/
      T-017).
- [x] **T-023b** Slice siguiente cerrado (2026-08-13): `OriginatorReward`
      conectado a los dos triggers reales del spec.
      `OriginatorService.evaluateMilestoneFundedTrigger()` se dispara
      "fire-and-forget" desde `PaymentsService` justo después de que un
      depósito finaliza `succeeded` (mismo punto que ya finaliza el
      depósito, sin webhook async separado); crea `FIXED_BONUS` sólo si el
      monto depositado cubre el primer milestone (`sequence asc`).
      `OriginatorService.evaluateProjectCompletedTrigger()` se dispara
      igual desde `ProjectsController.updateStatus()` en el branch
      `status === "completed"` (mismo patrón que el archivo de
      digital-twin que ya vivía ahí); crea `PLATFORM_FEE_SHARE` a partir
      de `releasedAmount * StripeConnectService.PLATFORM_FEE_RATE * 100`.
      Idempotencia garantizada por constraint único nuevo
      `@@unique([projectOriginatorId, type])` en `OriginatorReward`
      (migración `20260813193605_add_originator_reward_type_unique`) — un
      segundo depósito o una segunda liberación nunca duplican la
      recompensa. El puente `BuildOpsProject → Job → Project` que ambos
      triggers necesitan para resolver "¿este proyecto tiene un
      originador validado?" ya existe desde PR #571
      (`BuildOpsService.publishAsJob()`). Cubierto por
      `apps/api/test/originator-reward-triggers-integration.test.ts`
      (5/5 verde: bono al cubrir el primer milestone, no-op si el depósito
      no alcanza, no-duplicación en un segundo depósito suficiente, cálculo
      exacto de `PLATFORM_FEE_SHARE`, no-op silencioso sin originador
      validado). Sigue detrás del mismo flag
      `SEMSE_ORIGINATOR_REGISTRATION_ENABLED`/
      `SEMSE_ORIGINATOR_CANARY_TENANT_IDS`; ningún dinero real se mueve
      todavía (eso sigue en Fase 3, bloqueada por el gate legal por país).
- [x] **T-024** Confirmado — ya resuelto por T-009 (2026-08-04): `WORKER`
      ya tiene `payments:connect:self`, así que el onboarding de
      `StripeConnectAccount` ya funciona para cualquier rol. No requirió
      cambios adicionales en esta pasada.

## Fase 3 — Recompensa real (bloqueada por gate legal por país, ya no por F5)

- [ ] **T-030** Conectar `OriginatorReward` a la liberación real vía
      `payment-governance.service.ts` + `stripe-connect.service.ts` —
      mismo mecanismo que ya paga a `PRO`, sin lógica de liberación
      propia.
- [ ] **T-031** Aprobación explícita y separada del owner antes de activar
      en EE.UU. (primer país) en cualquier tenant.
- [ ] **T-032** Definir y probar reversibilidad si el proyecto se
      cancela/disputa después de pagar (coordinado con
      `escrow-release.service.ts`).
- [ ] **T-033** Activar México (spec §11b) — **bloqueada, no lista**:
      investigación externa ya corrida (T-005), pero reveló que el gate
      real no es solo investigación, es una obligación operativa (alta
      ante el SAT, retención ISR/IVA, CFDI mensual). Requiere T-007
      (asesoría fiscal mexicana) y probablemente trabajo de ingeniería
      dedicado en `apps/api/src/modules/payments/`, no solo un flag. No
      tratar como "ya investigado, listo para activar".

## Fase 4 — Validación y cierre

- [x] **T-040** `pnpm spec:validate:strict` en verde (2026-08-13, incluye
      el slice T-023b).
- [ ] **T-041** Auditoría end-to-end de al menos un ciclo completo
      originador→hito verificado→recompensa pagada — **Fase 3**, requiere
      dinero real, no aplica a esta pasada.
- [x] **T-042** Actualizar `IMPLEMENTATION_STATUS_MATRIX.md` y
      `ROADMAP.md` §F10 (2026-08-13, refleja Fase 1-2 + triggers
      conectados (T-023b), todavía sin merge/deploy).

## Criterio de cierre

- [ ] Ningún evento de "solo publicar" dispara recompensa, verificado con
      test explícito.
- [ ] Toda recompensa pagada queda auditada con el hito exacto que la
      justificó.
- [ ] `payment-governance.service.ts`/`escrow-release.service.ts`/
      `stripe-connect.service.ts` intactos, sin lógica de liberación
      paralela.
- [ ] `pnpm spec:validate:strict` verde.
- [ ] Ningún país recibe pago real sin su propio gate legal cerrado (spec
      §12b) — verificado explícitamente, no asumido por similitud con
      EE.UU.
- [ ] Spec marcado `IMPLEMENTED`/`VERIFIED` solo con evidencia de
      producción real de un ciclo completo, no por existencia de código.
