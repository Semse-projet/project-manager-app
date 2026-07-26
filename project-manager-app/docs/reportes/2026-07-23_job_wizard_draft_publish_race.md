# Seguimiento 1.14 — Cancelar debounce del borrador al publicar trabajo

**Fecha:** 2026-07-23  
**Ítem del plan:** `docs/AUDIT_REMEDIATION_PLAN.md` 1.14 (MEDIO) — seguimiento  
**Archivo modificado:** `apps/web/app/(app)/client/jobs/new/page.tsx`

## Hallazgo del Devin Review

El wizard "Publicar trabajo" guarda el borrador automáticamente con un `setTimeout` de 500 ms. Si el usuario llega al paso de revisión y publica inmediatamente, el temporizador pendiente podía dispararse **después** de `clearJobWizardDraft()` en `handleSubmit`, resucitando el borrador en `localStorage` con los datos de un trabajo ya publicado. Al volver a abrir el wizard, el efecto de restauración cargaría ese borrador obsoleto.

## Solución

- Se agregó `draftSaveTimeoutRef` para rastrear el `setTimeout` activo del guardado.
- Se agregó `hasPublishedRef` para marcar que la publicación ya fue exitosa.
- El efecto de guardado:
  - No programa un nuevo timeout si `hasPublishedRef.current` es `true`.
  - Cancela el timeout anterior antes de programar uno nuevo.
  - Dentro del callback del timeout verifica nuevamente `hasPublishedRef.current` antes de llamar `saveJobWizardDraft`.
- En `handleSubmit`, inmediatamente después de confirmar respuesta exitosa del backend:
  - Se asigna `hasPublishedRef.current = true`.
  - Se cancela `draftSaveTimeoutRef.current`.
  - Después se ejecuta `clearPersistedIntakeId()` y `clearJobWizardDraft()`.

Esto evita cualquier guardado tardío tanto en el mismo render como en callbacks pendientes del desmontaje.

## Validación

- `pnpm --filter @semse/web lint` — 0 errores (54 warnings preexistentes)
- `pnpm exec tsc --noEmit --project apps/web/tsconfig.json` — pasa
- `pnpm build:web` — 402/402 páginas estáticas generadas sin errores
- `pnpm test:unit` — 944 pass / 0 fail
- `pnpm spec:validate:strict` — 0 errores

## Pendiente

- Verificación en vivo con una sesión real de cliente para confirmar que publicar un trabajo no deja un borrador residual en `localStorage`.
