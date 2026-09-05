# Remediación 1.14 — Persistencia del borrador del wizard "Publicar trabajo"

**Fecha:** 2026-07-23  
**Ítem del plan:** `docs/AUDIT_REMEDIATION_PLAN.md` 1.14 (MEDIO)  
**Archivos modificados:**
- `apps/web/lib/job-intake.ts`
- `apps/web/app/(app)/client/jobs/new/page.tsx`

## Hallazgo original

El wizard de publicación de trabajo (`/client/jobs/new`) perdía el 100% del progreso al refrescar la página. No existía guardado de borrador local; solo persistía un `intakeId` cuando venía de la landing, pero un usuario que empezara el wizard desde cero y recargara perdía categoría, descripción, presupuesto, etc.

## Solución

Se agregó un borrador local en `localStorage` bajo la clave `semse-job-wizard-draft`.

### Helpers en `lib/job-intake.ts`

- `saveJobWizardDraft(draft)` — serializa el borrador con `JSON.stringify` y tolera errores de `localStorage`.
- `loadJobWizardDraft()` — parsea y valida los campos, normalizando enum values (`locationType`, `budgetType`, `urgency`) y revirtiendo a defaults seguros si el JSON está corrupto.
- `clearJobWizardDraft()` — elimina la clave.
- Nuevo tipo exportado `JobWizardDraft` para tipado interno.

### Cambios en `client/jobs/new/page.tsx`

1. **Restauración al montar:** un `useEffect` ejecutado una sola vez carga el borrador si no hay un `intakeId`, `getPersistedIntakeId()` ni datos de prefill en la URL. Recupera `step` y todos los campos editables, y muestra un banner verde (`draftRecovered`).
2. **Guardado automático:** un segundo `useEffect` con debounce de 500 ms persiste el borrador cada vez que cambia algún campo relevante (`step`, `categoryId`, `subcategoryId`, `title`, `description`, `locationType`, `city`, `budgetType`, `budgetMin`, `budgetMax`, `urgency`, `deadline`). Usa una referencia (`isInitialDraftSave`) para evitar guardar el estado inicial vacío antes de la primera interacción.
3. **Limpieza al publicar:** `handleSubmit` ahora llama a `clearJobWizardDraft()` tras una publicación exitosa, evitando que un borrador obsoleto reaparezca.
4. **No se persisten archivos:** los `File` seleccionados en el paso 2 no se guardan en `localStorage` (no son serializables); el resto del formulario se recupera.

## Validación

- `pnpm --filter @semse/web lint` — 0 errores (54 warnings preexistentes).
- `pnpm typecheck` — pasa.
- `pnpm build:web` — 402/402 páginas estáticas generadas sin errores.
- `pnpm test:unit` — 944 pass / 0 fail.
- `pnpm spec:validate:strict` — 0 errores.

## Limitaciones / pendientes

- **Verificación en vivo pendiente:** no se pudo probar con una sesión real de cliente en el navegador por falta de credenciales/cookie de sesión. El fix es puramente client-side y puede validarse abriendo `/client/jobs/new`, llenando pasos 1-3, refrescando y confirmando que el paso y los campos se restauran.
- Si un usuario inicia el wizard desde una URL de landing con `intakeId` o `category`, el borrador local se ignora a favor del prefill/intake, para no sobreescribir datos provenientes de otra fuente.
