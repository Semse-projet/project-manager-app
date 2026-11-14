---
type: tasks
feature: "Workspace funcional integrado"
domain: "ui"
plan: "docs/specs/ui/workspace-functional-hub.plan.md"
version: "2.0"
status: "IN_PROGRESS"
branch: "feat/workspace-functional-20261114"
date: "2026-11-14"
---
# Tareas: Workspace funcional integrado

## SDD y preparación

- [x] T-001 Alcance aprobado por usuario/Blueprint; spec APPROVED antes de código.
- [x] T-002 Base Git identificada; producción no consultada y sin autorización de deploy.
- [x] T-003 Constitution check/análisis spec↔plan↔tasks sin ampliación de backend/dominio.
- [x] T-004 Regenerar índice y completar checklist local.

## Tests y UI

- [x] T-010 Escribir pruebas antes de código y conservar evidencia del fallo inicial.
- [x] T-020 Inicio/referencia veraces y formulario validado, conservado ante error.
- [x] T-021 Navegación buscable por rol/estado activo e historial existente.
- [x] T-022 Proyectos autorizados e hitos por ID correcto con empty/error/forbidden.
- [x] T-023 Evidencia real y filtros locales, errores visibles sin cargas ficticias.
- [x] T-024 Hub presupuestos y comparación de ofertas del mismo Job, sin adjudicar.
- [x] T-025 Planificación de consulta con fechas reales, filtros y vínculos BuildOps correctos.
- [x] T-026 Montar/acceder a Prometeo existente sin chat paralelo ni ejecución automática.
- [x] T-027 Store coherente/concurrente, preferencias visuales, paneles móviles accesibles.

## Validación y handoff

- [x] T-040 Pruebas dirigidas y regresión proporcional: 155/155 PASS, sin skips.
- [x] T-041 Typecheck/lint/build frontend; registrar blockers preexistentes: build final PASS, tipado web y de pruebas PASS, lint cero errores y un warning de recorrido 360 no modificado.
- [x] T-042 spec:validate:strict, spec:coverage, spec:index.
- [x] T-043 Revisión read-only y corrección de defectos confirmados: 401 transversal, status HTTP estructurado e ID único. Regresión roja 5/5 antes de fixes; 6 regresiones nuevas verdes después.
- [x] T-044 Reporte/diff acotado/secrets check.
- [ ] T-050 Rama GitHub + PR borrador; confirmar estado real del CI sin reintentos ciegos.
- [ ] T-051 Checkpoint Manus sin publicación.

Este archivo captura el estado antes de ejecutar T-050/T-051. La URL del PR, el estado vivo del CI y el SHA de checkpoint se acreditan en el handoff de entrega; no se anticipan aquí ni se confunden con los checks locales.

Merge, deploy, canary/activación y operaciones de producción NO AUTORIZADOS y fuera de tarea. Migration NOT_APPLICABLE. Nunca marcar VERIFIED en esta entrega.
