# Comparación de `semse_project_optimized.zip` con el estado actual

Fecha: 2026-04-09
Artefacto analizado:

- `/home/yoni/labsemse/archive/artifacts/semse_project_optimized.zip`

## Veredicto

`semse_project_optimized.zip` no es una alternativa canónica al estado actual.
Es un snapshot anterior del ecosistema, previo a la consolidación documental y estructural que hoy ya existe en `labsemse/`.

## Qué contiene el ZIP

En la raíz del ZIP aparecen:

- `src/`
- `vision/`
- `_governance/`
- `program/`
- `labsemse_project/`
- documentos sueltos como `01_KERNEL.md`, `CANONICITY.md`, `ARCHITECTURE_AUDIT.md`, `CONSOLIDATION_MATRIX.md`
- artefactos como `PLAN_CONSOLIDACION.html`, `SEMSE_Cronograma_Madurez.pptx`, `supabase_schema.sql`

Conteos relevantes:

- `src/` → 101 archivos
- `vision/` → 14 archivos
- `_governance/` → 7 archivos
- `labsemse_project/` → 1290 archivos

## Qué NO contiene respecto al estado actual

El ZIP no contiene estas capas ya consolidadas:

- `repository-rules/`
- `constitution/`
- `archive/`
- `agents/`
- `reportes/`
- `project-manager-app/`

Conteo dentro del ZIP:

- `repository-rules/` → 0
- `constitution/` → 0
- `archive/` → 0
- `agents/` → 0
- `reportes/` → 0
- `project-manager-app/` → 0

## Lectura arquitectónica

El ZIP representa una etapa donde:

- los documentos soberanos todavía estaban sueltos en la raíz;
- `_governance/` seguía plano;
- el monorepo técnico aún vivía bajo `labsemse_project/`;
- no existía la separación actual entre:
  - `constitution/`
  - `repository-rules/`
  - `agents/`
  - `reportes/`
  - `archive/`

## Comparación con el presente

Estado actual de `labsemse/`:

- `project-manager-app/` en raíz como canónico técnico
- `constitution/` para el canon soberano
- `repository-rules/` para precedencia y migración
- `agents/` para la base documental agentic
- `reportes/` para evidencia y cierres
- `archive/` para artefactos históricos

Eso significa que el estado actual no solo es más nuevo: también es más gobernable.

## Qué valor conserva el ZIP

- sirve como evidencia de la etapa previa del repositorio;
- ayuda a entender desde qué layout se hizo la consolidación;
- puede usarse como referencia histórica si hace falta reconstruir decisiones de origen.

## Qué NO debe hacerse

- no usar el ZIP como fuente de verdad actual;
- no reinyectar su layout a la raíz de `labsemse`;
- no tomar sus rutas como más válidas que las actuales.

## Conclusión

`semse_project_optimized.zip` es un artefacto histórico útil, no un candidato a reemplazar el estado presente.
El repositorio actual ya está más maduro y mejor organizado que ese snapshot.
