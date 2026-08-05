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
