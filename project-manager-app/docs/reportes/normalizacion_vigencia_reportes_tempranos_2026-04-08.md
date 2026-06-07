# Normalización de vigencia en reportes tempranos

Fecha: 2026-04-08
Base: `/home/yoni/labsemse/reportes`

## Objetivo

Evitar que los informes tempranos de abril 4 se lean como estado vigente del ecosistema después de:

- la consolidación final de `project-manager-app/`
- el reordenamiento documental de `labsemse`
- el cierre posterior de hardening, auth lifecycle, observabilidad y runtime

## Criterio aplicado

Tomando el mismo enfoque usado al analizar `infclaude`, se reforzó esta distinción:

- evidencia histórica válida;
- contexto vigente del sistema.

No todo reporte viejo está mal. El problema aparece cuando evidencia correcta se interpreta como fotografía actual.

## Cambios aplicados

Se añadieron notas históricas explícitas en:

- `informe_maestro_semse_2026-04-04.md`
- `informe_levantamiento_backend_2026-04-04.md`
- `informe_validacion_api_2026-04-04.md`
- `informe_e2e_web_2026-04-04.md`
- `informe_migraciones_prisma_2026-04-04.md`

También se actualizó:

- `reportes/README.md`

para dejar claro que los informes tempranos siguen siendo útiles como evidencia, pero no deben leerse como estado actual sin contrastarlos con cierres posteriores.

## Verificación

Se ejecutó:

```bash
node /home/yoni/labsemse/scripts/audit-report-paths.mjs
```

Resultado:

- `OK: no missing absolute paths in reportes/`

## Resultado

La carpeta `reportes/` ya no solo está ordenada por ubicación y enlaces.
Ahora también tiene mejor semántica temporal:

- qué es evidencia vigente;
- qué es planning;
- qué es prompt;
- qué es auditoría legacy;
- y qué informe debe leerse explícitamente como histórico.
