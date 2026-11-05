---
type: tasks
feature: "Motor de costos unificado"
domain: "pricing"
plan: "docs/specs/api/cost-engine.plan.md"
version: "2.0"
status: "PENDING"
branch: "feat/cost-engine"
date: "2026-10-30"
---

# Tareas: Motor de costos unificado

> Prerrequisito: spec `APPROVED` (hoy `DRAFT`) y análisis sin gaps, **salvo la excepción siguiente**.
>
> **Excepción autorizada por el owner (2026-10-30):** las tareas T-004 y T-005 son investigación y pruebas
> **diagnósticas previas a la aprobación**, porque su resultado es necesario para llegar a `APPROVED`. Se ejecutan
> en una rama separada, **no modifican lógica de producción**, no cambian precios y no activan nada. Esto no
> autoriza fusionar #1075, cambiar precios en producción ni activar el motor.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [ ] [T-001] Cerrar Q2, Q3, Q5, Q7, Q9, Q10 y Q11 (spec §11) y pasar a `APPROVED`; confirmar Q1, Q4, Q6 y Q8
- [ ] [T-002] Registrar SHA Git/producción, migraciones, mecanismo de flags y estado de `LocationCostIndex` en producción
- [ ] [T-003] Completar análisis spec↔plan↔constitución y ADR de las decisiones clave
- [x] [T-004] Pruebas diagnósticas de los 24 motores — **ejecutadas** como evidencia diagnóstica en el PR #1076 (72 escenarios, 76/76 tests, CI en verde; PR #1076 **fusionado en main** como `645ce3b8`) (excepción previa a `APPROVED`, solo pruebas):
  - al menos **tres escenarios por motor** (normal, complejo y límite): 72 iniciales, más los que los resultados justifiquen;
  - comparar cada salida contra su resultado original: ninguna discrepancia monetaria sin explicar y **sin tolerancias arbitrarias** que oculten diferencias;
  - capturar los argumentos reales que cada motor pasa a `buildCostSummary` (base, tasas efectivas, divisor) y compararlos con la reconstrucción por división de importes redondeados, que puede perder precisión (también `total / perUnit`);
  - si hay diferencias, evaluar que los motores **expongan directamente** tasas efectivas, bases y divisor, compatible con sus respuestas actuales;
  - informe que registre fallos, redondeos y motores incompatibles, con causas y modificaciones necesarias, y que **distinga errores de reconstrucción de errores de precios de mercado** (una prueba golden demuestra estabilidad matemática, no que un presupuesto sea comercialmente correcto)
- [ ] [T-004b] **Contrato aditivo (implementación posterior a `APPROVED`):** exponer en los 24 motores `costs.basis` antes del redondeo (USD), `effectiveRates` decimales y `perUnitDivisor` tipado y con unidad; sin inferir de importes finales. Comparar 72/72 casos con campos públicos, 0 centavos de diferencia y 66/66 divisores exactos, sin instrumentación; compatibilidad del JSON previo y privacidad por modo.
- [ ] [T-004c] **Defecto separado [#1085](https://github.com/Semse-projet/project-manager-app/issues/1085):** fijar unidad canónica y conversión versionada de `wastePercent` (`concrete` puntos porcentuales / `masonry` fracción) antes de activar categorías afectadas; pruebas de 10 %, límites y compatibilidad.
- [ ] [T-004d] **Defecto separado [#1086](https://github.com/Semse-projet/project-manager-app/issues/1086):** definir semántica de `crewSize` y cálculo multi-oficio; probar 1, 20, 21 y cuadrillas solapadas, sin subir el límite arbitrariamente.
- [ ] [T-004e] **Golden independiente (posterior a `APPROVED`):** 24 × normal/complejo/límite con expectativas congeladas y oráculo independiente; cambios de redondeo declarados, tasas por oficio conservadas, overrides, errores, integración ADR-027, inmutabilidad y regresión de `perUnit`.
- [ ] [T-005] Investigación externa y validación de datos (plan §9); expedientes de decisión preparados en `docs/specs/api/cost-engine.decisions.md` (Q2, Q3, Q5, Q7, Q9, Q10, Q11), **ninguno decidido**; borradores adjuntos sin ejecutar ni enviar: auditoría de datos de Q2 (`cost-engine.q2-data-audit.md`/`.sql`) y nota jurídica de Q11 (`cost-engine.q11-legal-note.md`)
- [x] [T-006] #1074 cerrado como `SUPERSEDED` con comentario de trazabilidad hacia #1075 (autorizado por el owner el 2026-10-30; rama e historial conservados)
- [ ] [T-007] Alinear con ADR-027: plan de adaptación de `contractor-estimate.service.ts`

## Fase 0b — Correcciones P0

**Decisión técnica de orden (sin aprobación de spec):** [T-008b primero, T-008 después; consumidores y activación por gates](../../reportes/COST_ENGINE_T008_TECH_DECISION_2026-11-05.md). El diagnóstico #1099 **cerró sin fusionar** tras trasladar su oráculo sintético al PR existente #1101; ni esos tests ni el CI autorizan reemplazar precios o fusionar código productivo.



- [ ] [T-008] **Corregir metodología PPI — posterior a `APPROVED`:** precio observado con fecha/mes, unidad, fuente, derechos y serie compatible; dividir índice actual entre índice de **esa fecha** (no `/100`). Gate de estado tipado si índice ≤ 0, no finito, ausente, sin vigencia, incompatible o sin base verificable. No usar índice ficticio 100 ni publicar `basePrice` hardcoded como precio confirmado. Tests sintéticos subida/igualdad/bajada y fallback, más revisión de Q11. **Diagnóstico reproducible, no corrección:** PR [#1099 cerrado sin merge](https://github.com/Semse-projet/project-manager-app/pull/1099), oráculo sintético ahora en [#1101](https://github.com/Semse-projet/project-manager-app/pull/1101) e issue [#1087](https://github.com/Semse-projet/project-manager-app/issues/1087).
- [ ] [T-009] `TaxPolicy` versionada y estado "impuestos no determinados"; revisión fiscal profesional previa a valores

- [ ] [T-008b] **Integridad del snapshot PPI [#1100](https://github.com/Semse-projet/project-manager-app/issues/1100):** fallos de BLS y fallback hardcoded no crean ni renuevan observaciones con `source=BLS_PPI` verificada; índices ausentes/no válidos no producen precios ni expiraciones aparentes. **Implementación propuesta en [#1101 DRAFT](https://github.com/Semse-projet/project-manager-app/pull/1101)**: bloqueo de upserts de fallback, índices inválidos, procedencia `UNVERIFIED` para consumidores y tests con Prisma simulado; no corrige fórmula T-008. Merge/activación solo tras `APPROVED`, revisión independiente, compatibilidad de API, prueba DB aislada, smoke de consumidores y rollback.

- [ ] [T-008c] **Auditoría de caché PPI actual (solo lectura; PENDIENTE):** ejecutar con rol PostgreSQL de solo lectura el [SQL agregado](../../reportes/COST_ENGINE_T008_SNAPSHOT_READONLY_AUDIT.sql) siguiendo el [protocolo](../../reportes/COST_ENGINE_T008_SNAPSHOT_READONLY_AUDIT.md). Distinguir indicios de fallback de evidencia de corrupción; no inferir historial por `MaterialPriceSnapshot` actual, ni cambiar datos/servicios. Q11 y revisión de datos siguen OPEN.

## Fase 1 — Servicio y registro

- [ ] [T-010] Tests rojos del resolvedor por capas, límites y capas reservadas
- [ ] [T-011] [P] Schemas Zod de `CostParameter` y `costTrace`
- [ ] [T-012] `PARAMETER_REGISTRY` y `CostEngineService.compute` con recalculo que deriva y conserva los márgenes propios del oficio
- [ ] [T-013] `costTrace` (versión del motor, fecha de precios, parámetros y origen)
- [ ] [T-014] Pasar tests; confirmar que no cambia ningún resultado con defaults
- [ ] [T-015] Unificar `quote-engine` en el servicio con prueba de igualdad de totales

## Fase 2 — Smart Intake en modo sombra

- [ ] [T-020] Tests de tabla respuesta → entrada del motor por categoría mapeada (con revisión de oficio, Q9)
- [ ] [T-021] Adaptador y rango por escenarios bajo/alto
- [ ] [T-022] `COST_ENGINE_SHADOW`: servir la fórmula plana y registrar la diferencia sin texto libre
- [ ] [T-023] Pruebas de que un fallo del motor no rompe ni retrasa `analyze`/`estimate`
- [ ] [T-024] Informe de la comparación sombra y decisión de activación por categoría

## Fase 3 — Parámetros por capa (migración)

- [ ] [T-030] Migración aditiva `CostParameter` (con aprobación explícita del owner)
- [ ] [T-031] Verificar SQL, checksum, drift y compatibilidad hacia atrás
- [ ] [T-032] Servicio de parámetros con límites, versión y reversión
- [ ] [T-033] Permisos por capa en `rbac.ts` y endpoints `/v1/pricing/cost-parameters`
- [ ] [T-034] `AuditLog` con before/after y pruebas de aislamiento entre tenants y organizaciones
- [ ] [T-035] Flujo de doble control para `platformFeeRate` y `TaxPolicy`: solicitante distinto del aprobador, reautenticación reciente, aprobación ligada a valores y versión, caducidad
- [ ] [T-036] Permiso `pricing:org:manage` por `Membership` activa, con pruebas de otra organización y membresía inactiva
- [ ] [T-037] Serializador por modo y pruebas negativas de privacidad sobre el JSON del cliente
- [ ] [T-038] Control optimista de versión (`409`)

## Fase 4 — Pantallas

- [ ] [T-040] Pantalla admin (plataforma y región)
- [ ] [T-041] Pantalla de organización
- [ ] [T-042] Pantalla de contratista
- [ ] [T-043] Tarjeta de estimado con región, fuente y "cómo se calculó" según modo
- [ ] [T-044] Estados loading/empty/forbidden/degraded/error y es/en

## Fase 5 — Activación y migración de consumidores

- [ ] [T-050] Activar `COST_ENGINE_SMART_INTAKE` por categoría con smoke en Chrome
- [ ] [T-051] Migrar ProTools y Prometeo al servicio
- [ ] [T-052] Migrar cotizaciones, órdenes de cambio y `contractor-estimate` al servicio (ADR-027)
- [ ] [T-053] Retirar la fórmula plana con evidencia

## Fase 6 — PR, CI, deploy y verificación (por cada fase anterior)

- [ ] [T-060] Revisar diff y secretos; abrir PR con migración, rollback y evidencia
- [ ] [T-061] CI terminal; fusionar y registrar SHA
- [ ] [T-062] Deployment terminal API/Web; health y logs
- [ ] [T-063] Canary gradual con flags; smoke autenticado; métricas y señal de rollback
- [ ] [T-064] Registrar `production_evidence`, `last_verified` y `status: VERIFIED`

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Deploy `DEPLOYED`
- [ ] Activación `CANARY` o `ACTIVE` según el gate aprobado
- [ ] Migración `VERIFIED`
- [ ] Evidencia de producción enlazada
- [ ] Índice, matriz y roadmap actualizados
