# Sprint 04 Job Project Backlog

## Objetivo

Iniciar la transicion incremental desde `Project` operativo hacia `Job`
canonico sin romper el API ni los flujos ya estabilizados.

## Tareas

### 1. Inventario de rutas

- listar endpoints project-centric
- listar endpoints job-first ya existentes
- identificar consumers web y ops que aun dependen de `projectId`

### 2. Helpers compartidos

- crear helper o repositorio comun para resolver `jobId -> projectId`
- evitar repeticion en milestones, evidence, payments y trust

### 3. Lecturas job-first

- revisar `milestones`
- revisar `evidence`
- revisar `trust`
- revisar `ops`

Objetivo:

- preferir `jobId` como entrada canonica
- mantener compatibilidad con `projectId`

### 4. Ownership derivado

- definir ownership a partir de `Job`
- reducir consultas que leen ownership solo desde `Project`

### 5. Riesgos y compatibilidad

- documentar que rutas siguen legacy
- documentar acoplamientos que no deben tocarse aun

## Definition of Done

- mapa claro de endpoints job-first vs project-centric
- backlog tecnico para mover lecturas a `Job`
- plan de compatibilidad sin romper contratos existentes
