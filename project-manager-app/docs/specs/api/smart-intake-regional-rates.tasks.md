---
type: tasks
feature: "Smart Intake — Tarifas regionales y rango de estimado"
domain: "smart-intake"
plan: "docs/specs/api/smart-intake-regional-rates.plan.md"
version: "2.0"
status: "PENDING"
branch: "feat/smart-intake-regional-rates"
date: "2026-10-30"
---

# Tareas: Smart Intake — Tarifas regionales y rango de estimado

> Prerrequisito: spec `APPROVED` (hoy `DRAFT`) y análisis sin gaps.
> `[ ]` pendiente · `[x]` completo · `[~]` bloqueado · `[P]` paralelizable.

## Fase 0 — SDD y verdad

- [ ] [T-001] Cerrar Q1–Q4 de la spec §11 y pasar a `APPROVED`
- [ ] [T-002] Registrar SHA Git/producción, migraciones, filas de `LocationCostIndex` y mecanismo de flags existente
- [ ] [T-003] Completar análisis spec↔plan↔constitución
- [ ] [T-004] Investigación externa: validar multiplicadores y tarifas base con fuentes primarias (plan §9)

## Fase 1 — Tests y contratos (por fase A/B/C/D)

- [ ] [T-010] Tests rojos de `resolveRegion` (tabla de casos de la spec §4)
- [ ] [T-011] [P] Schemas Zod de `RegionalAdjustment` y payloads admin
- [ ] [T-012] [P] Tests rojos de `generateEstimate(intake, regional)` y regresión con `regional = null`
- [ ] [T-013] Tests rojos de compresión de rango y etiqueta de confianza (P4)

## Fase 2 — Datos y dominio

- [ ] [T-020] Migración aditiva `LocationCostOverride` (solo fase C, con aprobación explícita del owner)
- [ ] [T-021] Verificar SQL, checksum y compatibilidad hacia atrás
- [ ] [T-022] `config/region.ts`, `getCachedMultipliers` sin red y precedencia de override
- [ ] [T-023] Conectar el servicio de Smart Intake bajo el flag
- [ ] [T-024] Pasar tests unitarios

## Fase 3 — API/BFF/UI

- [ ] [T-030] Endpoints admin con `pricing:location:manage` y `AuditLog`
- [ ] [T-031] BFF admin sin exponer secretos
- [ ] [T-032] Pantalla admin con loading/empty/forbidden/degraded/error
- [ ] [T-033] Región/fuente y textos es/en en la tarjeta del estimado
- [ ] [T-034] Actualizar API surface y permiso en `rbac.ts`

## Fase 4 — Verificación local

- [ ] [T-040] Tests dirigidos
- [ ] [T-041] Regresión `smart-intake-*` e `intake-*`
- [ ] [T-042] Build/typecheck/lint
- [ ] [T-043] `pnpm spec:validate:strict`
- [ ] [T-044] `pnpm spec:coverage` y `pnpm spec:index`
- [ ] [T-045] Actualizar spec a `code_status: COMPLETE` y `status: IMPLEMENTED`

## Fase 5 — PR, CI y merge

- [ ] [T-050] Revisar diff y secretos
- [ ] [T-051] Abrir PR con migración, rollback y evidencia (uno por fase)
- [ ] [T-052] Esperar CI terminal y registrar `ci_status`
- [ ] [T-053] Resolver review sin ampliar scope
- [ ] [T-054] Fusionar y registrar SHA; actualizar `merge_status`

## Fase 6 — Deploy y activación

- [ ] [T-060] Verificar pre-deploy/migración
- [ ] [T-061] Esperar deployment terminal API/Web
- [ ] [T-062] Verificar health/readiness y logs
- [ ] [T-063] Encender `SMART_INTAKE_REGIONAL_RATES` de forma gradual
- [ ] [T-064] Smoke en Chrome: estados bajo, alto y sin resolver; verificar `regionalAdjustment`
- [ ] [T-065] Validar métricas (proporción `national`, p95) y señal de rollback
- [ ] [T-066] Promover a `ACTIVE` o revertir/pausar
- [ ] [T-067] Registrar `production_evidence`, `last_verified` y `status: VERIFIED`

## Criterio de Done

- [ ] Código completo y tests verdes
- [ ] CI `PASS`
- [ ] Merge `MERGED`
- [ ] Deploy `DEPLOYED`
- [ ] Activación `CANARY` o `ACTIVE` según el gate aprobado
- [ ] Migración `VERIFIED`
- [ ] Evidencia de producción enlazada
- [ ] Índice/matriz/roadmap actualizados
