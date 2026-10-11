---
id: "evidence.field-memory-capture-session"
title: "SEMSE Field Memory 4D — CAP-0 CaptureSession y custodia de fotografías"
domain: "evidence"
sdd_version: "2.0"
version: "0.1"
status: "APPROVED"
owner: "semse-core"
risk: "high"
code_status: "NOT_STARTED"
ci_status: "NOT_RUN"
merge_status: "UNMERGED"
deploy_status: "NOT_DEPLOYED"
activation_status: "INACTIVE"
migration_status: "PENDING"
feature_flags:
  - "FIELD_MEMORY_CAPTURE_ENABLED"
production_evidence: []
related_files:
  - apps/api/src/modules/evidence/evidence.repository.ts
  - apps/api/src/modules/evidence/evidence.policy.ts
  - apps/api/src/infrastructure/storage/uploads.controller.ts
  - apps/api/src/infrastructure/storage/storage.service.ts
  - apps/web/app/(app)/worker/evidence/page.tsx
  - packages/db/prisma/schema.prisma
related_tests:
  - apps/api/test/evidence.spec-contract.test.ts
  - apps/api/test/signed-file-access.test.ts
  - tests/unit/workspace-360-preview.test.ts
# Metadata captures existing implementation references only. Proposed future
# tests/endpoints/events are tracked explicitly in the spec body and tasks.
related_endpoints: []
related_events: []
related_agents:
  - prometeo
last_verified: "2026-10-11"
---

# Spec: Field Memory CAP-0 — CaptureSession

> **APPROVED en alcance de contrato CAP-0 por autorización explícita del propietario el 2026-10-11.** La implementación, migraciones, merge y activación siguen sujetas a gates de seguridad y pruebas. Registro incorporado a SPEC_INDEX. Derivada de `docs/program/semse-4d-field-memory/PHOTO_WALKTHROUGH_3D_4D_CAPTURE_SPEC.md`; los PR #868/#869 ofrecen vista local 360 y anotación de fotografía, **no CaptureSession**. Los PR #870/#871 protegen límites de subida y de IDs; no asumir merge ni despliegue.

## 1. Problema y resultado

**Para quién:** electricistas, supervisores, clientes y responsables de obra autorizados.

**Problema:** las fotos sueltas no forman una unidad de captura vinculada a pared/zona, etapa antes del cierre, tarea, hora y versión de plano; no se puede reconstruir su custodia ni filtrar con precisión el estado de una pared meses después.

**Resultado verificable:** una sesión conserva referencias inmutables a originales de Evidence, relación verificable con obra/proyecto, área, etapa y operador; se puede recuperar sin filtrar datos de otra organización. La posición declarada no se confunde con mediciones ni as-built validado.

## 2. Alcance

**Incluido:** create/list/get sesión; relación uno-a-muchos con Evidence existente; adjuntar originales **ya subidos y registrados**; metadatos declarados de nivel/zona, fase y propósito; submit idempotente; solo metadatos y referencias, sin copiar bytes. Un único Job canónico derivado de Project y su tenant; revisión/archivo fuera del primer slice de implementación salvo contrato explícitamente aprobado.

**Excluido:** fotogrametría, NeRF, COLMAP, Gaussian Splatting, generación de poses, BIM/IFC, certificación de medidas, liberación de escrow, publicación pública, uso de GPS/EXIF como identidad del sitio, proveedores externos y reasignación de evidencia a otro proyecto.

## 2.1 Decisiones del propietario — aprobadas 2026-10-11

1. **Derechos y consentimiento:** el contratista/GC debe autorizar la captura para esa obra y zona; si no existe una política o autorización verificable, fallar cerrado. Evitar personas y datos sensibles; revisión o redacción de copias derivadas no modifica el original.
2. **Custodia y retención:** originales inmutables con checksum, audit trail, exportación autorizada y retención definida en el contrato/política de cada proyecto. **No inventar período legal uniforme:** sin política de retención activa no publicar, borrar ni exportar automáticamente; conservar bajo acceso restringido y solicitar configuración antes de la activación. Legal hold prevalece sobre purga.
3. **Visibilidad:** PRO de la Org asignada y CLIENT de la Org cliente solo si `evidence.policy` y consentimiento/rightsPolicyRef permiten esa acción; los metadatos técnicos, manifest y originales no se comparten con otras Orgs o terceros sin concesión explícita revocable. Supervisor no hereda permisos: necesita membership y permiso backend.
4. **Revisión humana:** supervisor/inspector explícitamente autorizado o representante del cliente autorizado; SUBMITTED significa entregado, **no aprobado/verificado**. IA solo sugiere hallazgos, nunca autoriza pagos, perforación ni estados as-built.
5. **Sin conexión:** CAP-1 es online-first. El móvil puede retener archivos localmente bajo política y protección del dispositivo; no hay sincronización aprobada mientras falten cifrado, expiración, identidad revalidada y deduplicación. Hora local se marca como declarada y se contrasta con hora servidor al sincronizar en futura fase.

Son políticas conservadoras de lanzamiento acordes con la aprobación del contrato. Su implementación y cumplimiento operativo se verifican por pruebas, no por la presencia de este texto.

## 3. Autoridad, permisos y límites

| Actor | Permiso backend | Puede | Límite |
|---|---|---|---|
| PRO/operario con org profesional asignada | `evidence:write` y relación vigente con el Project | crear sesión y adjuntar Evidence autorizada | misma tenant, project, org y etapa; sin fuga por error |
| CLIENT con org propietaria | `evidence:read` | consultar sesiones/adjuntos de su proyecto | derechos de acceso actuales + privacy scope |
| Supervisor autorizado | permisos efectivos de Evidence y membership vigentes | revisar captura en futuro slice | no hereda OPS_ADMIN por mostrar Workspace |
| OPS_ADMIN auditado | permiso administrativo explícito | inspección excepcional, no reescritura de originales | operación con auditoría, sin bypass silencioso |
| Invitado/Otra org | ninguno | nada | respuesta 404 para recurso ajeno |

**Política:** reutilizar `evidence.policy.ts` y `ProjectLink`; `orgId`, `tenantId`, `jobId`, `projectId` no se aceptan de metadatos de cliente como autoridad. En create el `projectId` viene de la ruta; el backend obtiene `jobId`, tenant y asignación. En attach buscar Evidence bajo tenant y project y revalidar permiso; evitar que el actor enlace una evidencia capturada por otra Org sin política explícita. Revocaciones se aplican en **cada** GET/POST, no solo en create. Prevenir user enumeration y filtración por cantidad/respuesta/miniaturas.

**Bloqueo P0:** el modo `UPLOADS_SIGNED_GET_MODE` del backend está en off por defecto y en auditoría Railway 2026-10-11 no aparecían sus variables de activación. No publicar imágenes/manifest en CAP-1 sin `shadow → enforce` validado, signed URLs cortas, y controles por recurso/org; matching solo de tenant no basta. `StorageService` actual usa filesystem; exigir persistencia/backup reales en Railway antes de declarar archivos durables.

## 4. Escenarios P1 y errores

- **P1-S1 Crear:** PRO autorizado selecciona obra visible y zona identificable, fase `BEFORE_CONCEALMENT`; backend guarda sesión en `DRAFT` con `createdAt` servidor y `claimedCapturedAt` separado; produce auditoría+outbox idempotente.
- **P1-S2 Adjuntar:** bytes verdaderos se suben al storage canónico, Evidence se registra con permiso `evidence:write`, luego se une por `evidenceId`; clave original no es recibida ni modificada por el endpoint attach.
- **P1-S3 Submit:** si no existe al menos una Evidence PHOTO realmente accesible, rechaza 409; tras submit no se permiten nuevas asociaciones salvo nueva revisión/sesión.
- **P1-S4 Consultar:** cliente y profesional autorizados ven la sesión y la lista de evidencia, con marcas `CLAIMED_BY_WORKER`; actor ajeno 404 sin manifest ni URL; revocación de membership corta lectura.
- **P1-S5 Reintento:** dos comandos con mismo idempotency key devuelven el mismo resultado; payload distinto bajo clave usada → 409 sin duplicar join ni outbox.
- **P1-S6 Conflicto de scope:** `projectId=A`, `jobId=B`, `milestoneId=C` incompatibles, o evidencia de otro proyecto, → 404 y cero escrituras.
- **P1-S7 Privacidad:** sin derecho a fotografiar o con personas sensibles no autoriza publicación; no usar salida 3D para perforar, medir ni pago.

## 5. Contratos API propuestos, NO existentes

### API — shape canónico SDD 2.0

```yaml
auth: required (JWT/session, no server-identity fallback)
routes:
  - method: POST
    path: /v1/projects/:projectId/capture-sessions
    permissions: [evidence:write]
    input_schema: CreateFieldCaptureSessionSchema
    output_schema: CaptureSessionView
  - method: GET
    path: /v1/projects/:projectId/capture-sessions
    permissions: [evidence:read]
    input_schema: CaptureSessionsFilterSchema
    output_schema: PaginatedCaptureSessionView
  - method: POST
    path: /v1/capture-sessions/:captureSessionId/evidence
    permissions: [evidence:write]
    input_schema: AttachCanonicalEvidenceSchema
    output_schema: CaptureEvidenceRefView
  - method: POST
    path: /v1/capture-sessions/:captureSessionId/submit
    permissions: [evidence:write]
    input_schema: SubmitCaptureSessionSchema
    output_schema: CaptureSessionView
  - method: GET
    path: /v1/capture-sessions/:captureSessionId
    permissions: [evidence:read]
    input_schema: CaptureSessionIdSchema
    output_schema: CaptureSessionView
errors:
  400: input inválido
  401: falta sesión autenticada
  403: permiso denegado
  404: recurso inexistente o fuera de alcance (misma respuesta)
  409: conflicto de estado o idempotencia
  422: fotografía inválida o Evidence sin bytes verificables
  503: almacenamiento indisponible
effects:
  audit_log: required
  domain_event: atomic_outbox_per_create_attach_submit
  sse: none_in_CAP_1
  payment_governance: never_release_or_approve
```

### UI

```yaml
surfaces: [worker/evidence, workspace]
states: [loading, empty, draft, uploading, ready, submitted, forbidden, degraded, error]
required_behavior:
  - show active company, job, phase and rights state
  - fail closed on revoked membership
  - original photo access only after backend resource authorization
  - show CLAIMED_BY_WORKER separately from server time
```

### Agente/Prometeo

```yaml
tools: [capture_session.read_authorized_only]
input_schema: AuthorizedCaptureContext
output_schema: GroundedCaptureSummaryWithEvidenceIds
source_citations_required: true
approval_policy: explicit_human_approval_for_nonread_actions
forbidden_behavior:
  - infer_uncaptured_conductors
  - treat_3D_render_as_survey_grade
  - auto_approve_evidence_or_release_payment
  - use_public_unsanctioned_file_urls
```


- `POST /v1/projects/:projectId/capture-sessions` — `evidence:write`, body `{floorLabel?:string≤60,zoneLabel:string≤100,phase:BEFORE_CONCEALMENT|DURING_INSTALL|AFTER_CONCEALMENT,purpose:string≤100,claimedCapturedAt?:ISO8601,rightsPolicyRef?:string,idempotencyKey:uuid}`; response `{id,projectId,jobId,status:DRAFT,createdAt,createdBy,originalEvidenceIds:[]}`.
- `POST /v1/capture-sessions/:id/evidence` — `evidence:write`, `{evidenceId,sequence:int,idempotencyKey:uuid}`; Evidence debe existir, estar autorizada, ser PHOTO, pertenecer al mismo proyecto/tenant, mantener misma identidad de original y tener bytes comprobables.
- `POST /v1/capture-sessions/:id/submit` — `evidence:write`, `{idempotencyKey:uuid}`, transición DRAFT→SUBMITTED (o rechaza 409).
- `GET /v1/projects/:projectId/capture-sessions` — `evidence:read`, paginado y filtros por zona/fase/hora; backend filtra por derechos del actor.
- `GET /v1/capture-sessions/:id` — `evidence:read`, devuelve metadatos y referencias a Evidence sin URLs permanentes.

**Códigos:** 400 campos/formato; 401 autenticación ausente; 403 permiso de operación; 404 recurso ajeno o inexistente (idéntico); 409 conflicto de estado/idempotencia; 413/422 tamaño/restricciones de imagen en el flujo de bytes existente; 503 storage temporal. No inventar confirmación si PUT/registro original falla.

**UI:** Workspace y worker/evidence presentan loading, empty, denied, offline/degraded, upload failed, draft, submitted; la sesión siempre muestra nombre de obra, org actual y fuente de cada fotografía; jamás mezclar tabs de distintas organizaciones.

**Prometeo:** lectura con citas a Evidence y estado verificable, tool en modo read-only hasta aprobación independiente. Responder NO DOCUMENTADO para zona sin cobertura, no inferir conductores dentro de paredes.

## 6. FSM, invariantes, outbox

Estados del slice: `DRAFT → SUBMITTED`. `ABANDONED` y `ARCHIVED` se posponen para otro spec. Las referencias anexas sólo se añaden en DRAFT; no eliminar originales ni modificar hash/fecha de servidor. Los eventos `capture_session.created.v1`, `...evidence-linked.v1`, `...submitted.v1` requieren schema, registro en Event Catalog, outbox **en la misma transacción** y correlation/idempotency. Consumer reintenta sin duplicar estado; DLQ y replay visibles. Estado SUBMITTED no significa REVIEWED/VERIFIED.

## 7. Datos, custodia y migración

**Propuesta aditiva Prisma:** `FieldCaptureSession` con IDs (UUID), tenantId, projectId, jobId canónico, creatorOrgId, createdById, floorLabel, zoneLabel, phase, purpose, claimedCapturedAt opcional, createdAt/updatedAt server, submittedAt, status, rightsPolicyRef, `idempotencyKey` única por tenant/acción. `FieldCaptureEvidenceRef` con `captureSessionId`, `evidenceId`, `ordinal`, `linkedAt`, unique(session,evidence) y unique(session,ordinal); exigir FK Evidence y scope de proyecto transaccional. Asegurar índices `(tenantId,projectId,status,createdAt)` y `(tenantId,projectId,zoneLabel,phase)`. Evaluar RLS/soft deletes y retención contra modelo existente antes de migrar.

**Provenance:** original pertenece a Evidence, no a CaptureSession; hash SHA-256 calculado del **stream real** (pendiente de integración segura), checksum/versionado y recuperación verificable. Tiempo declarado por worker, EXIF si se dispone, y `createdAt` servidor siempre separados. Derivados futuros son entidades distintas con sourceEvidenceIds inmutables.

**Migración:** no existe aún. Al aprobar crear migración aditiva forward-only Prisma SQL con índices/FK, `prisma migrate deploy`, compatibilidad con instancia API antigua en canary, prueba en Postgres real, rollback de código dejando tablas sin escribir y forward-fix de datos; jamás reset/db push en prod. Importaciones de anotaciones de #869 no se convertirán automáticamente en sesiones sin consentimiento y conciliación de ownership.

## 8. Observabilidad y rollout

Flag `FIELD_MEMORY_CAPTURE_ENABLED` desactivada por defecto (allowlist interna por tenant/org). Métricas `capture_session_create_total`, `attach_rejected_total{reason}`, `upload_original_missing_total`, `capture_view_denied_total`, `submit_latency_ms`. Traces con requestId y tenantId opaco, sin PII ni storage keys en logs. Readiness: DB, storage privado, permisos y outbox. Canary interno sólo después de signed-file enforce, controles de Org, resguardo persistente y restauración ensayada. Rollback: deshabilitar flag, detener escrituras, conservar originales y eventos.

## 9. Tests requeridos

- [ ] Unitarios de FSM DRAFT/SUBMITTED; vínculo unívoco y 409 reintentos contradictorios.
- [ ] Postgres real: atomicidad sesión+outbox, attach+outbox, unique indexes y FK.
- [ ] API e2e de sesión con dos tenants, dos orgs, misma tenant pero org no asignada, proyecto borrado y membership revocada.
- [ ] Subida real PUT + Evidence register + attach con checksum, GET de fuente autorizada; Error PUT → cero Evidence/refs.
- [ ] GET sin auth/otro tenant/otra Org no expone original, URL, preview ni metadatos.
- [ ] Uploads firmados `shadow/enforce` con navegador/móvil/vision; expiración y revocación.
- [ ] UI móvil/desktop, pérdida de red, sesión 0 fotos, fotos no legibles, snapshots separados.
- [ ] Performance y restore de almacenamiento + retención; no efectos de escrow ni cambios ocultos al Labor Engine.

## 10. Mapa de implementación

### API
- `apps/api/src/modules/evidence/field-capture-session.controller.ts`, `.service.ts`, `.repository.ts`: dentro del owner canónico Evidence de ADR-028; no establecer nuevo módulo `field-memory` ni nueva frontera de autoridad.
### Web
- BFF autenticado para sesiones; UI Workspace y `worker/evidence` existentes, con company/job context visible y permisos por recurso.
### Worker / Packages / DB
- `packages/schemas/src/field-memory.schema.ts` y migración Prisma **aditiva** después de pruebas/validación; outbox por ADR-022; worker GPU y derivaciones fuera de CAP-1.
### Tests
- `apps/api/test/field-memory-capture-session.test.ts`, `...-integration.test.ts`, `tests/unit/field-memory-capture-session-ui.test.ts` — archivos FUTUROS, no declarados como existentes en frontmatter.
- `EvidenceRepository` y `ResourceScope` son fuente de permisos; originales pertenecen exclusivamente a Evidence. **No crear tablas ni endpoints hasta tests y revisión previa a implementación.**

## 11. Investigación y decisiones

Investigación independiente de fuentes primarias (2026-10-11):
1. OWASP File Upload Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html — **aplicado ahora:** autenticar/autorización por objeto, tamaños, permitir formatos, almacenamiento privado.
2. Prisma Migrate deployment guide — https://www.prisma.io/docs/orm/v6/prisma-client/deployment/deploy-database-changes-with-prisma-migrate — **aplicado ahora:** `migrate deploy` automatizado y versiones/rollback forward-fix; no `db push` en producción.
3. COLMAP official Tutorial — https://colmap.github.io/tutorial.html — **backlog CAP-3:** fotogrametría de vistas superpuestas desde posiciones distintas; no reconstruir la escena en CAP-1.

**Descartado en CAP-1:** almacenamiento público de fotos, IA cloud por defecto, inferencia de medidas sin calibración y entrenamiento GPU dentro de HTTP.

ADR obligatorios: `docs/architecture/ADR-028-evidence-gateway-adapter-role.md` (Evidence canónico y refs) y `docs/architecture/ADR-022-transactional-outbox-bullmq.md` (atomicidad de eventos). No se abre un ADR nuevo porque `CaptureSession` permanece dentro de `modules/evidence`.

Fuentes arquitectónicas existentes en repositorio: `docs/SDD_GOVERNANCE.md`, `docs/specs/platform/resource-scope.spec.md`, `docs/specs/platform/signed-file-access.spec.md`, y la propuesta `docs/program/semse-4d-field-memory/PHOTO_WALKTHROUGH_3D_4D_CAPTURE_SPEC.md`. La investigación externa de tres fuentes primarias por nuevo módulo y su matriz aplicado/backlog/descartado es **pendiente antes de aprobación**. No inferir aprobación por documentos de descubrimiento.

## 12. Gate de cierre

- [x] Aprobación explícita del propietario del contrato CAP-0 y defaults conservadores de derechos/retención (2026-10-11). Políticas concretas por proyecto requieren configuración antes de activar.
- [ ] SDD spec + plan + tasks + checklist alineados; spec-index regenerado y CI terminal.
- [ ] P0 subida autenticada y coherencia de IDs (#870/#871) con CI/merge/smoke.
- [ ] Signed GET `enforce` y storage persistente, backup/restore y control por Org/recurso.
- [ ] Tests de seguridad, migración y E2E verdes.
- [ ] CI, merge, deploy y activación documentados por separado.
- [ ] Sólo marcar VERIFIED con evidencia de producción y recuperación histórica.
