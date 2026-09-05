# Seguimiento 2.24 — Mensajes de validación específicos en /worker/materials

**Fecha:** 2026-07-27  
**Ítem del plan:** `docs/AUDIT_REMEDIATION_PLAN.md` 2.24 (MEDIO) — seguimiento al PR #428  
**Archivo modificado:** `apps/web/app/(app)/worker/materials/page.tsx`

## Hallazgo del Devin Review

En el PR #428, `handleSubmit` agrupó varias condiciones (`!formItem.trim()`, `!formQty`, `qtyNum <= 0`, `!formJobId`, `submitting`) en una sola guarda y siempre mostraba `"La cantidad debe ser un número mayor a 0."`, incluso cuando el error real era que faltaba seleccionar un trabajo o escribir el ítem.

## Solución

Se separaron las validaciones en `handleSubmit` para mostrar un mensaje específico según el campo con problema:

- Si `!formJobId`: `"Selecciona un trabajo antes de enviar la solicitud."`
- Si `!formItem.trim()`: `"Escribe el nombre del material o ítem."`
- Si `!formQty` o cantidad inválida/menor o igual a `0`: `"La cantidad debe ser un número mayor a 0."`
- Si `costNum` es negativo: `"El costo estimado no puede ser negativo."`
- Si `submitting` está activo, simplemente retorna sin mensaje.

## Validación

- `pnpm --filter @semse/web lint` — 0 errores (54 warnings preexistentes)
- `pnpm exec tsc --noEmit --project apps/web/tsconfig.json` — pasa
- `pnpm build:web` — 404/404 páginas estáticas generadas sin errores
- `pnpm test:unit` — 947 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores

## Pendiente

- Verificación en vivo con una sesión de worker para confirmar que cada campo muestra el mensaje correcto al enviar el formulario.
