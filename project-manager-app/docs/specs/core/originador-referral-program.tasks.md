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
> por punto (spec §12b). Fases 0-2 pueden avanzar tras cerrar T-001..T-003
> (decisiones de producto, no de gobernanza). **Fase 3 sigue bloqueada**
> por la dependencia real hacia F5 (Shared Economic Ledger, `PENDIENTE`),
> no por falta de aprobación.

## Fase 0 — Preflight

- [ ] **T-001** Confirmar montos/porcentajes reales de recompensa con el
      owner de producto.
- [ ] **T-002** Confirmar con el owner de payments/finance dónde vive el
      acumulado anual por originador para 1099-NEC y el proceso de
      recolección de W-9 (spec §7, §11).
- [ ] **T-003** Definir verificación mínima de elegibilidad como
      originador (anti-fraude/anti-auto-referido) y alcance geográfico
      inicial (condiciona si aplica 1099-NEC).
- [ ] **T-004** Crear rama de implementación solo después de T-001..T-003.

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
- [ ] **T-015** Test: liberación bloqueada sin W-9 al superar US$600
      anuales (spec §7).

## Fase 2 — Registro y validación (sin dinero)

- [ ] **T-020** Implementar `POST /v1/projects/:projectId/originator`.
- [ ] **T-021** Implementar flujo de validación del dueño.
- [ ] **T-022** Lanzar detrás de flag, fase "solo registro", sin pago real.
- [ ] **T-023** Implementar recolección de W-9 y acumulado anual (spec §7)
      — puede construirse antes de Fase 3 aunque el pago real siga
      bloqueado, ya que es prerrequisito de datos.

## Fase 3 — Recompensa real (bloqueada por dependencia F5, no por gobernanza)

- [ ] **T-030** Confirmar que F5 (Shared Economic Ledger) resolvió lo
      necesario para registrar este tipo de recompensa sin balanceo
      ad-hoc (spec §12b) — gate de entrada a esta fase.
- [ ] **T-031** Conectar catálogo de eventos verificables a
      `payment-governance.service.ts` — sin lógica de liberación propia.
- [ ] **T-032** Aprobación explícita y separada del owner antes de activar
      en cualquier tenant.
- [ ] **T-033** Definir y probar reversibilidad si el proyecto se
      cancela/disputa después de pagar (coordinado con
      `escrow-release.service.ts`).

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
- [ ] Spec marcado `IMPLEMENTED`/`VERIFIED` solo con evidencia de
      producción real de un ciclo completo, no por existencia de código.
