# Remediación 2.24 y 2.25 — Validación y badge de solicitudes de material

**Fecha:** 2026-07-23  
**Ítems del plan:** `docs/AUDIT_REMEDIATION_PLAN.md` 2.24 (MEDIO), 2.25 (BAJO)  
**Archivo modificado:** `apps/web/app/(app)/worker/materials/page.tsx`

## Hallazgos originales

- **2.24**: el formulario "Solicitar material" solo comprobaba que `formQty` no estuviera vacía, no que fuera un número positivo. El backend rechaza `0` y negativos (`z.number().positive()`), pero el usuario no recibía aviso inline hasta el error post-submit.
- **2.25**: el badge de estado `rejected` usaba la variante `neutral` (gris) en vez de `error` (rojo), siendo inconsistente con la semántica y con otros flujos como Incidencias.

## Solución

- Se agregó validación inline en `handleSubmit`:
  - `qtyNum` debe ser finito y mayor a `0`; si no, se muestra `submitError = "La cantidad debe ser un número mayor a 0."` y no se envía nada al backend.
  - `estimatedCost`, si se proporciona, debe ser mayor o igual a `0`; si no, se muestra `submitError = "El costo estimado no puede ser negativo."`.
- `STATUS_MAP.rejected` cambió de `variant: "neutral"` a `variant: "error"`, para mostrar un `StatusBadge` rojo consistente con el significado de "Rechazado".

## Validación

- `pnpm --filter @semse/web lint` — 0 errores (54 warnings preexistentes)
- `pnpm exec tsc --noEmit --project apps/web/tsconfig.json` — pasa
- `pnpm build:web` — 402/402 páginas estáticas generadas sin errores
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores

## Pendiente

- Verificación en vivo con una sesión de worker/profesional para confirmar que cantidades `0` y negativas muestran el error inline y el badge `rejected` aparece en rojo.
