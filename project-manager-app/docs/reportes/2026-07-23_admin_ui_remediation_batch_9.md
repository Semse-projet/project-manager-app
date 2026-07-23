# Admin UI Remediation — Batch 9

**Fecha:** 2026-07-23  
**Rama:** `devin/1784821000-admin-remediation-header-panel`  
**Items del AUDIT_REMEDIATION_PLAN.md:** 3.6 (continuación)

## Resumen

Se añadió soporte de variante `panel` a `AdminPageHeader` (usa `HtmlInCanvasPanel` para conservar el estilo visual de páginas que ya lo usaban en el header) y se migraron tres páginas de Admin más: `/admin/qa`, `/admin/reports` y `/admin/dashboard`.

## Cambios

- `apps/web/app/components/admin/AdminPageHeader.tsx`:
  - Nueva prop `panel` para envolver el header en `HtmlInCanvasPanel` (`rounded-2xl`, `minHeight={82}`).
- `apps/web/app/(app)/admin/qa/page.tsx` — usa `AdminPageHeader` con `panel`.
- `apps/web/app/(app)/admin/reports/page.tsx` — usa `AdminPageHeader` con `panel`.
- `apps/web/app/(app)/admin/dashboard/page.tsx` — usa `AdminPageHeader` (sin `panel`); el badge de canvas y el botón de refrescar se conservan en acciones.
- `docs/AUDIT_REMEDIATION_PLAN.md` — item 3.6 actualizado.
- `docs/specs/ui/admin-flows-remediation.spec.md` — checklist actualizado.

## Validación local

- `pnpm lint` — 0 errores (warnings preexistentes)
- `pnpm typecheck` — pasa
- `pnpm build:api` — pasa
- `pnpm build:web` — pasa
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores

## Pendiente

- Aplicar `AdminPageHeader` a las ~43 páginas de Admin restantes para cerrar 3.6.
- Verificación en vivo con credencial `OPS_ADMIN`.
