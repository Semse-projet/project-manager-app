# Inventario de copias externas de documentos canónicos

Fecha: 2026-04-08
Base auditada: `/home/yoni`

## Objetivo

Detectar si los documentos soberanos de `labsemse` estaban replicados fuera del árbol oficial y dejar gobernado qué hacer con esas copias.

## Resultado

Los documentos canónicos reales siguen concentrados en:

- `constitution/`
- `repository-rules/`
- `program/`
- `_governance/`

Fuera de `labsemse/`, solo apareció una copia relevante con nombre canónico:

- `/home/yoni/skills /Quebes esto - Claude_files/01_KERNEL.md`

## Clasificación

Esta copia externa debe leerse como:

- export o residuo de trabajo;
- copia desautorizada;
- no canónica;
- no apta para gobernar decisiones del ecosistema.

## Señal importante

La búsqueda global también devolvió muchos `CONTRIBUTING.md`, pero pertenecen a:

- `node_modules/`
- herramientas globales de npm
- dependencias de satellites

No son documentos soberanos de `SEMSE` y no deben mezclarse con esta auditoría.

## Regla operativa

Si vuelve a aparecer una copia con nombre canónico fuera de `labsemse/`:

1. no se promueve automáticamente a fuente de verdad;
2. se registra como copia externa;
3. se compara con el soberano solo si aporta contexto útil;
4. manda siempre la versión dentro de `labsemse/`.

## Relación con `agents`

En paralelo se revisó `agents/` y no se encontró duplicación estructural grave.
El único subárbol que requería mejor índice era:

- `agents/agent-runtime/`

Eso se corrigió para distinguir:

- núcleo de runtime;
- operación persistente;
- paquetes de decisión.
