---
type: tasks
feature: "Unified Query and Lineage Layer"
domain: "prometeo"
plan: "docs/specs/prometeo/unified-query-lineage.plan.md"
version: "2.1"
status: "PENDING"
branch: "feat/unified-query-lineage"
date: "2026-11-06"
---

# Tasks: Unified Query and Lineage Layer

## Fase 0 — Gobierno
- [ ] [UQL-001] Owner acepta ADR-044 con fecha y aprueba el acta
- [ ] [UQL-002] Slices 1 y 2 aprobados y fusionados
- [ ] [UQL-003] Owner resuelve Q-1 a Q-8 del spec
- [ ] [UQL-004] Owner aprueba el spec (`REVIEW` → `APPROVED`)
- [ ] [UQL-005] Inventariar las superficies de consulta existentes y registrar la fachada en `docs/SOURCE_OF_TRUTH.md`
- [ ] [UQL-006] Refrescar `main` y reconciliar `related_files`

## Fase 1 — Pruebas en rojo
- [ ] [UQL-010] Decisión → fuentes y efectos, con base de datos
- [ ] [UQL-011] Impacto técnico con `derived` y sin aristas inferidas autoritativas
- [ ] [UQL-012] Matriz 2 × 2 y autorización en el servicio aunque la guarda no vea el cuerpo
- [ ] [UQL-013] Ocultos sin rastro y sin oráculo en `degradedSources`
- [ ] [UQL-014] No autoritativo caído → parcial; autoritativo caído → 503
- [ ] [UQL-015] Topes del servidor, ciclos y tiempo total
- [ ] [UQL-016] Flag `off`/desconocido → 404 y tool no listada
- [ ] [UQL-017] Prometeo no eleva alcance; la tool no figura en MCP
- [ ] [UQL-018] Entradas no confiables marcadas como datos
- [ ] [UQL-019] Registro de acceso y denegación sin contenido

## Fase 2 — Proveedores
- [ ] [UQL-020] Proveedor de decisiones sobre el Ledger
- [ ] [UQL-021] Proveedor de ejecuciones sobre `ToolExecutionQueryService` (valida `executionId` con `tenantId`)
- [ ] [UQL-022] Registro de ambos proveedores y semántica autoritativa/no autoritativa

## Fase 3 — API
- [ ] [UQL-030] Contratos Zod de entrada y salida
- [ ] [UQL-031] Servicio con autorización por recurso y topes del servidor
- [ ] [UQL-032] Endpoint `POST <prefijo>/graph/query` y catálogo de errores
- [ ] [UQL-033] Permisos de lectura en `rbac.ts`
- [ ] [UQL-034] Registro de acceso (reutilizando `AuditLog` si Q-4 lo confirma)
- [ ] [UQL-035] Actualizar `SEMSE_API_SURFACE_V1.md`

## Fase 4 — Herramienta de Prometeo (3b si se divide)
- [ ] [UQL-040] Campo de exposición en el registro de herramientas y exclusión de MCP
- [ ] [UQL-041] Descriptor de solo lectura y política en `tool-governance.policy.ts`
- [ ] [UQL-042] Sobre de datos no confiables y enrutamiento por sensibilidad
- [ ] [UQL-043] Cablear el runtime elegido en Q-5

## Fase 5 — Verificación
- [ ] [UQL-050] Pruebas dirigidas y regresión
- [ ] [UQL-051] build, typecheck y lint
- [ ] [UQL-052] `pnpm spec:validate:strict`, `spec:coverage` y `spec:index`

## Fase 6 — Entrega
- [ ] [UQL-060] Revisión del PR y CI en verde
- [ ] [UQL-061] SHA de merge registrado
- [ ] [UQL-062] Despliegue terminal verificado
- [ ] [UQL-063] `shadow` y canary autenticado con un tenant (cubre el slice 1)
- [ ] [UQL-064] Metadatos SDD y evidencia de producción sin inventar estados
