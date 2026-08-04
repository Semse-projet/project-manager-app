---
type: plan
feature: "F10 — Programa de recompensa para originador/facilitador"
domain: "core"
spec: "docs/specs/core/originador-referral-program.spec.md"
version: "1.0"
status: "APPROVED"
branch: "TBD — crear en Fase 0 tras cerrar T-001..T-004 de tasks.md"
date: "2026-08-04"
---

# Plan técnico: Programa de recompensa para originador/facilitador

> **Spec `APPROVED` 2026-08-04**, incluida la revisión punto por punto del
> gate de riesgo `critical` de pagos (spec §12b) y su corrección posterior
> (ver abajo). Este plan deja de ser provisional para las Fases 0-2
> (registro/validación, sin dinero). La **Fase 3 (recompensa real) sigue
> bloqueada por una sola dependencia real** — el gate legal por país, no
> dos:
>
> - El owner confirmó recompensa **monetaria real, modelo híbrido** (bono
>   fijo en "primer milestone financiado" + % de `platformFeeCents` en
>   "proyecto completado"), gateada por `StripeConnectAccount`
>   (`payoutsEnabled: true`, mismo mecanismo que ya usan los profesionales
>   — no un modelo de identidad fiscal propio), y **multi-país desde el
>   inicio, con Latinoamérica como prioridad tras EE.UU.** (2026-08-04).
>   Solo EE.UU. tiene la investigación legal/fiscal hecha (spec §11). Fase
>   3 se activa **país por país**, no globalmente.
> - **La dependencia hacia F5 (Shared Economic Ledger) se retiró como
>   bloqueo duro** (spec §12b, corrección 2026-08-04): Fase 3 reutiliza el
>   mismo `StripeConnectAccount`/transfer que ya paga dinero real a `PRO`
>   hoy sin F5 — bloquear esta feature específicamente con F5 habría sido
>   inconsistente con lo que ya corre en producción.

## 1. Resumen técnico

**Spec:** [`originador-referral-program.spec.md`](originador-referral-program.spec.md)

**Estrategia:** no crear un sistema de pagos paralelo. El registro de la
relación originador↔proyecto es un modelo nuevo y ligero
(`ProjectOriginator`); la liberación de la recompensa reutiliza
`payment-governance.service.ts`/`escrow-release.service.ts` existentes,
tratando al originador como un tipo nuevo de beneficiario dentro del
mecanismo ya auditado, no como un flujo de dinero separado.

**Complejidad:** alta — no por volumen de código, sino por el gate de
riesgo de pagos y por el catálogo de eventos verificables que debe ser
imposible de gamear (spec §4, P2: publicar solo no puede disparar pago).

**Riesgo principal:** que el catálogo de eventos verificables termine
siendo más fácil de simular de lo que parece en el spec (p. ej. "primera
propuesta recibida" con propuestas fantasma). Este plan trata el
anti-abuso como parte del diseño central, no como un endurecimiento
posterior.

## 2. Constitution check

- [x] Spec `APPROVED` (2026-08-04).
- [x] Gate de riesgo `critical` de pagos (`SDD_GOVERNANCE.md` §7) revisado
      explícitamente punto por punto (spec §12b), no solo sign-off genérico.
- [x] Investigación externa (spec §11) completada antes de `APPROVED`,
      incluyendo riesgo regulatorio de "comisión por referido" según
      jurisdicción, período de revisión anti-fraude y requisito 1099-NEC.
- [ ] Confirmar que `PaymentsService.release()` y sus invariantes
      existentes (ver hallazgo de disputas abiertas en
      `tool-registry-governance.tasks.md` T-043) no se bypasean para pagar
      recompensas de originador — pendiente, se confirma en Fase 3.
- [ ] Tests antes del código — pendiente, empieza en Fase 1.
- [ ] Multi-tenant: relación originador↔proyecto acotada al mismo tenant — a
      verificar en Fase 1.

## 3. Stack afectado (propuesto)

```yaml
backend:
  framework: NestJS + Fastify
  modules:
    - apps/api/src/modules/jobs (o módulo nuevo originator/, decidir en Fase 0)
    - apps/api/src/modules/payments (se extiende, no se reemplaza)
  schemas:
    - packages/schemas/src/ (ProjectOriginator, eventos de recompensa)
  prisma_changes: true

frontend:
  changes:
    - flujo "crear proyecto en nombre de otro"
    - panel de validación del dueño
    - dashboard de recompensas del originador

infrastructure:
  new_service: false
  new_provider: false
  new_env: []
```

## 4. Cambios de base de datos (propuesto, sujeto a revisión en Fase 0)

```prisma
enum ProjectOriginatorStatus {
  PENDING_OWNER_VALIDATION
  VALIDATED
  REJECTED
}

model ProjectOriginator {
  id                String                   @id @default(cuid())
  tenantId          String
  projectId         String
  originatorUserId  String
  status            ProjectOriginatorStatus  @default(PENDING_OWNER_VALIDATION)
  validatedAt       DateTime?
  createdAt         DateTime                 @default(now())
  updatedAt         DateTime                 @updatedAt

  @@unique([projectId])
  @@index([tenantId, originatorUserId])
}

enum OriginatorRewardType {
  FIXED_BONUS
  PLATFORM_FEE_SHARE
}

enum OriginatorRewardStatus {
  PENDING_REVIEW
  BLOCKED_NO_PAYOUT_ACCOUNT
  RELEASED
  RELEASE_FAILED
  REVERSED
}

// No se crea modelo de identidad fiscal propio — se reutiliza
// StripeConnectAccount (ya existe, ver related_files del spec).
model OriginatorReward {
  id                 String                   @id @default(cuid())
  tenantId           String
  projectOriginatorId String
  type               OriginatorRewardType
  triggerEvent       String   // "first_milestone_funded" | "project_completed"
  amountCents        Int
  platformFeeCentsSnapshot Int?  // solo para PLATFORM_FEE_SHARE, snapshot del cálculo
  status             OriginatorRewardStatus   @default(PENDING_REVIEW)
  reviewEndsAt       DateTime // ahora + 14 días
  releasedAt         DateTime?
  releaseFailedReason String?
  createdAt          DateTime                 @default(now())
  updatedAt          DateTime                 @updatedAt

  @@index([tenantId, status])
  @@index([projectOriginatorId])
}
```

Notas:

- `@@unique([projectId])` refleja la decisión del spec de un solo
  originador por proyecto (a confirmar en Fase 0; si se permite más de
  uno, este constraint cambia antes de migrar).
- **Identidad fiscal:** el originador usa su propia fila de
  `StripeConnectAccount` (mismo modelo que `PRO`, `packages/db/prisma/
  schema.prisma:327`) — no se crea ningún modelo nuevo para esto. El gate
  de país (spec §12b) lee `StripeConnectAccount.country`.
- `OriginatorReward.status` empieza en `BLOCKED_NO_PAYOUT_ACCOUNT` si el
  originador no tiene `StripeConnectAccount.payoutsEnabled` en el momento
  del `triggerEvent`; pasa a `PENDING_REVIEW` (arrancando los 14 días)
  recién cuando el gate de elegibilidad se cierra — no antes.
- Ninguna tabla de pagos existente se modifica; esto es aditivo.

## 5. Fases propuestas

### Fase 0 — Preflight

Resuelto por el owner (2026-08-04):

- [x] Tipo de recompensa: **modelo híbrido** — bono fijo en "primer
      milestone financiado" + % de `platformFeeCents` en "proyecto
      completado" (no créditos, no un solo monto único).
- [x] Identidad fiscal: **delegada a Stripe Connect** (reutiliza
      `StripeConnectAccount`), no se construye recolección propia.
- [x] Alcance geográfico: multi-país desde el inicio, **Latinoamérica
      priorizada** como primer destino tras EE.UU.
- [x] Elegibilidad: híbrida — cuenta SEMSE verificada para registrarse
      como originador; `StripeConnectAccount.payoutsEnabled` antes de que
      cualquier hito empiece a contar para recompensa.

Todavía abierto (no son decisiones de gobernanza, son de producto/legal):

- [ ] Monto exacto del bono fijo y % exacto sobre `platformFeeCents` para
      el piloto (el spec deliberadamente no los fija) — empezar chico y
      ajustar con datos reales, como sugirió el owner.
- [ ] Confirmar con el owner de payments/finance el flujo operativo para
      que el originador complete el onboarding de `StripeConnectAccount`
      (mismo flujo que `PRO`, reutilizado — no debería requerir trabajo
      nuevo de payments, pero se confirma antes de Fase 2).
- [ ] Confirmar la verificación mínima para registrarse como originador
      (cuenta verificada ya es el piso, spec §2 — confirmar si se necesita
      algo más, ej. antigüedad mínima de cuenta).
- [ ] Priorizar países concretos de Latinoamérica (¿México primero?
      ¿Colombia? ¿todos a la vez?) y lanzar la investigación externa
      (spec §11) para el primero de la lista — no se investiga "toda
      Latinoamérica" a la vez.

### Fase 1 — Tests antes del código (anti-abuso primero)

- Test: publicar un proyecto sin ningún otro evento NO genera recompensa
  (spec §4, P2 — es el criterio de aceptación más importante de esta
  spec).
- Test: dueño rechaza validación → ningún evento posterior cuenta.
- Test: mismo originador en múltiples proyectos sin avance real → se
  flaguea, no se bloquea automáticamente (spec §4, caso borde).
- Test: recompensa queda en `pending_review` 14 días antes de `released`
  (spec §4 P1, hallazgo §11).
- Test: fallo de `payment-governance.service.ts` deja el evento en
  `release_failed`, nunca en un estado ambiguo con `released` (spec §12b).
- Test: evento de recompensa nace en `blocked_no_payout_account` si el
  originador no tiene `StripeConnectAccount.payoutsEnabled`, y pasa a
  `pending_review` (arrancando los 14 días) recién al completarse el
  onboarding (spec §4 caso borde, §7).
- Test: el evento `PLATFORM_FEE_SHARE` calcula el monto sobre
  `platformFeeCents`, nunca sobre el valor bruto del proyecto; si
  `platformFeeCents` es 0, el monto es 0, nunca negativo (spec §4 P1b).

### Fase 2 — Registro y validación (sin dinero)

- `POST /v1/projects/:projectId/originator` (contrato spec §5).
- Flujo de validación del dueño.
- Lanzar detrás de flag, fase "solo registro" — **sin pago real** — antes
  de tocar Fase 3.

### Fase 3 — Recompensa real (bloqueada por gate legal por país, ya no por F5)

- **Se activa país por país, nunca globalmente.** EE.UU. es el único país
  con investigación legal/fiscal hecha (spec §11). Cualquier otro país
  (empezando por la lista de Latinoamérica de Fase 0) necesita repetir esa
  investigación antes de que `StripeConnectAccount.country` habilite ese
  país para pago real.
- Conectar el catálogo de eventos verificables (`OriginatorReward`) a la
  liberación real vía `payment-governance.service.ts` +
  `stripe-connect.service.ts`, transfiriendo al `StripeConnectAccount` del
  originador — mismo mecanismo que ya paga a `PRO`.
- Confirmar el onboarding de `StripeConnectAccount` para originadores
  (reutilizar el flujo existente de `PRO`, no construir uno nuevo).
- Requiere aprobación explícita y separada del owner antes de activar en
  cualquier tenant, incluso `tenant_default` — y antes de activar cada
  país adicional después de EE.UU.

### Fase 4 — Validación y cierre

- `pnpm spec:validate:strict`.
- Auditoría end-to-end de al menos un ciclo completo (spec §8).
- Actualizar `IMPLEMENTATION_STATUS_MATRIX.md` y `ROADMAP.md` §F10.

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| Publicaciones falsas para ganar recompensa | media | alto | ningún evento de "solo publicar" cuenta (spec §4 P2); risk scoring existente detecta patrones |
| Auto-referido (dueño y originador son la misma persona con cuentas distintas) | media | alto | verificación mínima de elegibilidad en Fase 0; cruzar con Trust/risk scoring existente |
| Recompensa pagada y luego proyecto cancelado/disputado | baja | medio | definir reversibilidad en Fase 0 antes de activar Fase 3, coordinado con `escrow-release.service.ts` |
| Modelo de recompensa duplica lógica de `PaymentsService` en vez de extenderla | baja | alto | Fase 3 reutiliza `payment-governance.service.ts` explícitamente, sin lógica de liberación propia |
| Activar pago real en un país sin revisión legal, asumiendo que "el mecanismo ya funciona en EE.UU." | media | crítico | `StripeConnectAccount.country` rechaza explícitamente cualquier país sin gate cerrado (spec §12b); ningún flag global activa todos los países a la vez |
| `platform_fee_share` reparte ingreso propio de SEMSE sin reconciliación clara antes de que exista F5 | media | medio | el evento guarda `platformFeeCentsSnapshot` explícito (plan §4) para que sea reconciliable cuando F5 exista; no bloquea Fase 3, pero tampoco se pierde trazabilidad mientras tanto |

## 7. Gate antes de tasks/implementación

- [x] Spec `APPROVED` (2026-08-04).
- [x] Gate de riesgo `critical` de pagos revisado explícitamente (spec §12b).
- [x] Investigación externa completada (spec §11).
- [ ] Modelo de datos de Fase 0 confirmado con owner de payments antes de
      iniciar Fase 2 (registro/validación).
- [ ] Montos piloto (bono fijo + % de `platformFeeCents`) confirmados
      antes de iniciar Fase 3.
- [ ] Gate legal/fiscal de EE.UU. como primer país activado (ya
      investigado, spec §11) confirmado operable antes de iniciar Fase 3.
- [ ] Lista priorizada de países de Latinoamérica (Fase 0) antes de
      planear cualquier expansión de Fase 3 más allá de EE.UU.
- [x] Dependencia F5 (Shared Economic Ledger) **ya no es bloqueo
      estructural** — corrección 2026-08-04, spec §12b.
