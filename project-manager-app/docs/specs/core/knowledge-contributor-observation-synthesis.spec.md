---
id: "core.knowledge-contributor-observation-synthesis"
title: "Field Knowledge Contributor Program — Observation Synthesis via LLM (PR-12)"
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
feature_flags:
  - "SEMSE_ASR_PROVIDER"
  - "CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED"
production_evidence: []
related_files:
  - "apps/api/src/modules/contributor-program/observation-synthesis.ts"
  - "apps/api/src/modules/contributor-program/contributor-program.service.ts"
  - "apps/api/src/modules/contributor-program/contributor-program.module.ts"
related_tests:
  - "apps/api/test/observation-synthesis.test.ts"
  - "apps/api/test/contributor-program-extraction.test.ts"
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-09-24"
---

# Spec: Field Knowledge Contributor Program — Observation Synthesis via LLM (PR-12)

> Contrato ejecutable SDD 2.0.

**Aprobación:** el dueño del producto aprobó construir esta síntesis en la
sesión de PR-11, explícitamente como slice separado (ver
`docs/specs/core/knowledge-contributor-asr-openai-whisper.spec.md` §2
"Fuera de alcance"). El diseño de enrutamiento de privacidad (§0/§5 acá
abajo) se resolvió por evidencia de código ya auditada en esta sesión, no
por una nueva pregunta al dueño del producto — ver "por qué no se necesitó
una nueva ronda de `AskUserQuestion`" más abajo.

## 0. ZOOM — estado real encontrado antes de escribir este spec

| Capa | Estado | Evidencia |
|---|---|---|
| `createObservation` (repositorio) | existe desde PR-5, nunca invocado en producción | confirmado por PR-11: solo se llama desde tests |
| `AiModelGatewayService.generate(request)` | patrón real ya usado para extracción estructurada de texto libre vía LLM | `finance/receipt-ocr.service.ts` — mismo shape exacto (systemPrompt + input + requireJson + parseo tolerante de JSON) que este PR necesita |
| Enrutamiento de privacidad | ya implementado y ya auditado, no es el gap de SPEC-GTW-001 | `AiModelRouterService.selectRoute()`: si `request.privacyLevel` es `"local_only" | "sensitive" | "restricted"`, retorna `ollama-local` **antes** de mirar `taskType` o `forceModelSlug`, sin `fallbackModelSlug` (falla cerrado). Este chequeo está fijo desde 2026-08-27 (`ai-model-router-privacy.test.ts`) |
| El gap real de SPEC-GTW-001 | no aplica a esta llamada | ese gap es que 5 slugs (`deepseek-chat`/`deepseek-reasoner`/`kimi-k2`/`glm-4`/`glm-ollama`) evitan `AdaptiveRouter.applyHardConstraints()` porque van por un camino de proveedor directo en `AiModelGatewayService.executeWithSlug()`. `ollama-local` **no** es uno de esos 5 — va por `LLMOrchestrator.chat()`, al que además se le pasa `localOnly`/`privacyCritical` explícitamente calculados desde `privacyLevel` (`ai-model-gateway.service.ts` línea ~122-136) |
| Ciclo de módulos | `AiModelsModule` importa `PrometeoModule`, que ya está en el ciclo `ContributorProgramModule` ↔ `PaymentsModule` (desde PR-10) | confirmado por un boot real: primer intento sin `forwardRef` en el nuevo edge produjo `ReferenceError: Cannot access 'AiModelsModule' before initialization` — mismo patrón de TDZ que PR-10 ya documentó, corregido con `forwardRef(() => AiModelsModule)` |

**Por qué no se necesitó una nueva ronda de `AskUserQuestion` para el
enrutamiento de privacidad:** la sesión de PR-11 flageó esto como "toca un
gap de privacidad sin resolver (SPEC-GTW-001)" antes de tener la evidencia
de código exacta. Al investigar `ai-model-router.service.ts` línea por
línea para este PR, se confirmó que `privacyLevel: "sensitive"` es
exactamente el mecanismo ya auditado y ya testeado para forzar
`ollama-local`, y que ese slug no pasa por el camino de 5 proveedores
directos que el gap real describe. No es una decisión de producto nueva —
es usar correctamente un mecanismo de seguridad que ya existe y ya está
probado, así que no calificaba como el tipo de decisión que requirió
`AskUserQuestion` en PR-9/PR-10/PR-11 (ASR local vs. hosted, fix de
race de pagos). Confirmar esto exigió sí, ZOOM real (leer el router
completo), no una suposición.

## 1. Problema y resultado

**Problema:** con PR-11 mergeado, un `TranscriptSegment` real puede existir
por primera vez — pero nada todavía transforma ese transcript en una
`Observation` estructurada (OBJECTIVE→CONDITION→DECISION→REASON→METHOD→
ACTION→RESULT). El pipeline completo (misión → entrega → ASR → LLM →
revisión humana → promoción a RAG) sigue teniendo un eslabón faltante.

**Resultado:** `ContributorProgramService.processPendingExtractions`, tras
completar una transcripción con éxito, intenta sintetizar 0+ `Observation`
candidatas desde los segmentos reales, vía una llamada a
`AiModelGatewayService.generate()` con `privacyLevel: "sensitive"`
(fuerza `ollama-local`, nunca un proveedor cloud). Cada observación
generada queda en `promotionStatus: PENDING` (default del modelo, sin
cambios) — nunca se auto-promueve a RAG; eso sigue siendo la decisión
humana ya implementada en PR-6.

## 2. Alcance

### Incluido

- `observation-synthesis.ts`: `buildSynthesisPrompt` (construye el prompt +
  alias cortos `s1`, `s2`... para citación, evitando que el modelo tenga
  que copiar cuids largos) y `parseSynthesisResponse` (parseo tolerante de
  JSON + **validación estricta de citas**: cualquier alias que el modelo
  mencione que no fue uno de los dados se descarta; una observación sin
  ninguna cita válida se descarta completa; una observación con cita válida
  pero los 7 campos en `null` también se descarta — "citar un segmento sin
  decir nada" no es una observación).
- `ContributorProgramService.synthesizeObservations` (privado, invocado
  solo desde `processPendingExtractions`): arma el prompt desde los
  segmentos reales recién persistidos, llama al gateway con
  `taskType: "field_report_generation"` + `privacyLevel: "sensitive"`,
  parsea la respuesta, persiste cada observación válida vía
  `repository.createObservation` con `generatedBy:
  "contributor-observation-synthesis:<modelSlug real>"` (trazable al
  modelo exacto que la generó), emite un evento de auditoría por
  observación creada.
- **Best-effort, nunca bloquea la transcripción**: si la síntesis falla
  (el gateway falla cerrado, JSON inválido, lo que sea), la extracción
  queda igual `COMPLETED` — el transcript real ya es una pieza valiosa por
  sí sola y revisable por un humano aunque la síntesis automática no haya
  producido nada. La falla se audita (`observation.synthesis_failed`) pero
  nunca convierte una transcripción exitosa en un fallo.
- Wiring: `AiModelsModule` importado en `ContributorProgramModule` (con
  `forwardRef`, ver §0), `AiModelGatewayService` inyectado en el
  constructor del servicio.

### Fuera de alcance

- **Corrección/edición humana de una Observation sintetizada** — ya existe
  desde PR-5 (`correctObservation`), sin cambios necesarios acá.
- **Promoción automática a RAG** — nunca. Sigue siendo 100% decisión
  humana (PR-6), este PR no la toca.
- **Reintento automático de síntesis fallida** — una extracción que
  transcribió bien pero cuya síntesis falló queda `COMPLETED` con cero
  observaciones; no hay cola de reintento en este alcance (mismo criterio
  que PR-5 ya estableció para el worker de extracción en general).
- **Activación real en producción** — depende de que `SEMSE_ASR_PROVIDER`
  esté activado primero (PR-11) para que existan transcripts reales; y de
  que `semse-API` (no solo el servicio `ollama` de Railway) tenga
  `OLLAMA_BASE_URL`/`ENABLE_OPEN_SOURCE_MODELS=true` configurados para que
  `ollama-local` realmente resuelva — **no confirmado en esta sesión**
  (lectura de variables de `semse-API` denegada por el clasificador de modo
  automático del sandbox, igual que en PR-11). Si no está configurado, la
  llamada falla cerrado (ver §0) — comportamiento honesto, no un bloqueo
  para mergear este PR.

## 3. Actores, permisos y límites

Sin cambios respecto a PR-5/PR-11 — mismo actor interno (`platform`, worker
job vía `processPendingExtractions`), mismo alcance tenant-scoped. Este PR
no agrega endpoints ni permisos nuevos.

## 4. Escenarios y criterios de aceptación

### P1 — Transcripción exitosa con contenido de trabajo real

El transcript contiene una descripción real de una tarea de campo →
1+ `Observation` se crea, cada una citando ids de segmento reales, con
`generatedBy` trazable al modelo, y auditoría registrada.

### P2 — Transcripción exitosa sin contenido relevante (charla, silencio)

El modelo devuelve `observaciones: []` (o solo observaciones sin citas
válidas) → cero `Observation` creadas. Comportamiento honesto, no una
falla — igual que P4 del spec de PR-11 (clip sin segmentos).

### P3 — El modelo cita un segmento inventado

Esa observación específica se descarta (nunca persistida con una fuente
falsa); las demás observaciones de la misma respuesta, si citan segmentos
reales, sí se persisten.

### P4 — El gateway de IA falla (Ollama local no configurado/inalcanzable)

`synthesizeObservations` lanza; el llamador (`processPendingExtractions`)
lo captura, audita `observation.synthesis_failed`, y **no** modifica el
resultado de `completed`/`failed` de la extracción — la transcripción ya
había tenido éxito.

### P5 — Cero segmentos

No se llama al gateway en absoluto (nada que sintetizar) — evita una
llamada a IA vacía/desperdiciada.

## 5. Contratos

### `AiModelGatewayService.generate()` (existente, sin cambios — solo un nuevo caller)

```ts
gateway.generate({
  agentId: "contributor-observation-synthesis",
  taskType: "field_report_generation",
  privacyLevel: "sensitive",   // fuerza ollama-local, ver §0
  systemPrompt, input,
  requireJson: true, temperature: 0,
  metadata: { tenantId, submissionId, extractionId }
})
```

### `observation-synthesis.ts` (nuevo)

```ts
function buildSynthesisPrompt(segments: {id, startMs, endMs, text}[]):
  { systemPrompt: string; userPrompt: string; aliasToSegmentId: Map<string,string> }

function parseSynthesisResponse(raw: string, aliasToSegmentId: ReadonlyMap<string,string>):
  Array<{ objective?, condition?, decision?, reason?, method?, action?, result?, sourceSegmentIds: string[] }>
```

## 6. FSM, eventos y reconstrucción

Sin cambios de FSM — `Observation.promotionStatus` sigue en `PENDING` por
default (schema sin cambios). Nuevas acciones de auditoría (mismo patrón
`AuditService`, no outbox, consistente con el resto del módulo):
`contributor_program.observation.synthesized`,
`contributor_program.observation.synthesis_failed`.

## 7. Datos y migración

**Ninguna.** Sin modelos ni campos Prisma nuevos — `Observation` ya tiene
todos los campos necesarios desde PR-5/PR-6.

## 8. Observabilidad, despliegue y activación

- Depende de dos activaciones previas ya existentes:
  `CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED=true` y
  `SEMSE_ASR_PROVIDER=openai-whisper` (PR-11) — sin transcripts reales, esta
  síntesis nunca corre (cero segmentos → cero llamadas, P5).
- Requiere además que `semse-API` tenga configurado el acceso a
  `ollama-local` (`OLLAMA_BASE_URL`, `ENABLE_OPEN_SOURCE_MODELS=true`) —
  **no confirmado en esta sesión**, ver §2 "Fuera de alcance". Si falta,
  falla cerrado por diseño (P4), no silenciosamente ni con datos
  fabricados.
- Costo: cada síntesis es una llamada a un modelo local (sin costo de API
  externa, a diferencia de PR-11's Whisper) — sin límite de tasa
  implementado, volumen actual real es cero (mismo razonamiento que PR-11).

## 9. Tests requeridos

- [x] `buildSynthesisPrompt`/`parseSynthesisResponse` — prompt shape,
      validación de citas (real/inventada/mixta/duplicada), campos todos
      `null` descartados, JSON malformado tolerado, code fence removido.
- [x] `synthesizeObservations` (vía cast a privado, mismo patrón ya usado
      en `event-outbox-dispatcher.test.ts`/`satellite-webhooks-consumer.test.ts`)
      contra Postgres real: crea solo las observaciones con cita válida,
      enruta con `privacyLevel: "sensitive"`, no-op sin segmentos, lanza
      (nunca fabrica) cuando el gateway falla cerrado.
- [ ] Integración real contra un Ollama local corriendo — fuera de alcance
      de este sandbox (sin acceso de red al servicio `ollama` de Railway);
      evidencia de producción pendiente antes de activar.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/contributor-program/observation-synthesis.ts` (nuevo)
- `apps/api/src/modules/contributor-program/contributor-program.service.ts`
  (constructor + `synthesizeObservations` + hook en `processPendingExtractions`)
- `apps/api/src/modules/contributor-program/contributor-program.module.ts`
  (`AiModelsModule` con `forwardRef`)

### Tests

- `apps/api/test/observation-synthesis.test.ts` (nuevo, sin DB)
- `apps/api/test/contributor-program-extraction.test.ts` (extendido)
- `apps/api/test/contributor-program.service.test.ts`,
  `apps/api/test/contributor-program-registry.test.ts` (constructor
  actualizado con un fake que lanza si se llama — no ejercitado por esos
  archivos)
