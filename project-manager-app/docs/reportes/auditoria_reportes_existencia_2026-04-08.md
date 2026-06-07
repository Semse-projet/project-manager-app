# Auditoría de existencia en `reportes`

Fecha: 2026-04-08
Base: `/home/yoni/labsemse/reportes`

## Objetivo

Verificar si los reportes estaban citando archivos, carpetas o entregables que ya no existían en el filesystem real y completar la normalización donde todavía quedaban referencias rotas.

## Hallazgo principal

El problema dominante no era “trabajo inventado”, sino **rutas históricas obsoletas**.

La mayoría de los reportes afectados seguían apuntando al prefijo histórico:

- `labsemse_project/project-manager-app`

cuando el canónico real ya quedó consolidado en:

- `/home/yoni/labsemse/project-manager-app`

También quedaba una referencia vieja a:

- `reportes/infclaude/analisis_aterrizaje_infclaude_semse_2026-04-05.md`

que ya había sido movida a:

- `/home/yoni/labsemse/agents/references/infclaude/analisis_aterrizaje_infclaude_semse_2026-04-05.md`

## Corrección aplicada

Se normalizaron en lote los reportes que seguían con el prefijo obsoleto del canónico.

Archivos corregidos:

- `admin_domain_events_y_policy_2026-04-08.md`
- `admin_ops_runtime_filters_web_assistant_portal_2026-04-07.md`
- `aislamiento_y_correccion_build_api_2026-04-06.md`
- `avance_frontend_emparejamiento_2026-04-08.md`
- `cortex_runtime_trace_ui_infclaude_2026-04-07.md`
- `diagnostico_dependencias_labsemse_2026-04-06.md`
- `diagnostico_ops_agents_domain_events_2026-04-07.md`
- `domain_events_controller_inspirado_satellites_infclaude_2026-04-07.md`
- `domain_events_ui_ops_2026-04-08.md`
- `informe_ai_event_runtime_2026-04-06.md`
- `observabilidad_agent_runtime_infclaude_2026-04-07.md`
- `ops_repository_y_analisis_satellites_archive_2026-04-07.md`
- `prompts/prompt_codex_frontend_emparejamiento_2026-04-07.md`
- `reparacion_workspace_core_2026-04-06.md`
- `users_y_ratings_modulos_2026-04-08.md`
- `validacion_domain_events_y_worker_2026-04-07.md`
- `validacion_runtime_frontend_2026-04-08.md`
- `reordenamiento_infclaude_2026-04-08.md`

## Verificación real

Se ejecutó una auditoría de paths absolutos dentro de `reportes/`.

Resultado:

- los faltantes reales por prefijo viejo quedaron corregidos;
- los residuales detectados por parser son falsos positivos por:
  - espacios en rutas como `app semse/...`
  - segmentos dinámicos con corchetes como `[orgId]`, `[id]`, `[correlationId]`

Esos casos fueron verificados manualmente y sí existen.

## Automatización agregada

Se añadió:

- `/home/yoni/labsemse/scripts/audit-report-paths.mjs`

Uso:

```bash
node /home/yoni/labsemse/scripts/audit-report-paths.mjs
```

Comportamiento:

- `EXIT 0` si no hay referencias absolutas inexistentes en `reportes/`
- `EXIT 1` y JSON de salida si detecta faltantes reales

## Resultado

La carpeta `reportes/` quedó mucho más confiable como evidencia del trabajo real:

- ya no arrastra el prefijo roto del canónico anterior;
- las referencias estructurales importantes sí existen;
- y ahora hay un script para revalidarlo cuando vuelvan a moverse rutas del ecosistema.
