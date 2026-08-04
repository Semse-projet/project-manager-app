---
type: tasks
feature: "F10 — Programa de recompensa para originador/facilitador"
domain: "core"
plan: "docs/specs/core/originador-referral-program.plan.md"
version: "1.0"
status: "PENDING"
branch: "TBD — crear en T-004 tras cerrar T-001..T-003"
date: "2026-08-04"
---

# Tareas: Programa de recompensa para originador/facilitador

> Spec `APPROVED` 2026-08-04, gate de pagos `critical` ya revisado punto
> por punto (spec §12b). El owner ya resolvió, el mismo día: recompensa
> **monetaria real** (no créditos) y alcance **multi-país desde el
> inicio**. Fases 0-2 pueden avanzar tras cerrar T-001/T-002/T-005
> (decisiones de producto, no de gobernanza). **Fase 3 sigue bloqueada**
> por dos dependencias reales: F5 (Shared Economic Ledger, `PENDIENTE`) y
> el gate legal por país (solo EE.UU. investigado, spec §11) — no por
> falta de aprobación.

## Fase 0 — Preflight

Resuelto por el owner (2026-08-04):

- [x] **T-000a** Tipo de recompensa: monetaria real, gateada por
      `OriginatorTaxIdentity` (documento de identidad fiscal), no créditos.
- [x] **T-000b** Alcance geográfico: multi-país desde el inicio.

Todavía abierto:

- [ ] **T-001** Confirmar montos/porcentajes reales de recompensa con el
      owner de producto (por país).
- [ ] **T-002** Confirmar con el owner de payments/finance dónde vive el
      acumulado anual por originador para 1099-NEC y el proceso de
      recolección de `OriginatorTaxIdentity` para EE.UU. (spec §7, §11).
- [ ] **T-003** Definir verificación mínima de elegibilidad como
      originador (anti-fraude/anti-auto-referido).
- [ ] **T-004** Priorizar la lista de países a investigar legal/fiscalmente
      después de EE.UU. (uno por uno, spec §11/§12b) — no se investiga
      "todos los países" a la vez.
- [ ] **T-005** Crear rama de implementación solo después de
      T-001/T-002/T-003.

## Fase 1 — Tests antes del código (anti-abuso primero)

- [ ] **T-010** Test: publicar sin actividad NO genera recompensa (spec
      §4 P2 — criterio de aceptación central).
- [ ] **T-011** Test: rechazo del dueño bloquea toda recompensa futura.
- [ ] **T-012** Test: mismo originador en múltiples proyectos sin avance
      se flaguea, no bloquea automáticamente.
- [ ] **T-013** Test: recompensa permanece `pending_review` 14 días antes
      de `released` (spec §4 P1, hallazgo §11).
- [ ] **T-014** Test: fallo de liberación deja el evento en
      `release_failed`, nunca ambiguo con `released` (spec §12b).
- [ ] **T-015** Test: liberación bloqueada sin `OriginatorTaxIdentity`
      (W-9 para EE.UU.) al superar US$600 anuales (spec §7).
- [ ] **T-016** Test: originador de un país sin gate legal cerrado nunca
      recibe liberación real, aunque el mecanismo técnico funcione (spec
      §4 caso borde, §12b).

## Fase 2 — Registro y validación (sin dinero)

- [ ] **T-020** Implementar `POST /v1/projects/:projectId/originator`.
- [ ] **T-021** Implementar flujo de validación del dueño.
- [ ] **T-022** Lanzar detrás de flag, fase "solo registro", sin pago real.
- [ ] **T-023** Implementar modelo `OriginatorTaxIdentity` (país + tipo de
      documento) y recolección/acumulado anual para EE.UU. (spec §7) —
      puede construirse antes de Fase 3 aunque el pago real siga
      bloqueado, ya que es prerrequisito de datos. Cualquier `country`
      distinto de `US` se rechaza explícitamente hasta T-004 (Fase 0)
      confirmar su gate legal.

## Fase 3 — Recompensa real (bloqueada por F5 + gate legal por país, no por gobernanza)

- [ ] **T-030** Confirmar que F5 (Shared Economic Ledger) resolvió lo
      necesario para registrar este tipo de recompensa sin balanceo
      ad-hoc (spec §12b) — gate de entrada a esta fase.
- [ ] **T-031** Conectar catálogo de eventos verificables a
      `payment-governance.service.ts` — sin lógica de liberación propia.
- [ ] **T-032** Aprobación explícita y separada del owner antes de activar
      en EE.UU. (primer país) en cualquier tenant.
- [ ] **T-033** Definir y probar reversibilidad si el proyecto se
      cancela/disputa después de pagar (coordinado con
      `escrow-release.service.ts`).
- [ ] **T-034** Para cada país adicional después de EE.UU.: repetir
      investigación externa (spec §11) + revisión de gate (§12b) +
      aprobación separada del owner antes de habilitar ese `country` en
      `OriginatorTaxIdentity`. Ninguna expansión de país es automática.

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
- [ ] `payment-governance.service.ts`/`escrow-release.service.ts`
      intactos, sin lógica de liberación paralela.
- [ ] `pnpm spec:validate:strict` verde.
- [ ] Ningún país recibe pago real sin su propio gate legal cerrado (spec
      §12b) — verificado explícitamente, no asumido por similitud con
      EE.UU.
- [ ] Spec marcado `IMPLEMENTED`/`VERIFIED` solo con evidencia de
      producción real de un ciclo completo, no por existencia de código.
