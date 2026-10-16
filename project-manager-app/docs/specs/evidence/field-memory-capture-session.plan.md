---
type: plan
feature: "field-memory-capture-session"
domain: "evidence"
spec: "docs/specs/evidence/field-memory-capture-session.spec.md"
version: "2.0"
status: "APPROVED"
branch: "feat/field-memory-capture-session"
date: "2026-10-11"
---

# Plan técnico: CaptureSession CAP-0

> Plan de implementación autorizado por el propietario en cuanto a contrato CAP-0; los bloqueos de seguridad y los tests siguen siendo prerequisitos estrictos para introducir tablas o activar servicios.

## 1. Snapshot
- Main inspeccionado al iniciar este plan: `432a9e39488ebe818ac29d975b0c08d18f8ba907` (verificar otra vez antes del PR de implementación).
- Railway Web/API/Worker previamente observado en SUCCESS sobre `432a9e39488ebe818ac29d975b0c08d18f8ba907`; no inferir E2E funcional de un status de contenedor.
- Visor #868 y capturas Field Evidence #869 fusionados; #870/#871 con CI parcialmente pendiente en esta revisión.
- `UPLOADS_SIGNED_GET_MODE` no está configurado en API Railway según auditoría de variables de esta sesión: default `off`; persistencia local con volumen requiere verificación de mount y restauración.
- Migración CaptureSession: **no existente**; estado PENDING, cero SQL aplicado.

## 2. Constitución y autoridad

Decisión arquitectura: sesiones/citas a originales permanecen en `apps/api/src/modules/evidence/`, alineadas con `docs/architecture/ADR-028-evidence-gateway-adapter-role.md`; eventos atómicos siguen `docs/architecture/ADR-022-transactional-outbox-bullmq.md`. No crear una frontera nueva ni ADR numerado ambiguo.
Permisos/revisión/retención: defaults aprobados en §2.1 de la spec, sujetos a una `rightsPolicyRef` por obra, legal hold y no publicación sin política verificable.

- Solo Evidence posee originales, estados de revisión y custodia; `CaptureSession` posee grupo/manifiesto.
- Antes de schema o API: spec `APPROVED`, límites P0 #870/#871, contrato de autorización cliente/pro por org, acceso firmado y verificación storage.
- Backend resuelve `projectId/jobId`, tenant y org, no confía en IDs ocultos de UI ni `metadata.fieldCapture` como fuente de autorización.
- Identidad de usuario basada en sesión autenticada; no exponer keys en client logs o preview públicos.

## 3. Migración incremental
1. Crear tests unitarios/contract red: scope, mismas/diferentes orgs, revocación, duplicados, no registros por PUT fallido.
2. Crear schema Zod `CreateFieldCaptureSession`/`AttachOriginalEvidence` y FSM.
3. Agregar Prisma `FieldCaptureSession`, `FieldCaptureEvidenceRef` con FK/unique/index e invariantes tenant/project; migración aditiva y test Postgres real.
4. Implementar repositorio/servicio sobre políticas de Evidence; outbox atómico/trace.
5. API controladores + BFF autenticada sin fallback a OPS_ADMIN estático; paginación.
6. UI CAP-1 para crear sesión, capturar con foto original por upload canónico, vincular fuente, mostrar estados error/progreso.
7. Build/TypeScript/test/spec:strict/coverage, PR y CI, reconciliar SHA y migraciones.
8. Canary interno allowlist y signed access; pruebas con dos orgs y dos tenants, verificar replay y backup, rollback por flag.

## 4. Contratos/eventos
- `POST /v1/projects/:projectId/capture-sessions`, `POST /v1/capture-sessions/:id/evidence`, `POST /v1/capture-sessions/:id/submit` y GET paginados.
- Outbox: created/evidence-linked/submitted por acción y versión, unique `(tenantId,idempotencyKey)` por comando; rechazo 409 ante colisión con payload diferente.
- No entrega de signed URL hasta que actor pase Evidence policy + rights policy; revalidar en cada GET.

## 5. Datos y rollback
- Primero tabla aditiva sin backfill; Feature Flag off; CAP-1 no convierte anotaciones antiguas automáticamente.
- SQL Prisma forward-only; validar idempotencia y FK con dos organizaciones simultáneas.
- Ante fallo: apagar flag; mantener blobs originales y tablas/eventos, no borrar datos; forward-fix para migraciones ejecutadas.

## 6. Riesgos y gates
| Riesgo | Impacto | Mitigación |
|---|---|---|
| GET público sin signed mode | Crítico, imágenes filtrables por URL conocida | `shadow → enforce` y firma con TTL antes de publicar |
| PUT dentro tenant pero en Org ajena | Alto, sobrescritura lateral | Cargar solo con capacidad de recurso/nonce; pruebas cross-org |
| IDs project/job/milestone contradictorios | Alto, asociación cruzada | Contrato estricto y negativa antes del insert |
| Uso de FS efímero/backup incompleto | Alto, originales desaparecen | Volumen/persistencia/backup/restore verificados |
| Fecha/posición declaradas tratadas como medición | Alto, seguridad de obra | Estados CLAIMED y avisos sin habilitar perforación |

## 7. Investigación externa
Completadas tres comprobaciones primarias en la spec §11 (OWASP File Upload, Prisma Migrate, COLMAP), con decisiones aplicado/backlog/descartado. Investigaciones posteriores para drivers S3/GPU se resolverán en PRs de implementación. Fuentes internas contrastadas en la especificación.

## 8. Gates de salida
- [x] Propietario aprueba decisiones conservadoras de derechos/revisión/retención en [registro PR #872](https://github.com/Semse-projet/project-manager-app/pull/872#issuecomment-6114318002); la política concreta de cada obra sigue siendo gate previo a activar
- [ ] Riesgos de lectura/escritura mitigados con e2e real
- [ ] Tests antes del código y permisos revisados
- [ ] Migración aditiva/rollback probado
- [ ] CI, merge, deploy y activación tienen cada uno evidencia

## 9. Seguridad y política
- Scope: tenant+Org+Project+Job canónico validado por Evidence; lectura con rightsPolicyRef y membership vigente en cada request.
- Riesgo archivo: original write-once, no exposición por URL pública; tratar imágenes de trabajadores como privacyCritical.
- Aprobación: [constancia del propietario 2026-10-11](https://github.com/Semse-projet/project-manager-app/pull/872#issuecomment-6114318002). La aprobación de contrato no es permiso para abrir el flujo al público.

## 10. Eventos, idempotencia y reconstrucción
- Eventos: `capture_session.created.v1`, `capture_session.evidence_linked.v1`, `capture_session.submitted.v1`; aggregateType: `capture_session`.
- Transactional outbox según ADR-022; repetir comando idéntico (incluso submit ya ejecutado) retorna respuesta previa.
- Retry con otro payload o acción imposible: 409; reconstrucción 3D derivada fuera de CAP-1.

## 11. Estrategia de implementación SDD A–F
- **A — Tests y contratos:** tests rojos, esquemas Zod, permisos y fixtures cross-org.
- **B — Datos y dominio:** migración aditiva/Prisma, transacciones outbox y repositorios dentro de Evidence.
- **C — API/BFF/UI:** endpoints con permisos, BFF sin static-identity fallback, estados UX.
- **D — Validación:** unit, DB integration, E2E, typecheck, lint, spec:validate:strict.
- **E — Integración:** CI terminal y revisión PR, merge SHA y migración controlada.
- **F — Producción:** flag off → canary interno, revisión de backed-up originals, smoke autenticado, rollback y evidencia.


## 12. T-008 — StorageWriteGate / quiescencia verificable (contrato de implementación, 2026-10-15)

**Trazabilidad:** issue #954, task T-008, spec CAP-0 aprobada. Esta sección detalla cómo implementar la barrera necesaria para un respaldo coherente; **no constituye evidencia de ejecución, freeze, exportación ni activación de CAP-1**. Riesgo P0: no desplegar sin revisar el análisis de concurrencia.

### 12.1 Fuentes reales y frontera

- \`StorageService.store()\`: streaming a \`multipart/.put-staging\`, \`fsync\`, publicación \`link()\`; \`delete()\`: \`unlink()\`; \`putUploadPlan()\` emite una intención, no un derecho irrevocable de escribir.
- \`UploadsController\`: plan y \`PUT /v1/uploads/files/*\`; la autorización tenant precede al stream. La barrera deberá aplicarse **además** del permiso existente.
- \`EvidenceController\`: plan, \`createMultipartSessionEndpoint\`, \`uploadMultipartPart\`, \`completeMultipartSession\`; escribe en \`SEMSE_MULTIPART_STORAGE_ROOT\` (default \`/tmp/semse-multipart-sessions\`) y publica originales vía \`StorageService\`.
- \`BrowserAgentService.saveAsEvidence()\`: escribe PNG/JSON antes de registrar Evidence; cubrir también la fase de registro y fallos intermedios.
- \`Evidence\` / Postgres: \`register\`, vínculos, archivado/retención y cualquier escritura de referencia que afecte el snapshot deben coordinarse o demostrarse excluidos de la ventana.
- Verificar exhaustivamente mounts, cron, operaciones operator/SSH, worker y todas las llamadas a filesystem fuera de \`StorageService\` antes de certificar cierre del perímetro. Un grep inicial no es prueba suficiente.

### 12.2 Coordinación duradera y estados

**Autoridad primaria propuesta: PostgreSQL** (no un mapa local ni Redis como única verdad), con tablas aditivas \`StorageWriteGate\` y \`StorageWriteOperation\`/journal auditado. Los nombres exactos y constraints se revisan al diseñar la migración. Identificar por entorno + storage root canónico; no usar un flag global sin scope.

- \`OPEN\`: permite admisiones **atómicas** con la lectura del estado duradero, crea un registro de operación \`ACTIVE\` y un token único antes del primer byte. Si PostgreSQL/autoridad no responde, rechaza la admisión (fail closed).
- \`DRAINING\`: transición transaccional con row lock/version; rechaza nuevas admisiones/planes y completions sin ticket previo; espera \`ACTIVE=0\` y registros Evidence iniciados. No confundir \`idle\` con terminado.
- \`FROZEN\`: solo cuando el conjunto de writers probado declara cero operaciones activas y cada versión de código en servicio aplica el gate; no puede publicarse \`link\`, eliminarse \`unlink\`, escribir una parte multipart ni registrar nuevas referencias durante el checkpoint. Si algún writer no instrumentado, lease desconocida o crash ambiguo: \`BLOCKED\`, no \`FROZEN\`.
- \`OPEN\` posterior: solo transición de thaw autorizada, auditada e idempotente tras inventario/export/reconciliación; no auto-reabrir por reinicio, timeout, caída de Redis/DB ni deployment.

**Invariante:** la admisión y \`DRAINING\` se serializan mediante el mismo bloqueo transaccional de estado, por lo que ninguna admisión puede cruzar el cambio a \`DRAINING\`. Una operación admitida no libera su marca \`ACTIVE\` hasta terminar la publicación/eliminación, metadatos relevantes y limpieza controlada. Procesos reiniciados dejan operaciones ambiguas bloqueantes; solo un procedimiento de recuperación con prueba de que el escritor ya no puede ejecutar puede descartarlas. **Prohibido limpiar lease caducada solo por reloj**: un zombie podría publicar después del freeze.

El cambio de versión durante \`DRAINING/FROZEN\` se bloquea o falla cerrado; desplegar una réplica legacy sin enforcement invalida la prueba. Debe existir validación de writer inventory/provenance de réplicas. El gate protege escritura de originales y consistencia de referencias; no sustituye las políticas existentes tenant/org.

### 12.3 Operaciones administrativas y auditoría

API interna/operador para consultar estado sin PII (actor autenticado con privilegio OPS operativo efectivo). \`begin-drain\`, \`freeze-check\`, \`thaw\` exigen autorización fuerte, motivo/ticket, idempotency key, expiración de solicitud **sin auto-thaw**, auditoría persistente + evento; decisiones revalidadas en backend. No introducir endpoint público para cambiar el estado. No divulgar claves/rutas privadas, originales ni manifiestos en logs. Evitar degradar el healthcheck de lectura innecesariamente; las operaciones de escritura rechazadas responden error explícito recuperable (\`503\` + \`Retry-After\`) sin perder reintentos.

### 12.4 Snapshot coherente y Evidence

La barrera debe incluir **nuevos originales y mutaciones de referencias Evidence** en la misma ventana. Tras \`FROZEN\`, tomar inventario SHA-256 del origen y una proyección DB desde transacción de lectura consistente con timestamp/cursor verificable. Como registro y PUT son operaciones HTTP distintas, los huérfanos anteriores se clasifican sin borrar nada; la coincidencia de dos inventarios de archivos sola **no certifica** consistencia DB. Capturar alcance completo autorizado, incluyendo operaciones en staging que permanezcan pendientes (bloqueo, no borrado automático). Prohibido exponer proyección privada en CI/GitHub.

### 12.5 Rollout por etapas y retroceso

1. **S0 — Documentación y diseño:** esta adición y matriz de aceptación sin runtime/migraciones, PR draft; sin afirmar \`implemented\`.
2. **S1 — Tests primero:** casos de carrera, doble proceso, muerte de proceso, DB caída, admisión atómica, publish tardío, multipart, borrado, Evidence, tenancy, rollback, versión no instrumentada. Fixtures sintéticos, DB aislada.
3. **S2 — Motor/fencing + migración aditiva:** no activar freeze. Separar código interno y permisos de administración; migración observada sin tocar archivos existentes. Inicializar \`OPEN\` solo por procedimiento de migración verificado (jamás por catch/fallback ante DB caída).
4. **S3 — Enforcements:** \`StorageService\`, controlador multipart, Browser Agent, Evidence register/mutaciones. Fallar cerrado cuando gate habilitado y autoridad indisponible; modo de observación sin bloqueo no permite \`FROZEN\`.
5. **S4 — Prueba staging:** al menos dos procesos; validar \`OPEN → DRAINING → FROZEN → OPEN\`, archivos sintéticos, fallos durante stream, reinicio, freeze impedido por operaciones ambiguas, restauración aislada y correlación DB.
6. **S5 — PR/CI/release:** CI del SHA exacto, lint/typecheck, pruebas unit/integration/e2e, \`spec:validate:strict\`, revisión security, merge y despliegue Railway desde main. Comprobar SHA, migración, flags, logs/metrics, ninguna instancia legacy, y canary auténtico antes de ventana productiva.
7. **S6 — Custodia real:** ventana aprobada, backup nativo identificado sin pulsar Restore sobre producción, copia cifrada D: con clave de recuperación externa protegida, inventarios antes/después, ensayo aislado, SHA-256 y reconciliación Evidence/Postgres. Solo informes agregados al repositorio.

**Rollback:** despliegue puede volver a modo normal únicamente si no hay freeze ni operaciones activas y no reabre vulnerabilidades previas; esquema se conserva (forward-fix). Nunca hacer rollback a binario sin gate con estado \`DRAINING/FROZEN\`. Si falla la autoridad, bloquear escritura y restaurar el servicio, no improvisar \`OPEN\`.

### 12.6 Bloqueos que impiden declarar VERIFIED

- [ ] Evidencia de escritura y lectura de todas las instancias productivas bajo el gate.
- [ ] Pruebas reales de \`FROZEN\` con cero writers, incluido Evidence + multipart, canary sintético y auditoría.
- [ ] Inventarios remotos reales + exportación cifrada + ensayo aislado \`OFFSITE_RESTORE_PASS\`.
- [ ] Consistencia de Postgres/Evidence acreditada para el mismo punto lógico.
- [ ] Backups nativos Railway identificados y capacidad de recuperación probada **sin restaurar sobre producción**.
- [ ] SHA exacto de merge/deploy, smoke autorizado, runbook de thaw y registro de cierre.

**No equivalencias:** \`CI PASS\` ≠ deploy; \`Railway SUCCESS\` ≠ prueba de freeze; \`OFFSITE_RESTORE_PASS\` ≠ recuperación nativa ni CAP-1 VERIFIED.
