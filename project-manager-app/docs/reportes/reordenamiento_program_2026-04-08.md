# Reordenamiento de program

Fecha: 2026-04-08
Base: `/home/yoni/labsemse/program`

## Objetivo

Separar el programa activo de los planes, backlogs y estados históricos que estaban mezclados en la raíz.

## Decisión

La raíz de `program` debe quedar reservada para el núcleo programático vivo:

- `MASTERPLAN.md`
- `ARCHITECTURE_TARGET.md`
- `ROADMAP_12_MESES.md`
- `README.md`

El resto debe bajar a subcarpetas por función.

## Cambios realizados

### Movido a `execution/history`

- `BACKLOG_INICIAL.md`
- `HARDENING_SPRINT_PLAN.md`
- `INTEGRATION_EXECUTION_PLAN.md`
- `SPRINT_01_DOMAIN_BACKLOG.md`
- `SPRINT_02_SECURITY_BACKLOG.md`
- `SPRINT_03_SCHEMA_BACKLOG.md`
- `SPRINT_04_JOB_PROJECT_BACKLOG.md`

### Movido a `status/history`

- `INTEGRATION_EXECUTION_STATUS.md`
- `SPRINT_02_SECURITY_STATUS.md`
- `SPRINT_03_SCHEMA_STATUS.md`
- `SPRINT_04_JOB_PROJECT_STATUS.md`

### Movido a `strategy/phases`

- `PHASE_01_MVP.md`
- `README_STRUCTURE.md`

### Movido a `governance/coherence`

- `COHERENCE_AUDIT.md`

### Índices creados o actualizados

- `program/README.md`
- `program/execution/README.md`
- `program/status/README.md`
- `program/strategy/README.md`
- `program/governance/coherence/README.md`

## Resultado

`program/` ahora separa mejor:

- dirección viva;
- ejecución;
- estado;
- coherencia;
- historial operativo.
