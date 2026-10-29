---
type: plan
feature: "FreeProject archived history and restore S1"
domain: "labor"
spec: "docs/specs/labor/free-project-archive-restore.spec.md"
version: "2.0"
status: "DRAFT"
branch: "fix/labor-s1-archive-restore"
date: "2026-10-25"
---

# Plan técnico S1 — Restauración

**DRAFT; el código no está autorizado.** Contrato principal: free-project-archive-restore.spec.md. Solape que se excluye: PR #1036 (export/cursor) y #1039 (CSV).

## 1. Snapshot
- Leer HEAD de main y SHA Railway API/Web antes del primer cambio de implementación.
- S0 #937 fusionado, guard createdBy de lectura/mutación y AuditLog transaccional.
- El repo actual excluye archived del listado y resolveEntryProject pierde etiqueta. No hay ruta restaurar GET detalle.
- Railway online no demuestra funcionamiento S1; sin datos productivos tocados.

## 2. Constitución
- [ ] Owner aprueba D1–D6, spec pasa a APPROVED.
- [x] Tenant+owner recursos, políticas de privacidad, TimeEntry inmutable.
- [x] No Payment Governance ni escrow.
- [x] Audit-only registrado en catálogo antes del código.
- [x] Tests antes de implementación; CI al final.

## 3. Arquitectura
- Authority: LaborEngineRepository en Prisma FreeProject.
- Proyección: owner-only include archived y GET/:id. El backend selecciona tenantId+createdBy, no toma esos valores del cliente.
- CAS archived -> estado de D1 con AuditLog misma transacción, reutilizar patrón S0.
- Servicio/controller con validación de status enum y rutas declaradas en SEMSE_API_SURFACE_V1.
- Web: tab Proyectos, detalles y Restore; Registros/Resumen/Reportes toman una lista owner-only que incluye archivados; Timer selector conserva lista activa.
- Mobile: contrato común y pruebas, no presumir habilitado sin validación.
- No agente/worker/outbox. EventCatalog audit-only.

## 4. Datos
Ninguna migración prevista; comprobar campos Prisma. No cambia TimeEntry, convertedJobId ni archivo Evidence. Revert sólo S1; nunca desproteger S0. No crear segunda fuente de horas.

## 5. Seguridad
- GET/list con field-ops:read; Restore con field-ops:write.
- 404 owner ajeno/inexistente (mismo tenant incluido).
- No OPS_ADMIN override por FreeProject personal.
- Revalidate acceso al Job en consumidores, convertido no da permiso.
- Audit sin nombres, coordenadas, direcciones, PII.
- Revocación de membership/session no genera bypass.

## 6. CAS/eventos
- Una transición archived real y un audit atómico.
- Si AuditLog falla, rollback de estado.
- Repetición confirmada por backend no duplica estado ni audit.
- Sin bus nuevo; no cambiar reglas monetarias.

## 7. Fases
A: aprobar SDD, tests rojos A1–A12, fixtures owner A/B mismo tenant y otro tenant.
B: Backend owner-only list/detail/restore, audit CAS.
C: Web tabs archivados/detalle, histórico en Registros/Resumen/Reportes, ES/EN y accesibilidad.
D: integración real PG, regresión S0, typecheck/lint/spec:index; coordinar merge con #1036/#1039.
E: CI último y revisión seguridad, merge sólo aprobado.
F: Deploy autorizado API→Web, smoke sintético aislado y reporte con evidencias separadas.

## 8. Riesgos
| Riesgo | Mitigación |
| --- | --- |
| Usuario B consulta archive A | Pruebas HTTP y consultas scoped |
| Restaurar converted como active | Resolver por D1 y tests |
| Dos restores a la vez | CAS + auditoría atómica |
| Reporte marca total incompleto | F1A y advertencia alcance |
| UI vieja y API nueva | Contrato aditivo y feature surfaced tras API |
| Rollback revierte S0 | Revert sólo S1, no guard |

## 9. Gate final
- [ ] Contratos cerrados con owner
- [ ] Tests negativos y de concurrencia
- [ ] No solapamiento con PR draft concurrentes
- [ ] Rollback/compatibilidad y smoke en dos perfiles
- [ ] CI al final, aprobación antes de fusionar
- [ ] Documentación en docs/reportes al concluir