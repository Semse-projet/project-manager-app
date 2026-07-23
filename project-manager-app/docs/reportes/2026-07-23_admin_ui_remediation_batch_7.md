# Admin UI Remediation — Batch 7

**Fecha:** 2026-07-23  
**Rama:** `devin/1784819000-admin-remediation-header-more`  
**Items del AUDIT_REMEDIATION_PLAN.md:** 3.6 (continuación)

## Resumen

Continuación del item 3.6: se amplió el uso del componente compartido `AdminPageHeader` a tres páginas de Admin adicionales: `/admin/settings`, `/admin/coordinator` y `/admin/field-ops`. Se agregó soporte para `showBack` en el componente para pantallas que no requieren link a Dashboard.

## Cambios

- `apps/web/app/components/admin/AdminPageHeader.tsx`:
  - Nueva prop `showBack` (por defecto `true`) para ocultar el link a Dashboard cuando no aplica.
- `apps/web/app/(app)/admin/settings/page.tsx`:
  - Reemplaza header propio por `AdminPageHeader`.
- `apps/web/app/(app)/admin/coordinator/page.tsx`:
  - Reemplaza header propio por `AdminPageHeader` con `showBack={false}`.
- `apps/web/app/(app)/admin/field-ops/page.tsx`:
  - Reemplaza header propio por `AdminPageHeader`.
- `docs/AUDIT_REMEDIATION_PLAN.md`:
  - Item 3.6 actualizado con las páginas migradas en este lote.

## Validación local

- `pnpm lint` — 0 errores (warnings preexistentes)
- `pnpm typecheck` — pasa
- `pnpm build:api` — pasa
- `pnpm build:web` — pasa
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores

## Pendiente

- Aplicar `AdminPageHeader` a las ~49 páginas de Admin restantes para cerrar 3.6.
- Verificación en vivo con credencial `OPS_ADMIN`.
