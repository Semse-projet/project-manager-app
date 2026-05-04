# Reordenamiento de taxonomía en `reportes`

Fecha: 2026-04-08
Base: `/home/yoni/labsemse/reportes`

## Objetivo

Separar dentro de `reportes/` los documentos de naturaleza distinta para evitar mezclar:

- evidencia de ejecución;
- prompts de trabajo;
- paquetes de planning;
- auditorías legacy.

La decisión se tomó con el mismo criterio usado al absorber `infclaude`:

- referencia estructural estable fuera de `reportes/`;
- evidencia o trabajo fechado dentro de `reportes/`;
- prompts y planning en subcarpetas explícitas.

## Estructura nueva

Se añadieron:

- `/home/yoni/labsemse/reportes/README.md`
- `/home/yoni/labsemse/reportes/prompts/README.md`
- `/home/yoni/labsemse/reportes/planning/README.md`
- `/home/yoni/labsemse/reportes/audits/README.md`

## Movimientos realizados

### A `prompts/`

- `prompt_codex_frontend_emparejamiento_2026-04-07.md`
- `prompt_codex_hardening_completo_2026-04-07.md`

### A `planning/`

- `plan_emparejamiento_frontend_2026-04-07.md`
- `backlog_ejecucion_integracion_semse_webassistant_2026-04-05.md`
- `blueprint_detallado_integracion_semse_webassistant_2026-04-05.md`
- `dtos_exactos_integracion_semse_webassistant_2026-04-05.md`
- `historias_jira_linear_integracion_semse_webassistant_2026-04-05.md`
- `mapeo_pantallas_webassistant_a_semse_2026-04-05.md`

### A `audits/`

- `audit_report.md`

## Correcciones internas

También se corrigieron links viejos en:

- `avance_frontend_emparejamiento_2026-04-08.md`
- `implementacion_epica_p0_projects_archivo_por_archivo_2026-04-05.md`
- `agent-runtime/memo_ejecutivo_cierre_runtime_2026-04-05.md`
- los documentos de `planning/` que todavía enlazaban a `/home/yoni/reportes/...`

## Verificación real

Se ejecutó:

```bash
node /home/yoni/labsemse/scripts/audit-report-paths.mjs
```

Resultado:

- `OK: no missing absolute paths in reportes/`

## Resultado

`reportes/` quedó más gobernable:

- la raíz concentra cierres y evidencia;
- `prompts/` agrupa insumos de trabajo;
- `planning/` agrupa artefactos previos a ejecución;
- `audits/` encapsula auditoría legacy;
- los enlaces internos quedaron navegables.
