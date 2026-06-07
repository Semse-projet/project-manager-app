# Normalización histórica de `repository-consolidation`

Fecha: 2026-04-08
Base: `/home/yoni/labsemse/program/governance/repository-consolidation`

## Objetivo

Evitar que los documentos de consolidación histórica se lean como estado vigente del repositorio después del cierre de:

- la consolidación de `project-manager-app/` en la raíz;
- la creación de `constitution/`;
- la creación de `repository-rules/`;
- el reordenamiento posterior de `program/`, `agents/`, `_governance/` y `reportes/`.

## Ajustes aplicados

Se añadieron notas explícitas de vigencia histórica en:

- `README.md`
- `ARCHITECTURE_AUDIT.md`
- `CONSOLIDATION_MATRIX.md`
- `SEMSE_CONSOLIDATION_ACTION_PLAN.md`
- `SEMSE_MASTER_CONSOLIDATION_ANALYSIS.md`

## Criterio

Estos documentos siguen siendo valiosos para:

- entender por qué se tomaron ciertas decisiones;
- rastrear el proceso de consolidación;
- revisar el estado anterior del ecosistema.

Pero ya no deben competir con:

- `constitution/`
- `repository-rules/`
- `program/`
- `README.md`

## Resultado

`program/governance/repository-consolidation/` queda preservado como archivo de análisis histórico, no como capa normativa viva.
