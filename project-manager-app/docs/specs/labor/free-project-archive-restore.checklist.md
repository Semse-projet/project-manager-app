---
type: checklist
feature: "FreeProject archive/restore S1"
spec: "docs/specs/labor/free-project-archive-restore.spec.md"
version: "2.0"
date: "2026-10-25"
---

# Checklist S1 — Archivados y restauración

## Requisitos
- [x] Scope definido y fuera de alcance F1A CSV S2.
- [x] API, UI, owner, auditoría y 12 casos verificables documentados.
- [ ] Decisiones S1-D1–D6 aprobadas; spec APPROVED.
- [ ] Documentación de API y EventCatalog coherentes con implementación.

## Seguridad
- [ ] List, GET y Restore backend scoped por tenantId + createdBy.
- [ ] 404 entre usuarios misma org/tenant; 401/403 según permiso.
- [ ] No override de OPS_ADMIN para FreeProject ajeno.
- [ ] convertedJobId histórico no concede acceso a Job.
- [ ] Logs/audit sin PII, direcciones ni coordenadas.

## Datos y eventos
- [ ] CAS + AuditLog de restore en misma transacción.
- [ ] Reintentos idempotentes; no doble auditoría.
- [ ] TimeEntry intacto; status legal; sin cambios Payment/Evidence.
- [x] No migración prevista; verificar schema antes de implementación.
- [ ] Rollback nunca revierte S0.

## Entrega
- [ ] Tests rojos → verdes y PG real, no sólo mocks.
- [ ] ES/EN, móvil si aplica, offline, accesibilidad.
- [ ] No afirmar exactitud de un CSV limitado a 500 filas.
- [ ] CI al final tras tests locales y código, revisión de seguridad.
- [ ] Merge, deploy, activation, UAT registrados independientemente.
- [ ] Reporte docs/reportes y enlaces #933/#935.
- [ ] No declarar S1 VERIFIED antes de smoke auténtico.