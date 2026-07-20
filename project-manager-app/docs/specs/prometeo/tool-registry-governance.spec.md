---
id: "prometeo.tool-registry-governance-f2"
title: "F2 — Prometeo Tool Registry gobernado"
type: spec
domain: "prometeo"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
date: "2026-07-19"
author: "Claude Sonnet 5 — investigación y borrador SDD"
branch: "docs/f2-tool-registry-spec"
spec_index: "docs/SPEC_INDEX.md"
privacyCritical: true
auditLog: true
sse: false
fsmTransicion: "N/A — no introduce lifecycle nuevo, gobierna invocaciones puntuales"
paymentGovernance: true
related_files:
  - apps/api/src/modules/prometeo/prometeo-tool-registry.ts
  - apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts
  - apps/api/src/modules/prometeo/prometeo.controller.ts
  - packages/schemas/src/prometeo-runtime.schema.ts
  - packages/forge/src/policy.ts
  - packages/agents/src/governance.ts
  - apps/api/src/modules/payments/payments.controller.ts
  - apps/api/src/modules/payments/payments.service.ts
  - apps/api/src/modules/payments/escrow-release.service.ts
  - apps/api/src/modules/payments/payment-governance.service.ts
related_tests: []
related_endpoints:
  - v1/prometeo/tools
  - v1/prometeo/tools/invoke
related_events: []
related_agents:
  - prometeo
last_verified: "2026-07-20"
---

# Spec: F2 — Prometeo Tool Registry gobernado

> **APPROVED 2026-07-20.** El owner confirmó explícitamente la decisión 2
> (gate híbrido de pagos, sección 3) — la única marcada `risk: critical` que
> exigía sign-off humano antes de aprobar (SDD-005). Autoriza crear
> `tool-registry-governance.plan.md` y `.tasks.md` (SDD-001).

## 1. Qué resuelve

**Para quién:** cualquier actor (humano u operador) que invoca herramientas de
Prometeo, y Ops/Trust que necesitan poder auditar y limitar qué se ejecutó, en
nombre de quién y con qué evidencia de resultado.

**Problema (verificado contra el código actual, no solo contra el roadmap):**

1. **El permiso declarado por tool no se aplica nunca.** Cada
   `PrometeoToolDescriptor` en `prometeo-tool-registry.ts` declara un array
   `permissions` (p. ej. `["vision:run"]`, `["field-ops:write"]`,
   `["payments:write"]`), pero ni `PrometeoController.invokeTool` ni
   `PrometeoToolExecutionService.invokeReadTool` lo leen o verifican en ningún
   punto. Los dos únicos endpoints (`GET /v1/prometeo/tools`,
   `POST /v1/prometeo/tools/invoke`) solo exigen el permiso genérico
   `agents:run:create` — el mismo permiso para las 24 tools registradas, sin
   distinción de namespace, riesgo o mode. Un actor con `agents:run:create`
   pero sin, por ejemplo, `field-ops:read` puede invocar
   `time_tracker.get_status` igual.
2. **No existe ruta de ejecución de escritura.** De los 24 descriptors (23
   `read`, 1 `write`/`critical` cuenta corta — ver conteo real abajo),
   `invokeReadTool` rechaza explícitamente cualquier tool con
   `descriptor.mode !== "read"`. No hay `invokeWriteTool`, ni policy engine, ni
   aprobación humana implementada — las 7 tools de escritura
   (`time_tracker.start/pause/resume/stop/create_manual_entry`,
   `agro.create_task`, `payments.propose_release`) están declaradas pero son
   inertes.
3. **`auditRef` es una etiqueta, no un registro persistido.** El resultado de
   `invokeReadTool` incluye `auditRef: "prometeo-tool:${requestId}:${id}"`,
   pero no hay ninguna llamada a `AuditService.append(...)` en todo el flujo.
   No hay forma de reconstruir, desde la base de datos, qué tool se ejecutó,
   con qué input, para qué tenant, ni con qué resultado.
4. **6 de 23 read tools declaradas no ejecutan nada.** Todas las tools
   `vision.*` con permiso `vision:run` (`analyze_image`,
   `compare_before_after`, `detect_material`, `classify_space`,
   `check_safety`, `analyze_video`) caen en el `default:` de
   `executeReadTool`, que devuelve `{ __blockedReason: "... is registered but
   not wired for read execution in Prometeo P1." }`. El catálogo que ve
   Prometeo (`GET /v1/prometeo/tools`) no distingue estas de las 17 que sí
   ejecutan.
5. **No hay contrato de adapter reutilizable.** Toda la ejecución vive en un
   único `switch` de 100+ líneas en `PrometeoToolExecutionService`. Añadir una
   tool nueva significa editar ese switch a mano; no hay unidad de
   responsabilidad por tool, lo que hace más fácil que el próximo `case`
   nuevo también se salte la verificación de permisos (el bug #1 de arriba no
   es un accidente puntual, es lo que produce naturalmente esta forma).

## 2. Estado actual auditado

### Conteo real (verificado línea por línea en `prometeo-tool-registry.ts`,
2026-07-19, no tomado del roadmap sin verificar)

- 24 descriptors totales.
- 17 `read` con case de ejecución en `executeReadTool` (wired).
- 6 `read` sin case — caen en `default` / `__blockedReason` (namespace
  `vision`, tag `vision:run`, salvo `get_analysis/get_job_analyses/
  get_milestone_analyses` que sí están wired).
- 7 `write`/`critical` (5 `time_tracker`, 1 `agro.create_task`, 1
  `payments.propose_release`) — ninguno ejecutable; `invokeReadTool` los
  rechaza con 400 antes de llegar al switch.

### Capacidades que se conservan

- El shape `PrometeoToolDescriptor` (`namespace`, `name`, `mode`, `riskLevel`,
  `approvalPolicy`, `permissions`, `endpoint`, `inputSchema`, `outputKind`,
  `tags`) ya es razonable como contrato de catálogo; F2 no necesita
  rediseñarlo, necesita que se cumpla.
- `PrometeoToolExecutionResult` (`id`, `namespace`, `tool`, `status`,
  `output`/`errorMessage`, `auditRef`, `startedAt`, `completedAt`) es un buen
  shape de resultado estructurado; falta que `auditRef` apunte a algo real.
- El patrón `RequirePermissions` + `RbacGuard` (deny-by-default) ya existe y
  es el mismo que usa Domain Events (`domain-events:replay`) — F2 lo
  reutiliza, no inventa un mecanismo nuevo.
- Forge ya resolvió un problema estructuralmente idéntico
  (`packages/forge/src/tool-adapter.ts`: manifest por rol, policy engine,
  `evaluateForgePolicy`, decisión `allow | deny | require_approval`) para su
  propio dominio. F2 debe evaluar reusar ese patrón (no necesariamente el
  código, que está acoplado a `ForgeAgentRole`/task packets) en vez de
  diseñar una policy engine nueva desde cero.

### Brechas que este spec cierra

- permiso por tool no verificado (autorización real, no solo declarativa);
- write tools sin ruta de ejecución ni approval;
- audit trail persistido por invocación;
- completar los 6 read tools declarados-pero-no-wired, o marcarlos
  explícitamente `adapter_pending` en el catálogo (como ya hace
  `vision.analyze_video`) si no se van a completar en este corte;
- contrato de adapter por tool que reemplace el switch monolítico.

## 3. Decisiones — resueltas y confirmadas por el owner

> Las 4 quedaron abiertas en el borrador inicial. Se investigaron línea por
> línea contra el código real (no contra suposiciones) el 2026-07-19. El
> owner confirmó explícitamente la decisión 2 (gate híbrido de pagos) el
> 2026-07-20 — la única `risk: critical` que exigía sign-off humano antes de
> `APPROVED` (SDD-005). Las 4 quedan como base ejecutable para
> `tool-registry-governance.plan.md`.

### Decisión 1 — Policy engine: nueva y delgada, NO extraída de Forge

**Recomendado:** módulo nuevo dentro de `apps/api/src/modules/prometeo/` (o
`tool-governance/`), construido como **consumidor** de `hasPermission()` de
`@semse/auth`, no como reimplementación de resolución de roles. La lógica
genuinamente nueva es pequeña (~30-60 líneas): permiso → risk/approvalPolicy →
decisión.

**Por qué no extraer:** `packages/forge/src/policy.ts` (`evaluateForgePolicy`)
está fusionado al modelo de task packets de Forge (`task.allowedFiles`,
`task.targetBranch`, `manifest.fileScopes`) — solo ~4 líneas de la función son
genéricas. Existe además un **tercer motor de políticas ya en producción**,
no contemplado en el borrador inicial: `packages/agents/src/governance.ts`
(`evaluateAgentPolicy`), ya consumido por `agents.service.ts` y ya usado para
gobernar los propios agentes de IA de Prometeo (`technical-agent`,
`legal-agent`, etc.) — pero atado a un enum cerrado `AgentToolName` que
tampoco encaja con `PrometeoToolDescriptor`. Extraer cualquiera de los dos
como prerequisito de F2 sería un refactor no relacionado y más grande que el
propio F2.

**Riesgo a registrar (no resuelto por F2, para ítem de trabajo futuro):**
ya existen 3 motores `allow|deny|require_approval` con formas convergentes
pero vocabularios divergentes (Forge, `@semse/agents`, y el nuevo de F2) y sin
interfaz común. Vale un ADR futuro que defina un `PolicyDecision` tipo común
que los tres devuelvan, sin fusionar la lógica de decisión en sí.

### Decisión 2 — Pagos: gate doble, no uno solo — CONFIRMAR ANTES DE APROBAR

**Hallazgo crítico:** `approvalPolicy: "human_required"` en
`payments.propose_release` es **ficción hoy**. Si se quitara el rechazo
genérico de tools no-`read`, la llamada golpearía directo
`POST /v1/milestones/:milestoneId/escrow/release`
(`PaymentsController.release`), gateada solo por
`@RequirePermissions("projects:financials:write")` — un solo permiso, sin
segunda aprobación humana. El dinero se movería de inmediato.

**Recomendado (híbrido, no (a) ni (b) puros):** dos gates independientes que
no se pisan:

1. F2 construye la capa genérica de "proposed action" para la invocación de
   Prometeo en sí (aplica a cualquier tool `human_required`/`dual_approval`,
   no solo pagos). **Esta capa ya está medio diseñada y sin usar**:
   `packages/schemas/src/prometeo-runtime.schema.ts` ya define
   `prometeoApprovalPolicySchema` (`none|confirm|human_required|
   dual_approval`) y `prometeoProposedActionSchema` con estados
   `proposed|awaiting_approval|approved|rejected|blocked` — nadie los
   consume todavía. F2 los conecta, no los reinventa.
2. Una vez aprobada la propuesta, F2 llama al endpoint existente sin
   modificarlo. `PaymentsService.release()` conserva intactos sus checks de
   negocio (contrato firmado, milestone `APPROVED`, sin disputa abierta,
   balance suficiente) — F2 no los duplica ni los reemplaza.

Los dos gates responden preguntas distintas: "¿puede este agente/sesión
proponer esto?" (gate 1, nuevo) vs. "¿es esto financieramente válido ahora
mismo?" (gate 2, ya existe). Ninguno reemplaza al otro.

**Por qué no los puros:** (a) delegar solo en lo existente deja
`human_required` sin efecto real. (b) construir un flujo de aprobación que
sea el único gate arriesga duplicar o — peor — bypasear los invariantes de
`PaymentsService.release()`.

### Decisión 3 — Audit trail: split por write/read, no una tabla única

**Recomendado:**

- **Write-tool invocations** (cuando F2 las habilite): a `AuditLog` vía
  `AuditService.append`, igual que cualquier otra acción mutante del repo.
- **Read-tool invocations**: NO una fila de `AuditLog` por invocación.
  `AuditLog` no tiene retención/purga/particionado, y el volumen esperado
  (3-5 reads por turno de chat × muchos turnos × muchos tenants) es de forma
  telemetría, no de forma auditoría — ninguna fila de read tiene
  `beforeJson`/`afterJson` que justifique el schema. **Ya hay precedente
  aprobado para esto exacto**: `docs/specs/platform/product-intelligence.spec.md`
  especifica explícitamente `audit_log: no` para el ingest de telemetría de
  alto volumen ("volumen; se audita configuración, no cada evento"), con su
  propio modelo `ProductEvent` de retención corta. F2 sigue ese patrón en vez
  de inventar uno nuevo: reads van a logging estructurado / un modelo propio
  de bajo costo, y solo los outcomes bloqueados/con error (el camino
  `blockedReason`, poco frecuente y significativo) se persisten de forma
  durable.

### Decisión 4 — Los 5 tools `vision:run` sin cablear: quedan `adapter_pending` en este corte

**Recomendado:** NO cablearlos todavía, aunque mecánicamente sea trivial (~1
hora, mismos `case` que los 3 ya cableados). Motivo: los 5 pasan por
`VisionServiceClient` con `fetch()` síncrono real a un microservicio externo
(hasta 30s de timeout) y **sin ningún rate limit, cost tracker o quota en
todo el repo** — cablearlos ahora significaría que Prometeo puede disparar
llamadas externas costosas y lentas **antes** de que F2 termine de construir
el enforcement de `permissions`/`approvalPolicy`/audit. Eso invierte el
orden que el propio spec exige (sección 5: "el policy engine se ejecuta
antes del adapter, nunca dentro"). Se cablean como fast-follow una vez que
el enforcement exista.

**Hallazgo adicional a registrar (no bloquea F2, es un defecto de catálogo
separado):** `vision.analyze_image` está declarado `mode: "read"` pero en
realidad **escribe** — crea y actualiza un `VisionAnalysisRecord`. Corregir
esta clasificación cuando se cablee.

## 4. Actores y permisos

| Actor | Rol/identidad | Puede hacer | No puede hacer |
| --- | --- | --- | --- |
| Cualquier actor autenticado | rol con `agents:run:create` | listar catálogo (`GET /tools`), invocar tools `read` cuyo `permissions` posea individualmente | invocar una tool `read` sin el permiso específico declarado por esa tool; invocar tools `write`/`critical` |
| Actor con permiso de escritura de la tool | p. ej. `field-ops:write`, `agro:write` | invocar tools `write` de riesgo bajo/medio tras políticas de F2 (approvalPolicy `none`/`confirm`) | saltarse `approvalPolicy: human_required` |
| `OPS_ADMIN` | aprobador | aprobar/rechazar invocaciones `require_approval`, consultar audit trail de tool invocations | ejecutar en nombre de otro actor sin quedar registrado como aprobador |

Deny-by-default: una tool sin `permissions` verificables o sin adapter
registrado no debe aparecer como invocable — mismo principio que Forge
(`no tool declarada aparece como ejecutable sin adapter`, ya en `ROADMAP.md`
F2).

## 5. Contrato del adapter (borrador — a refinar en plan.md)

```ts
interface PrometeoToolAdapter<TInput = unknown, TOutput = unknown> {
  descriptor: PrometeoToolDescriptor;
  execute(input: {
    actor: RequestContext;
    requestId: string;
    payload: TInput;
  }): Promise<PrometeoToolAdapterResult<TOutput>>;
}

type PrometeoToolAdapterResult<TOutput> =
  | { status: "succeeded"; data: TOutput }
  | { status: "blocked"; reason: string }
  | { status: "failed"; error: string };
```

Reglas propuestas (a validar en plan.md):

- cada tool registrada en `PROMETEO_TOOL_REGISTRY` debe tener exactamente un
  adapter registrado bajo `${namespace}.${name}`, o el catálogo la marca
  `adapter_pending` automáticamente (no manualmente por tag, como hoy);
- el policy engine (decisión 1, nuevo módulo delgado sobre `hasPermission()`
  de `@semse/auth`) se ejecuta **antes** del adapter, nunca dentro — el
  adapter no decide si tiene permiso para correr, solo ejecuta;
- todo adapter recibe `actor` ya autorizado; no vuelve a resolver tenant ni
  roles;
- `write`/`critical` adapters con `approvalPolicy` distinto de `none` no
  ejecutan dentro de la misma llamada: crean/actualizan un
  `PrometeoProposedAction` (schema **ya existente**,
  `prometeoProposedActionSchema` en `packages/schemas/src/
  prometeo-runtime.schema.ts`, hoy sin consumidor) en estado
  `awaiting_approval`, y quedan pendientes hasta que Ops decida — mismo
  patrón que `ForgeHarness.ensurePendingApproval` / `approve` / `reject`
  (ya corregido en `packages/forge/src/orchestrator.ts` como parte de este
  mismo research loop: la lección directa es que la decisión de
  aprobar/rechazar debe mutar estado persistido real, nunca un clon
  descartable de `getRun()`/equivalente);
- para `payments.propose_release` específicamente, la aprobación de la
  `PrometeoProposedAction` NO ejecuta el efecto directamente — dispara la
  llamada al endpoint existente (`POST /v1/milestones/:milestoneId/escrow/
  release`), cuyos invariantes de negocio (`PaymentsService.release()`)
  quedan como el segundo gate, intacto (decisión 2).

## 6. Contratos API previstos

### `GET /v1/prometeo/tools` (existente, ajustar output)

Debe exponer si cada tool tiene adapter registrado
(`executable: boolean`) en vez de que el frontend infiera por `tags`.

### `POST /v1/prometeo/tools/invoke` (existente, ajustar guard)

```yaml
auth: requerida
permissions: [agents:run:create, "<descriptor.permissions[*]>"]
privacyCritical: true
input: { namespace, name, input }
output: PrometeoToolExecutionResult
errores:
  400: tool desconocida o sin adapter
  403: falta agents:run:create o el/los permiso(s) declarados por la tool
efectos:
  auditLog: true
  evento: none (F2 no introduce Domain Events; ver decisión #3)
  sse: false
  paymentGovernance: solo para namespace payments
```

### `POST /v1/prometeo/tools/invoke` para tools `write`/`critical` (nuevo)

```yaml
output: PrometeoToolExecutionResult con status "pending_approval" cuando
  approvalPolicy exige confirmación humana
efectos:
  auditLog: true (tanto el intento como la decisión de aprobación)
```

### Ruta de aprobación (nueva, forma exacta TBD en plan.md)

Necesaria para desbloquear invocaciones `pending_approval` — probable
`POST /v1/prometeo/tools/invocations/:invocationId/approve|reject`, mismo
patrón RBAC que `POST /v1/domain-events/:eventId/replay`.

## 7. Escenarios de aceptación (borrador)

### P0 — Enforcement de permiso por tool

```text
DADO un actor con agents:run:create pero sin field-ops:read
CUANDO invoca time_tracker.get_status
ENTONCES recibe 403, no 200
```

### P0 — Write tool sin approval no ejecuta directo

```text
DADO payments.propose_release (approvalPolicy: human_required)
CUANDO un actor con payments:write la invoca
ENTONCES la respuesta es "pending_approval", no un efecto inmediato
  Y no se libera ningún pago
```

### P1 — Audit trail reconstruible

```text
DADO cualquier invocación exitosa o bloqueada
CUANDO se consulta el audit trail por tenant y rango de fecha
ENTONCES aparece namespace, tool, actor, input (redacted si aplica),
  resultado y auditRef persistido — no una etiqueta sin respaldo
```

### P1 — Catálogo honesto

```text
DADO GET /v1/prometeo/tools
CUANDO una tool no tiene adapter registrado
ENTONCES el catálogo la marca explícitamente no-ejecutable
  Y no puede invocarse (400, no un blockedReason silencioso post-invocación)
```

## 8. Tests requeridos antes de implementación

- rechazo 403 por permiso de tool ausente, con agents:run:create presente;
- aceptación cuando el actor tiene ambos permisos;
- write tool de riesgo bajo (approvalPolicy: none) ejecuta directo tras
  policy;
- write tool con approvalPolicy: confirm/human_required nunca ejecuta el
  efecto sin decisión de aprobación registrada;
- reject de una aprobación pendiente dejarla en estado terminal (reutilizar
  el fix de persistencia de Forge como precedente de qué NO repetir);
  audit trail persiste y es tenant-scoped;
  catálogo marca adapter_pending correctamente para tools sin adapter.

## 9. No objetivos F2

- rediseñar el shape de `PrometeoToolDescriptor`;
- extraer o unificar los 3 motores de policy existentes (Forge,
  `@semse/agents`, F2) en un paquete común — decisión #1, queda como riesgo
  registrado para un ADR futuro, no como trabajo de este corte;
- cablear los 5 tools `vision:run` pendientes (`analyze_image`,
  `compare_before_after`, `detect_material`, `classify_space`,
  `check_safety`) — decisión #4, quedan `adapter_pending` hasta que el
  enforcement de permisos/audit de F2 exista primero;
- completar `vision.analyze_video` (pipeline temporal, ya marcado
  `adapter_pending`, sigue fuera de alcance — es su propio ítem en
  `IMPLEMENTATION_STATUS_MATRIX.md`);
- modificar `PaymentsService.release()` o cualquier invariante de negocio de
  pagos existente — F2 se conecta como gate previo, no reemplaza el gate
  financiero (decisión #2);
- exactly-once ni idempotencia distribuida más allá de lo que ya da
  `agents:run:create` + audit.

## 10. Dependencias y documentos

- `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md` (fila "Tool Registry");
- `ROADMAP.md` sección F2;
- `packages/forge/src/tool-adapter.ts` y `policy.ts` (precedente de patrón,
  no de código compartido todavía);
- `apps/api/src/common/rbac.guard.ts` / `rbac.ts` (mecanismo de permisos a
  reutilizar).

## Checklist de aprobación

- [x] Problema verificado contra el código actual, no contra documentación
      desactualizada (conteos exactos, líneas citadas).
- [x] Decisiones (sección 3) investigadas línea por línea y confirmadas por
      el owner — decisión #2 (pagos, `risk: critical`) confirmada
      explícitamente 2026-07-20 (SDD-005).
- [x] Contrato de adapter validado (sección 5, gate híbrido de
      `PrometeoProposedAction` sobre el endpoint de escrow existente sin
      modificarlo).
- [x] Contratos API confirmados (incluida la ruta de aprobación, sección 6).
- [x] Tests y criterios de aceptación confirmados (sección 8).
- [x] Aprobación explícita recibida — `status: DRAFT -> APPROVED` 2026-07-20.
      Habilita `tool-registry-governance.plan.md`.
