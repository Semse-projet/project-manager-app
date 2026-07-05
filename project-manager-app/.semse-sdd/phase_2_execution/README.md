# SEMSEproject SDD Kit Plus — Phase 2 Execution Pack

Este paquete continúa el kit SDD inicial. Está diseñado para que Codex pase de **auditoría y navegación modular** a **implementación guiada por specs**, con backlog, contratos, pruebas, prompts y criterios de aceptación.

## Orden recomendado para Codex

1. Leer `phase_2_execution/runbooks/00_operator_sequence.md`.
2. Ejecutar `phase_2_execution/prompts/00_codex_phase2_start.txt`.
3. Implementar primero `phase_2_execution/specs/01_admin_module_shells.md`.
4. Implementar después `phase_2_execution/specs/02_context_bridge_mvp.md`.
5. Validar con `phase_2_execution/tests/validation_matrix.md`.
6. Preparar PR con `phase_2_execution/github/pr_body_phase2.md`.

## Regla crítica

No se debe romper producción. Todo debe ser incremental, reversible y compatible con rutas existentes.
