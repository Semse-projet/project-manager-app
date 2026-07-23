# Admin UI Remediation — Batch 18

**Fecha:** 2026-07-23  
**Rama:** `devin/1784830000-admin-remediation-header-batch-18`  
**Items del AUDIT_REMEDIATION_PLAN.md:** 3.6 (continuación)

## Resumen

Se extendió el uso del componente compartido `AdminPageHeader` a tres páginas de Admin más: `/admin/html-in-canvas`, `/admin/browser-agent/missions` y `/admin/users/[id]`.

## Cambios

- `apps/web/app/(app)/admin/html-in-canvas/page.tsx` — `AdminPageHeader` con icono `Layers`, notificación y `SupportBanner` como acciones.
- `apps/web/app/(app)/admin/browser-agent/missions/page.tsx` — `AdminPageHeader` con `panel={true}`, icono `Layers` y link a Inspección Simple.
- `apps/web/app/(app)/admin/users/[id]/page.tsx` — `AdminPageHeader` con icono `User`, back link a `/admin/users` y botón Actualizar.
- `docs/AUDIT_REMEDIATION_PLAN.md` — item 3.6 actualizado (incluye también los verticales del batch 17 y ahora los nuevos).
- `docs/specs/ui/admin-flows-remediation.spec.md` — checklist actualizado.

## Validación local

- `pnpm lint` — 0 errores (warnings preexistentes)
- `pnpm typecheck` — pasa
- `pnpm build:api` — pasa
- `pnpm build:web` — pasa
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores

## Pendiente

- Aplicar `AdminPageHeader` a las ~16 páginas de Admin restantes para cerrar 3.6.
- Verificación en vivo con credencial `OPS_ADMIN`.
