---
type: tasks
feature: "F10 — Programa de recompensa para originador/facilitador"
domain: "core"
plan: "docs/specs/core/originador-referral-program.plan.md"
version: "1.0"
status: "PENDING"
branch: "TBD — crear en T-006 tras cerrar T-001..T-004"
date: "2026-08-04"
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

- [x] **T-001** Montos de piloto: US$25 fijo + 5% de `platformFeeCents`.
- [x] **T-003** Nada más allá de cuenta SEMSE verificada para registrarse
      como originador — sin antigüedad mínima.
- [x] **T-004** Primer país de Latinoamérica: México.
- [x] **T-005** Investigación externa para México corrida (spec §11b).
      **Resultado: el gate legal de México NO cierra con esto** — SEMSE
      necesitaría registrarse como plataforma de intermediación ante el
      SAT y resolver retención de ISR/IVA + CFDI mensual antes de activar
      Fase 3 ahí. Ver T-007 nuevo.

Todavía abierto:

- [ ] **T-002** Confirmar con el owner de payments el flujo de onboarding
      de `StripeConnectAccount` para originadores (reutilizando el de
      `PRO` — confirmar que no requiere trabajo nuevo de payments).
- [ ] **T-007** Conseguir asesoría fiscal mexicana real (contador/abogado
      fiscal) antes de planear activar México en Fase 3 — fuera del
      alcance de lo que investigación web puede resolver (spec §11b).
- [ ] **T-008** Confirmar si SEMSE ya tiene `PRO` mexicanos cobrando por
      Stripe Connect hoy — si los hay, la misma obligación de
      retención/CFDI podría ya aplicar sin estar resuelta, ajeno a esta
      spec (spec §11b, backlog).
- [ ] **T-006** Crear rama de implementación solo después de T-002.

## Fase 1 — Tests antes del código (anti-abuso primero)

- [ ] **T-010** Test: publicar sin actividad NO genera recompensa (spec
      §4 P2 — criterio de aceptación central).
- [ ] **T-011** Test: rechazo del dueño bloquea toda recompensa futura.
- [ ] **T-012** Test: mismo originador en múltiples proyectos sin avance
      se flaguea, no bloquea automáticamente.
- [ ] **T-013** Test: `OriginatorReward` permanece `pending_review` 14
      días antes de `released` (spec §4 P1a/P1b, hallazgo §11).
- [ ] **T-014** Test: fallo de liberación deja el evento en
      `release_failed`, nunca ambiguo con `released` (spec §12b).
- [ ] **T-015** Test: `OriginatorReward` nace en
      `blocked_no_payout_account` si el originador no tiene
      `StripeConnectAccount.payoutsEnabled`, y pasa a `pending_review`
      (arrancando los 14 días) recién al completarse el onboarding (spec
      §4 caso borde, §7).
- [ ] **T-016** Test: originador de un país sin gate legal cerrado nunca
      recibe liberación real, aunque el mecanismo técnico funcione (spec
      §4 caso borde, §12b).
- [ ] **T-017** Test: el evento `PLATFORM_FEE_SHARE` calcula el monto
      sobre `platformFeeCents`, nunca sobre el valor bruto del proyecto;
      si `platformFeeCents` es 0, el monto es 0, nunca negativo (spec §4
      P1b).

## Fase 2 — Registro y validación (sin dinero)

- [ ] **T-020** Implementar `POST /v1/projects/:projectId/originator`.
- [ ] **T-021** Implementar flujo de validación del dueño.
- [ ] **T-022** Lanzar detrás de flag, fase "solo registro", sin pago real.
- [ ] **T-023** Implementar modelo `OriginatorReward` (spec §7, plan §4) —
      puede construirse antes de Fase 3 aunque el pago real siga
      bloqueado, ya que es prerrequisito de datos. No requiere modelo de
      identidad fiscal propio: lee `StripeConnectAccount` existente.
- [ ] **T-024** Confirmar/adaptar el flujo de onboarding de
      `StripeConnectAccount` para que un originador (que puede no ser
      `PRO`) también pueda completarlo.

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

- [ ] **T-040** `pnpm spec:validate:strict` en verde.
- [ ] **T-041** Auditoría end-to-end de al menos un ciclo completo
      originador→hito verificado→recompensa pagada.
- [ ] **T-042** Actualizar `IMPLEMENTATION_STATUS_MATRIX.md` y
      `ROADMAP.md` §F10.

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
