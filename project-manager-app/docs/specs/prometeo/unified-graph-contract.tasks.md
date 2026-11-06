---
type: tasks
feature: "Unified Operational Graph Contract"
domain: "prometeo"
plan: "docs/specs/prometeo/unified-graph-contract.plan.md"
version: "2.1"
status: "PENDING"
branch: "feat/unified-graph-contract"
date: "2026-11-06"
---

# Tasks: Unified Operational Graph Contract

## Fase 0 — Gobierno
- [ ] [UGC-001] Owner acepta ADR-044 con fecha y aprueba el acta
- [ ] [UGC-002] Owner resuelve Q-1 a Q-5 del spec
- [ ] [UGC-003] Owner aprueba el spec (`REVIEW` → `APPROVED`)
- [ ] [UGC-004] Medir tamaño y tiempo de carga del `graph.json` de producción (condición de la prueba de Graphify)
- [ ] [UGC-005] Refrescar `main` y reconciliar `related_files` con rutas reales

## Fase 1 — Pruebas en rojo
- [ ] [UGC-010] Normalización Graphify → contrato y deduplicación determinista
- [ ] [UGC-011] Matriz 2 tenants × 2 organizaciones (404/403) y orden de denegación
- [ ] [UGC-012] Degradación frente a denegación
- [ ] [UGC-013] Ciclos, `maxDepth`, `maxNodes`, `timeBudgetMs`
- [ ] [UGC-014] `schema_mismatch` ante `graph.json` inválido
- [ ] [UGC-015] Techo de sensibilidad, allowlist y redacción de `label`
- [ ] [UGC-016] `SourceRef` de comunicación idéntico a `conversationSourceRefSchema`

## Fase 2 — Contratos y proveedor
- [ ] [UGC-020] Esquemas Zod en `packages/schemas/src`
- [ ] [UGC-021] Permisos de solo lectura en `packages/auth/src/rbac.ts`
- [ ] [UGC-022] Proveedor Graphify con validación Zod y exigencia de `internal:architecture:read`
- [ ] [UGC-023] Validación de argumentos si se usa la CLI

## Fase 3 — Servicio
- [ ] [UGC-030] Registro de proveedores y servicio de combinación
- [ ] [UGC-031] Topes, protección de ciclos y `truncated`
- [ ] [UGC-032] Guía para implementar un proveedor nuevo

## Fase 4 — Verificación
- [ ] [UGC-040] Pruebas dirigidas en verde
- [ ] [UGC-041] Regresión de `GraphifyService` y `repo-knowledge`
- [ ] [UGC-042] build, typecheck y lint
- [ ] [UGC-043] `pnpm spec:validate:strict`, `spec:coverage` y `spec:index`

## Fase 5 — Entrega
- [ ] [UGC-050] Revisión del PR y CI en verde
- [ ] [UGC-051] SHA de merge registrado
- [ ] [UGC-052] Metadatos SDD actualizados sin inventar estados (sin despliegue ni canary propios; D-16)
