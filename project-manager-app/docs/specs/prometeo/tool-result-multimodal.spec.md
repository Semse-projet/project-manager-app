---
id: "prometeo.tool-result-multimodal"
title: "ToolResult multimodal tipado (alias histórico SPEC-AGT-004)"
domain: "prometeo"
sdd_version: "2.0"
version: "1.0"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "PASS"
merge_status: "MERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: []
production_evidence: []
related_files:
  - apps/api/src/modules/prometeo/prometeo-tool-registry.ts
  - apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts
  - packages/schemas/src/prometeo-runtime.schema.ts
  - apps/web/components/ai/prometeo-response.ts
  - apps/web/components/ai/agent-chat-panel.tsx
related_tests:
  - apps/api/test/prometeo-tool-vision-execution.service.test.ts
  - apps/api/test/prometeo-tool-result-schema.test.ts
related_endpoints:
  - "POST /v1/prometeo/tools/invoke"
related_events: []
related_agents:
  - prometeo
last_verified: "2026-08-27"
---

# Spec: `ToolResult` multimodal tipado

> Contrato ejecutable SDD 2.0. Código, CI, merge, deploy y activación se
> registran por separado; un deploy no demuestra activación ni verificación
> funcional.

**Deriva de:** `docs/architecture/ADR-023-sense-agentic-architecture-v1.md`
§2.3 ítem 2 (`ACCEPTED`).
**Módulos afectados:** `apps/api/src/modules/prometeo`, `packages/schemas`.
**Alias histórico:** `SPEC-AGT-004` (renumerado desde `SPEC-AGT-002` por
`ADR-023` §6 — ese id colisionaba con `agt-002-prometeo-core`; **no**
`SPEC-AGT-002-B`, corrección frente a como lo citaba la versión anterior de
`docs/specs/agents/prometeo-core.spec.md`). Child spec de F7 (Prometeo
Multimodal); depende de `prometeo.model-gateway-unification` (estado
`REVIEW`, no implementada — corrección: la versión anterior de este
documento decía "mergeado", que no es cierto para el código, solo para el
propio archivo de spec vía PR #495).

## 1. Problema y resultado

**Para quién:** cualquier persona/agente de Prometeo que necesita devolver
algo más que texto plano — una imagen anotada, un PDF, una tabla CSV — como
resultado de una tool.

**Problema:** hoy toda salida de herramienta de Prometeo es JSON no
tipado. `outputKind` es solo una etiqueta descriptiva del nombre de tipo
TypeScript (p. ej. `"VisionAnalysisResult"`), no una estructura real de
partes. Prometeo no puede devolver una imagen anotada, un PDF generado, o
una tabla CSV como parte estructurada de una respuesta de herramienta —
solo puede describirlos en texto o dejar una URL suelta dentro de un JSON
sin contrato.

**Resultado esperado:** un tipo `ToolResultPart` discriminado
(text/json/image/pdf/csv/annotation/internal_link/approval_request) que
las herramientas pueden devolver, empezando por un piloto real en
`vision.analyze_image` — sin romper el contrato JSON actual de las demás
herramientas.

## 2. Alcance

### Incluido

- `ToolResultPart`/`ToolResult` en `packages/schemas/src/` — tipo nuevo,
  aditivo.
- Piloto de adopción en `vision.analyze_image` (namespace `vision`, tool
  de lectura ya existente).
- Consumidor en `apps/web` que renderiza cada `type` con fallback a
  texto/JSON crudo si no lo reconoce.

### Fuera de alcance / corregido frente a la versión anterior

- **No se migra ninguna de las ~30 tools existentes** en este spec —
  confirmado: 31 descriptors (`grep -c outputKind`), todos siguen
  devolviendo su forma actual salvo el piloto.
- **El segundo piloto ("un export de evidencia") no existe hoy como tool
  de Prometeo.** Verificado: los namespaces reales del Tool Registry son
  `agro`, `materials`, `payments`, `time_tracker`, `vision` — no hay
  namespace `evidence`. Construir un export de evidencia como tool nueva
  es trabajo adicional no cubierto por este spec (es una tool nueva, no
  una migración de una existente) — se retira como piloto declarado y se
  deja como extensión futura una vez exista esa tool.
- No cambia la gobernanza de tools (`tool-governance.policy.ts` aplica
  igual, sea el resultado `ToolResult` o JSON plano).
- No introduce almacenamiento nuevo — las URLs de `image`/`pdf`/`csv`
  deben apuntar al storage ya existente.

## 3. Actores, permisos y límites

| Actor | Permiso backend | Alcance tenant/org/recurso | Puede | No puede |
|---|---|---|---|---|
| Cualquier actor con `vision:run` | `vision:run` (ya vigente, sin cambio) | tenant/org resuelto por `resolveRequestContext`, sin cambio | Invocar `vision.analyze_image` y recibir un `ToolResult` con parte `image` | Acceder a una URL de imagen fuera del control de permisos que ya aplica al storage subyacente |

- **Tenant boundary:** sin cambio — `vision.analyze_image` ya resuelve
  tenant/org igual que hoy; `ToolResult` no introduce una ruta de acceso
  nueva.
- **Ownership/resource policy:** sin cambio — el piloto no toca
  `evaluatePrometeoToolPolicy`.
- **Step-up o aprobación humana:** ninguna — `vision.analyze_image` es
  tool de lectura (`mode: "read"`, confirmado en
  `prometeo-tool-registry.ts:184`), sin `approvalPolicy` de escritura.
- **Datos `privacyCritical`:** ninguno nuevo — la imagen ya se sirve hoy
  bajo el mismo control de storage.
- **Requisitos de auditoría:** sin cambio — `PrometeoToolInvocationAudit`
  ya registra la invocación; el cambio de forma del resultado no afecta
  qué se audita.

## 4. Estado real (verificado en código, 2026-08-17)

| Pieza | Qué hace hoy | Evidencia |
|---|---|---|
| `PrometeoToolDescriptor.outputKind` | String descriptivo del tipo TS del output — 31 ocurrencias confirmadas, todas string libre, ninguna es un schema | `prometeo-tool-registry.ts` (`grep -c outputKind` = 31) |
| `vision.analyze_image` | Tool de **lectura** (`readTool({...})`), ejecuta `VisionService.runAnalysis()`, devuelve `VisionAnalysisResult` como JSON plano | `prometeo-tool-registry.ts:184-197` |
| `PrometeoToolExecutionService.invokeReadTool` | Devuelve `{ id, namespace, tool, status, output: { outputKind, data }, auditRef, startedAt, completedAt }` — **el resultado de tools de lectura nunca se persiste**, viaja únicamente en la respuesta HTTP | `prometeo-tool-execution.service.ts:150,189-201` |
| `PrometeoToolExecutionService.invokeWriteTool` | Devuelve el mismo `output`, pero además lo persiste vía `toolGovernance.finalizeProposedAction({ resultJson: output })` | `prometeo-tool-execution.service.ts:408-413` |
| Persistencia de `resultJson: Json?` | **Corrección frente a la versión anterior de este spec**, que citaba 4 modelos incorrectos (`DomainOutboxEvent`, `AgentWorkPlan`, `AiInteractionLog`, `PrometeoToolInvocationAudit` — este último **no tiene** columna `resultJson`). Los 4 modelos reales con `resultJson: Json?` son `DomainEventConsumption`, `AgentDelegation`, `MissionControlActionReceipt`, `PrometeoProposedAction` — y de estos, el único que `PrometeoToolExecutionService` efectivamente escribe es `PrometeoProposedAction.resultJson`, y solo para tools de **escritura** | `packages/db/prisma/schema.prisma:848,1684,2329,3820` (modelos), `3837` (campo en `PrometeoProposedAction`); `prometeo-tool-invocation-audit` confirmado sin `resultJson` en `schema.prisma:3845-3859` |

**Consecuencia real — de-riesgo frente a la versión anterior:** el piloto
declarado (`vision.analyze_image`) es una tool de **lectura**, cuyo
resultado **nunca toca Prisma** — vive únicamente en la respuesta HTTP de
`invokeReadTool`. Esto significa que adoptar `ToolResult` en el piloto
**no requiere ninguna migración ni tocar `resultJson` en ningún modelo**:
es trabajo puramente de tipos en `packages/schemas` + el handler de
`vision.analyze_image`. Solo si en el futuro se pilotea en una tool de
**escritura** el diseño necesita considerar `PrometeoProposedAction.resultJson`
como destino de serialización — no es el caso del piloto de este spec.

## 5. Diseño propuesto

```ts
// packages/schemas/src — nuevo, aditivo
export type ToolResultPart =
  | { type: "text"; text: string }
  | { type: "json"; data: unknown }
  | { type: "image"; url: string; mimeType: string; metadata?: Record<string, unknown> }
  | { type: "pdf"; url: string; filename: string }
  | { type: "csv"; url: string; filename: string }
  | { type: "annotation"; targetId: string; data: unknown }
  | { type: "internal_link"; entityType: string; entityId: string }
  | { type: "approval_request"; approvalId: string };

export type ToolResult = {
  parts: ToolResultPart[];
  // compatibilidad hacia atrás: el JSON plano de hoy sigue disponible
  legacyJson?: unknown;
};
```

- Herramientas que no adopten `ToolResult` siguen devolviendo `unknown` tal
  cual — es aditivo, no se fuerza una migración de las ~30 tools
  existentes en este spec.
- Piloto único confirmado: `vision.analyze_image` devuelve
  `{ parts: [{ type: "json", data: <VisionAnalysisResult existente> }, { type: "image", url: <imagen anotada si existe> }] }`,
  sin cambio de persistencia (§4).
- **Implementado 2026-08-27 — corrección de alcance real:** verificado
  (`grep -rn "annotated|overlay|heatmap"` sobre `apps/api/src/modules/
  vision/` y `apps/vision-service/`) que **ningún** campo de imagen
  anotada existe hoy en `VisionAnalysisRecord`, `rawResult`, ni en el
  microservicio de visión. El piloto implementado solo produce
  `{ parts: [{ type: "json", data: <VisionAnalysisResult> }], legacyJson: <VisionAnalysisResult> }`
  — sin parte `image`, consistente con el "si existe" de este párrafo y
  con el caso borde de §6. No se agregó una detección especulativa de un
  campo inexistente (ver `prometeo-tool-execution.service.ts`,
  `buildVisionAnalyzeImageToolResult`). El camino "con imagen" de §6 P1
  queda estructuralmente soportado por el tipo `ToolResultPart` pero no es
  ejercitable con datos reales hasta que `apps/vision-service` produzca
  una imagen anotada — trabajo futuro, no de este spec.
- El consumidor (`apps/web`, componentes del Prometeo Copilot) debe poder
  renderizar cada `type` de `ToolResultPart` sin romper si aparece un
  `type` que no reconoce (fallback a texto/JSON crudo).
- Cuando exista una tool real de export de evidencia (fuera de alcance de
  este spec, ver §2), su adopción de `ToolResult` sí deberá revisar el
  camino de escritura (`PrometeoProposedAction.resultJson`), porque un
  export probablemente sea `mode: "write"` o al menos con efecto de
  side-storage — spec aparte cuando esa tool exista.

## 6. Escenarios y criterios de aceptación

### P1 — `vision.analyze_image` devuelve `ToolResult` con parte `image`

```gherkin
DADO un usuario con vision:run invocando vision.analyze_image
CUANDO la imagen analizada tiene una versión anotada disponible
ENTONCES el output de invokeReadTool trae outputKind: "ToolResult"
Y data.parts incluye al menos una parte type: "image" real, no solo json
Y legacyJson conserva el VisionAnalysisResult tal cual existía antes
```

### P2 — Herramientas no migradas no cambian de comportamiento

```gherkin
DADO cualquiera de las otras 30 tools del registry
CUANDO se invocan sin haber adoptado ToolResult
ENTONCES su output.data sigue siendo exactamente el JSON plano de hoy
```

Casos borde:

- [ ] El consumidor en `apps/web` recibe un `type` de `ToolResultPart`
      que no reconoce (versión futura del tipo) — debe hacer fallback a
      texto/JSON crudo, no romper el render.
- [ ] `vision.analyze_image` sin imagen anotada disponible — `parts`
      contiene solo la parte `json`, sin una parte `image` vacía o
      inventada.
- [ ] URL de imagen en `ToolResultPart` expuesta sin el control de
      permisos que ya aplica al storage subyacente — no debe ocurrir; se
      verifica reusando el mismo mecanismo de firma/tenant que ya protege
      el bucket de Evidence/Vision.

## 7. Contratos

### API — `POST /v1/prometeo/tools/invoke` (namespace `vision`, tool `analyze_image`)

```yaml
auth: required
permissions: ["vision:run"]
input_schema: "{ evidenceId: string; imageUrl: string; jobId?: string; milestoneId?: string }"
output_schema: "PrometeoToolExecutionResult con output.outputKind: 'ToolResult' y output.data: ToolResult"
errors:
  400: "unknown tool / validación de input sin cambio"
  401: "sin sesión"
  403: "falta vision:run"
  404: "no aplica — tool conocida siempre resuelve"
  409: "no aplica — tool de lectura, sin conflicto de estado"
effects:
  audit_log: "sin cambio — PrometeoToolInvocationAudit ya registra la invocación"
  domain_event: "ninguno nuevo"
  sse: "ninguno nuevo"
  payment_governance: "no aplica"
```

### UI

```yaml
surfaces:
  - Prometeo Copilot (apps/web) — componente de render de resultado de tool
states:
  - loading
  - ready
  - error
required_behavior:
  - Renderiza cada ToolResultPart.type conocido con su propio componente.
  - Fallback a texto/JSON crudo (legacyJson) ante un type desconocido.
```

### Agente/Prometeo

```yaml
tools: ["vision.analyze_image"]
input_schema: "sin cambio — { evidenceId, imageUrl, jobId?, milestoneId? }"
output_schema: "ToolResult { parts: ToolResultPart[]; legacyJson?: unknown }"
source_citations_required: false
approval_policy: "none — tool de lectura, sin cambio de approvalPolicy"
forbidden_behavior:
  - Ninguna tool existente cambia de comportamiento si no adopta ToolResult explícitamente.
  - Ninguna URL de storage se expone sin el control de permisos ya vigente.
```

## 8. FSM, eventos y reconstrucción

No aplica — sin FSM de dominio afectado, sin eventos nuevos. El cambio es
puramente de forma del resultado de una tool de lectura.

## 9. Datos y migración

- **Modelos Prisma:** ninguno nuevo, y **ninguna migración necesaria para
  el piloto** — hallazgo de esta revisión (§4): `vision.analyze_image` es
  de lectura, su resultado no se persiste.
- **Migración:** no aplica para el piloto declarado.
- **Estrategia expand/contract:** el tipo `ToolResult` es aditivo — las
  ~30 tools no migradas no cambian.
- **Backfill:** no aplica.
- **Compatibilidad hacia atrás:** `legacyJson` conserva el JSON plano
  actual dentro del nuevo contrato — ningún consumidor existente que lea
  `output.data` directamente como el JSON de siempre se rompe si el
  consumidor se actualiza para leer `legacyJson` cuando `outputKind` es
  `"ToolResult"`.
- **Verificación de drift:** §4 corrige la cita de modelos Prisma de la
  versión anterior (ver tabla) y confirma que el piloto no toca
  persistencia.
- **Rollback de código:** trivial — revertir el handler de
  `vision.analyze_image` a su forma anterior no afecta a ninguna otra
  tool.
- **Rollback/forward-fix de datos:** no aplica.

## 10. Observabilidad, despliegue y activación

- **Métricas/SLO:** ninguna nueva — mismo endpoint ya monitoreado
  (`POST /v1/prometeo/tools/invoke`).
- **Logs/traces/correlation:** sin cambio — `auditRef` ya presente.
- **Health/readiness:** no aplica.
- **Feature flags/allowlists:** ninguno — cambio aditivo de tipo, sin
  riesgo de romper consumidores no actualizados.
- **Plan de canary:** activar el piloto en `vision.analyze_image` y
  verificar que `apps/web` renderiza la parte `image` antes de considerar
  un segundo piloto (una vez exista una tool de export real).
- **Evidencia de producción requerida:** una invocación real de
  `vision.analyze_image` con imagen anotada, devolviendo `ToolResult` con
  parte `image`, renderizada correctamente en `apps/web`.
- **Señal de rollback:** cualquier consumidor de `apps/web` que rompa al
  recibir `outputKind: "ToolResult"` en vez del `outputKind` anterior.
- **Owner operativo:** `semse-core`.

## 11. Tests requeridos

- [ ] Unitario: `vision.analyze_image` devuelve `ToolResult` con `parts`
      no vacío y `legacyJson` igual al `VisionAnalysisResult` de hoy.
- [ ] Contrato: las 30 tools no migradas devuelven exactamente el mismo
      `output.data` que antes de este spec.
- [ ] UI: el consumidor de `apps/web` renderiza cada `type` conocido y
      hace fallback ante uno desconocido (test de regresión hacia
      adelante).
- [ ] Permisos: ninguna URL de `image`/`pdf`/`csv` es accesible sin el
      control de permisos que ya aplica al storage subyacente.
- [ ] Migración y compatibilidad: confirmado que no aplica (ver §9) —
      test que documenta explícitamente que `vision.analyze_image` no
      toca ningún modelo Prisma.
- [ ] Canary o smoke autenticado en producción antes de `VERIFIED`.

## 12. Mapa de implementación

### API

- `apps/api/src/modules/prometeo/prometeo-tool-registry.ts` — actualizar
  `outputKind` de `vision.analyze_image` a `"ToolResult"`
- `apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts` —
  construir `ToolResult` en el handler de `vision.analyze_image`

### Web

- `apps/web/components/ai/` (o equivalente del Prometeo Copilot) —
  renderer por `ToolResultPart.type` con fallback

### Worker/Packages/DB

- `packages/schemas/src/prometeo-runtime.schema.ts` — definir
  `ToolResultPart`/`ToolResult`

### Tests

- `apps/api/test/prometeo/*`, `apps/web/**/*.test.*` (ubicación exacta a
  confirmar en `/speckit.tasks`)

## 13. Investigación externa

- No se realizó investigación externa nueva — el diseño de partes
  discriminadas (`text`/`json`/`image`/`pdf`/`csv`/...) es un patrón ya
  interno al repo (similar a como otros contratos de `packages/schemas`
  usan uniones discriminadas por `type`); no requirió evaluar alternativas
  externas para este piloto acotado.

## 14. Gates de cierre

- [ ] Spec enlazado por `pnpm spec:index`
- [ ] Spec, plan, tasks, analyze y checklist coherentes
- [ ] Tests derivados del spec y verdes
- [ ] `pnpm spec:validate:strict` verde
- [ ] Migración reproducible y rollback/forward-fix documentado (no
      aplica, ver §9)
- [ ] CI `PASS`
- [ ] PR fusionado y SHA registrado
- [ ] Deployment terminal `DEPLOYED`
- [ ] Activación/canary verificada por separado
- [ ] `production_evidence` y `last_verified` actualizados
- [ ] Sólo entonces `status: VERIFIED`
