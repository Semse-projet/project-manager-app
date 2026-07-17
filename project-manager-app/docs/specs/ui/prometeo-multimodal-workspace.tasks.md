---
type: "tasks"
feature: "Prometeo Workspace — compositor multimodal y respuestas estructuradas"
domain: "ui"
plan: "docs/specs/ui/prometeo-multimodal-workspace.plan.md"
version: "1.0"
status: "IMPLEMENTED"
branch: "agent/prometeo-p3a"
date: "2026-07-16"
---

# Tareas: Prometeo Multimodal Workspace P3-A

## Fase 0 — Preflight SDD

- [x] **T-001** Crear `agent/prometeo-p3a` desde `origin/main` limpio.
- [x] **T-002** Revisar Constitución, SDD, invariantes, FSM, eventos y API surface.
- [x] **T-003** Aprobar spec y plan con alcance sin mutaciones.
- [x] **T-004** Ejecutar baseline `pnpm spec:validate:strict`.

## Fase 1 — Tests antes del código

- [x] **T-010** Crear tests de clasificación de tipos y fuentes.
- [x] **T-011** Crear tests de límites por archivo, cantidad y total.
- [x] **T-012** Crear test de metadata remota sin `File`/`blob:`.
- [x] **T-013** Confirmar fallo controlado por helper ausente.

## Fase 2 — Helpers y upload

- [x] **T-020** Implementar `prometeo-attachments.ts`.
- [x] **T-021** Implementar `uploadPrometeoAttachment` con presign + PUT.
- [x] **T-022** Marcar video/audio como pipeline pendiente.
- [x] **T-023** Pasar tests T-010–T-012.

## Fase 3 — Compositor multimodal

- [x] **T-030** Agregar drafts y previews al panel.
- [x] **T-031** Agregar selección de archivos y captura de cámara.
- [x] **T-032** Agregar drag-and-drop y paste.
- [x] **T-033** Agregar validación y estados de carga/error accesibles.
- [x] **T-034** Permitir turno solo con adjuntos y conservar draft ante error.
- [x] **T-035** Revocar object URLs al limpiar o desmontar.

## Fase 4 — Contexto y respuestas estructuradas

- [x] **T-040** Mostrar chips de agente, módulo/ruta y proyecto.
- [x] **T-041** Mostrar adjuntos enviados en el mensaje del usuario.
- [x] **T-042** Renderizar todos los response blocks relevantes.
- [x] **T-043** Renderizar tool results y errores/bloqueos.
- [x] **T-044** Renderizar citas sin exponer payloads completos.

## Fase 5 — Validación

- [x] **T-050** Ejecutar tests focalizados.
- [x] **T-051** Ejecutar typecheck de Web.
- [x] **T-052** Ejecutar lint focal de Web y documentar baseline global ajeno.
- [x] **T-053** Ejecutar `pnpm spec:index` y validación SDD estricta.
- [x] **T-054** Revisar diff, secretos, scope y `git diff --check`.

## Fase 6 — Research loop y reporte

- [x] **T-060** Ejecutar tres búsquedas externas independientes.
- [x] **T-061** Registrar ideas aplicadas, backlog y descartadas.
- [x] **T-062** Crear reporte `docs/reportes/PROMETEO_MULTIMODAL_WORKSPACE_P3A_2026-07-16.md`.
- [x] **T-063** Marcar tareas terminadas y spec en estado verificable según evidencia.

## Criterio de cierre

- [x] Compositor soporta selección, cámara, drop y paste.
- [x] Límites y errores son visibles y accesibles.
- [x] No se envía turno con carga parcial fallida.
- [x] Chips y tarjetas estructuradas representan el contexto real.
- [x] Video nunca se presenta como analizado.
- [x] No hay mutaciones, endpoints, eventos, schema o infra nuevos.
- [x] Tests, typecheck, lint focal y SDD están verdes; baseline global documentado.
