# Plan — VoiceStudio Voice Gateway (DRAFT)

> Aplica solo tras aprobación del spec. Sin modificaciones a Railway, producción, variables ni modelos en este PR documental.

## Fase 0 — Gobierno

1. Volver a leer `AGENTS.md`, constitución, `SPEC_INDEX`, `SOURCE_OF_TRUTH`, invariantes, API surface y contratos Prometeo/Contributor/Agro.
2. Aprobar D1-D3 (batch ASR/TTS, servicio separado, clonación deshabilitada) antes de escribir código.
3. Cerrar D4 con matriz **modelo/versión/revisión/archivo SHA-256/pesos/tokenizador/outputs/comercial/redistribución** y D5 con política real de retención/consentimiento. **Gate de activación comercial**: no suponer permisos por nombre OmniVoice o AGPL del software.
4. Registrar recursos, límites por tenant, política BFF, error 404 vs 403, auditoría sin contenido y kill switches.

## Fase 1 — ASR batch opcional

- Mantener el contrato `TranscriptionProvider.transcribe({storageKey,mimeType})` y la selección vigente `unset`/`openai-whisper`. Adición explícita de `voicestudio`, jamás fallback silencioso al servicio cloud.
- Consumir upstream `POST /v1/audio/transcriptions` desde API/worker, nunca desde navegador; `file` es buffer autorizado del storage SEMSE, no URL arbitraria. Usar `verbose_json`; convertir segundos→ms; no inventar `confidence`.
- Normalizar error/timeout/429/503; retry limitado para fallos temporales y no reintentar invalidez, bloqueo legal o acceso revocado.
- Auditar `HttpUrlStorageReader` de Agro (lectura por `fetch(key)`): origen, allowlist, redirects, DNS e IP internas; solución preferida lectura autenticada directa en storage o proxy cerrado, con pruebas cross-tenant.

## Fase 2 — TTS batch y Workspace

- Nuevo `SpeechProvider` servidor-a-servidor. `responseId` de Prometeo asegura que el texto pertenece al actor y solo se envía contenido autorizado a un motor/voz permitidos en servidor.
- Upstream `POST /v1/audio/speech` `response_format=wav|opus`; validar cabecera y bytes, volumen/duración/cuotas, entrega vía SEMSE con token efímero y storage persistente si se guarda.
- Extender `apps/web/components/ai/agent-chat-panel.tsx`: mic activado por usuario, indicadores de grabación, detener/cancelar, transcripción editable, confirmar antes de enviar, reproducir/detener, accesibilidad ES/EN; texto siempre disponible.
- Reusar `prometeo-attachments.ts` y staging sin convertirlos en Evidence aprobada.

## Fase 3 — Seguridad y orquestación

- API NestJS es única frontera pública: auth/RBAC+tenant+org+ownership por conversación/job/proyecto. 404 homogéneo para recurso ajeno; pruebas antes de enviar un byte al servicio.
- Backend VoiceStudio privado, host fijo allowlisted, TLS/túnel o red interna controlada, API key gestionada. **No publicar** `/mcp/`, `/system/*`, `/api/settings/*` o consola.
- MCP se excluye fase 1. Eventual entrada por Tool Registry con policy/approval, sin herramientas `clone_voice` y `design_voice` hasta spec y permisos independientes.
- No logs de voz, audio, transcript ni secretos; telemetría sanitizada, correlación y auditoría de acciones materiales.

## Fase 4 — Ejecución y rollout

- Benchmark reproducible en CPU/GPU, memoria, cold/warm start, latencias p50/p95, bytes, modelo real y coste. No presumir que CPU en Railway cumple latencia deseada.
- Imagen Linux amd64 de versión/digest fijado, backend con persistencia y restauración validada; no confiar en filesystem efímero.
- Checks en checkout real: `pnpm spec:index --check`, `pnpm spec:validate:strict`, `pnpm verify:workspace`, unit + E2E. CI pasa antes de considerar merge.
- Staging autenticado con 2 tenants y 2 organizaciones del mismo tenant; audio español/inglés, fallo/revocación/SSRF, inyección de prompt y defensa económica.
- Canary exclusivamente de tenant autorizado después de D4+D5; verificar deploy SHA real y flags; rollback por flags OFF documentado y probado.

## Contrato upstream

```text
SEMSE API/worker -- HTTPS/Bearer (sin exponer key) --> VoiceStudio privado
ASR: POST /v1/audio/transcriptions  file=<bytes autorizados>, model=whisper-1, response_format=verbose_json
TTS: POST /v1/audio/speech  input=<respuesta autorizada>, model=tts-1, voice=<id fijo permitido>, response_format=wav|opus
```

`whisper-1` y `tts-1` son alias; comprobar motor y pesos ejecutados. **No se activan** las fases de código sin aprobar spec ni producción sin D4+D5 y pruebas reales.
