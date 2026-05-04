# Anatomy Agent Runtime Spec

## Alcance

Los agentes anatómicos viven en `project-manager-app/packages/agents/src/anatomy.ts`.

## Agentes

- `anatomy-ingestor`
- `anatomy-normalizer`
- `anatomy-validator`
- `anatomy-tutor`

## Dependencias runtime

- `project-manager-app/packages/knowledge/dist`
- `project-manager-app/packages/schemas`

## Entradas mínimas

- ingestor: `{ text }`
- normalizador: `{ term }`
- validador: `{}`
- tutor: `{ nodeId? | question? | search? }`

## Salidas mínimas

- coincidencias detectadas
- término normalizado
- validación del dominio
- respuesta explicativa con `node`, `children`, `relations` y `path`

## Restricción actual

En esta iteración, los agentes anatómicos quedan integrados como catálogo server-only del dominio dentro de `packages/agents`, pero no se enchufan al runtime gobernado de `governance.ts` ni al `agentCatalog` legacy.
Se usan por API como agentes de conocimiento especializados para no romper los contratos existentes del subsistema de agentes.
