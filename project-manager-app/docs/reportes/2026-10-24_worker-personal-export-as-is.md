# SEMSE — Auditoría AS-IS de exportación personal (F1, solo lectura)

**Fecha:** 2026-10-24  
**Estado:** INVENTARIO / NO TESTED RUNTIME / NO IMPLEMENTACIÓN  
**Programa:** `labor.worker-independence-growth-program` (DRAFT)  
**Autoridad relacionada:** EPIC [#935](https://github.com/Semse-projet/project-manager-app/issues/935), slice S1 de archivo/restauración/historial íntegro, y `docs/reportes/2026-10-15_time-tracker-aaaa-claude-codex-handoff.md`.

## 1. Alcance de la lectura

Código de `main` @ `06dfd7bd34edf09e860f807015d004d341e503a5`, sin consultar datos de usuarios ni producción:

- `apps/api/src/modules/labor-engine/labor-engine.controller.ts`: `GET /v1/labor/entries`, `GET/POST /v1/labor/free-projects`, start/manual.
- `apps/api/src/modules/labor-engine/labor-engine.service.ts`: `listEntries`, `assertOwnership`, idempotencia.
- `apps/api/src/modules/labor-engine/labor-engine.repository.ts`: `listTimeEntries`, `take`, `skip`, `createdBy`.
- `apps/web/app/(app)/labor-api.ts`: `fetchLaborEntries`.
- `apps/web/app/(app)/worker/tracker/sections/RegistrosTab.tsx`, `ReportesTab.tsx`, `trackerUi.tsx`: descarga CSV.
- Contratos `labor.engine-remediation`, `labor.free-project-mutation-guard`, ADR-029.

No se ejecutó CI, tests, SQL ni smoke autenticado; los hallazgos son trazado estático del código.

## 2. Hallazgos verificables

| ID | Hallazgo en código | Consecuencia / riesgo | Acción de alcance mínimo |
|---|---|---|---|
| F1-H01 | `RegistrosTab.loadEntries` solicita `fetchLaborEntries({range, limit: 500})`, incluso cuando `range === 'all'`. `ReportesTab` también solicita hasta 500 por semana. | La opción **Todo el historial** y su CSV pueden quedar truncados sin advertencia. | Paginar exhaustivamente con total/nextCursor y estado de exportación; no confundir 500 cargados con histórico íntegro. |
| F1-H02 | `GET /v1/labor/entries` solo admite `range, jobId, freeProjectId, purpose, limit, weekOffset`; no `cursor`/`offset`. `LaborEngineRepository.listTimeEntries` sí acepta `offset` internamente pero controlador/servicio no lo exponen. | No existe protocolo público estable para recorrer el historial total por páginas. | Especificar paginación segura, orden estable (`startedAt,id`) y tests con cambios concurrentes; no exponer acceso multiusuario. |
| F1-H03 | `trackerUi.exportEntriesCsv` serializa **solo el arreglo recibido del frontend**. | El CSV es copia de vista, **no backup fiable** ni exportación completa verificada. | Distinguir CSV de vista y exportación integral autorizada, con procedencia, conteos y controles de integridad. |
| F1-H04 | `RegistrosTab` concatena entradas de `trackerLocalStore` todavía pendientes de sincronizar; el CSV actual no incorpora columna `status` ni `syncState`. | Un tercero podría interpretar como confirmadas entradas no persistidas. | Etiquetar `pending_sync` explícitamente, excluirlo de constancias verificadas y documentar sincronización. |
| F1-H05 | CSV presenta `startedAt`/ `endedAt` como ISO y usa `startedAt.slice(0,10)` como fecha; no declara zona horaria ni política de DST. | Interpretación ambigua en turnos nocturnos y reportes legales. | Metadatos de zona, semántica de fecha local y tests de DST; conservar UTC original. |
| F1-H06 | La función CSV escapa comillas y envuelve celdas entre comillas, pero no neutraliza fórmulas de hoja de cálculo en campos libres (proyecto, ubicación, notas) que comiencen con `=`, `+`, `-`, `@`. | Riesgo de **CSV/formula injection** al abrir en aplicaciones de hojas de cálculo. | Criterio de exportación con neutralización segura y pruebas; no depender solo de comillas. |
| F1-H07 | El handoff S1 anterior ya pide archivados/restauración, paginación y conciliación CSV ↔ API; no hay razón para un segundo sistema. | PR duplicados y divergencia de autoridad en Time Tracker. | Coordinar F1 con #935/S1, preservar ownership por `createdBy`. |

## 3. Qué SÍ existe

1. `GET /v1/labor/entries` usa `createdBy` del actor autenticado, no lo recibe del query.
2. `listTimeEntries` filtra `tenantId` + `createdBy` y puede ordenar/filtrar por rango.
3. `startTimer` y entrada manual tienen `clientEventId` para retries; `assertOwnership` verifica FreeProject o Job asignado.
4. `RegistrosTab` permite filtrar fecha, propósito y proyecto y descargar su selección a CSV.
5. S1 de #935 ya documenta la necesidad de no ocultar históricos archivados y reconciliar cantidades.

Estos elementos no demuestran todavía seguridad completa ni que la exportación sea exhaustiva: requieren pruebas autenticadas contra dos usuarios del mismo tenant y otro tenant.

## 4. Contrato mínimo sugerido para futuro F1 `labor.personal-record-export` (NO aprobado)

- Exportación creada por **el propio User**; no endpoint para exportar datos personales de otra persona por ID.
- Primera iteración: datos de `TimeEntry` y `FreeProject` propios, con paginación completa, filtrado por `createdBy`, límite de tamaño, zona horaria, revisiones y procedencia.
- CSV de vista y exportación integral son productos diferentes; ambos revelan origen `server_confirmed` vs `pending_local`.
- Campos sensibles (GPS, notas, medias, horas de otras personas, tarifas organizacionales) requieren política explícita; no se incluyen por defecto.
- Descarga/exportación auditable, con expiración, idempotencia, límites de uso y prevención de formula injection.
- Histórico exportado verificable por conteo, hashes/cadena de procedencia donde proceda, sin prometer valor jurídico de una firma electrónica.
- No modificar `TimeEntry`, `createdBy` ni la política BO-05/BO-08/BO-12.

## 5. Matriz de pruebas propuesta (pendiente)

| Escenario | Esperado |
|---|---|
| Usuario A mismo tenant que B | A exporta solo lo propio; IDs de B nunca aparecen |
| Otra organización/tenant C | 404/403 neutro; sin datos |
| Más de 500 entradas, varias páginas | Conteo y contenido completos, sin duplicados/faltantes |
| Mismo instante de inicio para dos registros | Orden determinista mediante segundo criterio |
| Un registro `pending_sync` | CSV lo identifica, no lo certifica |
| Proyecto archivado y con histórico | Historia preservada, label resuelto correctamente |
| Notas con `=HYPERLINK(...)` | CSV neutraliza fórmula al abrir en spreadsheet |
| Nocturno/DST | Zona y UTC visibles; fecha local correcta |
| Suspensión de afiliación a Org | Historial personal permanece disponible según permisos |
| Exportación mientras ingresa tiempo nuevo | Snapshot/corte documentado, no se afirma total global sin criterio |

## 6. Decisión operacional

**NO iniciar implementación por este informe.** Incorporar este inventario como referencia en EPIC #935 (S1) y en la futura spec F1, con revisión independiente y sin despliegues. Distinguir defectos observados en código de explotación o pérdida de datos demostrada.

**CI de último**, después de contrato aprobado, revisión, tests negativos y cambios pequeños y reversibles.
