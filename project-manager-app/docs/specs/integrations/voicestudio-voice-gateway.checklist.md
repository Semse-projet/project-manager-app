# Checklist de aceptación — VoiceStudio × SEMSE (DRAFT)

## Especificación y licencias
- [ ] SDD APPROVED con D1–D3 firmadas; D4–D5 cerradas antes de producción.
- [ ] Modelo ASR/TTS y voz identificados por versión/digest/pesos/asset y autorización comercial documentada.
- [ ] AGPL-3.0 aplicación, model weights, tokenizer, output, FFmpeg/redistribución revisados por separado.
- [ ] SEMSE_ASR_PROVIDER unset sigue apagado; openai-whisper no cambia; voicestudio solo opt-in.
- [ ] pnpm spec:index --check, pnpm spec:validate:strict y CI ejecutados en checkout completo, no inferidos.

## Seguridad
- [ ] Identidad/tenant/org y resource policy verificados antes de cargar medio.
- [ ] Otro tenant y otra org del mismo tenant sin acceso al job reciben 404 homogéneo.
- [ ] API key solo servidor; destino fijo por allowlist, TLS o red interna protegida.
- [ ] No exponer directamente /mcp/, /system/*, /api/settings/* ni consola VoiceStudio.
- [ ] Rechazar SSRF, IP privadas/metadata, redirect, DNS rebinding y esquemas inválidos en readers URL.
- [ ] Verificar bytes reales, tamaño, duración, formato, cuota y consentimiento de grabación.
- [ ] Sin captura remota, sin clonación, sin entrenamiento de terceros y sin audio/PII en logs.
- [ ] Ninguna instrucción/transcripción libera fondos, cambia FSM ni aprueba Evidence sin flujo independiente.

## Resiliencia/calidad
- [ ] Transcript editable, etiqueta IA y sourceFileId; original con SHA-256 y copia restaurable.
- [ ] TTS devuelve audio real WAV/Opus del motor autorizado y texto persiste si falla.
- [ ] ES/EN validados con clips reales; silencio, ruido de obra, error ASR no inventa palabras.
- [ ] Backend 401/429/503, timeout, archivo corrupto y modelo no instalado tienen fallback explícito.
- [ ] Rate limit por tenant, idempotencia, retry limitado, aislamiento de colas y kill switch.
- [ ] Sin flags habilitados: cero llamadas a VoiceStudio por producción.
- [ ] Medir p50/p95, throughput, CPU/GPU/RAM, disk y fallbacks con datos reales.

## E2E y entrega
- [ ] 2 tenants, 2 org del mismo tenant y permisos por job verificados con sesiones autenticadas.
- [ ] Mic → storage SEMSE → ASR → corrección → Prometeo → TTS → reproducción.
- [ ] Backup/restore original contra SHA-256.
- [ ] Regresión de otras funcionalidades ASR Contributor/Agro superada.
- [ ] CI PASS, merge SHA, deploy SHA, flags canary, activación y rollback comprobados separadamente.
- [ ] Únicamente tras la evidencia anterior, considerar pasar spec a VERIFIED.

**Estado actual:** ninguno de los checks de código/CI/runtime/productivo se considera completado. Este documento registra criterios, no certifica funcionalidades.
