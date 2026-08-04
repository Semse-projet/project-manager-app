---
id: "core.originador-referral-program"
title: "SPEC-CORE-006 — Originador/Facilitador: recompensa por hito verificado"
domain: "core"
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
  - packages/db/prisma/schema.prisma
  - apps/api/src/modules/payments/payment-governance.service.ts
  - apps/api/src/modules/payments/escrow-release.service.ts
  - apps/api/src/modules/payments/stripe-connect.service.ts
related_tests: []
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-08-04"
---

# SPEC-CORE-006 — Originador/Facilitador: recompensa por hito verificado

**Deriva de:** `docs/vision/VISION_PROMETEO_OS_2026.md` (sección
"Originador / facilitador").
**Módulos afectados:** `apps/api/src/modules/payments/` (lectura de estado
de hitos; no se propone tocar `escrow-release.service.ts` en este spec —
ver "Fuera de alcance").
**Fase Matriz:** Programa transversal "Prometeo OS" (`ROADMAP.md`).
**Gate aplicable:** `docs/SDD_GOVERNANCE.md` §7 "Economía" — payment
provider y ledger son responsabilidades separadas; reversals inmutables;
débitos y créditos balanceados cuando aplica ledger.

> Contrato ejecutable SDD 2.0. `status: DRAFT`, `risk: critical` — no
> autoriza código hasta `APPROVED` por revisión humana explícita, dado que
> toca dinero real.

## 1. Problema y resultado

**Para quién:** un usuario ("originador" o "facilitador") que ayuda a un
tercero a crear un proyecto en SEMSE — lo conecta con la plataforma, lo
ayuda a definir alcance, o simplemente lo invita — sin ser cliente ni
profesional en ese proyecto.

**Problema:** hoy no existe ningún mecanismo que reconozca a quien origina
o facilita un proyecto. No existe en ningún spec, ADR ni código (el único
uso de la palabra "originador" en el repo es un campo de contexto no
relacionado en `docs/program/execution/SEMSE_AI_EXECUTION_BACKLOG.md:300`,
sobre el actor que abrió un `Job`, no un rol de referido).

**Resultado esperado:** un usuario puede marcar que originó/facilitó un
proyecto de otro usuario, y recibe una recompensa **solo** cuando el
proyecto avanza por hitos verificables reales — nunca por la sola
publicación.

## 2. Alcance

### Incluido

- Registro de la relación originador↔proyecto (quién originó qué proyecto).
- Catálogo cerrado de eventos que disparan recompensa:
  - proyecto validado por su dueño (confirmado, no borrador);
  - primera propuesta recibida de un profesional;
  - profesional contratado (bid aceptado / contrato firmado);
  - primer milestone financiado (fondos en escrow);
  - proyecto completado (cierre exitoso).
- Regla explícita de qué NO dispara recompensa: publicar el proyecto por sí
  solo, sin ningún hito posterior.
- Definición de quién paga la recompensa y de dónde sale (afecta el
  ledger existente; no crea una fuente de fondos nueva).

### Fuera de alcance

- Implementación del mecanismo de liberación de fondos — se apoya en
  `PaymentsService`/`escrow-release.service.ts` existentes, no se
  duplica lógica de pagos.
- Multi-nivel de referidos (referido de un referido) — explícitamente
  fuera hasta que exista evidencia de demanda.
- Cambios al modelo de identidad multi-rol
  (`docs/specs/core/universal-identity-multi-role.spec.md`) — un
  originador puede o no tener otro rol en el mismo proyecto; ese cruce se
  resuelve en `clarify`, no se asume aquí.
- Cualquier variante de "pago por invitar" sin hito de proyecto real
  (ese modelo es explícitamente lo que este spec busca evitar).

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Originador/facilitador | `referral:create` (nuevo, a definir) | su propio registro de referidos, dentro de su tenant | registrar que originó un proyecto de un tercero | auto-asignarse como originador de un proyecto ya originado por otro; aprobar su propia recompensa |
| Dueño del proyecto | permisos existentes de owner | su proyecto | confirmar/rechazar que fue originado por alguien | forzar un pago de recompensa fuera de los hitos declarados |
| `OPS_ADMIN` | `payments:approve` (existente, mismo patrón que F2 `payments.propose_release`) | tenant | aprobar la liberación de la recompensa en el hito correspondiente | saltarse el catálogo cerrado de hitos |

- Tenant boundary: la relación originador↔proyecto no cruza tenants.
- Ownership/resource policy: el originador no es owner del proyecto; su
  registro es una relación separada, auditable independientemente.
- Step-up o aprobación humana: **requerida** — sigue el mismo patrón
  `approvalPolicy: human_required` que `payments.propose_release` en F2
  (`docs/specs/prometeo/tool-registry-governance.spec.md`), un `OPS_ADMIN`
  aprueba cada liberación de recompensa, no se automatiza de entrada.
- Datos `privacyCritical`: monto de recompensa y datos de pago del
  originador.
- Requisitos de auditoría: cada evento de hito que dispara evaluación de
  recompensa, y cada aprobación/rechazo, quedan en audit log inmutable.

## 4. Escenarios y criterios de aceptación

### P1 — Recompensa por milestone financiado

```gherkin
DADO un proyecto marcado como originado por el usuario U
CUANDO el primer milestone del proyecto queda financiado (fondos en escrow)
ENTONCES se genera una propuesta de recompensa para U en estado pendiente de aprobación
Y un OPS_ADMIN debe aprobarla explícitamente antes de liberar fondos
Y la aprobación/rechazo queda en audit log con auditRef
```

### P2 — Publicar no dispara recompensa

```gherkin
DADO un proyecto marcado como originado por el usuario U
CUANDO el proyecto solo se publica, sin propuestas ni contratación
ENTONCES no se genera ninguna propuesta de recompensa
```

Casos borde:

- [ ] proyecto marcado como originado por dos usuarios distintos (debe rechazarse o requerir resolución explícita, no aceptar ambos silenciosamente)
- [ ] hito revertido (ej.: milestone definanciado) después de haber disparado una recompensa ya aprobada — la recompensa ya liberada no se revierte automáticamente; se trata como excepción manual
- [ ] originador que es también dueño o profesional del mismo proyecto — bloqueado hasta que `clarify` resuelva el cruce con identidad multi-rol

## 5. Contratos

### API — `POST /v1/projects/:projectId/referral`

```yaml
auth: required
permissions: [referral:create]
input_schema: "{ originatorUserId: string }"
output_schema: "{ referralId: string, status: 'pending_owner_confirmation' }"
errors:
  400: proyecto ya tiene un originador confirmado
  401: sin sesión
  403: sin permiso referral:create
  404: proyecto no existe o fuera de tenant
  409: originador intenta auto-asignarse como owner/profesional del mismo proyecto
effects:
  audit_log: "referral.created"
  domain_event: "referral.registered.v1 (a declarar en docs/foundation/EVENT_CATALOG.md en plan)"
  sse: null
  payment_governance: "evalúa en cada hito del catálogo cerrado; no libera fondos directamente"
```

### UI

```yaml
surfaces: [flujo de creación de proyecto, panel de referidos del usuario]
states:
  - loading
  - empty
  - ready
  - forbidden
  - degraded
  - error
required_behavior: [el estado de cada hito y recompensa es visible para el originador; el catálogo de hitos que califican es explícito en la UI, no implícito]
```

### Agente/Prometeo

```yaml
tools: []
input_schema: null
output_schema: null
source_citations_required: false
approval_policy: human_required
forbidden_behavior: [Prometeo no debe proponer ni aprobar liberación de recompensa de forma autónoma; sigue el mismo patrón human_required que payments.propose_release]
```

## 6. FSM, eventos y reconstrucción

- Estado/FSM afectado: nuevo estado `Referral` (pending_owner_confirmation → confirmed → reward_pending → reward_approved/rejected), a formalizar en `plan`.
- Invariantes: a documentar en `docs/foundation/DOMAIN_INVARIANTS.md` en `clarify` (un proyecto tiene a lo sumo un originador confirmado).
- Eventos declarados: `referral.registered.v1`, `referral.reward.proposed.v1`, `referral.reward.approved.v1` — a dar de alta en `docs/foundation/EVENT_CATALOG.md` en `plan`, siguiendo el envelope `SemseDomainEvent` v2 de F1.
- Productor + outbox atómico: sí, mismo patrón que Evidence/F1 (`docs/specs/platform/event-backbone.spec.md`).
- Consumidores + idempotencia: el evaluador de hitos debe ser idempotente (un mismo hito no genera dos propuestas de recompensa).
- Replay/rebuild: recompensas ya aprobadas no se recalculan por replay.
- DLQ/compensación: fallo en evaluación de hito va a DLQ, no bloquea el flujo de pagos principal del proyecto.

## 7. Datos y migración

- Modelos Prisma: nuevo modelo `Referral` (proyecto, originador, estado, hitos cumplidos) — a definir en `plan`. No se toca `Job`/`Milestone`/`PaymentEscrow` existentes.
- Migración: aditiva, nueva tabla.
- Estrategia expand/contract: expand puro (tabla nueva).
- Backfill: no aplica (sin datos previos).
- Compatibilidad hacia atrás: proyectos sin originador siguen funcionando idénticos.
- Verificación de drift: estándar del programa (`prisma migrate status`).
- Rollback de código: desactivar el endpoint y el evaluador de hitos; la tabla puede quedar vacía sin afectar el resto del sistema.
- Rollback/forward-fix de datos: reversals de recompensa ya liberada se tratan como excepción manual auditada, nunca se edita el registro histórico (regla general de `SDD_GOVERNANCE.md` §7 "reversals inmutables").

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: recompensas propuestas vs. aprobadas vs. rechazadas; tiempo entre hito y aprobación.
- Logs/traces/correlation: `auditRef` por cada evaluación de hito y decisión de aprobación, mismo patrón que `PrometeoToolInvocationAudit` de F2.
- Health/readiness: sin impacto en servicios core.
- Feature flags/allowlists: lanzamiento detrás de flag, acotado a `tenant_default` primero, igual que F3/F4.
- Plan de canary: `tenant_default`, con volumen bajo de proyectos reales antes de expandir.
- Evidencia de producción requerida: al menos una recompensa real aprobada y liberada correctamente, con reversal simulado probado en staging.
- Señal de rollback: cualquier liberación de recompensa sin aprobación humana registrada.
- Owner operativo: semse-core / payments.

## 9. Tests requeridos

- [ ] Unitarios del dominio `Referral` y evaluador de hitos
- [ ] Contrato API/BFF de `POST /v1/projects/:projectId/referral`
- [ ] Permiso denegado y aislamiento tenant/org
- [ ] Validación y conflicto de estado (doble originador, auto-asignación)
- [ ] Idempotencia/reintento/concurrencia del evaluador de hitos
- [ ] Migración y compatibilidad (tabla nueva, aditiva)
- [ ] UI loading/empty/forbidden/degraded/error del panel de referidos
- [ ] Canary o smoke autenticado en producción con recompensa real de bajo monto

## 10. Mapa de implementación

### API

- `apps/api/src/modules/payments/` (evaluación de hitos, sin duplicar lógica de escrow)
- nuevo módulo `apps/api/src/modules/referrals/` (a crear en `plan`)

### Web

- `apps/web/` — panel de referidos, flujo de creación de proyecto

### Worker/Packages/DB

- `packages/db/prisma/schema.prisma` — nuevo modelo `Referral`

### Tests

- `apps/api/src/modules/referrals/*.spec.ts` (a crear)

## 11. Investigación externa

- Reporte con tres búsquedas primarias: pendiente — a completar en `clarify` (patrones de referral-with-milestone en marketplaces B2B con escrow, para no reinventar antifraude de referidos).
- Aplicado ahora: N/A (DRAFT).
- Backlog: N/A.
- Descartado: multi-nivel de referidos (ver "Fuera de alcance").

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
