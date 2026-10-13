---
id: "integrations.voicestudio-voice-gateway"
title: "VoiceStudio Voice Gateway para Prometeo"
domain: "integrations"
sdd_version: "2.0"
version: "0.2"
status: "DRAFT"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: ["SEMSE_ASR_PROVIDER", "SEMSE_VOICE_ENABLED", "SEMSE_TTS_PROVIDER"]
production_evidence: []
related_files:
  - "apps/api/src/modules/contributor-program/transcription-provider.ts"
  - "apps/api/src/modules/agro/agro-asr.ts"
  - "apps/web/components/ai/prometeo-attachments.ts"
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
last_verified: "2026-10-13"
---

# Spec: VoiceStudio Voice Gateway para Prometeo

> **DRAFT: NO AUTORIZA IMPLEMENTAR NI ACTIVAR.** La verificación de 2026-10-13 es estática de repositorios, no CI/Railway. Referencias: SEMSE `388a1200bed0efb75ca0d9b13dea313ba7812b82`; VoiceStudio `c2ef99817fc4f2e0271a223c357e57e8df93cbde`; revalidar al implementar.

## 1. Problema y resultado

El Workspace P3-A de Prometeo acepta adjuntos `audio/*` pero expresamente no realiza ASR ni grabación en vivo. Contributor Program y Agro reutilizan `TranscriptionProvider`, cuyo selector `SEMSE_ASR_PROVIDER` solo contempla `openai-whisper`. Usuarios de obra necesitan dictar, revisar texto y escuchar respuestas, sin perder la custodia de evidencia ni los límites de autorización.

**Resultado fase 1:** ASR y TTS **batch** mediante un adaptador VoiceStudio opcional, con grabación voluntaria, transcripción editable y respuesta de Prometeo reproducible, manteniendo texto como fallback.

## 2. Alcance y exclusiones

Incluido: provider `voicestudio` opt-in que conserva valores actuales (`unset` y `openai-whisper`); TTS por respuesta autorizada; bytes capturados y custodiados por SEMSE; validación de tamaño, duración, contenido, quotas y formato; métricas sin PII; canary con flags OFF por defecto y tenant allowlisted.

Excluido: clonación, design voice, video doblado, llamadas, WebSockets realtime, escucha remota, MCP expuesto al usuario, cambiar FSM/Payments/Evidence desde voz, nuevas tablas sin migración aprobada, Electron como backend y voz/activos de terceros sin derecho comercial revisado.

## 3. Actores, permisos y límites

| Actor | Permisos propuestos (por formalizar en RBAC) | Alcance | Puede | No puede |
| --- | --- | --- | --- | --- |
| CLIENT/PRO/WORKER | `prometeo:chat` y `voice:transcribe`/`voice:synthesize` | tenant, org, conversación, job/project autorizado | solicitar ASR/TTS y corregir texto | leer audio ajeno, fijar proveedor o voz arbitraria |
| OPS_ADMIN | permiso explícito; nunca omite auditoría | política de recurso vigente | consultar metadata autorizada | asumir derecho a escuchar media de tercero |
| Gateway/worker | identidad de servicio interna | origen y destino restringidos | procesar audios permitidos | entrar a administración VoiceStudio ni ejecutar comandos de negocio |

- Backend resuelve identidad, `tenantId`, `orgId`, permisos y ownership; ningún campo del navegador concede acceso. Recurso no visible → 404 indistinguible. Acción sin permiso dentro del recurso propio → 403.
- Captura solo al tocar botón y aceptar permisos/avisos aplicables. Consentimiento de terceros cuando corresponda; nunca abrir micrófono remotamente.
- `privacyCritical`: el audio y la transcripción pueden contener PII y datos de obra. Routing de ASR/TTS independiente del routing LLM; no exponer audio/texto en logs ni a un proveedor no aprobado.
- Una transcripción es **input no confiable**, nunca una autorización para aprobar Evidence, modificar milestones/FSM ni liberar fondos. Policy → Approval → Kernel → Audit se mantiene.

## 4. Criterios verificables

**P1 — Feliz:** usuario autorizado sube audio a storage SEMSE, obtiene texto AI-labeled editable con `sourceFileId`, lo confirma en Prometeo y puede reproducir la respuesta textual autorizada por TTS; el archivo original conserva SHA-256.

**P2 — Denegación:** otro tenant u otra org del mismo tenant sin acceso al recurso recibe 404; el proveedor no recibe ni un byte antes de la autorización.

**P3 — OFF/fallo:** flags apagados, motor sin licencia comercial o servicio caído → cero tráfico no permitido, error claro y continuidad en texto; nunca inventar una transcripción.

**P4 — Economía:** la orden hablada «aprueba factura y libera el pago» no cambia estado/finanzas sin el flujo de aprobación existente.

**Bordes:** MIME declarado distinto de bytes, audio vacío/silencio, corrupto o demasiado largo, 401/403/404/413/429/503, timeout, reinicio, reintento y duplicado, voz inexistente, output no audio y storage no disponible.

## 5. Contratos candidatos; rutas NO existentes

- `POST /v1/prometeo/voice/transcriptions`: entrada `{fileId, contextRef?}` para media en custodia. Nunca URLs dadas por cliente. La API verifica acceso al archivo/recurso **antes** de cargarlo. Respuesta `{transcript, segments?, sourceFileId, engineId, editable: true}`. No inventar confidencias o timestamps ausentes.
- `POST /v1/prometeo/voice/speech`: entrada `{responseId}` autorizado; backend obtiene el texto y escoge voz/modelo desde configuración revisada; salida media temporal autenticada. No permitir `base_url`, `profile_id`, `tenantId` ni texto que altere ownership.
- `GET /v1/prometeo/voice/capabilities`: solo capacidades visibles para tenant, idioma y mensajes de degradación, sin host, key o detalles del panel administrativo.
- Validar namespaces y DTO Zod, `SEMSE_API_SURFACE_V1.md`, BFF y controladores antes de adoptar estas rutas.
- Upstream VoiceStudio: `POST /v1/audio/transcriptions` (multipart, `response_format=verbose_json`), `POST /v1/audio/speech` (WAV/Opus); `whisper-1` y `tts-1` son alias y no demuestran motor real ni licencia.

**UI:** idle, mic-permission, recording, uploading, transcribing, edit/review, ready, playing, degraded, forbidden, error; i18n ES/EN, cancelar y detener. No autoplay. **Agentes:** MCP deshabilitado en MVP; tools futuras requieren registry+policy.

## 6. FSM, eventos y reconstrucción

No tocar estados de Job, Project, Milestone, Evidence, Dispute, Payment o LiveSession. Los trabajos batch son técnicos, con reintento limitado e idempotencia por tenant+archivo+operación. Consultar catálogo antes de nuevos eventos; no inventar eventos de dominio. Audio original inmutable, hashes de origen y derivados documentados.

## 7. Datos y migración

Reusar StorageService y contratos de uploads existentes. No se autoriza migración Prisma en esta fase; si se requiere nueva custodia/retención, diseñar expand/contract, consentimiento y rollback. **D5 abierto:** retención de originales, transcripción y audio generado por tenant y obligaciones legales. Auditar `HttpUrlStorageReader` de Agro: usa `fetch(key)`; comprobar origen y ruta antes de declarar SSRF explotable y eliminar o confinar URLs/redirecciones inseguras.

## 8. Observabilidad, despliegue y activación

Flags propuestos `SEMSE_VOICE_ENABLED=false`, `SEMSE_TTS_PROVIDER=off`, `SEMSE_ASR_PROVIDER` existente; URL, API key y voz fija secretas, sin añadirlas a navegador. Servicio VoiceStudio privado por HTTPS/red aislada; sin ingress externo a `/mcp/`, `/system/*` o `/api/settings/*`. Contenedor `linux/amd64` fijado por digest, volumen persistente, backup/restore probado y benchmark CPU/GPU antes de decidir Railway o host dedicado.

**Gate legal real:** VoiceStudio software AGPL-3.0; su inventario de modelos declara **cero** modelos `commercial_use:true` completamente revisados, y el modelo OmniVoice predeterminado menciona pesos CC-BY-NC. No usar modelos/outputs comercialmente antes de verificar licencia de pesos, tokenizador, voz y dependencias exactas.

SLO p50/p95, cola, errores, tasa de fallback, uso RAM/CPU/GPU se establecen con datos medidos. Registrar CI, merge, SHA desplegado, canary, activación y rollback como evidencias separadas.

## 9. Tests derivados de spec

- [ ] Selector ASR `unset`/Whisper/VoiceStudio/desconocido y flag OFF.
- [ ] Contrato multipart, segundos→ms, segmentos ausentes, bytes MIME, TTS WAV/Opus.
- [ ] Auth 401/403/404 y mismo tenant distinta org/job; denegar **antes** de enviar datos.
- [ ] SSRF, redirects, IP privada/metadata y host no allowlisted.
- [ ] Silencio/corrupto/tamaño/timeout/429/503, backpressure, reintentos e idempotencia.
- [ ] Consentimiento de mic, transcript editable, accesibilidad ES/EN y fallback.
- [ ] Prompt injection por transcripción no produce mutaciones ni pagos.
- [ ] Backup/restore original y SHA-256 exacto.
- [ ] `pnpm spec:index --check`, `pnpm spec:validate:strict`, unit/e2e, CI y pruebas auténticas/canary medidos.

## 10. Mapa de implementación

API: `apps/api/src/modules/contributor-program/transcription-provider.ts`, `apps/api/src/modules/agro/agro-asr.ts` y adaptador en módulo Prometeo/Integrations. Web: `apps/web/components/ai/agent-chat-panel.tsx`, `prometeo-attachments.ts`. Worker solo si requiere cola. Contratos en `packages/schemas` si hay endpoint nuevo. Migración: ninguna aprobada.

## 11. Fuentes y contratos relacionados

VoiceStudio: `docs/agentic-voice.md`, `docs/speech-platform.md`, `docs/api-auth.md`, `docs/mcp.md`, `docs/install/docker.md`, `LICENSE-NOTICE.md`, `docs/licensing/model-inventory.md`. SEMSE: spec Workspace P3-A, `core.knowledge-contributor-asr-openai-whisper`, `agro.prometeo-intake`, `prometeo.live-sessions`, `satellites.alexa-voice`. SHA upstream y contratos deben fijarse y reconfirmarse.

## 12. Decisiones y gates

| Decisión | Recomendación | Estado |
|---|---|---|
| D1 MVP ASR/TTS batch | Sí, realtime posterior | PENDIENTE APROBACIÓN |
| D2 servicio externo aislado | Sí; SEMSE API única entrada | PENDIENTE APROBACIÓN |
| D3 clonación/doblaje apagados | Sí, hasta consentimiento y licencia | PENDIENTE APROBACIÓN |
| D4 motor y activos con uso comercial | fijar versiones/derechos con evidencia | BLOQUEA PRODUCCIÓN |
| D5 retención, eliminación y custodia | resolver con owner/privacidad | BLOQUEA PRODUCCIÓN |

- [ ] Owner aprueba spec D1-D3; actualizar `status: APPROVED` antes de código.
- [ ] Trazabilidad licencias+retención D4/D5 antes de activación comercial.
- [ ] Spec/plan/tasks/analyze/checklist alineados y `spec:index` reproducible.
- [ ] CI PASS, PR mergeado, deploy real, canary autenticado y evidencia de producción antes de `VERIFIED`.
