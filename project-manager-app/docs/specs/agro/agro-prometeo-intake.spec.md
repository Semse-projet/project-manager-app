---
id: "agro.prometeo-intake"
title: "Prometeo Agro — intake operacional (buscar → relacionar → completar → crear)"
domain: "agro"
sdd_version: "2.0"
version: "1.1"
status: "IMPLEMENTED"
owner: "semse-core"
risk: "medium"
code_status: "COMPLETE"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags:
  - "SEMSE_ASR_PROVIDER"
  - "VISION_OBJECT_PROVIDER"
production_evidence: []
related_files:
  - apps/api/src/modules/agro/agro-intake.domain.ts
  - apps/api/src/modules/agro/agro-intake.service.ts
  - apps/api/src/modules/agro/agro-intake.controller.ts
  - apps/api/src/modules/agro/agro-asr.ts
  - apps/api/src/modules/agro/agro-vision.service.ts
  - apps/api/src/modules/contributor-program/transcription-provider.ts
  - apps/api/src/modules/vision/clients/vision-service.client.ts
  - apps/api/src/modules/prometeo/prometeo-tool-registry.ts
  - apps/api/src/modules/prometeo/prometeo-tool-execution.service.ts
related_tests:
  - apps/api/test/agro-intake.service.test.ts
  - apps/api/test/agro-vision.service.test.ts
related_endpoints:
  - farms/:farmId/intake/propose
related_events: []
related_agents:
  - prometeo
last_verified: "2026-09-26"
---

# Spec: Prometeo Agro intake

> Aprobación: solicitud explícita del propietario de producto en la sesión del 2026-09-25 (PR4).

## 1. Resultado

Un reporte de campo en lenguaje natural ("Al lote 15 le falta agua", "Ya alimenté los cerdos del corral 8") se convierte en una propuesta estructurada, relacionada con las entidades reales de la finca, que una persona revisa antes de guardarla.

## 2. Reglas

- No es otro chatbot. Es una capa operativa sobre los datos Agro.
- Solo propone, nunca escribe: `POST v1/agro/farms/:farmId/intake/propose` responde con `requiresHumanReview: true`.
- Principio: buscar → relacionar → completar → crear. Primero busca tareas abiertas (AgroFarmTask + JobTask `domain = "agro"`) e incidencias abiertas similares; crear algo nuevo es el último recurso.
- Sin diagnóstico: la categoría es operativa, la severidad es una *sugerencia* y se guarda con `severityConfirmed = false` (también por la tool `agro.create_incident`).
- `privacyCritical`: el motor v1 (buscar/relacionar/completar/crear) es determinista y local (reglas en español, sin LLM) — ningún dato de ese motor sale del API.
  **Excepción de producto explícita (T-054):** el ASR de audio adjunto SÍ sale del perímetro. No existe hoy ningún proveedor de ASR local en este stack (ver §3ter) — ante esa disyuntiva, el dueño del producto aprobó explícitamente reusar el mismo proveedor hosted (OpenAI Whisper) que ya usa Field Knowledge Contributor Program, en vez de dejar el audio sin transcribir o desplegar infraestructura nueva en esta sesión. Sigue pendiente antes de activar en producción: revisión legal/DPIA de retención de OpenAI para audio (misma pendiente ya documentada en `core.knowledge-contributor-asr-openai-whisper`, un solo flag `SEMSE_ASR_PROVIDER` para ambos programas). El reconocimiento de objetos en fotos (§3ter) sí puede quedar 100% local (`VISION_OBJECT_PROVIDER=ollama`) y no tiene esta excepción.

## 3ter. ASR y visión (T-054)

**Diagnóstico antes de tocar código:** se investigaron los dos mecanismos existentes en el repo antes de conectar nada.

- **ASR**: el único `TranscriptionProvider` real en el repo es `OpenAIWhisperTranscriptionProvider` (`contributor-program/transcription-provider.ts`, spec `core.knowledge-contributor-asr-openai-whisper`) — hosted a propósito, porque el servicio `ollama` de producción solo corre modelos de texto (`qwen2.5:3b`/`glm4`), nunca un modelo de voz; "local" implicaría desplegar un servicio nuevo. Agro reusa ese mismo provider sin tocar su código (`resolveTranscriptionProvider`, mismo flag `SEMSE_ASR_PROVIDER=openai-whisper`), vía `agro-asr.ts`'s `HttpUrlStorageReader` — un adapter que hace `fetch()` de `AgroEvidenceItem.fileUrl` en vez de leer por storage key (esa evidencia solo guarda la URL absoluta servible, no la key cruda; parsear la forma de la URL para recuperarla sería frágil).
- **Visión**: `apps/vision-service`'s `/v1/objects/recognize` (Sense Vision, `docs/specs/vision/sense-vision-field-library.spec.md`) ya soporta un proveedor 100% local (`VISION_OBJECT_PROVIDER=ollama`, modelo `qwen2.5vl:3b`) — ningún frame sale del perímetro con ese proveedor activo. No estaba conectado a Agro (solo a Sense Vision, con vocabulario de construcción). `agro-vision.service.ts` agrega un vocabulario propio de Agro (15 términos v1, no exhaustivo — animales comunes, corral, bebedero/comedero, tractor, cerca, silo, invernadero, riego, equipo de ordeño) y llama al mismo `VisionServiceClient` ya existente, sin tocarlo ni construir un segundo pipeline (deliberadamente sin `VisionLibraryService`/"mi diccionario"/Jev Decision Gate — eso es una feature de producto de construcción con su propia UX, Agro solo necesita candidatos como contexto).

**Contrato:**

- `POST .../intake/propose`: `text` pasa a ser opcional — si viene vacío y `evidenceIds` incluye evidencia `AUDIO`, se transcribe automáticamente antes de continuar (concatenando transcripts si hay más de un audio). Sin proveedor ASR configurado (`SEMSE_ASR_PROVIDER` sin setear, estado por defecto), lanza un 400 explícito distinto del genérico "text is required" — nunca inventa un texto ni sigue en silencio.
- Si `evidenceIds` incluye evidencia `PHOTO`, cada una se envía a reconocimiento de objetos; el resultado (`visionSignals: [{evidenceId, provider, model, candidates}]`) se agrega a la propuesta como contexto adicional, nunca reemplaza ni confirma nada — es enriquecimiento *best-effort*: proveedor deshabilitado, error de red o timeout devuelven `[]`/se omiten, jamás bloquean ni fallan la propuesta completa. La transcripción de audio, en cambio, si falla o no hay proveedor, sí bloquea (es la única fuente del texto, no un enriquecimiento).
- `transcribedFrom: string[]` en la respuesta — ids de evidencia de audio efectivamente transcritos, para que la UI pueda mostrar "se usó la transcripción de X" en vez de dar por sentado que el texto vino escrito a mano.

## 5. Contratos Agente/Prometeo

```yaml
tools:
  - agro.propose_intake   # read, sin aprobación, no persiste
  - agro.list_incidents   # read
  - agro.create_incident  # write, approvalPolicy: confirm, source=PROMETEO
forbidden_behavior:
  - emitir diagnóstico veterinario o agronómico
  - confirmar severidad
  - crear registros sin confirmación humana
```

## Pendiente

- Activación real en producción de `SEMSE_ASR_PROVIDER=openai-whisper` y `VISION_OBJECT_PROVIDER=ollama` — este spec entrega el código conectado, no la activación operativa (mismo criterio que `core.knowledge-contributor-asr-openai-whisper` §8).
- Revisión legal/DPIA de retención de OpenAI antes de esa activación (ver §2).
- El vocabulario de visión Agro (§3ter) es v1, deliberadamente no exhaustivo — ampliarlo es un cambio de datos, no de código.
