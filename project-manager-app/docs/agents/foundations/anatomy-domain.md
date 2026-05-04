# Anatomy Domain

## Propósito

Definir el dominio anatómico como primer caso piloto del motor de conocimiento cooperativo de `SEMSE`.

## Idea central

El dominio anatómico se modela como una ontología jerárquica parte-todo con:

- nodos canónicos;
- relaciones tipadas;
- seed versionada;
- consultas reusables;
- agentes especializados que operan sobre conocimiento estructurado.

## Capas

- contratos: `project-manager-app/packages/schemas`
- conocimiento reusable: `project-manager-app/packages/knowledge`
- agentes: `project-manager-app/packages/agents`
- API: `project-manager-app/apps/api/src/modules/anatomy`
- UI: `project-manager-app/apps/web/app/anatomy`

## Regla

El dominio no vive como texto suelto.
Vive como:

- seed JSON canónica;
- schemas Zod;
- queries programables;
- agentes que consultan la ontología.

