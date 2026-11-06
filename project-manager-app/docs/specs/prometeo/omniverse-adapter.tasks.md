---
type: tasks
feature: "Omniverse Read-Only Projection Adapter"
domain: "prometeo"
plan: "docs/specs/prometeo/omniverse-adapter.plan.md"
version: "2.1"
status: "PENDING"
branch: "feat/omniverse-adapter"
date: "2026-11-06"
---

# Tasks: Omniverse Read-Only Projection Adapter

## Fase 0 — Gobierno
- [ ] [OMN-001] Owner acepta ADR-044 con fecha y aprueba el acta
- [ ] [OMN-002] Slices 1 a 3 aprobados y fusionados
- [ ] [OMN-003] Owner resuelve Q-1 a Q-8 del spec
- [ ] [OMN-004] Owner aprueba el spec (`REVIEW` → `APPROVED`)
- [ ] [OMN-005] Refrescar `main` y reconciliar `related_files`

## Fase 1 — Pruebas en rojo
- [ ] [OMN-010] Instantánea saneada: allowlist, techo de sensibilidad y metadatos
- [ ] [OMN-011] Cero escrituras con identidad sin sesión previa
- [ ] [OMN-012] Matriz 2 × 2 con la identidad del consumidor (404/403)
- [ ] [OMN-013] Falta de `projectId` → 400 sin consultar proveedores
- [ ] [OMN-014] Sin datos personales, ubicaciones ni nombres de secretos
- [ ] [OMN-015] Determinismo y topes del servidor
- [ ] [OMN-016] Flag `off` → 404; identidad revocada → 401
- [ ] [OMN-017] Registro de exportación y de denegación sin contenido

## Fase 2 — Identidad
- [ ] [OMN-020] Identidad de servicio del consumidor según Q-1
- [ ] [OMN-021] Permisos mínimos en `rbac.ts`
- [ ] [OMN-022] Revocación inmediata

## Fase 3 — Proyección y API
- [ ] [OMN-030] Contratos Zod en `packages/schemas/src`
- [ ] [OMN-031] Servicio de proyección sobre el servicio de consulta del slice 3
- [ ] [OMN-032] Endpoint `POST <prefijo>/omniverse/snapshot` y catálogo de errores
- [ ] [OMN-033] Registro de acceso sin contenido
- [ ] [OMN-034] Actualizar `SEMSE_API_SURFACE_V1.md`

## Fase 4 — Verificación
- [ ] [OMN-040] Pruebas dirigidas y regresión
- [ ] [OMN-041] build, typecheck y lint
- [ ] [OMN-042] `pnpm spec:validate:strict`, `spec:coverage` y `spec:index`

## Fase 5 — Entrega
- [ ] [OMN-050] Revisión del PR y CI en verde
- [ ] [OMN-051] SHA de merge registrado
- [ ] [OMN-052] Despliegue terminal verificado
- [ ] [OMN-053] `shadow` sin entregar nada al consumidor
- [ ] [OMN-054] Owner adjunta evidencia de las condiciones externas del consumidor
- [ ] [OMN-055] Canary con una identidad, un proyecto y una organización
- [ ] [OMN-056] Metadatos SDD y evidencia de producción sin inventar estados
