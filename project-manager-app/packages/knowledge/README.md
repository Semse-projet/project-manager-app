# packages/knowledge

Capa reusable de conocimiento estructurado para dominios vivos de SEMSE.

## Primer dominio

- `anatomy`: ontología anatómica jerárquica con seed, loaders, normalización y queries base.

## Regla

Este paquete no redefine contratos.
Los contratos públicos viven en `@semse/schemas`.

## Motivo de existencia

El repo no tenía una capa reusable para:

- seeds de conocimiento versionados;
- queries semánticas/jerárquicas;
- normalización de nodos y relaciones;
- lectura estructurada por backend, web y agentes.

