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
Pendiente triple comprobación de fuentes primarias antes de estado APPROVED. Fuentes internas contrastadas en la especificación.

## 8. Gates de salida
- [ ] Propietario aprueba decisiones sensibles, derechos y retención
- [ ] Riesgos de lectura/escritura mitigados con e2e real
- [ ] Tests antes del código y permisos revisados
- [ ] Migración aditiva/rollback probado
- [ ] CI, merge, deploy y activación tienen cada uno evidencia
