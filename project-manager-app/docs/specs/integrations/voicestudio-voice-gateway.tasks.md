# Tareas secuenciadas — VoiceStudio Gateway (DRAFT)

**No ejecutar código antes de aprobar la spec. No modificar Railway ni variables productivas durante este PR documental.**

- [x] T00 Auditar VoiceStudio y SEMSE, confirmar endpoints upstream y contratos existentes.
- [x] T00b Registrar DRAFT en SDD 2.0, índice y analizar solapamientos.
- [ ] T01 Cerrar D1–D3 mediante aprobación expresa del propietario; revalidar HEAD, revisiones y permisos.
- [ ] T02 Elegir motor ASR/TTS, pesos/tokenizador/voz/outputs, licencia comercial exacta por revisión SHA y registro de fuente; definir retención/consentimiento D4–D5.
- [ ] T03 Escribir tests de resolver ASR (unset, Whisper, VoiceStudio, error de configuración) y mapeo segmentos.
- [ ] T04 Implementar ASR bajo TranscriptionProvider, sin alterar comportamientos previos, con timeout, límites y errores controlados.
- [ ] T05 Auditar y corregir, si confirma riesgo, lectura HTTP Agro: origen permitido, SSRF, redirects, autenticación, custodia y cross-tenant.
- [ ] T06 Definir schemas Zod/BFF/endpoints de voz y scopes de RBAC/ownership; tests 401/403/404 por recurso antes de lectura de archivos.
- [ ] T07 Escribir tests para TTS de respuesta previamente autorizada, audio WAV/Opus, voz permitida, errores y fallback a texto.
- [ ] T08 Implementar SpeechProvider TTS backend-only y enlace temporal autenticado de respuesta; no exponer keys/administración.
- [ ] T09 Crear UX mic iniciado/cancelado por usuario, aviso/consentimiento, transcript editable, audio reproducible y accesibilidad ES/EN.
- [ ] T10 Pruebas de prompt injection: audio no ejecuta Payment, Evidence, Milestone, FSM ni tools mutables sin approval.
- [ ] T11 Pruebas de error: silencio, corrupto, MIME/bytes discordantes, duration, payload grande, 429, 503, timeout, retry e idempotencia.
- [ ] T12 Benchmark modelos aprobados en CPU/GPU con RAM, disco, latencia, throughput, cold start y logs redactados.
- [ ] T13 Staging privado sin MCP/admin ingress, imagen digest fija, secretos fuera de frontend, volúmenes + backup/restore + SHA-256.
- [ ] T14 Ejecutar pnpm spec:index --check, pnpm spec:validate:strict, verify workspace, unit, E2E y CI; corregir regresiones.
- [ ] T15 PR de implementación independiente; revisión, merge autorizado, validación SHA deploy, canary de tenant aprobado, smoke ES/EN autenticado y rollback probado.
- [ ] T16 Documentar resultados, métricas reales, contrato de retención, activación y evidencia SDD; nunca etiquetar VERIFIED sin despliegue activo comprobado.

**Dependencias:** T01 bloquea T03–T10; T02 bloquea cualquier prueba comercial/activación; T14 precede al merge; T15 precede a VERIFIED. Clonación, LiveKit/WebSocket, doblaje y MCP agentic son especificaciones futuras.
