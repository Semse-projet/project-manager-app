---
id: "ui-admin-flows"
title: "Admin and OPS UI Flows"
domain: "ui"
sdd_version: "2.0"
version: "2.0"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "MERGED"
deploy_status: "DEPLOYED"
activation_status: "ACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence:
  - "docs/AUDIT_REMEDIATION_PLAN.md Sección 3 — 59/59 páginas de /admin recorridas con OPS_ADMIN real, 2026-07-27"
  - "docs/specs/ui/admin-flows-remediation.spec.md — pasada dirigida con OPS_ADMIN real, ~10 pantallas incl. Disputas y Dashboard, 2026-08-02"
related_files:
  - apps/web/app/(app)/admin/ai-mission-control/page.tsx
  - apps/web/app/(app)/admin/consciousness/page.tsx
  - apps/web/app/(app)/admin/disputes/page.tsx
  - apps/web/app/(app)/admin/jobs/[jobId]/page.tsx
  - apps/web/app/api/semse/ops/audit/route.ts
  - apps/web/app/semse-api.ts
  - apps/web/app/(app)/buildops/projects/[projectId]/page.tsx
  - apps/api/src/modules/anatomy
  - apps/api/src/modules/knowledge/knowledge.controller.ts
  - apps/api/src/modules/repo-knowledge
  - apps/api/src/modules/runtime-knowledge
  - packages/auth/src/rbac.ts
related_tests:
  - apps/api/test/ai-mission-control.test.ts
  - apps/api/test/semse-consciousness.test.ts
  - scripts/web-sprint15-smoke.mjs
  - tests/unit/navigation-shell.test.ts
  - tests/unit/navigation-registry.test.ts
related_endpoints:
  - v1/ops/mission-control/summary
  - v1/ops/ai-mission-control/rag
  - v1/ops/consciousness/index
  - v1/disputes
  - v1/ops/audit
  - v1/anatomy
  - v1/knowledge
  - v1/repo-knowledge
  - v1/runtime-knowledge
related_events:
  - agents:system
related_agents:
  - mission-control
last_verified: "2026-08-17"
---

# Spec: Admin / OPS UI Flows

> Contrato ejecutable SDD 2.0. Reemplaza la versión 1.0 (`REVIEW`, `last_verified:
> 2026-06-09`), que describía tres pantallas (Evidence Review Panel, aprobación
> de plan BuildOps y Audit Log) que **no existen** en el código actual bajo
> `/admin/*` — ver hallazgo verificado en código, §2. El historial de auditoría
> de seguridad/UX de este módulo (navegación, confirmaciones, RBAC de rutas
> internas) vive en `docs/specs/ui/admin-flows-remediation.spec.md`
> (`APPROVED`) y no se duplica aquí; este documento es el contrato vigente de
> lo que la superficie Admin/OPS hace hoy.

## 1. Problema y resultado

**Para quién:** usuarios con rol `OPS_ADMIN` que operan `/admin/*` en `apps/web`.

**Problema:** el spec v1.0 de este documento quedó en `REVIEW` desde 2026-06-09
señalando gaps de una auditoría 2026-07-20 (navegación incompleta, acciones
financieras sin confirmación, permisos de lectura de arquitectura interna
abiertos a cualquier rol) sin nunca resolver si esos gaps seguían vigentes.
Esa auditoría y su remediación ya tienen su propio spec `APPROVED`
(`admin-flows-remediation.spec.md`), verificado dos veces en vivo con
credencial `OPS_ADMIN` real (2026-07-27, 2026-08-02). Este documento nunca se
actualizó para reflejarlo — el mismo patrón de documentación desincronizada
que la propia remediation spec identifica en su encabezado.

Además, al releer el código real para esta revisión, tres de los seis flujos
originales (Evidence Review Panel, aprobación de plan BuildOps, Audit Log) no
corresponden a ninguna pantalla existente bajo `/admin/*` — ver §2.

**Resultado esperado:** un documento único que (a) describe con precisión los
flujos Admin/OPS que sí existen hoy, con endpoints y estados reales; (b) no
duplica el backlog de remediación — lo referencia; (c) es honesto sobre los
tres flujos que el spec original inventó o proyectó y que el código nunca
construyó.

## 2. Alcance

### Incluido

- **Mission Control** (`/admin/ai-mission-control`) — panorama operativo del
  ecosistema de agentes/RAG/SSE.
- **Consciousness Index** (`/admin/consciousness`) — score de madurez del
  sistema.
- **Disputes** (`/admin/disputes`) — revisión y resolución de disputas con
  confirmación explícita (fix de G-ADM-02, confirmado en código y en vivo).
- Referencia a `admin-flows-remediation.spec.md` para el estado detallado de
  RBAC de rutas internas (G-ADM-07), tenant de subida de archivos (G-ADM-08),
  navegación del sidebar (G-ADM-01) y headers de página (G-ADM-06).

### Fuera de alcance

- **Historial de auditoría/remediación completo** — vive en
  `admin-flows-remediation.spec.md`; este spec no repite sus 8 gaps.
- **Evidence Review Panel** (`/admin/evidence-review` en el spec original) —
  **hallazgo verificado en código, no asumido:** esa ruta no existe.
  `apps/web/app/(app)/admin/jobs/[jobId]/page.tsx:297-316` sí tiene una
  pestaña "Evidence" dentro del detalle de un job individual, pero es una
  lista de solo lectura (título, nota, link al archivo) — no tiene resultado
  de revisión IA (`reviewStatus`/`confidence`/`riskLevel`/`findings`),
  `ragCitations`, botones "Override" ni badge `privacyCritical` como
  describía el spec original. No hay ningún panel agregado de evidencias
  `SUBMITTED` pendientes de revisión en todo `/admin/*` (`grep` sin resultados
  fuera de esa pestaña por-job).
- **Aprobación de plan BuildOps** (`/admin/buildops` o `/admin/projects/:id`
  en el spec original) — **hallazgo verificado en código:** ninguna de las
  dos rutas existe. Sí existe un flujo de aprobación de plan en
  `apps/web/app/(app)/buildops/projects/[projectId]/page.tsx:14-22`
  (`approveClientPlan`/`rejectClientPlan`/`requestPlanChanges`), pero (a) vive
  fuera de `/admin/*` por completo, y (b) su modelo de datos
  (`clientPlanApprovalStatus`, `clientPlanApprovedById`) está nombrado y
  orientado a que el **cliente** apruebe el plan que propone el profesional/IA,
  no a que `OPS_ADMIN` lo revise. No es el mismo flujo que describía el spec
  original, y no hay evidencia en código de que exista una pantalla de
  aprobación de plan específica de Admin.
- **Audit Log** (`/admin/audit` en el spec original) — **hallazgo verificado
  en código:** no existe ninguna página bajo `/admin/audit` ni ninguna otra
  ruta. El backend (`GET /v1/ops/audit`) y su BFF
  (`apps/web/app/api/semse/ops/audit/route.ts`) sí existen y funcionan, y
  `apps/web/app/semse-api.ts:1129` (`fetchOpsAuditLog`) los envuelve — pero
  esa función no tiene ningún caller en `apps/web/app` (`grep` sin
  resultados). Es código muerto: un endpoint listo sin ninguna pantalla que
  lo consuma. La única superficie de auditoría real y usada hoy es
  `apps/web/app/cortex/semse-cortex-console.tsx` (consola separada, no
  `/admin/*`, no cubierta por este spec).
- Estas tres ausencias no bloquean `APPROVED` — el contrato de este documento
  solo describe lo que existe; quedan documentadas aquí como gap de producto
  para quien decida priorizar construirlas, no como algo que este spec
  prometa entregar.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` | `ops:dashboard:read` | global, sin scoping adicional por tenant en el service | Ver Mission Control y Consciousness | — |
| `OPS_ADMIN` | `disputes:read`/`disputes:resolve` (vía política de disputes) | disputas de cualquier tenant (rol operativo) | Asignar/resolver disputas con confirmación | Resolver sin el paso de confirmación (bloqueado por UI, `disputes/page.tsx:261,393`) |
| `OPS_ADMIN` | `internal:architecture:read` | global | Leer `/v1/anatomy`, `/v1/repo-knowledge`, `/v1/runtime-knowledge`, `GET /v1/knowledge/domains`\|`/overview` | — |
| `CLIENT`/`PRO`/`WORKER` | `knowledge:read` (compartido, a propósito) | RAG operativo (workspace-memory, skills, curation) | Usar RAG general | Leer `internal:architecture:read` (403 — no tienen ese permiso en `packages/auth/src/rbac.ts`) |

- **Tenant boundary:** `resolveRequestContext` resuelve `tenantId`/`orgId` del
  token de sesión en todos los endpoints listados; sin cambios de esta spec.
- **Ownership/resource policy:** confirmado por código
  (`packages/auth/src/rbac.ts:189`, dentro del bloque `OPS_ADMIN:` que
  arranca en la línea 130): `internal:architecture:read` no aparece en los
  bloques `CLIENT:` (línea 4) ni `PRO:` (línea 60) — solo `OPS_ADMIN` lo
  tiene. `apps/api/src/modules/anatomy/*.controller.ts:14-15`,
  `apps/api/src/modules/repo-knowledge/repo-knowledge.controller.ts:15-16` y
  `apps/api/src/modules/runtime-knowledge/runtime-knowledge.controller.ts:10-11`
  aplican `@RequirePermissions("internal:architecture:read")` a nivel de
  controller completo; `apps/api/src/modules/knowledge/knowledge.controller.ts:27-34`
  lo aplica solo a los dos endpoints `domains`/`overview` (el resto del
  controller sigue en `knowledge:read` compartido, por diseño — comentario
  explícito en el código, línea 26).
- **Step-up o aprobación humana:** resolver una disputa requiere
  `window.confirm` antes de disparar la llamada
  (`apps/web/app/(app)/admin/disputes/page.tsx:261,393`) — fix de G-ADM-02,
  confirmado por código y en vivo (ver `admin-flows-remediation.spec.md`).
- **Datos `privacyCritical`:** ninguno nuevo en este spec.
- **Requisitos de auditoría:** resolución de disputa y decisiones de agentes
  quedan en `AuditLog` vía el flujo de servicio ya existente, sin cambios
  aquí.

## 4. Escenarios y criterios de aceptación

### P1 — Ver Mission Control

```gherkin
DADO un usuario OPS_ADMIN autenticado
CUANDO abre /admin/ai-mission-control
ENTONCES ve cards de estado por módulo, lista de incidentes, ObserverPanel
  y un stream SSE de eventos (GET /v1/ops/mission-control/summary +
  EventSource /api/semse/health/stream)
```

**Corrección respecto al spec v1.0:** el spec original decía `API calls: GET
/v1/ops/ai-mission-control/summary + SSE /v1/ops/events`. El código real
(`apps/web/app/api/semse/ops/mission-control/summary/route.ts:6`) llama
`/v1/ops/mission-control/summary` (sin el prefijo `ai-`, que sí existe pero
para un endpoint distinto de RAG —
`apps/web/app/api/semse/ops/rag-health/route.ts:6` llama
`/v1/ops/ai-mission-control/rag`) y el stream SSE real es
`/api/semse/health/stream` (`apps/web/app/(app)/admin/ai-mission-control/page.tsx:136`),
no `/v1/ops/events`. Corregido en `related_endpoints` de este frontmatter.

### P2 — Ver Consciousness Index

```gherkin
DADO un usuario OPS_ADMIN autenticado
CUANDO abre /admin/consciousness
ENTONCES ve un score circular (0-100), un badge de Autonomy Level y un grid
  de módulos con hasBackend/hasFrontend/hasSSE/hasRAG/hasTests
  (fetch a /api/semse/ops/consciousness)
```

**Hallazgo verificado en código, no asumido:** el spec v1.0 también prometía
un "Trend histórico" (evolución del score en el tiempo) y un "Query box" para
hacer preguntas al Consciousness. Ninguno de los dos aparece en
`apps/web/app/(app)/admin/consciousness/page.tsx` (`grep` de
`trend|historic|pregunta|ask` sin resultados relevantes fuera de comentarios
de código). Se retiran del contrato de este spec — si se quieren construir,
es trabajo nuevo, no algo ya implementado que este documento deba certificar.

### P3 — Resolver una disputa con confirmación

```gherkin
DADO una disputa en estado UNDER_REVIEW o ASSIGNED
CUANDO OPS_ADMIN elige un resolutionType y confirma
ENTONCES window.confirm se dispara antes de POST /v1/disputes/:id/resolve
Y la disputa pasa a RESOLVED con resolution/resolutionType persistidos
Y el AuditLog correspondiente se emite (comportamiento ya existente del service)
```

Confirmado por código: `apps/web/app/(app)/admin/disputes/page.tsx:257-276`
(`handleResolve`, con `window.confirm` en la línea 261) y
`admin-flows-remediation.spec.md` G-ADM-02 (confirmado también en vivo
2026-08-02, sobre una disputa con datos anómalos — repetir con un caso limpio
si se quiere cerrar la verificación end-to-end).

Casos borde:

- [ ] Confirmar resolución dos veces seguido (doble clic) — no debe disparar
      dos `POST /v1/disputes/:id/resolve`.
- [ ] Resolver una disputa que otro admin ya resolvió en paralelo — mostrar
      el error del backend (409 esperado), no asumir éxito optimista.

## 5. Contratos

### API — endpoints consumidos (ya existentes, sin contratos nuevos)

```yaml
auth: required
permissions:
  - ops:dashboard:read (Mission Control, Consciousness)
  - disputes:resolve (Disputes)
  - internal:architecture:read (anatomy, repo-knowledge, runtime-knowledge, knowledge domains/overview)
effects:
  audit_log: "toda resolución de disputa (ya existente en el service, sin cambios de este spec)"
  domain_event: "sin eventos nuevos declarados por este spec"
  sse: "/api/semse/health/stream para Mission Control"
  payment_governance: "no aplica — este spec no mueve dinero"
```

### UI

```yaml
surfaces:
  - /admin (dashboard)
  - /admin/ai-mission-control
  - /admin/consciousness
  - /admin/disputes
states:
  - loading
  - empty
  - ready
  - forbidden
  - error
required_behavior:
  - Ninguna resolución de disputa ejecuta sin confirmación explícita (verificado, G-ADM-02)
  - internal:architecture:read gatea anatomy/repo-knowledge/runtime-knowledge/knowledge domains-overview a solo OPS_ADMIN (verificado por código, §3)
  - Evidence Review Panel, aprobación de plan BuildOps y Audit Log NO son parte del contrato actual de /admin/* — ver §2
```

### Agente/Prometeo

No aplica — este spec no agrega superficie de Prometeo nueva en Admin.

## 6. FSM, eventos y reconstrucción

- **Estado/FSM afectado:** `Dispute` (`OPEN → ASSIGNED/UNDER_REVIEW →
  RESOLVED/REJECTED`), sin transiciones nuevas — se consume el FSM ya
  definido en `docs/foundation/STATE_MACHINES.md` y `DOMAIN_INVARIANTS.md`.
- **Invariantes:** `docs/foundation/DOMAIN_INVARIANTS.md` — "toda resolución
  requiere `resolutionType`; el cliente dueño solo puede cerrar por acuerdo a
  favor del profesional, mientras refund, split y escalamiento legal
  requieren `OPS_ADMIN`" — consistente con que Admin/OPS es el único actor
  que puede elegir cualquiera de los 4 `resolutionType` desde
  `RESOLVE_OPTIONS` en `disputes/page.tsx:111`.
- **Eventos declarados:** sin eventos nuevos — se reusa el pipeline de
  `AuditLog` ya existente en el servicio de disputes.

## 7. Datos y migración

No aplica — sin modelos Prisma nuevos, sin migración. Se leen/escriben los
mismos modelos que ya usa el resto de `/admin/*` (Dispute, AuditLog).

## 8. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna nueva — mismos endpoints ya monitoreados.
- **Feature flags:** ninguno.
- **Plan de canary:** no aplica — código ya desplegado en `main`/Railway.
- **Evidencia de producción requerida:** ya cubierta por
  `admin-flows-remediation.spec.md` (dos pasadas en vivo con `OPS_ADMIN`
  real, 2026-07-27 y 2026-08-02) para Dashboard y Disputes específicamente.
  Mission Control y Consciousness **no** tienen verificación en vivo dirigida
  en ninguna de esas pasadas — la confirmación de este spec para esas dos
  pantallas es solo de código, no de pantalla. Marcar explícitamente pendiente
  si se requiere evidencia de producción para ellas.
- **Señal de rollback:** ninguna acción de este spec mueve dinero directamente
  (resolver una disputa puede destrabar un release de escrow retenido, pero
  eso es responsabilidad del backend de disputes/payments, no de esta UI).
- **Owner operativo:** `semse-core`.

## 9. Tests requeridos

- [x] `apps/api/test/ai-mission-control.test.ts` — ya existe.
- [x] `apps/api/test/semse-consciousness.test.ts` — ya existe.
- [x] `tests/unit/navigation-shell.test.ts`, `tests/unit/navigation-registry.test.ts` — ya existen.
- [x] Un actor CLIENT o PRO recibe 403 en `GET /v1/anatomy` o en
      `domains`/`overview` de `GET /v1/knowledge` — confirmado por código
      (§3), no probado con una sesión CLIENT/PRO real todavía (mismo pendiente
      que señala `admin-flows-remediation.spec.md`).
- [ ] Resolución de disputa: doble confirmación / resolución concurrente (ver
      casos borde §4) — sin test dedicado localizado.
- [ ] Mission Control / Consciousness: smoke autenticado en producción con
      captura — pendiente, no cubierto por las pasadas de 2026-07-27/08-02.

## 10. Mapa de implementación

### Web

- `apps/web/app/(app)/admin/ai-mission-control/page.tsx`
- `apps/web/app/(app)/admin/consciousness/page.tsx`
- `apps/web/app/(app)/admin/disputes/page.tsx`

### API

- `apps/api/src/modules/anatomy`, `repo-knowledge`, `runtime-knowledge`
- `apps/api/src/modules/knowledge/knowledge.controller.ts`
- `packages/auth/src/rbac.ts`

### Tests

- `apps/api/test/ai-mission-control.test.ts`
- `apps/api/test/semse-consciousness.test.ts`

## 11. Investigación externa

No aplica.

## 12. Gates de cierre

- [x] Spec enlazado por `pnpm spec:index`
- [x] Spec, plan, tasks, analyze y checklist coherentes (sin plan/tasks/checklist
      dedicados — este spec documenta capacidad ya entregada, no una a construir)
- [x] Tests derivados del spec y verdes (los ya existentes; los pendientes de
      §9 quedan como backlog, no bloquean `APPROVED` porque describen huecos
      de verificación en vivo, no contrato ambiguo)
- [ ] `pnpm spec:validate:strict` verde — no ejecutado en esta sesión (fuera
      de alcance de esta tarea; lo corre la sesión coordinadora)
- [x] Migración reproducible y rollback/forward-fix documentado (N/A)
- [ ] CI `PASS` — no verificado en esta sesión
- [x] PR fusionado (código ya en `main`)
- [x] Deployment terminal `DEPLOYED` (Railway auto-deploy desde `main`)
- [x] Activación/canary verificada por separado — Dashboard y Disputes
      confirmados en vivo por `admin-flows-remediation.spec.md`; Mission
      Control y Consciousness solo por código (ver §8)
- [x] `production_evidence` y `last_verified` actualizados
- [x] `status: APPROVED` — contrato consistente con el código verificado en
      esta sesión; no se marca `VERIFIED` porque falta evidencia de
      producción dirigida para Mission Control/Consciousness y los tests
      pendientes de §9
