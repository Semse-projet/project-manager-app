# Remediación 1.8 — Estado vacío en `/client/milestones`

**Fecha:** 2026-07-23  
**Ítem del plan:** `docs/AUDIT_REMEDIATION_PLAN.md` 1.8 (MEDIO)  
**Archivo modificado:** `apps/web/app/(app)/client/milestones/page.tsx`

## Hallazgo original

La pantalla de hitos del cliente (`/client/milestones`) mostraba un área vacía (`HtmlInCanvasPanel` de 380 px sin contenido) cuando no había trabajos activos con milestones. El plan también asociaba a este archivo un error de hidratación de React (#418), reproducible al cargar la vista sin datos.

## Solución

Se agregó un estado vacío explícito que se renderiza cuando `!loading && !error && groups.length === 0`:

- Título: "No tienes hitos de pago activos"
- Descripción: "Cuando tengas trabajos en curso, sus hitos aparecerán aquí."
- CTA: link "Ver mis trabajos" que lleva a `CLIENT_ROUTES.jobs`.

Cuando hay grupos de hitos, se sigue mostrando el `HtmlInCanvasPanel` con las tarjetas de proyecto. El panel vacío de 380 px ya no se renderiza sin contenido, eliminando la posible fuente de hidratación inconsistente.

## Validación

- `pnpm --filter @semse/web lint` — 0 errores (54 warnings preexistentes)
- `pnpm exec tsc --noEmit --project apps/web/tsconfig.json` — pasa
- `pnpm build:web` — 402/402 páginas estáticas generadas sin errores
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores

## Limitaciones / pendientes

- **Verificación en vivo pendiente:** no se pudo probar con una sesión real de cliente por falta de credenciales/cookie de sesión. El fix es puramente UI y puede validarse abriendo `/client/milestones` en una cuenta sin trabajos activos.
