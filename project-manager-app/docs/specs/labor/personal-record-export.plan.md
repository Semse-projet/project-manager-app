---
type: plan
feature: "personal-record-export"
domain: "labor"
spec: "docs/specs/labor/personal-record-export.spec.md"
version: "2.0"
status: "DRAFT"
branch: "docs/labor-personal-record-export-f1-20261024"
date: "2026-10-24"
---

# Plan técnico — F1A Exportación exhaustiva del registro personal

> **DRAFT, no ejecutar código.** Programa general en PR #1035. Este plan propone F1A menor, dejando F1B (continuidad cross-tenant/Org) bloqueado por decisión formal de Identity/Security. Debe coordinarse con #933 S1 para que exista **un solo** sistema de paginación/exportación de TimeEntry.

## 1. Snapshot comprobado (lectura de main 2026-10-24)

- `RegistrosTab.tsx` y `ReportesTab.tsx`: `fetchLaborEntries(... limit:500)`; CSV cliente sobre filas cargadas.
- `labor-engine.controller.ts`: GET entries usa `tenantId` y `createdBy` del actor de sesión, no permite `cursor`/`offset`.
- `labor-engine.repository.ts`: `listTimeEntries` ya tiene `offset` interno, ordena solo por `startedAt DESC`, filtra `createdBy`. `listFreeProjects` excluye `archived`.
- `TimeEntry`: `tenantId`, `orgId`, `createdBy` obligatorios. Una User global no demuestra una ruta de lectura histórica entre tenants.
- `trackerUi.tsx`: `exportEntriesCsv` no guarda `status`; comillas CSV no neutralizan formula injection.
- `labor.engine-remediation` y ADR-029 establecen propiedad personal, un único escritor, idempotencia.
- `#935` / `#933` abiertos. No se observó ejecución autenticada, DB de producción o estado de despliegue durante esta revisión.

**SHA de main para el inventario previo:** `06dfd7bd34edf09e860f807015d004d341e503a5`; reconfirmar antes del primer código. No inferir que doc status es runtime.

## 2. Constitución y decisiones

- [ ] SDD `APPROVED` expresamente para F1A; PR documental NO equivale a aprobación de producto/código.
- [ ] Aclarar si alguien sin Membership puede iniciar sesión, crear FreeProject personal y leer sus registros; no inventar un token cross-tenant.
- [ ] Definir qué sucede a `User` si Org X suspende membership o elige otra Org.
- [ ] Reutilizar la exportación de #933 o definir una sola proyección/endpoint canónico compartido.
- [ ] Retención/PII/GPS y derechos sobre nombres de clientes/obras revisados.
- [ ] Si hacen falta eventos de exportación, inventariar `EVENT_CATALOG` antes de agregarlos.

## 3. Autoridad y arquitectura

**Sin nuevos actores RBAC.** User autenticado + fila `TimeEntry.createdBy` + alcance del tenant fuente **realmente verificado**. Employer/supervisor no tiene acceso a `purpose=personal`. `OPS_ADMIN` no posee override implícito a FreeProject personal. No usar propiedad por coincidencia de emails, números telefónicos o nombres de compañía.

**Alternativas de exportación técnica a analizar:**

A. Extender GET `/v1/labor/entries` con cursor estable para lectura paginada, y construir CSV desde servidor con corte consistente.  
B. Nuevo `/v1/labor/entries/export` con streaming privado si dataset moderado.  
C. Job asíncrono con URL de descarga efímera si volumen/compliance requieren retención y límite de memoria.

**Decisión pendiente:** el slice debe escoger una vía compartida con #933/S1. No tener A+B+C en paralelo; ninguna ruta está aprobada aún.

**Consistencia:** `startedAt,id` como orden determinista; guardar corte y seleccionar un snapshot real transaccional si se promete “completo a fecha X”. Si se elige streaming sin snapshot transaccional, no afirmar total exacto durante mutaciones concurrentes: la spec deberá ajustarse. Tests A/B/cross-tenant antes de CI.

## 4. Diseño UX (reutilización)

- Conservar las seis pestañas del Time Tracker, colores, reloj y notas.
- Renombrar `CSV` actual como `CSV de resultados visibles (N)` si aplica truncamiento. No venderlo como "copia de seguridad".
- `Exportar historial completo` aparece solo cuando backend pueda producirlo sin truncamiento; estados sin acceso/pendiente/error.
- `pending_sync` separado de `persisted`, sin afirmaciones de servidor; si se generan CSV offline, se etiqueta cada fila claramente.
- Fecha local siempre con zona IANA explícita. CSV de Excel neutraliza `= + - @` y prefijos espacios/tabs/control, Unicode y saltos de línea probados.
- Proyectos archivados se resuelven con lookup por dueño y estado, sin filtrar solamente activos.

## 5. Implementación propuesta si se aprueba

**Fase A — tests rojos.** Fixtures sintéticas de A/B mismo tenant, C distinto, 1,201 TimeEntry incluyendo idéntico `startedAt`, notas con fórmula, pendientes, archivados y DST. Test de acceso tras suspensión que falla en lugar de saltar políticas.

**Fase B — servicio/repositorio.** Cambios mínimos en `LaborEngineRepository`, `LaborEngineService` y proyección de FreeProject; `TimeEntry` sigue canónico. No mutar datos al leer/exportar. Evitar N+1 de etiquetas y full-table scans con índices revisados.

**Fase C — API/BFF/UI.** Permiso de lectura individual, ruta/DTO acordados, respuestas/streaming con límite de tamaño, logging sin PII. BFF no acepta `createdBy` ni `tenantId` del cliente. UI ES/EN, móvil con paridad apropiada. Estado de exportación reconciliado.

**Fase D — revisión.** Seguridad (IDOR, CSV injection, datos privados, caché/descargas); privacidad (retención y medios); correctitud (snapshot, zonas, costos). Entorno staging con datos sintéticos.

**Fase E — CI último.** `pnpm spec:index`, `pnpm spec:validate:strict`, cobertura relevante, build y typecheck; tests e2e/móvil ES/EN, revisión terminal. PR funcional separado, no mezclar con #1035 ni ampliar #933 sin coordinación.

**Fase F — despliegue separado.** Canary con usuarios A/B/C sintéticos o autorizados, validación export >500, auditoría, fallos denegados, rollback/forward-fix. Sin merge, deployment ni activation automática.

## 6. Estrategia datos y rollback

- Preferir sin migración si el cursor está sustentado en índices. Si falta índice sobre `(tenantId,createdBy,startedAt,id)`, preparar migración **aditiva** con prueba real y checksum; `prisma db push` prohibido.
- Sin copia de registros ni cambios `createdBy` para conseguir portabilidad. No trasladar TimeEntry entre tenants por inferencia.
- Rollback = retirar export nuevo/flag y conservar endpoint/listado existente y registros; revocar enlaces descargables efímeros.
- F1B requerirá ADR y spec de transición de identidad/acceso histórico, con pruebas de no exposición de datos a nueva empresa. **No incluido** aquí.

## 7. Riesgos

| Riesgo | Severidad | Control |
|---|---|---|
| Exportar datos ajenos del mismo tenant | critical | `createdBy`, permiso efectivo, tests A/B |
| Acceso cross-tenant mal implementado | critical | F1B bloqueado, no bypass por User ID |
| Export truncado falsamente completo | high | paginación estable, snapshot y conteo |
| CSV/formula injection | high | neutralización específica y fixtures |
| Horas offline confundidas con confirmadas | high | estados separados y reconciliación |
| Archivados sin nombre correcto | medium | integrar S1/#933 |
| Rutas BFF y auth atadas a Org | critical | prueba persona sin empresa, no prometer éxito |

## 8. Gates no completados

- [ ] Resolver F1-D01..F1-D08 de spec y elegir vía A/B/C.
- [ ] Aprobación owner de slice F1A / privacidad y seguridad.
- [ ] Inventario exacto de client-server sesión y SQLite/DB mobile/offline.
- [ ] Tests negativos sintéticos y revisión independiente.
- [ ] CI verde **al final** y PR funcional terminal.
- [ ] Merge/despliegue/canary sólo por autorización independiente.
