---
id: "labor.engine-remediation"
title: "Labor Engine — integridad, privacidad, ventanas y moneda"
domain: "labor"
version: "1.1"
status: "APPROVED"
owner: "semse-core"
risk: "high"
date: "2026-07-23"
author: "Codex"
spec_index: "docs/SPEC_INDEX.md"
related_files:
  - apps/api/src/modules/labor-engine/labor-engine.controller.ts
  - apps/api/src/modules/labor-engine/labor-engine.service.ts
  - apps/api/src/modules/labor-engine/labor-engine.repository.ts
  - apps/api/src/modules/pricing/contractor-rate.service.ts
  - apps/web/app/(app)/admin/labor-engine/page.tsx
  - apps/web/app/(app)/worker/tracker/page.tsx
  - apps/web/app/(app)/worker/tracker/sections/RegistrosTab.tsx
related_tests:
  - apps/api/test/contractor-rate.service.test.ts
  - apps/api/test/labor-engine.controller.test.ts
  - apps/api/test/labor-engine.service.test.ts
  - apps/api/test/labor-engine.repository.test.ts
  - apps/api/test/labor-chat.service.test.ts
  - tests/unit/labor-rate-boundary.test.ts
related_endpoints:
  - v1/labor
  - v1/pricing/labor-rates
related_events: []
related_agents: []
last_verified: "2026-07-25"
---

# Spec: Labor Engine — remediación funcional

## 1. Alcance

Cubre `0.19`, `0.20`, `0.24`, `2.2`–`2.5` y `2.8`–`2.16`.
Complementa `labor.time-tracking-consolidation`, que gobierna la unificación
persistente entre el tracker legacy y `TimeEntry`.

## 2. Invariantes de entradas

- `breakMinutes >= 0` antes del cálculo y persistencia.
- `durationMinutes` no supera el rango trabajado menos descansos.
- `hourlyRate`/`currency` enviados a una entrada manual se toleran solo por
  compatibilidad con colas legacy: no se extraen, propagan ni persisten.
- El KPI administrativo usa exclusivamente el baseline nacional BLS en USD;
  no consume valores históricos sin procedencia ni el override del admin.
- El endpoint dedicado de override exige tarifa finita entre USD 10 y 250 y
  markup finito entre 0 y 1. El uso funcional general del override sigue bajo
  la decisión de producto 2.40.
- `job_linked` exige job/proyecto accesible para el worker.
- Un `freeProject` solo cambia a `converted` mediante el flujo dedicado y con
  `convertedJobId`.
- Turnos nocturnos pueden cruzar medianoche dentro del máximo permitido; un
  rango invertido absurdo sigue siendo error.
- `clientEventId` hace idempotentes starts y entradas manuales.

## 3. Privacidad

```text
DADO una TimeEntry purpose=personal
CUANDO OPS_ADMIN consulta overview, costo o alertas del equipo
ENTONCES la entrada personal no aparece ni contribuye a costo/overtime
  Y solo el creador puede leerla
```

`tenantId` acota, pero ownership por `createdBy` autoriza las entradas
personales.

## 4. Ventanas temporales

- “Últimos 7 días” = ventana móvil `[now-7d, now]`.
- “Últimos 30 días” = ventana móvil `[now-30d, now]`.
- “Semana calendario” y “mes calendario” solo pueden usarse cuando la UI los
  etiqueta de esa forma.
- KPIs, charts, CSV y contexto de Cronos consumen el mismo rango explícito.
- La selección semanal no filtra sobre un dataset mensual incompleto.

## 5. Resiliencia/offline

- Un fallo de `fetchActiveTimer` no elimina entries/summaries ya cargables; se
  muestra error parcial.
- Registros, Resumen y Reportes distinguen datos sincronizados de eventos
  locales pendientes.
- Los dos formularios manuales usan la misma validación y estrategia offline.
- Eventos confirmados se podan individualmente; un fallo posterior no duplica
  los ya aceptados.

## 6. Contratos críticos

### `POST /v1/labor/timer/start`

- Valida ownership, timer activo e idempotencia.
- No acepta tarifa/moneda no autorizada.

### `POST /v1/labor/entries/manual`

- Valida rango, descanso, purpose, ownership y clientEventId.
- Ignora tarifa/moneda del payload y persiste costo desconocido en la entrada.

### `PATCH /v1/labor/free-projects/:id`

- No acepta `converted` directamente.
- El cambio a convertido vive en `POST /free-projects/:id/convert`.

### Summaries/admin overview

- Rango explícito.
- Excluye personal del agregado de equipo.
- Estima costo con baseline BLS USD y overtime 1.5x; no lee tarifa/moneda
  histórica sin procedencia ni el override personal del administrador.

## 7. Tests requeridos

- Descanso negativo queda en cero.
- Rate/moneda legacy no llegan al repositorio ni al KPI.
- Override dedicado rechaza rate negativo/excesivo/no finito y markup inválido.
- Job/proyecto ajeno se rechaza.
- Personal nunca aparece en admin overview.
- Ventanas de 7/30 días son móviles, incluidos límites de mes.
- CSV/chart/KPI usan el mismo rango.
- `converted` sin endpoint dedicado se rechaza.
- Replay por `clientEventId` devuelve la entrada existente.

## 8. Evidencia de implementación 2.10

- [x] Controller manual no extrae `hourlyRate` ni `currency`.
- [x] Service persiste `hourlyRate: undefined` y normaliza moneda interna a USD.
- [x] Summary ignora todos los valores históricos de rate/currency y usa BLS.
- [x] Admin usa `nationalBaselineHourlyRate`, nunca `rates.override`.
- [x] El formulario manual ya no ofrece rate/moneda controlables por cliente.
- [x] La policy de overrides aplica USD 10..250 y markup 0..1.
- [x] Pruebas focalizadas y build API verdes el 2026-07-25.

## 9. Rollback

Los clamps, ownership y privacidad no se revierten. Los cambios de presentación
de rangos/moneda pueden revertirse independientemente si conservan exactitud.
