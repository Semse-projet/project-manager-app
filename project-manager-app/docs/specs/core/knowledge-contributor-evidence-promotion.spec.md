---
id: "core.knowledge-contributor-evidence-promotion"
title: "Field Knowledge Contributor Program — Evidence Promotion (PR-6)"
domain: "core"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "medium"
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
  - "apps/api/src/modules/contributor-program/contributor-program.repository.ts"
  - "packages/db/prisma/schema.prisma"
related_tests:
  - "apps/api/test/contributor-program-extraction.test.ts"
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-09-18"
---

# Spec: Field Knowledge Contributor Program — Evidence Promotion (PR-6)

> Contrato ejecutable SDD 2.0. Completar todas las secciones aplicables y
> cambiar `status` a `APPROVED` antes de implementar. Código, CI, merge,
> deploy y activación se registran por separado; un deploy no demuestra
> activación ni verificación funcional.

**Aprobación:** PR-6 aparecía en un reporte de sesión anterior
(`docs/reportes/knowledge_contributor_program_pr2_2026-09-17.md`) únicamente
como la etiqueta de tres palabras "Evidence promotion adapter" — sin spec,
sin diseño, sin ningún otro rastro en el repositorio. En vez de inventar el
alcance desde una etiqueta, se presentaron cuatro interpretaciones concretas
al dueño del producto (incluyendo "escribe el spec y espera tu revisión" y
"salta a otro PR"); el dueño eligió explícitamente la primera: **un revisor
humano promueve una `Observation` ya existente (de PR-5) a conocimiento
citable**. Esa elección es la aprobación de este spec — igual que en PR-5, no
se espera una ronda de PR separada antes de implementar.

## 0. ZOOM — estado real encontrado antes de escribir este spec

| Capa | Estado | Evidencia |
|---|---|---|
| Modelo `Observation` (PR-5) | EXISTING | `packages/db/prisma/schema.prisma`, ya trae campos de corrección humana |
| Endpoint de corrección (PR-5) | EXISTING | `POST .../observations/:id/correct` |
| Cualquier campo o concepto de "promoción" | ABSENT | No existe `promotionStatus` ni nada equivalente en `Observation` ni en ningún otro modelo |
| **Creación real de `Observation` en producción** | **ABSENT** | `repository.createObservation` no tiene ningún llamador en `contributor-program.service.ts` ni en `apps/worker` — confirmado por grep antes de escribir este spec. Solo los tests de PR-5 llaman a este método directamente. La generación automática de `Observation` vía LLM fue explícitamente excluida del alcance de PR-5 ("depende de que exista un transcript real primero", spec de PR-5 §2) |
| Endpoints admin ya existentes para leer extracciones | EXISTING | `GET .../submissions/:id/extractions` (PR-5) — ya incluye `observations[]` en su vista, con `isCorrected` pero sin ningún campo de promoción |

**Hallazgo crítico que este spec no oculta**: hoy, en este repositorio, **no
existe ningún camino de producción que cree una fila `Observation`**. La
promoción que este spec implementa será, hasta que exista ese camino (bloqueado
en la decisión de proveedor ASR de PR-5 §11 **y** en la generación de
`Observation` vía LLM, explícitamente fuera de alcance de PR-5), una
capacidad correcta y probada pero sin datos reales que promover — el mismo
patrón "el worker existe y corre honestamente, pero no hay proveedor" que
PR-5 ya estableció para la transcripción. Esto no es una razón para no
construirlo (la API/UI de promoción es independiente de qué genera las
`Observation`, igual que el modelo de datos de PR-5 no necesitaba la decisión
de ASR) — es una razón para no reportar esta capacidad como "en uso" hasta
que también exista esa generación.

## 1. Problema y resultado

**Para quién:** revisor humano (`contributor-program:manage`); en última
instancia, Prometeo/RAG (PR-8) que necesita saber qué conocimiento derivado
está autorizado a citar como hecho, no solo como observación cruda.

**Problema:** PR-5 le dio al revisor una forma de leer y corregir el texto de
una `Observation`, pero ninguna forma de declarar "esta observación (corregida
o no) es confiable y puede citarse como conocimiento" ni "esta observación no
sirve, no la use nadie aguas abajo". Sin ese estado explícito, PR-7 (Human
Review Workspace) y PR-8 (Knowledge Registry/RAG) no tienen ninguna señal
sobre qué observaciones fueron editorialmente aprobadas.

**Resultado esperado:** una `Observation` tiene un estado de promoción
explícito de tres valores (`PENDING` / `PROMOTED` / `REJECTED`), visible al
revisor, cambiable por un `OPS_ADMIN` con una razón obligatoria, y auditado en
cada transición — nunca una promoción silenciosa ni implícita por el simple
hecho de que la observación existe o fue corregida.

## 2. Alcance

### Incluido

- Campo `promotionStatus` en `Observation`: `PENDING` (default) / `PROMOTED`
  / `REJECTED`.
- Endpoint para promover (`PENDING`/`REJECTED` → `PROMOTED`) y otro para
  rechazar (`PENDING`/`PROMOTED` → `REJECTED`), cada uno con `reason`
  obligatorio.
- A diferencia de la corrección de campos (PR-5, que usa un guard de
  concurrencia 409 porque un hecho corregido no debe sobreescribirse
  silenciosamente), la promoción es una **decisión editorial revisable**: un
  `OPS_ADMIN` puede cambiar de opinión (promover algo que había rechazado, o
  viceversa) sin bloqueo de conflicto — cada cambio queda su propio evento de
  auditoría con la razón, así que la decisión anterior nunca se pierde, solo
  se reemplaza explícitamente.
- Vista de extracciones (`GET .../submissions/:id/extractions`) extendida
  para incluir `promotionStatus`/`promotedByUserId`/`promotedAt`/
  `promotionReason` por observación.
- UI admin: badge de estado de promoción + botones promover/rechazar con
  campo de razón obligatorio, en el mismo panel de extracciones que PR-5 ya
  construyó.

### Fuera de alcance

- **Generación automática de `Observation` vía LLM** — sigue exactamente
  donde la dejó PR-5: fuera de alcance, bloqueada en la misma decisión de
  proveedor. Este spec no crea ningún camino nuevo que produzca
  `Observation` rows; solo agrega un estado a las que ya existan (hoy,
  ninguna en producción — ver §0).
- Cualquier efecto downstream de "promovido" (ingesta a Prometeo/RAG,
  PR-8) — este spec solo registra el estado, no lo consume todavía.
- Un endpoint para que el propio contribuidor vea el estado de promoción de
  su entrega — mismo gap ya documentado (y deliberadamente no resuelto) en
  el spec de PR-5 §5 para el endpoint de lectura equivalente.
- Revertir una promoción/rechazo a `PENDING` — el flujo solo permite
  moverse entre los tres estados vía las dos acciones explícitas
  (promover/rechazar); no existe una tercera acción "despromover a
  pendiente" en este alcance.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance | Puede | No puede |
|---|---|---|---|---|
| `OPS_ADMIN` (revisor) | `contributor-program:manage` (ya existe) | tenant-scoped vía `submissionId`/`observationId` | promover o rechazar cualquier `Observation` del tenant, con razón | promover/rechazar sin razón; hacerlo cross-tenant |
| `WORKER`/`PRO` (contribuidor) | — | — | — | promover, rechazar, ni ver el estado de promoción de su propia entrega (ver "Fuera de alcance") |

- Tenant boundary: igual que el resto del módulo — `tenantId` derivado de la
  `Observation`, nunca inferido del actor.
- Requisitos de auditoría: `AuditService.append` en cada transición
  (`contributor_program.observation.promoted` /
  `contributor_program.observation.promotion_rejected`), mismo patrón que
  `contributor_program.observation.corrected` de PR-5.

## 4. Escenarios y criterios de aceptación

### P1 — El revisor promueve una observación

```gherkin
DADO una Observation en estado PENDING o REJECTED
CUANDO un OPS_ADMIN la promueve con una razón
ENTONCES su promotionStatus pasa a PROMOTED
Y se registra promotedByUserId/promotedAt/promotionReason
Y un AuditEvent contributor_program.observation.promoted queda registrado
```

### P2 — El revisor rechaza una observación

```gherkin
DADO una Observation en estado PENDING o PROMOTED
CUANDO un OPS_ADMIN la rechaza con una razón
ENTONCES su promotionStatus pasa a REJECTED
Y se registra el actor/fecha/razón del rechazo
Y un AuditEvent contributor_program.observation.promotion_rejected queda registrado
```

### P3 — El revisor cambia de opinión

```gherkin
DADO una Observation ya PROMOTED
CUANDO el mismo u otro OPS_ADMIN la rechaza con una nueva razón
ENTONCES la transición se acepta (no hay conflicto 409 — es una decisión
  editorial, no un hecho corregido)
Y ambas decisiones (la promoción original y el rechazo posterior) quedan
  visibles en el historial de auditoría, aunque solo el estado actual se
  refleje en la fila
```

Casos borde:

- [ ] Razón vacía → `400`, mismo patrón que el resto del módulo.
- [ ] `observationId` inexistente o de otro tenant → `404`.
- [ ] Promover una `Observation` que ya está `PROMOTED` con la misma razón →
      se acepta igual (idempotente en efecto, no en historial — cada llamada
      genera su propio evento de auditoría).

## 5. Contratos

### API — `POST /v1/contributor-program/admin/observations/:observationId/promote`

```yaml
auth: required
permissions: [contributor-program:manage]
input_schema: { reason: string (min 1) }
output_schema: "ObservationView (con promotionStatus=PROMOTED y los campos de promoción poblados)"
errors:
  400: reason vacío
  403: falta contributor-program:manage
  404: observación no existe o no pertenece al tenant
effects:
  audit_log: contributor_program.observation.promoted
  domain_event: none (mismo patrón que el resto del módulo)
  sse: none
  payment_governance: n/a
```

### API — `POST /v1/contributor-program/admin/observations/:observationId/reject-promotion`

```yaml
auth: required
permissions: [contributor-program:manage]
input_schema: { reason: string (min 1) }
output_schema: "ObservationView (con promotionStatus=REJECTED y los campos de promoción poblados)"
errors:
  400: reason vacío
  403: falta contributor-program:manage
  404: observación no existe o no pertenece al tenant
effects:
  audit_log: contributor_program.observation.promotion_rejected
  domain_event: none
  sse: none
  payment_governance: n/a
```

### UI

```yaml
surfaces: ["apps/web/app/(app)/admin/contributors/submissions"]
states:
  - pending (badge neutro, sin decisión tomada)
  - promoted (badge success)
  - rejected (badge error)
required_behavior:
  - el badge de promoción es visualmente distinto del badge de corrección
    (PR-5) — son dos ejes independientes (el texto fue corregido; el
    contenido fue aprobado para citarse) y una observación puede estar en
    cualquier combinación de ambos
  - promover/rechazar siempre pide una razón antes de enviar
```

## 6. FSM, eventos y reconstrucción

- Estado afectado: `promotionStatus` en `Observation`. Transiciones
  permitidas: `PENDING → PROMOTED`, `PENDING → REJECTED`,
  `PROMOTED ↔ REJECTED` (libres en ambas direcciones). No existe transición
  de vuelta a `PENDING`.
- Invariantes: cada transición exige `reason`; el estado anterior nunca se
  pierde silenciosamente — queda en el `AuditEvent` de esa transición.
- Eventos declarados: ninguno nuevo en `EVENT_CATALOG.md` — mismo patrón que
  el resto del módulo (usa `AuditService`, no el outbox de dominio).

## 7. Datos y migración

- Modelo modificado: `Observation` (agrega `promotionStatus`,
  `promotedByUserId`, `promotedAt`, `promotionReason`).
- Migración: aditiva únicamente — `CREATE TYPE` + `ALTER TABLE ... ADD
  COLUMN`, ninguna tabla existente se toca más allá de esas columnas nuevas.
- Backfill: ninguno — las `Observation` existentes (hoy, cero en producción,
  ver §0) simplemente nacen en `PENDING`.
- Verificación de drift: `pnpm verify:prisma-contract:db`.

## 8. Observabilidad, despliegue y activación

- Métricas/SLO: ninguna definida — mismo hallazgo que PR-5, el módulo no
  tiene métricas propias todavía.
- Evidencia de producción requerida: al menos una promoción real hecha por
  un revisor humano sobre una `Observation` real — lo cual, per §0, requiere
  primero que exista generación real de `Observation` (bloqueada en PR-5
  §11 y en la generación LLM fuera de este alcance).
- Feature flags: ninguno — a diferencia del worker de extracción de PR-5,
  esto es una acción manual de un humano, no un proceso automático que
  necesite un kill switch.

## 9. Tests requeridos

- [ ] Promover una Observation PENDING → PROMOTED, campos y audit correctos
- [ ] Rechazar una Observation PENDING → REJECTED, campos y audit correctos
- [ ] Cambiar de PROMOTED a REJECTED (y viceversa) sin conflicto 409
- [ ] Razón vacía → 400
- [ ] Actor sin `contributor-program:manage` → 403
- [ ] Observación de otro tenant → 404
- [ ] UI: badge distinto para cada uno de los 3 estados

## 10. Mapa de implementación

### API

- `apps/api/src/modules/contributor-program/contributor-program.repository.ts`
  (`setObservationPromotion`)
- `apps/api/src/modules/contributor-program/contributor-program.service.ts`
  (`promoteObservation`, `rejectObservationPromotion`)
- `apps/api/src/modules/contributor-program/contributor-program.controller.ts`

### Web

- `apps/web/app/(app)/admin/contributors/submissions/page.tsx`
  (`ObservationCard` gana el badge + botones de promoción)
- `apps/web/app/api/semse/contributors/admin/observations/[id]/promote/route.ts`
- `apps/web/app/api/semse/contributors/admin/observations/[id]/reject-promotion/route.ts`
- `apps/web/app/semse-api.ts`

### DB

- `packages/db/prisma/schema.prisma`
- `packages/schemas/src/contributor-program.schema.ts`

### Tests

- `apps/api/test/contributor-program-extraction.test.ts` (extender)

## 11. Investigación externa

No aplica — este spec no introduce ninguna dependencia externa nueva (no ASR,
no proveedor de terceros). La única pregunta abierta relevante
(¿quién/qué genera `Observation` en producción?) ya está documentada como
bloqueada en el spec de PR-5 §11 y no se duplica aquí.

## 12. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Tests derivados del spec y verdes (verificados contra Postgres real
      antes de push, no solo contra el skip local sin DB)
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
