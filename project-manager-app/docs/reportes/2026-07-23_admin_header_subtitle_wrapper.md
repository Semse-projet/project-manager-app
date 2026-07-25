# AdminPageHeader — wrapper de subtitle evita HTML inválido

**Fecha:** 2026-07-23  
**Rama:** `devin/1784900000-admin-header-subtitle-wrapper`  
**PR relacionado:** #404 (ya mergeado)

## Resumen

El review posterior al PR #404 señaló que `AdminPageHeader` renderizaba la prop `subtitle` dentro de un `<p>`. En `/admin/intelligence-rooms/[id]` el `subtitle` es un `<div>` con badges flex, lo que genera anidamiento HTML inválido (`<div>` dentro de `<p>`) y puede provocar errores de hidratación en Next.js.

## Cambio

- `apps/web/app/components/admin/AdminPageHeader.tsx`
  - El contenedor de `subtitle` cambió de `<p>` a `<div>`, respetando el mismo estilo visual.
  - Esto permite que consumidores pasen elementos en línea o bloque sin romper el DOM.

## Validación local

- `pnpm lint` (`@semse/web`) — 0 errores (54 warnings preexistentes)
- `pnpm typecheck` — pasa
- `pnpm build:api` — pasa
- `pnpm build:web` — pasa
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores
