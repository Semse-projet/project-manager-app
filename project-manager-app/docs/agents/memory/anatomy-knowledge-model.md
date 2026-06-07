# Anatomy Knowledge Model

## Memoria compartida del dominio

El dominio anatómico usa una memoria estructurada compuesta por:

- `nodes`
- `relations`
- `version`
- `source`
- `confidence`

## Tipos mínimos

- `body`
- `region`
- `subregion`
- `functional_unit`
- `organ`
- `tissue`
- `cell`

## Relaciones mínimas

- `part_of`
- `contains`
- `connected_to`
- `functionally_related_to`
- `depends_on`

## Fuente viva

La seed vive en:

- `project-manager-app/packages/knowledge/src/anatomy/seed/anatomy.seed.json`

La memoria no se considera válida si rompe:

- ids únicos;
- árbol sin raíz;
- padres ausentes;
- relaciones hacia nodos inexistentes.

