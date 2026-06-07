# SEMSE Anatomy Knowledge Domain

## Objetivo

Introducir un dominio vivo de conocimiento anatómico dentro del monorepo canónico para validar el patrón:

- conocimiento estructurado;
- agentes especializados;
- API reusable;
- vertical slice visible en UI.

## Componentes

- Schemas: `packages/schemas/src/anatomy-*.schema.ts`
- Seed y queries: `packages/knowledge/src/anatomy/`
- Agentes: `packages/agents/src/anatomy.ts`
- API: `apps/api/src/modules/anatomy`
- UI: `apps/web/app/anatomy`

## Decisión arquitectónica

Se creó `packages/knowledge` porque el repo no tenía una capa reusable para seeds de conocimiento, loaders y queries de dominio.
No se reutilizó `shared` ni `agents` para evitar mezclar:

- utilidades runtime genéricas;
- catálogo agentic;
- almacenamiento/consulta de conocimiento estructurado.

## Estado

El dominio anatómico queda como piloto funcional del motor de conocimiento cooperativo de `SEMSE`.
