---
id: "agro.audio-ssrf-containment"
title: "Agro ASR — custodia de audio y contención SSRF"
domain: "agro"
sdd_version: "2.0"
version: "0.1"
status: "DRAFT"
owner: "semse-core"
risk: "critical"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags: ["SEMSE_ASR_PROVIDER"]
production_evidence: []
related_files:
  - "apps/api/src/modules/agro/agro-evidence.controller.ts"
  - "apps/api/src/modules/agro/agro-evidence.service.ts"
  - "apps/api/src/modules/agro/agro-intake.service.ts"
  - "apps/api/src/modules/agro/agro-asr.ts"
  - "apps/api/src/modules/agro/agro-farm-access.service.ts"
  - "apps/api/src/infrastructure/storage/storage.service.ts"
  - "apps/api/src/infrastructure/storage/storage-key.ts"
  - "apps/web/app/agro/[farmId]/agro-evidence-upload.ts"
  - "packages/db/prisma/schema.prisma"
related_tests: []
related_endpoints: []
related_events: []
related_agents: ["prometeo"]
last_verified: "2026-10-13"
---

# Spec: Agro ASR — custodia y SSRF

> **DRAFT: no autoriza código, migraciones ni cambios de Railway.** Seguimiento: [Issue #911](https://github.com/Semse-projet/project-manager-app/issues/911). Revisión **estática**, no explotación ni estado de flags confirmado. Base inspeccionada: SEMSE main 388a1200bed0efb75ca0d9b13dea313ba7812b82.

## 1. Problema y resultado

**Actor:** CLIENT/PRO/WORKER con acceso real y permiso de reporte en una finca, administradores autorizados y Prometeo Agro.

**Ruta comprobada en código**: el controller acepta fileUrl como URL absoluta en POST/PATCH; AgroEvidenceService la persiste; AgroIntakeService, después de comprobar acceso a la finca y filtrar evidenceIds de esa finca, pasa la URL AUDIO a HttpUrlStorageReader; éste realiza fetch(key) sin validación explícita de destino ni límite de lectura. Si SEMSE_ASR_PROVIDER está habilitado, podría causar conexiones a destinos no autorizados y reenviar los bytes al transcriptor. **No está demostrada explotabilidad de red ni activación productiva.**

**Resultado:** la transcripción automática únicamente lee un original custodiado por SEMSE mediante referencia interna verificada. Nunca ejecuta peticiones HTTP a una URL controlada por un usuario. Las evidencias legacy y enlaces externos pueden conservarse para visualización con las políticas existentes, pero **no activan ASR** sin una referencia segura.

## 2. Alcance

**Incluido**
- Separar metadatos de enlace (fileUrl) de referencia procesable de audio (storageKey o assetId con custodia verificada).
- Validar actor, permiso 'incident.report', pertenencia a la finca, tenant y alcance del audio **antes** de acceder a sus bytes; tenantId coincidente no basta para inferir ownership entre organizaciones o fincas.
- Reusar StorageService y normalización de keys; no descargar el propio proxy web por HTTP como sustituto de la lectura interna.
- Error explícito 'AUDIO_SOURCE_NOT_VERIFIED' / dato legacy en vez de inventar transcript, seguir URL externa o cambiar automáticamente a Whisper.
- Crear binding/receipt persistente que pruebe que un archivo fue subido por un actor autorizado y vinculado a la finca correcta. Diseñar migración aditiva + plan de rollback; no usar solo la posesión de una URL o key como prueba de ownership.
- Revisión de endpoints que crean, actualizan o adjuntan evidencias AUDIO (incluidas rutas de incidencias y capacidades de trabajadores) para evitar vías laterales.

**Excluido**
- Reescritura global de evidence o media; tratamiento de EXTERNAL_URL como archivo interno; grabación y TTS; VoiceStudio como proveedor; cambios de Payment, Escrow, FSM; conexiones a servicios externos para probar SSRF.
- Migraciones o retro-rellenado que adivinen posesión de archivos o conviertan una URL histórica en asset verificado sin prueba.

## 3. Actor, recurso y permisos

| Actor | Requisito | Permitido | Prohibido |
| --- | --- | --- | --- |
| Miembro ACTIVE de farm | Autorización farm + incident.report (y permiso de subida para crear) | Solicitar transcripción de evidencia AUDIO verificada de esa finca | Consumir media de otra finca, org o tenant |
| Owner farm | Mismos controles de recurso + autorización explícita | Custodiar/ver evidencia propia | Usar tenantless farm para atravesar scopes |
| OPS_ADMIN | Scope documentado y auditado | Soporte bajo autorización | Saltar binding/consentimiento o custodia |
| Servicio ASR | Identidad interna, acceso a bytes ya autorizados | Procesar buffer limitado y autorizado | Aceptar URL/remitente externo o abrir metadata/localhost |

- AgroFarm.tenantId **es nullable** en main. Para finca legacy sin tenant resuelto, ASR procesando media debe **fallar cerrado** hasta vinculación autorizada y auditable; nunca asumir tenant desde headers o URL.
- AgroEvidenceItem guarda farmId y fileUrl, pero no una prueba de posesión del archivo. El ID de evidencia y el tenant prefix de la key por sí solos **no autorizan** acceso entre organizaciones o fincas.
- 404 homogéneo para actor fuera de finca/recurso; 403 para permiso ausente según política existente; 400/409 seguro para media sin custodia, 413 para bytes excesivos. Sin fugas de host, firma o key.

## 4. Escenarios de aceptación

**P1, autorización previa:** DADO miembro ACTIVE con permiso de reportar y objeto subido/custodiado ligado a farm y tenant, CUANDO solicita ASR de esa evidencia, ENTONCES se valida actor+farm+binding y sólo después se llama StorageService.readBuffer(key), respetando cuotas. El resultado incluye evidencia de procedencia, nunca se transforma en aprobación.

**P2, fuente remota:** DADO evidencia AUDIO nueva o histórica con fileUrl arbitrario (HTTP(S), localhost, IP privada, metadata, redirect), CUANDO se pide ASR, ENTONCES la ruta falla explícitamente **sin ninguna petición de red** a esa URL ni reenvío externo.

**P3, cruces:** Una key válida de otro tenant, otra finca o distinta org del mismo tenant **no** puede asociarse/consumirse sin binding válido. Testear creación y actualización además de lectura.

**P4, legacy / tenantless:** Una evidencia previa con sólo URL o una finca sin tenant verificado produce una degradación explícita; no hacer heurísticas que infieran access.

**P5, flag:** SEMSE_ASR_PROVIDER unset produce cero peticiones salientes. openai-whisper conserva semántica explícita una vez que la fuente esté verificada; no activar VoiceStudio ni un fallback cloud por defecto.

**P6, seguridad del archivo:** MIME vs bytes, silencio, corrupto, longitud, tamaño, carreras de revocación, expiración de credenciales, reintentos, stream excesivo y no mutación financiera.

## 5. Contratos existentes a revisar (NO son nuevos)

- POST /v1/agro/farms/:farmId/evidence: createEvidenceSchema.fileUrl URL libre.
- PATCH /v1/agro/evidence/:evidenceId: updateEvidenceSchema.fileUrl URL libre.
- POST /v1/agro/farms/:farmId/intake/propose: usa evidenceIds y, si no hay texto, transcribe AUDIO.
- Otras rutas de incidentes y worker capabilities deben inventariarse antes de implementar.

**Contrato nuevo candidato (pendiente de decisión):** asociar assetId/storageKey **mediante recibo opaco firmado por el backend**, no mediante una key aportada sin prueba. El servicio resuelve receipt→tenant/org/farm/uploader/key desde almacenamiento confiable y valida la disponibilidad y ownership del archivo. Reusar esquema/servicios existentes si ya garantizan dicho vínculo; no crear tabla nueva hasta cerrar investigación.

**UI:** mantener fileUrl para visualización histórica; mostrar 'archivo no verificado/no se puede transcribir' y sugerir volver a subir el original. Nunca marcar como transcrito si el proveedor no produjo texto.

## 6. FSM, eventos y auditoría

No tocar FSM de Job, Project, Evidence, Payment, Milestone ni LiveSession. No inventar eventos de dominio. Registro de auditoría agregado a cambios de asociación de asset, con metadatos mínimos (sin audio, transcript, firmas ni URLs secretas); consultar catálogo antes de introducir evento. La transcripción no escribe estados económicos.

## 7. Datos/migración

**Hechos en main**: AgroEvidenceItem tiene farmId y fileUrl, sin storageKey ni receipt en su propio modelo; AgroFarm.tenantId nullable. El storage usa claves 'tenants/{tenantId}/...' y StorageService.readBuffer(). El helper web genera URL absoluta a partir de '/api/semse/uploads/files/:key'.

**Propuesta de transición (no aprobada):**
1. P0: bloquear el fetch arbitrario en el camino ASR. Para AUDIO cuyo origen no pueda verificarse, fallar cerrado. Mantener lectura web original y permitir entrada manual de texto cuando ASR no esté disponible.
2. P1: binding server-side del upload y del farm/actor/tenant, mediante assetId o storageKey certificado por receipt; tratar rotación de org, revocación de membresía y fincas tenantless.
3. P2: backfill **solo** de registros con prueba autoritativa de origen; los demás quedan legacy no-ASR y reparables por re-upload explícito.
4. Migración Prisma expand/contract y rollback por pasos con pruebas reales; no editar migraciones aplicadas, no db push.

## 8. Operaciones y activación

Sin cambio productivo ni activación hasta aprobación y verificación. ASR debe contar con flags OFF por defecto, gate por tenant/farm, timeouts, tamaño y cuota; métricas de rechazo y uso sin PII; alerta por intento de URL externa, rollback por desactivar provider. No registrar fileUrl/tokens completos.

## 9. Tests

- [ ] Unit: source resolver rechaza URL, redirect, host/IP local, tenantless y key sin receipt, **sin invocar fetch**.
- [ ] Unit: receipt válido requiere actor activo, farm, tenant, org y permiso.
- [ ] Integración: 2 tenants, 2 org mismo tenant, 2 farms, revocación y rotación de roles.
- [ ] Integración: create/update/incident/worker evidence no generan bypass.
- [ ] E2E: presign→PUT→binding→ASR→review humana; capturar bytes/hashes sin revelar PII.
- [ ] Errores: 401, 403, 404, 413, 429, timeout, corrupto, control de tamaño y almacenamiento caído.
- [ ] Regresión T-053: la subida de PHOTO/VIDEO/DOCUMENT no se rompe; EXTERNAL_URL sigue siendo enlace, nunca fuente ASR.
- [ ] GitHub CI, Prisma migrate, pnpm spec:index --check, pnpm spec:validate:strict, unit y e2e verdes.

## 10. Touchpoints previstos

apps/api/src/modules/agro/agro-evidence.controller.ts, agro-evidence.service.ts, agro-intake.service.ts, agro-asr.ts, agro-farm-access.service.ts; apps/api/src/infrastructure/storage/*; apps/web/app/agro/[farmId]/agro-evidence-upload.ts; packages/db/prisma/schema.prisma (solo con migración planificada y aprobada).

## 11. Evidencia e investigación

Revisión de código en main: controllers, services, helper T-053, esquema Prisma, signed-url.ts y StorageService. No se ha comprobado Railway, explotabilidad, volúmenes, TTL efectivo ni políticas de otros endpoints que escriben fileUrl. Revisar conforme a Issue #911.

## 12. Gates y decisiones

- D-SSRF-1: **Propuesta**: P0 denegar siempre HTTP arbitrario en ASR, conservando entrada manual — requiere aprobación del owner.
- D-SSRF-2: receipt server-side vinculado a farm/tenant/actor y org, o reutilización demostrable de asset binding existente — diseño pendiente.
- D-SSRF-3: legado no verificable y farm tenantless quedan inactivos para ASR, sin backfill heurístico — requiere aprobación.
- D-SSRF-4: migración/retención/consentimiento y despliegue escalonado — requiere validación del owner y privacidad.
- [ ] status APPROVED; plan/tasks/checklist/analyze coherentes
- [ ] tests+spec validator+CI PASS
- [ ] merge SHA, deploy SHA, activación/canary, rollback y producción comprobados por separado
