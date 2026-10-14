---
id: "agro.audio-ssrf-p0"
title: "Agro ASR P0 — contención de URLs no verificadas"
domain: "agro"
sdd_version: "2.0"
version: "1.0"
status: "APPROVED"
owner: "semse-core"
risk: "critical"
code_status: "IN_PROGRESS"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "NOT_APPLICABLE"
feature_flags: ["SEMSE_ASR_PROVIDER"]
production_evidence: []
related_files:
  - "apps/api/src/modules/agro/agro-intake.service.ts"
  - "apps/api/src/modules/agro/agro-asr.ts"
  - "apps/api/src/modules/contributor-program/transcription-provider.ts"
related_tests:
  - "apps/api/test/agro-intake.service.test.ts"
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
last_verified: "2026-10-14"
---

# SDD 2.0 — Agro ASR P0

## 0. Alcance de autorización y restricciones

El propietario pidió continuar el 2026-10-14 después de presentar expresamente el bloqueo de aprobación y el orden P0 → VoiceStudio. Esta instrucción se aplica únicamente a preparar el cambio P0 en una rama separada para revisión y CI. No autoriza fusionar, desplegar, activar ASR, agregar motores comerciales ni modificar bases de datos. El PR permanece en borrador hasta aceptar de forma expresa el impacto funcional y autorizar el merge.

Este slice APPROVED es independiente del spec padre agro.audio-ssrf-containment (DRAFT para P1/P2); la implementación posterior de custodia de audio no se autoriza aquí.

## 1. Problema y resultado

AgroEvidenceItem.fileUrl es una URL controlable desde endpoints de evidencia. AgroIntakeService la pasaba a HttpUrlStorageReader y éste hacía fetch(key) desde el servidor. El vínculo de la evidencia con una finca no prueba ownership del destino de esa URL.

Resultado P0: toda evidencia AUDIO que sólo cuenta con fileUrl falla de modo explícito y sin tráfico HTTP desde el camino de ASR. La entrada de texto manual sigue funcionando. Se preservan archivos y transcripciones existentes; no hay escritura nueva sobre Evidence.

## 2. Incluido y excluido

Incluido: eliminar cualquier llamada a fetch de HttpUrlStorageReader; poner el reader legacy en fail-closed; AgroIntakeService.resolveText devuelve HTTP 400 con AUDIO_SOURCE_NOT_VERIFIED para audio no verificable y sin texto; renovar tests T-054 para que no consideren válida una URL arbitraria.

Excluido: nuevo binding assetId/receipt, migraciones, backfill, cambios en Prisma, infra/Railway, provider Whisper de Contributor Program, VoiceStudio, TTS, LiveKit, Evidence/Payment Governance y approvals.

Regresión deliberada: incluso una URL pública válida del almacenamiento actual no puede demostrar vínculo farm/org por sí sola; hasta P1 esa evidencia no alimentará ASR automáticamente. Mantener posibilidad de introducir texto manual.

## 3. Actores y permisos

AgroIntakeController y AgroFarmAccessService siguen exigiendo permiso incident.report y pertenencia ACTIVE a la finca. Usuario ajeno no puede enumerar fincas. Un miembro autorizado recibe AUDIO_SOURCE_NOT_VERIFIED para fileUrl sin referencia de custodia, y no se invoca proveedor de voz.

El hecho de pertenecer al mismo tenant u organización no autoriza resolver media de otra finca. P0 no construye un tercer backend ni cambia RBAC; la asociación segura queda pendiente de P1.

## 4. Escenarios P1 y bordes

P1: DADO usuario autorizado, audio AUDIO con fileUrl no verificado y texto vacío, CUANDO realiza POST /v1/agro/farms/:farmId/intake/propose, ENTONCES 400 AUDIO_SOURCE_NOT_VERIFIED y ninguna invocación al resolver del proveedor, al transcriptor o a fetch.

P2: URLs de CDN externa, localhost, IPv6 loopback, metadata o URL con firma aparente se rechazan todas sin petición saliente.

P3: Si el usuario proporciona text explícito, incluso cuando adjunta AUDIO, recibe la misma propuesta textual de siempre con transcribedFrom vacío, sin intento de ASR.

P4: Si un consumidor legacy instancia HttpUrlStorageReader y llama readBuffer, lanza AUDIO_SOURCE_NOT_VERIFIED sin conexión.

P5: Fotos y visión optativa se mantienen intactas. Un usuario no autorizado sigue rechazado antes del análisis de evidencias.

## 5. Contrato API/UI/agente

Endpoint existente, sin añadir rutas: POST /v1/agro/farms/:farmId/intake/propose. Error 400, mensaje sin la URL original, credenciales o información de red. La interfaz debe permitir texto manual y no prometer transcripción en un archivo no verificable.

Prometeo sólo devuelve propuestas, no mutaciones ni aprobaciones de pagos, evidencia o hitos.

## 6. FSM, eventos y auditoría

Sin cambios de estado, eventos, outbox, replay o compensaciones. No persiste una transcripción inventada. No se incluyen logs de audio, firma o URL.

## 7. Datos, migración y reversión

No hay migración. No se modifica fileUrl de evidencias existentes. Restaurar el antiguo fetch sería regresión de seguridad; en un incidente operacional, desactivar proveedor o aplicar forward-fix, no restaurar por defecto acceso arbitrario.

P1, sujeto a spec distinto: assetId/storageKey custodiado, receipt vinculado a actor/tenant/org/farm y lectura por StorageService con autorización.

## 8. Entrega y operaciones

No tocar Railway ni flags. CI deberá ejecutar build API, unit/coverage, E2E, spec:index:check y spec:validate:strict. Evaluar regresión AUDIO intencionada antes de merge; sólo entonces prueba autenticada de producción y evidencias.

## 9. Tests

- [x] Rechazo con 400 de audio URL no verificada.
- [x] Casos loopback, metadata, CDN, URL firmada aparente.
- [x] Prueba de no invocación de provider.
- [x] Prueba de reader fail-closed sin fetch.
- [x] Texto manual continúa disponible sin ASR.
- [ ] CI por SHA en verde, no inferido.
- [ ] Tests autenticados multi-farm y ausencia de egress en staging.
- [ ] Aprobación de merge y despliegue controlado.

## 10. Archivos

apps/api/src/modules/agro/agro-intake.service.ts; apps/api/src/modules/agro/agro-asr.ts; apps/api/test/agro-intake.service.test.ts.

## 11. Fuentes

Constitución, AGENTS.md, docs/SDD_GOVERNANCE.md, specs/agro/agro-audio-ssrf-containment.spec.md y Issue #911.

## 12. Estados separados

Spec: APPROVED solo para P0. Código: IN_PROGRESS. CI: NOT_RUN hasta comprobación terminal. Merge: UNMERGED. Deploy: NOT_DEPLOYED. Activation: INACTIVE. Migration: NOT_APPLICABLE. Nunca marcar VERIFIED a partir de existencia de rama, CI pendiente o health 200.
