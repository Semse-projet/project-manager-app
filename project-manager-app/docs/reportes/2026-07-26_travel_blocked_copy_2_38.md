# Remediación 2.38 — Copy confuso en bloqueo de liquidación de viaje

**Fecha:** 2026-07-26  
**Ítem del plan:** `docs/AUDIT_REMEDIATION_PLAN.md` 2.38 (BAJO)  
**Archivos modificados:**
- `apps/web/app/(app)/worker/travel/page.tsx`
- `apps/web/app/(app)/worker/travel/[travelId]/page.tsx`

## Hallazgo original

El mensaje de bloqueo de liquidación de viajes decía `"sin hospedaje requerido"`, que literalmente se lee como "el hospedaje no es requerido", lo opuesto a lo que se intentaba comunicar: "falta el hospedaje que sí es requerido". El texto aparecía en el listado de viajes y en el detalle de un viaje.

## Solución

Se reemplazó `"sin hospedaje requerido"` por `"falta el hospedaje requerido"` en ambos archivos, eliminando la ambigüedad semántica.

## Validación

- `pnpm --filter @semse/web lint` — 0 errores (54 warnings preexistentes)
- `pnpm exec tsc --noEmit --project apps/web/tsconfig.json` — pasa
- `pnpm build:web` — 402/402 páginas estáticas generadas sin errores
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores

## Pendiente

- Verificación en vivo con datos reales de viaje para confirmar que el mensaje se muestra correctamente cuando `requiresLodging === true` y no hay registros de hospedaje.
