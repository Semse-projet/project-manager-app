# Sprint 01 Domain Backlog

## Objetivo

Cerrar las ambiguedades de dominio que hoy afectan seguridad, contratos e integracion.

## Historias de Trabajo

### 1. Definir frontera `Job` vs `Project`

Resultado esperado:

- tabla clara de responsabilidades
- reglas de lectura correcta durante la transicion

Salida:

- `JOB_VS_PROJECT_BOUNDARY.md`

### 2. Definir invariantes de lifecycle

Resultado esperado:

- transiciones validas de `Job`
- transiciones validas de `Project`
- condiciones financieras y de milestones por transicion

Salida:

- `DOMAIN_INVARIANTS.md`

### 3. Fijar ownership por agregado

Resultado esperado:

- ownership explicito para:
  - jobs
  - projects
  - payments
  - milestones
  - disputes

Salida:

- matriz de ownership dentro de `DOMAIN_INVARIANTS.md`

### 4. Alinear docs tecnicos actuales

Resultado esperado:

- `DOMAIN_MODEL_MVP.md` actualizado
- `IMPLEMENTATION_GAPS_VS_VISION.md` actualizado

### 5. Preparar backlog de endurecimiento derivado

Resultado esperado:

- lista de cambios concretos para Sprint 2 y Sprint 3

Salida:

- `SPRINT_02_SECURITY_BACKLOG.md`
- `SPRINT_03_SCHEMA_BACKLOG.md`

## Checklist de Cierre

- no queda ambiguedad entre lenguaje canonico y herencia tecnica
- ownership queda explicado por organizacion
- los estados heredados quedan marcados como transicion
- los proximos sprints salen de backlog real y no de intuicion
