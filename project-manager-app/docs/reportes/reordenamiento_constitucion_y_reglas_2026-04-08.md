# Reordenamiento de constitución y reglas del repositorio

Fecha: 2026-04-08
Base: `/home/yoni/labsemse`

## Objetivo

Organizar los últimos documentos sueltos que quedaban en la raíz:

- constitución del ecosistema;
- reglas del repositorio.

## Cambios realizados

### Creada `constitution/`

Movidos:

- `01_KERNEL.md`
- `02_AUTHORITY_MAP.md`
- `03_NODE_REGISTRY.md`
- `04_AGENTIC_LAYER.md`
- `05_DATA_ARCHITECTURE.md`
- `06_EXECUTION_ROADMAP.md`
- `07_SELF_IMPROVING_AGENTS.md`
- `08_SPRINT_BACKLOG.md`
- `SEMSE_MARCO_MAESTRO_EXPANDIDO_2026-03-30.md`

También se creó:

- `constitution/README.md`

### Creada `repository-rules/`

Movidos:

- `CANONICITY.md`
- `ARCHIVE_POLICY.md`
- `CONTRIBUTING.md`
- `MIGRATION_RULES.md`

También se creó:

- `repository-rules/README.md`

### Índices actualizados

- `README.md`
- `_governance/protocol/AGENT_PROTOCOL.md`

## Resultado

La raíz de `labsemse` ya no tiene documentos soberanos ni reglas del repo sueltos.

Ahora queda separada así:

- `constitution/` -> soberanía y arquitectura constitucional
- `repository-rules/` -> reglas de precedencia y migración
- `vision/` -> dirección estratégica
- `program/` -> ejecución
- `agents/` -> subsistema agentic
- `reportes/` -> evidencia y cierres

## Nota

Se corrigieron rutas principales de navegación. Pueden quedar referencias históricas menores dentro de documentos antiguos, pero la entrada canónica del repositorio ya quedó alineada.
