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
> gate de riesgo `critical` de pagos (spec §12b). Este plan deja de ser
> provisional para las Fases 0-2 (registro/validación, sin dinero). La
> **Fase 3 (recompensa real) sigue bloqueada por dos dependencias reales**,
> no por falta de aprobación del spec:
>
> 1. No existe todavía un mecanismo de registro contable (Shared Economic
>    Ledger, F5, `PENDIENTE`) con el que integrar el pago sin inventar un
>    balanceo ad-hoc.
> 2. El owner confirmó recompensa **monetaria real, multi-país desde el
>    inicio** (2026-08-04) — pero solo EE.UU. tiene la investigación
>    legal/fiscal hecha (spec §11). Fase 3 se activa **país por país**, no
>    globalmente; cada país nuevo requiere su propio cierre de gate (spec
>    §12b) antes de mover dinero real ahí.

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

// Generalizado a multi-país (decisión del owner 2026-08-04) — no hardcodea W-9.
model OriginatorTaxIdentity {
  id               String    @id @default(cuid())
  originatorUserId String    @unique
  country          String    // ISO 3166-1 alpha-2
  documentType     String    // "W9" para US; otros países TBD en Fase 0 por país
  documentRef      String    // referencia/almacenamiento seguro, no el documento crudo
  collectedAt      DateTime  @default(now())

  @@index([country])
}
```

Notas:

- `@@unique([projectId])` refleja la decisión del spec de un solo
  originador por proyecto (a confirmar en Fase 0; si se permite más de
  uno, este constraint cambia antes de migrar).
- `OriginatorTaxIdentity.documentType`/`country` existen desde el diseño
  inicial aunque, al lanzar, solo `country: "US"` tenga validación y
  umbral (1099-NEC/US$600) implementados — cualquier otro país queda
  rechazado explícitamente hasta que Fase 0 confirme su gate legal (spec
  §12b), nunca aceptado "porque el campo ya existe".
- El modelo de eventos de recompensa (qué tabla, si reutiliza
  `PaymentTxn` o necesita una propia) se decide en Fase 0 junto con el
  owner de payments — no se asume aquí para no prejuzgar el diseño del
  ledger existente.
- Ninguna tabla de pagos existente se modifica; esto es aditivo.

## 5. Fases propuestas

### Fase 0 — Preflight

Resuelto por el owner (2026-08-04):

- [x] Tipo de recompensa: monetaria real, gateada por documento de
      identidad fiscal (no créditos).
- [x] Alcance geográfico: multi-país desde el inicio.

Todavía abierto (no son decisiones de gobernanza, son de producto/legal):

- [ ] Montos/porcentajes reales de recompensa (el spec deliberadamente no
      los fija) — por país, dado que ya no hay un solo mercado objetivo.
- [ ] Confirmar con el owner de payments/finance dónde vive el acumulado
      anual por originador para 1099-NEC (spec §7) y el proceso de
      recolección de `OriginatorTaxIdentity` para EE.UU.
- [ ] Confirmar la verificación mínima para ser elegible como originador
      (anti-fraude/anti-auto-referido).
- [ ] **Nuevo, por la decisión multi-país:** priorizar la lista de países
      a investigar legal/fiscalmente después de EE.UU. — cada uno abre su
      propia línea de investigación externa (spec §11) antes de que Fase 3
      pueda activarse ahí. No se investiga "todos los países" a la vez;
      se prioriza por dónde el owner espera los primeros originadores
      reales.

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
- Test: liberación bloqueada si el originador supera US$600 anuales sin
  W-9 registrado (spec §4 caso borde, §7).

### Fase 2 — Registro y validación (sin dinero)

- `POST /v1/projects/:projectId/originator` (contrato spec §5).
- Flujo de validación del dueño.
- Lanzar detrás de flag, fase "solo registro" — **sin pago real** — antes
  de tocar Fase 3.

### Fase 3 — Recompensa real (bloqueada por F5 + gate legal por país, no por gobernanza)

- **Bloqueada hasta que exista un mecanismo de registro contable
  consistente con Payments (spec §12b) — dependencia de F5 (Shared
  Economic Ledger), hoy `PENDIENTE`.** No se activa con un balanceo
  ad-hoc solo para este programa.
- **Se activa país por país, nunca globalmente.** EE.UU. es el único país
  con investigación legal/fiscal hecha (spec §11). Cualquier otro país
  necesita repetir esa investigación (Fase 0, ítem nuevo) antes de que
  `OriginatorTaxIdentity.country` acepte ese país para pago real.
- Conectar el catálogo de eventos verificables a la liberación real vía
  `payment-governance.service.ts`.
- Implementar recolección de `OriginatorTaxIdentity` y acumulado anual
  (EE.UU. primero) antes de habilitar cualquier pago real (spec §7).
- Requiere aprobación explícita y separada del owner antes de activar en
  cualquier tenant, incluso `tenant_default` — y antes de activar cada
  país adicional después del primero.

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
| Activar pago real en un país sin revisión legal, asumiendo que "el mecanismo ya funciona en EE.UU." | media | crítico | `OriginatorTaxIdentity.country` rechaza explícitamente cualquier país sin gate cerrado (spec §12b); ningún flag global activa todos los países a la vez |

## 7. Gate antes de tasks/implementación

- [x] Spec `APPROVED` (2026-08-04).
- [x] Gate de riesgo `critical` de pagos revisado explícitamente (spec §12b).
- [x] Investigación externa completada (spec §11).
- [ ] Modelo de datos de Fase 0 confirmado con owner de payments antes de
      iniciar Fase 2 (registro/validación).
- [ ] Dependencia F5 (Shared Economic Ledger) resuelta antes de iniciar
      Fase 3 (recompensa real) — bloqueo estructural, no de gobernanza.
- [ ] Gate legal/fiscal de EE.UU. como primer país activado (ya
      investigado, spec §11) confirmado operable antes de iniciar Fase 3.
- [ ] Lista priorizada de países siguientes (Fase 0, ítem nuevo) antes de
      planear cualquier expansión de Fase 3 más allá de EE.UU.
