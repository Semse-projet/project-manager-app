# Contexto SEMSEproject — punto de entrada

**Estado:** el contexto raíz anterior queda supersedido desde 2026-07-16.

La fuente operativa compacta para personas y agentes es
[`project-manager-app/docs/SEMSE_CONTEXT.md`](project-manager-app/docs/SEMSE_CONTEXT.md).

Reglas mínimas antes de trabajar:

- la raiz Git es este checkout de `Semse-projet/project-manager-app`;
- la raiz canónica de desarrollo es `project-manager-app/`;
- `main` actual prevalece sobre documentos y conversaciones;
- specs, Zod, Prisma, migrations y tests gobiernan los contratos;
- codigo, CI, merge, despliegue y activacion por feature flag son estados
  distintos;
- no hacer renombramientos masivos ni crear plataformas paralelas a los nueve
  dominios;
- no exponer secretos ni inspeccionar `.env` reales.

Entradas canónicas:

- [Arquitectura](project-manager-app/docs/architecture/CURRENT_ARCHITECTURE.md)
- [Matriz](project-manager-app/docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md)
- [Roadmap](project-manager-app/ROADMAP.md)
- [Specs](project-manager-app/docs/SPEC_INDEX.md)
- [Reglas para agentes](project-manager-app/AGENTS.md)
