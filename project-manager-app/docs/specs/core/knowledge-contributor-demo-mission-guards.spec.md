---
id: "core.knowledge-contributor-demo-mission-guards"
title: "Field Knowledge Contributor Program — Demo Mission Guards Across the Pipeline"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - "apps/api/src/modules/contributor-program/contributor-program.service.ts"
related_tests:
  - "apps/api/test/contributor-program.service.test.ts"
  - "apps/api/test/contributor-program-extraction.test.ts"
related_endpoints:
  - "POST /v1/contributor-program/submissions"
  - "POST /v1/contributor-program/admin/submissions/:submissionId/review"
  - "POST /v1/contributor-program/admin/appeals/:appealId/resolve"
  - "POST /v1/contributor-program/admin/rewards/:rewardId/authorize-payout"
  - "POST /v1/contributor-program/admin/observations/:observationId/promote"
  - "POST /v1/contributor-program/admin/observations/:observationId/reject-promotion"
related_events: []
related_agents: []
last_verified: "2026-09-24"
---

# Spec: Field Knowledge Contributor Program — Demo Mission Guards Across the Pipeline

> Contrato ejecutable SDD 2.0.

**Aprobación:** hallazgos de dinero (RC5, `semse-security-baseline`). Se
presentaron los cuatro huecos y el fix propuesto al dueño del producto
antes de escribir código; eligió corregir **los cuatro**, incluido el de
RAG (no monetario).

## 0. ZOOM — estado real encontrado antes de escribir este spec

| Capa | Estado | Evidencia |
|---|---|---|
| `acceptMission` | GUARDADO | rechaza `mission.isDemo` con `400 CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO` desde PR-2 (2026-09-17) |
| Otra vía de crear `KnowledgeMissionAcceptance` | AUSENTE | `createAcceptance` solo se llama desde `acceptMission` |
| Cambio de `isDemo` tras crear la misión | AUSENTE | ningún endpoint lo actualiza |
| Ventana sin guarda | EXISTIÓ | tablas creadas en `20260916021251_knowledge_contributor_program`; guarda añadida un día después. El seed publica la misión demo (500¢, 25 plazas) — cualquier entorno que la haya sembrado en esa ventana pudo acumular aceptaciones demo |
| `createSubmission` | SIN GUARDA | confía en la aceptación, no mira `mission.isDemo` |
| `makeRewardEligible` (review `APPROVED` / apelación `OVERTURNED`) | SIN GUARDA | crea un `ContributorReward` real con `compensationCentsSnapshot` |
| `authorizePayout` | SIN GUARDA | reclama y llama `stripeConnect.transferToContractor` — dinero real |
| `setObservationPromotion` (`PROMOTED`) | SIN GUARDA | indexa el contenido demo en el RAG de Prometeo del tenant |

Conclusión: la única guarda está en la puerta de entrada. Toda aceptación
demo previa a PR-2 recorre el resto del pipeline sin ninguna comprobación.

## 1. Problema y resultado

**Para quién:** la tesorería de la plataforma (no pagar misiones que
son explícitamente simbólicas) y la base de conocimiento de Prometeo (no
citar contenido de onboarding como conocimiento de campo real).

**Resultado esperado:** una misión `isDemo` nunca produce una entrega
nueva, un reward, una transferencia de Stripe ni un documento RAG,
independientemente de cómo haya llegado a existir la aceptación.

## 2. Alcance

### Incluido

- `createSubmission` — rechaza con `400 CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO`
  (mismo código que `acceptMission`) antes de crear la fila.
- `makeRewardEligible` — si la misión de la aceptación es demo, no crea
  reward y no mueve la entrega a `PAYMENT_PENDING`. La decisión de
  revisión/apelación ya escrita se conserva (no se lanza tras escribir,
  para no dejar estado parcial). La entrega queda en `APPROVED`.
- `authorizePayout` — si `reward.submission.mission.isDemo`, rechaza con
  `409 CONTRIBUTOR_PROGRAM_REWARD_NOT_PAYABLE` **antes** del claim
  atómico: el reward no cambia de estado y el proveedor nunca se llama.
  Un reward demo ya `PAID` sigue devolviéndose tal cual (idempotencia,
  sin llamada al proveedor).
- `setObservationPromotion` — `PROMOTED` sobre una observación cuya
  misión es demo se rechaza con `400 CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO`
  sin llamar a Prometeo. `REJECTED` sigue permitido, para poder
  des-indexar una observación demo que ya se hubiera promovido.

### Fuera de alcance

- Limpieza de datos existentes (aceptaciones/entregas/rewards demo ya
  creados en algún entorno). Es un script sobre datos reales; va aparte
  y con confirmación explícita.
- Nuevos eventos de audit: `EVENT_CATALOG.md` no define eventos
  `contributor_program.*` y este repo prohíbe inventarlos. Los rechazos
  son síncronos y visibles para quien actúa.
- Cambios de schema, permisos o UI.

## 3. Actores, permisos y límites

Sin cambios de permisos. Cada guarda se evalúa después de las
comprobaciones de tenant/propiedad/rol existentes, así que no filtra
información nueva a quien no la podía ver.

## 4. Escenarios y criterios de aceptación

### P1 — Entrega sobre aceptación demo

```gherkin
DADO una aceptación existente de una misión isDemo
CUANDO su dueño llama createSubmission
ENTONCES recibe 400 CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO y no se crea entrega
```

### P2 — Aprobación de una entrega demo

```gherkin
DADO una entrega SUBMITTED de una misión isDemo
CUANDO un OPS_ADMIN la aprueba
ENTONCES la review queda registrada, la entrega queda APPROVED
  y no existe ningún ContributorReward para ella
```

### P3 — Pago de un reward demo

```gherkin
DADO un reward PENDING_REVIEW de una misión isDemo
CUANDO un OPS_ADMIN llama authorizePayout
ENTONCES recibe 409 CONTRIBUTOR_PROGRAM_REWARD_NOT_PAYABLE,
  el reward sigue PENDING_REVIEW y el proveedor se llama 0 veces
```

### P4 — Promoción al RAG de una observación demo

```gherkin
DADO una observación de una entrega de misión isDemo
CUANDO un OPS_ADMIN la promueve
ENTONCES recibe 400 CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO,
  Prometeo.ingestText no se llama y la observación sigue PENDING
```

### P5 — Rechazo de una observación demo sigue permitido

```gherkin
DADO una observación demo
CUANDO un OPS_ADMIN la rechaza
ENTONCES pasa a REJECTED (y se des-indexa si tenía ragDocumentId)
```

### P6 — Sin regresión en misiones reales

```gherkin
DADO una misión con isDemo=false
ENTONCES entrega, reward, pago y promoción se comportan igual que antes
```

## 5. Contratos

```yaml
endpoints: sin endpoints nuevos
errors:
  - CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO (400) — ahora también en
    createSubmission y en promote
  - CONTRIBUTOR_PROGRAM_REWARD_NOT_PAYABLE (409) — ahora también para
    rewards de misiones demo
auth: sin cambios
effects:
  audit_log: sin eventos nuevos
  sse: no
  fsmTransicion: ninguna nueva; solo se bloquean transiciones existentes
  paymentGovernance: sí — bloquea reward y transferencia para misiones demo
  privacyCritical: no
```

## 6. Datos y migración

Ninguna. `acceptance.mission`, `submission.mission`,
`reward.submission.mission` y `observation.submission.mission` ya se
cargan en las consultas existentes del repositorio.

## 7. Tests requeridos

- [ ] P1 — `createSubmission` rechaza aceptación demo y no crea entrega
- [ ] P2 — aprobar entrega demo no crea reward y la deja `APPROVED`
- [ ] P3 — `authorizePayout` de reward demo: 409, estado intacto, 0 llamadas al proveedor
- [ ] P4 — promover observación demo: 400, 0 ingestas, sigue `PENDING`
- [ ] P5 — rechazar observación demo sigue funcionando
- [ ] P6 — los fixtures existentes de pago/promoción pasan con `isDemo: false`

## 8. Mapa de implementación

- `apps/api/src/modules/contributor-program/contributor-program.service.ts`
  (`createSubmission`, `makeRewardEligible`, `authorizePayout`,
  `setObservationPromotion`)
- `apps/api/test/contributor-program.service.test.ts`
- `apps/api/test/contributor-program-extraction.test.ts`

## 9. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Tests verdes contra Postgres real
- [ ] `pnpm spec:validate:strict` verde
- [ ] CI `PASS`
- [ ] PR fusionado
