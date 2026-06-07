# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [Unreleased]

### Added
- Presets de filtros guardados en `localStorage`.
- Atajos de teclado:
  - `/` foco en búsqueda.
  - `n` nuevo proyecto.
  - `Esc` cancela edición/desenfoca.
  - `l`, `k`, `c` cambian entre Lista/Kanban/Calendario.
- Métricas financieras por estado (total, pendiente, en progreso, completado).
- Ranking de presupuesto por responsable (top 5).
- Vista calendario mensual con proyectos agrupados por fecha límite.
- Indicadores visuales en calendario para vencidos y próximos a vencer.
- Filtros recordados automáticamente por vista (lista, kanban, calendario).
- Presets asociados a la vista activa.
- Backup JSON completo (proyectos + presets + filtros por vista) en export/import.
- Deshacer última acción (botón y atajo Ctrl/Cmd+Z) para cambios de datos.
- Confirmación previa al sobrescribir configuración durante importación completa.
- Mejoras de accesibilidad en calendario (`role=grid`, `gridcell`, `aria-label`).
- Cobertura unitaria de normalización de backup/presets/filtros por vista.

### Planned
- Dashboard financiero por responsable y por etiqueta.
- Vista de calendario mensual para fechas límite.
- Mejoras de accesibilidad (navegación completa por teclado y focus management).

## [1.0.2] - 2026-03-05

### Fixed
- Ajuste de comando unit test para CI (`tests/unit/*.test.mjs`) y estabilidad de workflow Release.

### CI
- Workflow `Release` validado de punta a punta en GitHub Actions.

## [1.0.1] - 2026-03-05

### Added
- Primera versión releaseada con tag automático y GitHub Release generado en CI.

## [1.0.0] - 2026-03-04

### Added
- App web para gestión de proyectos con lista + kanban.
- CRUD local de proyectos con `localStorage`.
- Filtros, ordenamiento, métricas, import/export JSON.
- Test unitarios + E2E Playwright.
- Cobertura con `c8` y umbrales mínimos.
- Pipeline CI, Codecov y Dependabot.
