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

- [ ] [T-001] Cerrar Q1–Q9 de la spec §11 y pasar a `APPROVED`
- [ ] [T-002] Registrar SHA Git/producción, migraciones, mecanismo de flags y estado de `LocationCostIndex` en producción
- [ ] [T-003] Completar análisis spec↔plan↔constitución y ADR de las decisiones clave
- [ ] [T-004] Tests de contrato (golden) por motor: `buildCostSummary(costs.materials, costs.labor)` con defaults reproduce el resultado actual
- [ ] [T-005] Investigación externa y validación de datos (plan §9)

## Fase 1 — Servicio y registro

- [ ] [T-010] Tests rojos del resolvedor por capas, límites y capas reservadas
- [ ] [T-011] [P] Schemas Zod de `CostParameter` y `costTrace`
- [ ] [T-012] `PARAMETER_REGISTRY` y `CostEngineService.compute` con recalculo de márgenes
- [ ] [T-013] `costTrace` (versión del motor, fecha de precios, parámetros y origen)
- [ ] [T-014] Pasar tests; confirmar que no cambia ningún resultado con defaults

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
- [ ] [T-035] Aprobación reforzada para `platformFeeRate` y `taxRate` (según Q1)

## Fase 4 — Pantallas

- [ ] [T-040] Pantalla admin (plataforma y región)
- [ ] [T-041] Pantalla de organización
- [ ] [T-042] Pantalla de contratista
- [ ] [T-043] Tarjeta de estimado con región, fuente y "cómo se calculó" según modo
- [ ] [T-044] Estados loading/empty/forbidden/degraded/error y es/en

## Fase 5 — Activación y migración de consumidores

- [ ] [T-050] Activar `COST_ENGINE_SMART_INTAKE` por categoría con smoke en Chrome
- [ ] [T-051] Migrar ProTools y Prometeo al servicio
- [ ] [T-052] Migrar cotizaciones y órdenes de cambio al servicio
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
