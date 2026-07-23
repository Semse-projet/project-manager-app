# Admin UI Remediation — Batch 8

**Fecha:** 2026-07-23  
**Rama:** `devin/1784820000-admin-remediation-header-batch-3`  
**Items del AUDIT_REMEDIATION_PLAN.md:** 3.6 (continuación)

## Resumen

Se extiende el uso del componente compartido `AdminPageHeader` a tres páginas de Admin adicionales: `/admin/change-orders`, `/admin/contractors` y `/admin/agents`.

## Cambios

- `apps/web/app/(app)/admin/change-orders/page.tsx` — usa `AdminPageHeader` con icono `FilePlus`.
- `apps/web/app/(app)/admin/contractors/page.tsx` — usa `AdminPageHeader` con icono `Building2`.
- `apps/web/app/(app)/admin/agents/page.tsx` — usa `AdminPageHeader` con icono `Bot` y conserva el indicador SSE en el slot de acciones.
- `docs/AUDIT_REMEDIATION_PLAN.md` — item 3.6 actualizado con las páginas migradas.

## Validación local

- `pnpm lint` — 0 errores (warnings preexistentes)
- `pnpm typecheck` — pasa
- `pnpm build:api` — pasa
- `pnpm build:web` — pasa
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores

## Pendiente

- Aplicar `AdminPageHeader` a las ~46 páginas de Admin restantes para cerrar 3.6.
- Verificación en vivo con credencial `OPS_ADMIN`.
