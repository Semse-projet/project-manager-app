# Reordenamiento de raíz documental

Fecha: 2026-04-08
Base: `/home/yoni/labsemse`

## Objetivo

Reducir mezcla entre:

- documentos constitucionales vigentes del ecosistema;
- análisis históricos de consolidación del repositorio;
- artefactos residuales de bootstrap.

## Decisión

La raíz debe quedar reservada principalmente para:

- constitución soberana (`01` a `08`);
- reglas de precedencia (`CANONICITY`, `ARCHIVE_POLICY`, `MIGRATION_RULES`, `CONTRIBUTING`);
- marco maestro expandido.

Los análisis de consolidación del repo no deben seguir ocupando la raíz.

## Cambios realizados

### Movidos a `program/governance/repository-consolidation`

- `ARCHITECTURE_AUDIT.md`
- `CONSOLIDATION_MATRIX.md`
- `SEMSE_CONSOLIDATION_ACTION_PLAN.md`
- `SEMSE_MASTER_CONSOLIDATION_ANALYSIS.md`

### Artefacto residual archivado

- `info.md` -> `_governance/archive/vite_bootstrap_info.md`

### Índices actualizados

- `README.md`
- `program/governance/README.md`
- `program/governance/repository-consolidation/README.md`

## Resultado

La raíz queda más limpia y más legible:

- menos mezcla entre canon y análisis histórico;
- mejor separación entre soberanía, programa, agentes, reportes y gobernanza;
- menor riesgo de que un documento viejo de consolidación sea confundido con fuente viva de decisión.
