# SEMSE Architecture Bridge

> **AREA HISTORICA/DE PUENTE:** las decisiones vigentes se consolidan en
> [`../../architecture/CURRENT_ARCHITECTURE.md`](../../architecture/CURRENT_ARCHITECTURE.md),
> la [matriz de implementacion](../../architecture/IMPLEMENTATION_STATUS_MATRIX.md)
> y el [roadmap F0-F9](../../../ROADMAP.md).

## Purpose

This area formalizes the bridge between:

1. the previous path: an ecosystem with strong vision and multiple pieces already built;
2. the newer path: a more formal construction operating system architecture.

The goal is **not** to replace the old path.
The goal is to:
- preserve the ecosystem vision already built;
- use the new architecture as a precision layer;
- map existing assets into a clearer operating model;
- migrate by segments without destructive resets.

## Core rule

We continue the old path while building the new architecture underneath it.

Meaning:
- SEMSE remains an ecosystem with strong vision;
- the construction app remains part of that ecosystem;
- the construction operating system model becomes the formal architecture layer;
- the new architecture must absorb and organize what already exists.

## Sections

### `01-foundations/`
Bridge principles and architectural intent.

### `02-domain-groups/`
Canonical groups and business structure.

### `03-toolkits/`
Toolkits and tools by group.

### `04-modules/`
Application modules and module ownership.

### `05-permissions/`
Permissions, access logic and RBAC references.

### `06-mappings/`
Mapping from existing pages, flows and assets into the new architecture.

### `07-rollout/`
Migration and rollout by phases, without breaking the current product path.

## Key documents

- `SEMSE_DEVELOPER_RUNTIME_BLUEPRINT.md`
  Blueprint canonico para la terminal agentiva / developer runtime dentro del ecosistema.
