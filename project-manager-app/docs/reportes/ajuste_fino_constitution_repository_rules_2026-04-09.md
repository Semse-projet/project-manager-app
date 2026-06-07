# Ajuste fino de `constitution/` y `repository-rules/`

Fecha: 2026-04-09
Base: `/home/yoni/labsemse`

## Objetivo

Corregir residuos de rutas viejas y lenguaje desactualizado en la capa más alta del sistema documental:

- `constitution/`
- `repository-rules/`

## Cambios aplicados

Se corrigieron rutas antiguas de `app semse/project-manager-app` a `project-manager-app` en:

- `repository-rules/MIGRATION_RULES.md`
- `repository-rules/CONTRIBUTING.md`
- `constitution/02_AUTHORITY_MAP.md`
- `constitution/03_NODE_REGISTRY.md`

## Resultado

La capa normativa ya quedó alineada con el layout real del repo:

- `project-manager-app/` como canónico técnico;
- `constitution/` como canon soberano;
- `repository-rules/` como reglas de precedencia y contribución.

## Verificación

Se ejecutó:

```bash
rg -n 'app semse/project-manager-app|labsemse_project' constitution repository-rules
```

Resultado:

- sin coincidencias
