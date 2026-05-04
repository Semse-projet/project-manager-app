# Reordenamiento de artefactos sueltos de raíz

Fecha: 2026-04-08
Base: `/home/yoni/labsemse`

## Objetivo

Sacar de la raíz los artefactos no documentales que ya no debían convivir con la navegación activa del ecosistema.

## Decisión

Se mantuvieron en raíz los archivos del Vite transicional porque todavía sostienen:

- `src/`
- `components.json`
- `package.json`
- `vite.config.ts`
- `tsconfig*`
- `tailwind.config.js`
- `postcss.config.js`
- `eslint.config.js`
- `index.html`

Esos archivos siguen perteneciendo a la app transicional de raíz.

## Movido a `archive/artifacts`

- `PLAN_CONSOLIDACION.html`
- `SEMSE_Cronograma_Madurez.pptx`
- `semse_project_optimized.zip`

## Movido a `archive/sql`

- `supabase_schema.sql`

## Índices creados o actualizados

- `README.md`
- `archive/README.md`
- `archive/artifacts/README.md`
- `archive/sql/README.md`

## Resultado

La raíz de `labsemse` conserva solo:

- el README principal;
- carpetas estructurales del ecosistema;
- y los archivos técnicos necesarios para la app Vite transicional.

Los binarios, exportes y SQL heredado ya no contaminan la navegación principal.
