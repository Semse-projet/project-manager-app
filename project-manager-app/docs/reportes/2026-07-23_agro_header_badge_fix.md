# Admin Agro — Restaurar insignia "Live" y eliminar import sin usar

**Fecha:** 2026-07-23  
**Rama:** `devin/1784900000-agro-header-badge-fix`  
**PR relacionado:** #402 (ya mergeado)

## Resumen

El PR #402 migró `/admin/verticals/agro` a `AdminPageHeader` compartido, pero el review posterior detectó dos problemas:

- La insignia `"Live"` que identificaba el estado de la vertical Agro desapareció durante la migración.
- El import `DollarSign` de `lucide-react` quedó sin usar (reportado por CodeQL).

## Cambios

- `apps/web/app/(app)/admin/verticals/agro/page.tsx`
  - Se eliminó `DollarSign` del import de `lucide-react`.
  - Se restauró la insignia `<span className="badge badge-green" style={{ fontSize: 10 }}>Live</span>` dentro de `actions` de `AdminPageHeader`, antes del link "Ir a Agro".

## Validación local

- `pnpm lint` (`@semse/web`) — 0 errores (54 warnings preexistentes)
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm build:web` — pasa

Pendiente verificación en vivo con credencial `OPS_ADMIN`.
