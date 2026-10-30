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

> Prerrequisito: spec `APPROVED` (hoy `DRAFT`) y análisis sin gaps.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [ ] [T-001] Cerrar Q2, Q3, Q5, Q7, Q9, Q10 y Q11 (spec §11) y pasar a `APPROVED`; confirmar Q1, Q4, Q6 y Q8
- [ ] [T-002] Registrar SHA Git/producción, migraciones, mecanismo de flags y estado de `LocationCostIndex` en producción
- [ ] [T-003] Completar análisis spec↔plan↔constitución y ADR de las decisiones clave
- [ ] [T-004] Tests de contrato (golden) de los 24 motores: base, resultado actual, reconstrucción preservando los márgenes propios de cada oficio, unidades, redondeos y escenarios límite
- [ ] [T-005] Investigación externa y validación de datos (plan §9)
- [ ] [T-006] Documentar #1074 como `SUPERSEDED` enlazando esta spec (**solo con confirmación del owner**; no cerrar sin ella)
- [ ] [T-007] Alinear con ADR-027: plan de adaptación de `contractor-estimate.service.ts`

## Fase 0b — Correcciones P0

- [ ] [T-008] Corregir metodología PPI (precio de referencia con fecha, índice de esa fecha, unidad y serie compatible)
- [ ] [T-009] `TaxPolicy` versionada y estado "impuestos no determinados"; revisión fiscal profesional previa a valores

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
