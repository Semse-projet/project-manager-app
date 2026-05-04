# Clasificación `openai/` y `supabase/` — 2026-04-09

## Objetivo

Cerrar la ambigüedad documental de dos carpetas de raíz que podían confundirse con capas vivas del ecosistema:

- `/home/yoni/labsemse/openai`
- `/home/yoni/labsemse/supabase`

## Decisión

### `openai/`

- Estado: `REFERENCE_ONLY`
- Tipo: snapshot técnico / vendor source
- Canonicidad: no canónico

No debe usarse como base operativa de integraciones agentic ni como fuente de verdad del runtime.

### `supabase/`

- Estado: `TRANSITIONAL`
- Tipo: infraestructura y artefactos heredados
- Canonicidad: no canónico

Puede seguir teniendo valor para la capa Vite transicional en `/home/yoni/labsemse/src`, pero no gobierna el backend vivo ni el modelo de datos canónico.

## Cambios realizados

### Nuevos archivos de estado

- `/home/yoni/labsemse/openai/STATUS.md`
- `/home/yoni/labsemse/supabase/STATUS.md`

### Navegación raíz corregida

Actualizado:

- `/home/yoni/labsemse/README.md`

Cambios aplicados:

- clasificación explícita de `openai/` como `REFERENCE_ONLY`;
- clasificación más precisa de `supabase/` como infraestructura transitoria heredada;
- corrección del stack de build del monorepo vivo a `npm workspaces + prebuild scripts explícitos`;
- ampliación de la tabla de capas documentales para incluir zonas transicionales y vendor/reference.

### Regla de canonicidad reforzada

Actualizado:

- `/home/yoni/labsemse/repository-rules/CANONICITY.md`

Cambios aplicados:

- `openai/` añadido como `Reference only (vendored / external snapshots)`;
- regla explícita de que `openai/` no gobierna integración ni runtime de SEMSE;
- regla explícita de que `supabase/` conserva solo valor transicional y no desplaza a `project-manager-app`.

## Verificación

Ejecutado:

- `node [audit-canonical-docs.mjs](/home/yoni/labsemse/scripts/audit-canonical-docs.mjs)`
- `node [audit-report-paths.mjs](/home/yoni/labsemse/scripts/audit-report-paths.mjs)`

Resultado esperado de cierre:

- sin rutas canónicas viejas en zonas estables;
- sin rutas absolutas rotas en `reportes/`.

## Resultado

La raíz documental del ecosistema queda más clara:

- `project-manager-app/` = implementación viva
- `agents/`, `program/`, `vision/`, `constitution/`, `repository-rules/` = canon estable
- `reportes/` = evidencia
- `supabase/` = transición
- `openai/` = referencia técnica externa
