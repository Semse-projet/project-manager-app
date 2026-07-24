# Breadcrumb duplicado y href cross-rol (1.12)

**Fecha:** 2026-07-23  
**Rama:** `devin/1784900000-breadcrumb-duplicates`  
**Item del AUDIT_REMEDIATION_PLAN.md:** 1.12 (ALTO — navegación cross-rol)

## Resumen

`ClientBreadcrumbs` (usado por `ClientPageHeader`) siempre antepone su propio crumb `"Dashboard"` con href `/client/dashboard`. En `/client/professionals` y `/worker/agenda` las páginas ya incluyen un crumb `"Dashboard"`, lo que resulta en `"Dashboard > Dashboard"`. Además, en `/worker/agenda` el crumb inyectado apuntaba a `/client/dashboard` en vez de `/worker/dashboard`, enviando a un PRO al dashboard del rol Cliente.

## Cambios

- `apps/web/app/components/client/ClientBreadcrumbs.tsx` — ahora detecta si el primer `items` ya es `"Dashboard"` (case-insensitive) y, en ese caso, no antepone otro crumb, respetando el `href` que la página proporciona.
- `docs/AUDIT_REMEDIATION_PLAN.md` — item 1.12 marcado `[x]`.

## Impacto

- `/client/professionals`: evita el crumb duplicado y conserva el link a `/client/dashboard`.
- `/worker/agenda`: evita el crumb duplicado y conserva el link correcto a `/worker/dashboard`.
- El resto de pantallas que no incluyen su propio `"Dashboard"` siguen recibiendo el crumb automático de `CLIENT_ROUTES.dashboard` como antes.

## Validación local

- `pnpm lint` — 0 errores (54 warnings preexistentes)
- `pnpm typecheck` — pasa
- `pnpm build:api` — pasa
- `pnpm build:web` — pasa
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores
