---
type: tasks
feature: "personal-record-export"
domain: "labor"
plan: "docs/specs/labor/personal-record-export.plan.md"
version: "2.0"
status: "PENDING"
branch: "docs/labor-personal-record-export-f1-20261024"
date: "2026-10-24"
---

# Backlog F1 — Exportación íntegra y continuidad

> Alcance de este PR: **documentación**. Tests, cambios API y producción **NO ejecutados**. El código requiere aprobación separada de F1A; F1B requiere ADR específico de Identity.

## Gate de verdad y coordinación

- [x] F1-001: identificar la exportación CSV actual y `limit:500` de Registros/Reportes en main.
- [x] F1-002: confirmar filtro `TimeEntry.createdBy`, `tenantId` y obligatoriedad `orgId` del modelo.
- [x] F1-003: registrar `#935` y `#933` como dueños de S1 para evitar duplicaciones.
- [x] F1-004: documentar `pending_sync` no incluido como estado en CSV y formula injection potencial.
- [ ] F1-005: verificar API existente de exportación de producto completa vs CSV vista, y repositorios/móviles fuera del alcance estático.
- [ ] F1-006: ratificación explícita de F1A, matriz permisos y D01..D08 por owner/Security/Privacy.
- [ ] F1-007: decidir cursor/streaming/job (una sola fuente) y snapshot consistente.
- [ ] F1-008: acordar con #933/S1 si se amplía ese slice o se evita colisión.
- [ ] F1-009: registrar ADR y validación de F1B (sin Org + cross-tenant), **bloqueante para prometer continuidad completa**.

## Pruebas rojas ANTES de código

- [ ] F1-101: A vs B mismo tenant; A vs C otro tenant; sin `createdBy`/tenantId controlable.
- [ ] F1-102: cuenta individual sin patrón en SEMSE, con y sin Membership, y revocación.
- [ ] F1-103: 1,201 entradas, tiempos idénticos y duplicaciones; no truncar 500.
- [ ] F1-104: entrada nueva durante export; snapshot/consistencia/conteo.
- [ ] F1-105: archived FreeProject y nombre histórico seguro.
- [ ] F1-106: pending sync vs persisted, reintento con `clientEventId`.
- [ ] F1-107: CSV formula injection en campos libres con espacios/tabs/Unicode/comillas.
- [ ] F1-108: nocturno/DST con zona IANA, milisegundos y descansos exactos.

## Implementación si F1A APPROVED

- [ ] F1-201: DTO/schemas backend explícitos con validación de fechas/timezone.
- [ ] F1-202: fuente canónica `LaborEngineRepository`, orden estable, paginación y policy personal.
- [ ] F1-203: proyección para nombres de FreeProject archivado (#933) sin divulgar terceros.
- [ ] F1-204: API de export única elegida, streaming limitado o job controlado; no dos mecanismos.
- [ ] F1-205: CSV text-safe, metadatos `syncStatus`, `exportedAt`, `timezone`, conteos e integridad.
- [ ] F1-206: BFF y frontend sin mezclar vistas locales con exportación integral de servidor.
- [ ] F1-207: UI ES/EN y mobile; conservar pestañas/reloj y no inventar permisos de supervisor.
- [ ] F1-208: auditoría catalogada y límites de uso; sin PII en logs.
- [ ] F1-209: migración aditiva solo si indices requeridos; prueba y rollback documentados.

## Gates de revisión, prueba y CI al final

- [ ] F1-301: code review técnico contra ADR-029 y #933.
- [ ] F1-302: security review cross-tenant y CSV injection.
- [ ] F1-303: UAT en staging sintético, casos A/B/C, ES/EN, offline, >500 y DST.
- [ ] F1-304: rollback seguro y recuperación de descargas temporales.
- [ ] F1-305: `pnpm spec:index`, `pnpm spec:validate:strict`, pruebas targeted, regresión, lint/build/typecheck — **último**.
- [ ] F1-306: PR funcional terminal, CI con resultado verificado; merge/despliegue/activación solo autorizados separadamente.
