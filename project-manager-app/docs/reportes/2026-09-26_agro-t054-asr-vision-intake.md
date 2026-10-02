# 2026-09-26 — Agro T-054: ASR y visión para el intake

Spec: `docs/specs/agro/agro-prometeo-intake.spec.md` §3ter. Continúa T-050 … T-052.

## Qué había

El intake Prometeo Agro (`propose_intake`) solo aceptaba texto ya escrito;
"transcripción de audio y análisis de imagen" estaba explícitamente marcado
como pendiente en el propio spec, con la condición de respetar
`privacyCritical` (cualquier LLM agregado debe enrutarse a Ollama local).

## Diagnóstico antes de tocar código

- **ASR**: el único `TranscriptionProvider` real en el repo
  (`contributor-program/transcription-provider.ts`) es hosted a propósito —
  el servicio `ollama` de producción solo corre modelos de texto
  (`qwen2.5:3b`/`glm4`), nunca voz; "local" implicaría desplegar un servicio
  nuevo, no un flag. No existe hoy ninguna opción de ASR local en este stack.
- **Visión**: `apps/vision-service`'s `/v1/objects/recognize` (Sense Vision)
  ya soporta un proveedor 100% local (`VISION_OBJECT_PROVIDER=ollama`,
  `qwen2.5vl:3b`) — pero no estaba conectado a Agro, solo a un vocabulario de
  construcción.

Esta disyuntiva (ASR sin opción local vs. visión ya resuelta localmente) se
presentó al usuario antes de escribir código, con la pregunta explícita de
si reusar el ASR hosted para Agro (rompiendo la regla de `privacyCritical`
del propio spec) o dejarlo documentado como gap. El usuario aprobó
explícitamente reusar OpenAI Whisper para Agro también, y construir la
conexión de visión con un vocabulario propio.

## Qué cambió

- **`agro-asr.ts`** (nuevo): `HttpUrlStorageReader` — adapter que hace
  `fetch()` de `AgroEvidenceItem.fileUrl` para reusar `resolveTranscriptionProvider`
  de Contributor Program sin tocar su código (esa evidencia solo guarda la
  URL absoluta, no la storage key cruda; parsear la forma de la URL sería
  frágil).
- **`agro-vision.service.ts`** (nuevo): vocabulario Agro v1 (15 términos,
  no exhaustivo) + wrapper best-effort sobre `VisionServiceClient` ya
  existente (`recognizeObjects`) — nunca lanza, `null` en disabled/timeout/error.
- **`agro-intake.service.ts`**: `text` pasa a ser opcional. Sin texto y con
  evidencia `AUDIO` en `evidenceIds`, transcribe automáticamente (bloquea con
  un 400 explícito si no hay proveedor ASR configurado — nunca inventa
  texto). Con evidencia `PHOTO`, adjunta `visionSignals` a la propuesta como
  contexto adicional (best-effort, nunca bloquea). Nuevo campo
  `transcribedFrom` en la respuesta.
- **`agro-intake.controller.ts`**: `text` opcional en el schema, con
  `.refine` exigiendo `text` o `evidenceIds`.
- **`prometeo-tool-registry.ts`**: descriptor `agro.propose_intake`
  actualizado (ya no exige `text`, documenta la transcripción automática y
  `visionSignals`).
- **`agro.module.ts`**: `VisionServiceClient` + `AgroVisionService` como
  providers nuevos; `AgroIntakeService` ahora depende de `AgroEvidenceService`
  (ya existente) y opcionalmente de `AgroVisionService`.

## Qué no se tocó

- El código del `TranscriptionProvider`/`resolveTranscriptionProvider` de
  Contributor Program: se reusa tal cual, ningún cambio.
- El código de `vision-service` (Python) ni de `VisionServiceClient`: se
  reusa tal cual.
- `VisionLibraryService`/"mi diccionario"/Jev Decision Gate: deliberadamente
  no se integró — es una feature de producto de construcción con su propia
  UX (caché de librería en DB, gamificación); Agro solo necesita candidatos
  de objetos como contexto, no ese pipeline completo.
- Activación real en producción de `SEMSE_ASR_PROVIDER=openai-whisper` /
  `VISION_OBJECT_PROVIDER=ollama`: este PR entrega el código conectado, no
  la activación — igual criterio que el spec de ASR original.
- Revisión legal/DPIA de retención de OpenAI para audio: sigue pendiente,
  bloqueante para activar en producción, no para este merge (misma
  pendiente ya documentada para Contributor Program — un solo flag para
  ambos programas).

## Verificación

- `agro-intake.service.test.ts`: 16/16 (5 nuevos — transcribe cuando no hay
  texto y hay audio; error explícito sin proveedor ASR; no transcribe si ya
  vino texto; visionSignals con candidatos cuando hay foto y vision
  inyectada; visionSignals vacío sin vision inyectada, sin bloquear).
- `agro-vision.service.test.ts` (nuevo): 5/5 (disabled, éxito, cuerpo
  malformado, candidato con campos basura saneado, error de red/timeout —
  todos sin lanzar salvo el caso feliz).
- `pnpm --filter @semse/api test:unit` con `DATABASE_URL` real: 2503 pass /
  0 fail. `pnpm build:packages`, `pnpm --filter @semse/api build`,
  `pnpm typecheck`, `pnpm lint` (0 errores; mismos 36 warnings preexistentes
  de React hooks/`<img>`), `pnpm spec:validate:strict` (0 errores/warnings,
  141 specs) — todo limpio.

## Backlog restante

| Tarea | Estado |
|---|---|
| T-055 | Pantallas Agro en apps/mobile (hoy el reporte es web responsive) |

Además, sigue pendiente (no asignado a una tarea): **R8** — los controllers
Agro no capturan `ZodError` (500 en vez de 400 para cualquier body
inválido), documentado en T-053.
