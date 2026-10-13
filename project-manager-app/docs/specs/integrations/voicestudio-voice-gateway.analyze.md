# Análisis de consistencia — VoiceStudio × SEMSE (2026-10-13)

**Resultado:** DRAFT — NO GO para implementación ni despliegue. Auditoría estática de SEMSE `388a1200bed0efb75ca0d9b13dea313ba7812b82` y VoiceStudio `c2ef99817fc4f2e0271a223c357e57e8df93cbde`. No afirma SHA de Railway.

## Solapamiento con código y specs actuales

| Fuente SEMSE | Comportamiento observado | Decisión |
|---|---|---|
| `apps/api/src/modules/contributor-program/transcription-provider.ts` | `TranscriptionProvider`, selector opt-in actual solo OpenAI Whisper | ampliar por adaptador, preservar comportamiento predeterminado |
| `apps/api/src/modules/agro/agro-asr.ts` | reader por URL y reutilización del proveedor | revisar legitimidad de URL, scope y SSRF sin afirmar explotabilidad |
| `docs/specs/ui/prometeo-multimodal-workspace.spec.md` | audio como archivo, ASR/grabación fuera de alcance P3-A | nueva spec/UX, no reescribir historial |
| `apps/web/components/ai/prometeo-attachments.ts` | admite audio y staging | reutilizar validación, custodia y límites; no promover Evidence |
| `docs/specs/prometeo/live-sessions.spec.md` | LiveKit y FSM de medios en otro alcance | no mezclar batch con sesiones en vivo |
| `docs/specs/satellites/SAT-002-alexa-voice-channel.spec.md` | integración canal Alexa | no duplicar comandos o permisos |

## Riesgos que bloquean

- **SSRF confirmado a nivel de flujo de código (sin explotación de red):** `AgroEvidenceController` acepta `fileUrl` externo con `z.string().url()`, `AgroEvidenceService` lo persiste y `AgroIntakeService` lo pasa a `HttpUrlStorageReader.readBuffer` que ejecuta `fetch(key)`; con ASR cloud activo, los bytes pueden salir hacia el transcriptor. Consultar [`voicestudio-voice-gateway.security-review.md`](voicestudio-voice-gateway.security-review.md) para evidencia, impacto condicionado y pruebas de contención. No activar este camino sin mitigación.

1. **Licencias:** VoiceStudio `LICENSE-NOTICE.md` es AGPL-3.0 para su código, no derechos de los modelos. `docs/licensing/model-inventory.md` dice que actualmente **ninguno** tiene `commercial_use:true` revisado y el modelo OmniVoice predeterminado tiene pesos con términos no comerciales. No seleccionar modelo por intuición ni usar una licencia de software como autorización de pesos.
2. **Privacidad:** los audios pueden contener PII de trabajadores, clientes y obras. D5 y consentimiento aplicable aún sin cerrar.
3. **SSRF:** `HttpUrlStorageReader.readBuffer` hace `fetch(key)`. Evaluar origen, allowlist, IP/host/redirect/DNS y acceso a storage para determinar si existe ruta explotable.
4. **Acciones económicas:** la voz no es una firma/aprobación; tool governance y Payment Governance mantienen barreras vigentes.
5. **Seguridad VoiceStudio:** API admin `/system/*`, `/api/settings/*` y MCP no deben ser públicos. El gateway no expone claves, direcciones internas ni voz arbitraria.
6. **Rendimiento/operación:** Docker upstream es amd64; descargas y RAM/CPU/GPU necesitan benchmark y custodia de datos antes de ofrecer servicio al público.

## Verificaciones y decisiones pendientes

- [x] Contratos reales de ASR/TTS upstream revisados
- [x] Reutilización y colisiones con módulos SEMSE revisadas
- [x] Spec con SDD 2.0 declarada `DRAFT`
- [x] `related_endpoints` y `related_tests` vacíos porque no están implementados
- [ ] Aprobación expresa D1–D3 y spec
- [ ] Licencia comercial/modelo/outputs exactos D4
- [ ] Retención, consentimiento y eliminación D5
- [ ] `pnpm spec:index --check`, `pnpm spec:validate:strict` y tests en checkout real
- [ ] CI GitHub PASS, deploy real, smoke autenticado y canary con evidence

La documentación no es un despliegue. No crear PR de código hasta autorización del SDD.
