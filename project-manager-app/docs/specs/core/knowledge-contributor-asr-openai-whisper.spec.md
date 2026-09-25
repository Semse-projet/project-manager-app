---
id: "core.knowledge-contributor-asr-openai-whisper"
title: "Field Knowledge Contributor Program — ASR via OpenAI Whisper (PR-11)"
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
  - "apps/api/src/modules/contributor-program/transcription-provider.ts"
  - "apps/api/src/modules/contributor-program/contributor-program.service.ts"
related_tests:
  - "apps/api/test/contributor-program-transcription-provider.test.ts"
related_endpoints: []
related_events: []
related_agents: []
last_verified: "2026-09-24"
---

# Spec: Field Knowledge Contributor Program — ASR via OpenAI Whisper (PR-11)

> Contrato ejecutable SDD 2.0.

**Aprobación:** decisión de proveedor de ASR que PR-5 (§11) dejó
explícitamente abierta como pregunta humana. Presentada en esta sesión al
dueño del producto vía `AskUserQuestion` en dos pasos: (1) confirmar que
corresponde resolverla ahora en vez de construir la síntesis de
`Observation` desacoplada de ASR — eligió resolverla; (2) con hallazgos
reales de Railway sobre la mesa (ver §0), elegir entre local vs. hosted —
eligió **hosted, OpenAI Whisper API**. Ninguna de las dos respuestas fue
inferida ni asumida; ambas quedaron registradas como selección explícita
del usuario en la sesión.

## 0. ZOOM — estado real encontrado antes de escribir este spec

| Capa | Estado | Evidencia |
|---|---|---|
| `resolveTranscriptionProvider()` | devuelve `null` siempre | `transcription-provider.ts`, sin cambios desde PR-5; `SEMSE_ASR_PROVIDER_URL` nunca configurado |
| `createObservation` (repositorio) | ABSENTE de cualquier flujo real | solo se llama desde tests (`contributor-program-extraction.test.ts`) — confirmado por `grep` en todo `apps/`/`packages/`, ningún caller en `contributor-program.service.ts` |
| Servicio `ollama` en Railway (proyecto `SEMSEproject`, producción) | LIVE, pero solo texto | `describe-service` (solo lectura): imagen `ollama/ollama:latest`, `ollama pull qwen2.5:3b && ollama pull glm4` — ningún modelo de ASR/Whisper corriendo hoy. "Local" no es un flag, implicaría desplegar un servicio nuevo |
| `OPENAI_API_KEY` en `semse-API` | configurado (confirmado en sesión de PR-3) | usado hoy para embeddings RAG (`embedding.service.ts`) y el orquestador LLM (`infrastructure/llm/orchestrator.ts`) — **no** para audio |
| `StorageService` (`readBuffer`) | filesystem local únicamente | `effectiveProvider: "local"` fijo; `STORAGE_PROVIDER=s3` solo loguea un warning y sigue usando disco local — confirmado leyendo el archivo completo, no asumido. Relevante porque el proveedor de ASR necesita leer los bytes del audio para enviarlos a Whisper |
| Kill switch de sweep | YA EXISTE | `CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED` en `apps/worker/src/main.mjs` — gate independiente de si el worker corre en absoluto |
| SDK `openai` | ya es dependencia de `apps/api` | `^6.49.0`; ya usado en `infrastructure/llm/providers/openai.provider.ts` con el mismo patrón (`new OpenAI({ apiKey })`) — este spec reutiliza el SDK, no agrega uno nuevo |

Conclusión: el bloqueo real no era técnico — era una decisión de producto
sin tomar. Con las dos decisiones explícitas del dueño (§ arriba), el
único trabajo de este slice es una implementación acotada del `provider`
ya diseñado como seam pluggable desde PR-5.

## 1. Problema y resultado

**Problema:** ninguna fila `KnowledgeExtraction` real llega nunca a
`COMPLETED` con un transcript real en producción — `resolveTranscriptionProvider()`
siempre devolvió `null`, así que el pipeline entero (worker → extracción →
`TranscriptSegment` → `Observation`) es código que existe pero nunca corrió
sobre datos reales, precedente documentado en los reportes PR-6 a PR-10.

**Resultado de este PR:** un `TranscriptionProvider` real
(`OpenAIWhisperTranscriptionProvider`) que, cuando un humano activa
`SEMSE_ASR_PROVIDER=openai-whisper` en Railway, transcribe el audio de una
entrega vía la API hospedada de OpenAI Whisper y produce `TranscriptSegment`
reales. **No** incluye la síntesis de `Observation` vía LLM a partir de esos
segmentos — eso queda para un PR-12 separado (ver §2), ahora desbloqueado
porque ya puede existir un transcript real, pero no builded en este mismo
slice para mantener el tamaño de cambio revisable (una integración de
proveedor por PR, mismo criterio que el resto de este programa).

## 2. Alcance

### Incluido

- `OpenAIWhisperTranscriptionProvider implements TranscriptionProvider`:
  lee el audio vía `StorageService.readBuffer`, lo envía a
  `client.audio.transcriptions.create({ model: "whisper-1", response_format:
  "verbose_json" })`, mapea `segments[]` (start/end en segundos → ms,
  `avg_logprob` → confidence vía `exp()`) a `TranscriptionSegment[]`.
- `resolveTranscriptionProvider(storage)`: cambia de firma sin argumentos a
  recibir un lector de storage (necesario para que el provider pueda leer
  el audio); gate explícito nuevo `SEMSE_ASR_PROVIDER=openai-whisper`,
  **independiente** de `OPENAI_API_KEY` (que ya está configurado por otras
  razones) para que este PR no active procesamiento real de audio con solo
  mergear — activación es un paso deliberado posterior en Railway.
  Cualquier otro valor de `SEMSE_ASR_PROVIDER` falla ruidosamente (no cae
  silenciosamente a `null`).
- Timeout explícito de 120s en el cliente OpenAI para esta llamada (gap ya
  documentado en `semse-prometeo-orchestrator` para `DeepSeekProvider`, que
  no tiene timeout — este provider nuevo no repite ese patrón).
- Función pura `mapWhisperSegments` extraída y exportada para poder testear
  el mapeo de timestamps/confidence sin red ni mocks del SDK.

### Fuera de alcance

- **Síntesis de `Observation` vía LLM a partir de `TranscriptSegment`** —
  PR-12. El dueño del producto aprobó construirla, pero desacoplada de esta
  decisión de ASR (la síntesis puede probarse con fixtures de segmentos
  reales o de prueba sin depender de qué proveedor de ASR los generó); y
  también toca una decisión de ruteo de privacidad (`privacyCritical` vía
  `AiModelRouterService`/`AdaptiveRouter`, ver `semse-prometeo-orchestrator`)
  que merece su propio slice revisable en vez de mezclarse con la
  integración del proveedor de ASR.
- **Proveedor de ASR local (Whisper self-hosted)** — descartado
  explícitamente por el dueño del producto en esta sesión a favor de hosted.
- **Activación real en producción** — este PR entrega el código; encender
  `SEMSE_ASR_PROVIDER=openai-whisper` en Railway es un paso operativo
  posterior y deliberado, no parte de este merge (mismo patrón que el
  kill switch del sweep, que tampoco se activa por este PR).
- **DPIA/revisión legal de los términos de retención/uso de datos de
  OpenAI para el audio enviado** — el dueño del producto tomó la decisión
  de producto (hosted vs. local); la verificación de cumplimiento GDPR/CCPA
  sobre los términos contractuales de OpenAI es una revisión legal
  separada, fuera de la autoridad de este agente — se deja como
  recomendación operativa (§8).
- **Streaming / archivos de audio muy grandes** — `readBuffer` carga el
  archivo completo en memoria; aceptable para clips de campo cortos, no
  para archivos grandes (mismo límite ya documentado para `StorageService`
  en general, no nuevo de este PR).

## 3. Actores, permisos y límites

Sin cambios respecto a PR-5 — el worker job sigue siendo el único actor que
invoca `processPendingExtractions`/`resolveTranscriptionProvider`, mismo
permiso interno `platform` sin JWT de usuario, mismo alcance tenant-scoped
vía la fila `KnowledgeExtraction` que procesa. Este PR no agrega ni cambia
ningún endpoint ni permiso.

## 4. Escenarios y criterios de aceptación

### P1 — `SEMSE_ASR_PROVIDER` no configurado (default, estado actual de producción)

`resolveTranscriptionProvider(storage)` devuelve `null`. El pipeline se
comporta exactamente igual que hoy: cada fila reclamada termina `FAILED`
con `ASR_PROVIDER_NOT_CONFIGURED`. Sin cambio de comportamiento en
producción hasta que un humano active el flag.

### P2 — `SEMSE_ASR_PROVIDER=openai-whisper` activado, transcripción exitosa

El worker reclama una extracción `PENDING`, el provider lee el audio,
llama a Whisper, y `completeExtractionWithTranscript` persiste los
`TranscriptSegment` reales — la extracción pasa a `COMPLETED`. Auditoría
(`contributor_program.extraction.completed`) registra `segmentCount` real,
no simulado.

### P3 — `SEMSE_ASR_PROVIDER=openai-whisper` pero `OPENAI_API_KEY` ausente

`resolveTranscriptionProvider` lanza un error explícito en vez de devolver
`null` silenciosamente — un typo o una activación a medias en Railway debe
ser visible en logs, no indistinguible de "ASR deliberadamente
deshabilitado".

### P4 — Whisper devuelve un clip sin segmentos (silencio)

Resultado honesto: `[]` segmentos, extracción `COMPLETED` con
`segmentCount: 0` — no es una falla ni un transcript fabricado.

### P5 — Fallo de red/API de OpenAI durante la transcripción

El `catch` existente en `processPendingExtractions` ya maneja esto —
`failClaimedExtraction` con el mensaje del error real. Sin cambios
necesarios en el manejo de errores del método de servicio; el provider
nuevo simplemente puede lanzar como cualquier proveedor.

## 5. Contratos

### `TranscriptionProvider` (interfaz, sin cambios de forma)

```ts
interface TranscriptionProvider {
  transcribe(input: { storageKey: string; mimeType: string | null }): Promise<TranscriptionSegment[]>;
}
```

### `resolveTranscriptionProvider` (firma cambiada)

```ts
// Antes (PR-5): resolveTranscriptionProvider(): TranscriptionProvider | null
// Ahora (PR-11): necesita poder leer el audio para transcribirlo.
function resolveTranscriptionProvider(storage: TranscriptionStorageReader): TranscriptionProvider | null
```

Llamador único: `ContributorProgramService.processPendingExtractions`, ya
tiene `this.storage: StorageService` inyectado desde PR-9 — `StorageService`
satisface `TranscriptionStorageReader` estructuralmente (solo necesita
`readBuffer`).

## 6. FSM, eventos y reconstrucción

Sin cambios respecto a PR-5 — mismo FSM `PENDING → PROCESSING →
{COMPLETED, FAILED}`, mismos eventos de auditoría
(`contributor_program.extraction.completed`/`.failed`). Este PR no agrega
transiciones ni eventos nuevos, solo hace que `COMPLETED` sea alcanzable
con datos reales por primera vez.

## 7. Datos y migración

**Ninguna.** No hay modelo Prisma nuevo ni campo nuevo — `TranscriptSegment`
y `Observation` ya existen desde PR-5/PR-6. Este PR es una integración de
proveedor pura, sin tocar el esquema.

## 8. Observabilidad, despliegue y activación

- **Doble gate de activación**, ninguno activado por este merge:
  `CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED=true` (¿corre el sweep del worker
  en absoluto?) y `SEMSE_ASR_PROVIDER=openai-whisper` (¿qué proveedor usa,
  si el sweep corre?). Confirmar el estado actual de ambos en Railway antes
  de asumir cualquier nivel de actividad — no se pudo leer directamente en
  esta sesión (permiso denegado por el clasificador de modo automático al
  intentar `describe-service`/`list-variables` sobre `semse-API`).
- **Recomendación operativa explícita**: antes de activar
  `SEMSE_ASR_PROVIDER=openai-whisper` en producción, alguien con autoridad
  legal/compliance debe revisar los términos de uso/retención de datos de
  la API de OpenAI para audio potencialmente sensible (voces de
  trabajadores, contexto de obra) — este spec no resuelve esa revisión,
  solo la deja visible como bloqueante para la activación (no para el
  merge del código).
- **Costo**: cada transcripción es una llamada de pago a OpenAI — no hay
  límite de tasa ni presupuesto máximo implementado en este slice; el
  volumen actual es cero (ninguna fila `PENDING` de `kind: TRANSCRIPTION`
  llega nunca a este estado en producción hoy, confirmado por ZOOM), así
  que no hay urgencia, pero un futuro slice de activación real debería
  añadir un límite.
- **Canary**: no implementado en este PR — al activar, se recomienda
  primero solo `maxItems` bajo y monitoreo manual antes de subir el
  intervalo del sweep, mismo espíritu que el patrón `isDemo` usado en el
  resto del programa, pero sin construir un mecanismo nuevo de tenant
  canary en este slice.

## 9. Tests requeridos

- [x] `mapWhisperSegments` — conversión de segundos a ms, `avg_logprob` →
      confidence, filtrado de texto vacío/whitespace.
- [x] `resolveTranscriptionProvider` — sin flag → `null`; flag sin
      `OPENAI_API_KEY` → lanza; flag reconocido + key → instancia real;
      flag desconocido → lanza (no cae a `null` silenciosamente).
- [ ] Integración real contra la API de OpenAI — fuera de alcance de este
      sandbox (sin red saliente a OpenAI ni credencial real disponible);
      queda como evidencia de producción pendiente antes de activar
      (§8), no como test automatizado en CI.

## 10. Mapa de implementación

### API

- `apps/api/src/modules/contributor-program/transcription-provider.ts`
  (proveedor real + `mapWhisperSegments` + firma de `resolveTranscriptionProvider`)
- `apps/api/src/modules/contributor-program/contributor-program.service.ts`
  (un solo call site actualizado)

### Tests

- `apps/api/test/contributor-program-transcription-provider.test.ts` (nuevo,
  sin DB — prueba pura de lógica, no necesita Postgres)
