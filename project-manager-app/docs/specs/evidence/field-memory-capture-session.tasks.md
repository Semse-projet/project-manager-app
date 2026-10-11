---
type: tasks
feature: "field-memory-capture-session"
domain: "evidence"
plan: "docs/specs/evidence/field-memory-capture-session.plan.md"
version: "2.0"
status: "PENDING"
branch: "feat/field-memory-capture-session"
date: "2026-10-11"
---

# Tasks: CaptureSession CAP-0 / CAP-1

## Fase 0 — Gobierno y permisos
- [x] T-001 Aprobación del contrato CAP-0 y definición de derechos por defecto (2026-10-11); investigación de OWASP, Prisma y COLMAP registrada.
- [ ] T-002 Completar estado final PR #870/#871, smoke de dos orgs y verificar sin drift.
- [ ] T-003 Verificar modo de signed GET, secreto, retención y restauración de volúmenes; rollout shadow/enforce de spec ya APPROVED.
- [ ] T-004 Reconciliar Evidence policy con usuario supervisor, cliente, pro y organización no asignada.
- [ ] T-005 Registrar decisiones abiertas en checklist y revisar SPEC_INDEX.

## Fase 1 — Tests y contratos
- [ ] T-010 Tests rojos para actor externo/misma tenant otra Org/revocación/IDs contradictorios.
- [ ] T-011 Tests rojos para sesión sin fotos, attach a otro proyecto, Evidence sin bytes y firma caducada.
- [ ] T-012 Tests idempotencia/reintento y respuesta 409 sin duplicar outbox.
- [ ] T-013 Contratos Zod + Event Catalog y provenance/hashes sin datos inventados.

## Fase 2 — Datos y API
- [ ] T-020 Prisma schema aditivo + migración forward only / índices / FK.
- [ ] T-021 Postgres real: atomicidad, concurrencia, tenant y actor permissions.
- [ ] T-022 Servicio/repository CAP-1 con `EvidenceRepository` dueño de fuente.
- [ ] T-023 API/BFF autenticada y paginada, auditoría, pruebas HTTP contra bearer real.
- [ ] T-024 Outbox eventos create/attach/submit con correlation y replay seguros.

## Fase 3 — UI/móvil
- [ ] T-030 Reutilizar Workspace y worker/evidence con contexto visible.
- [ ] T-031 Subir bytes primero → registrar Evidence → attach sesión, con errores visibles.
- [ ] T-032 Ver fotografías originales solo con autorización/URL corta.
- [ ] T-033 Manejar sin imágenes, off-line, reintentos, errores y revocaciones.

## Fase 4 — Release y verificación
- [ ] T-040 Code/test/typecheck/lint/spec:validate:strict y spec:index.
- [ ] T-041 CI y revisión de seguridad → merge SHA.
- [ ] T-042 Deploy migración y services, flag OFF.
- [ ] T-043 Canary interno autentificado con dos organizaciones, sin fugas.
- [ ] T-044 Restauración probada de originales, métricas y rollback.
- [ ] T-045 Actualizar `production_evidence`, flags, estados y reportes; NO marcar VERIFIED antes de validarlo.
