# CONTRIBUTING

## Proposito

Definir como contribuir a SEMSEproject sin volver a fragmentar el sistema.

## Antes de tocar codigo

Lee en este orden:

1. `repository-rules/CANONICITY.md`
2. `vision/`
3. `program/`
4. `repository-rules/MIGRATION_RULES.md`

## Regla principal

No abras una nueva app paralela para resolver un problema del producto.

El destino oficial del desarrollo estructural es:

- `project-manager-app`

## Donde va cada tipo de cambio

### Vision

- `vision/`

### Ejecucion, backlog y fases

- `program/`

### Frontend destino

- `project-manager-app/apps/web`

### Backend

- `project-manager-app/apps/api`

### Worker

- `project-manager-app/apps/worker`

### UI compartida

- `project-manager-app/packages/ui`

### Schemas y contratos

- `project-manager-app/packages/schemas`

## Regla sobre `src/`

`src/` sigue siendo util, pero:

- se usa como referencia transicional
- no debe convertirse otra vez en el centro del sistema
- todo valor nuevo que nazca ahi debe tener plan de absorcion al monorepo

## Regla sobre carpetas congeladas

No desarrolles nuevas capacidades en:

- `app semse/Agent_Matriz de agentes`
- `app semse/Agent_Chat semántico sobre PDFs`
- `app semse/app`

Si encuentras valor ahi:

1. documenta que parte vale
2. extraela al destino canonico
3. no extiendas la rama paralela

## Regla sobre duplicacion

Si vas a introducir:

- un nuevo tipo
- un nuevo componente compartido
- un nuevo layout
- un nuevo flujo core

primero revisa si ya existe una version canonicamente correcta.

## Pull Requests o cambios equivalentes

Toda contribucion importante debe responder:

1. que problema resuelve
2. donde vive el cambio
3. por que ese destino es el correcto
4. si reemplaza o convive con algo previo
5. si reduce o aumenta fragmentacion

## Criterio de aceptacion

Un cambio es mejor si:

- reduce fragmentacion
- aumenta claridad de precedencia
- acerca la UX al tronco canonico
- usa contratos compartidos
- evita nuevos modelos paralelos

## Criterio de rechazo

Un cambio debe replantearse si:

- crea otra app
- redefine dominio fuera de `packages/schemas`
- agrega backend core fuera de `apps/api`
- copia carpetas enteras desde una rama paralela
- prolonga una duplicacion conflictiva
