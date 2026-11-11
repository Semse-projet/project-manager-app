# Aviso de evidencias del profesional en ES/EN

**Fecha:** 2026-11-05 · **Rama:** `claude/worker-evidence-badge-i18n` (desde `main` @ `21ecf67`) · **Origen:** pendiente anotado en `2026-10-26_resumen-evidencias-profesional.md`

## Problema

El aviso de evidencias del panel del profesional (`WorkerEvidenceSummary`) tenía sus textos escritos en español dentro del componente. Con el panel en inglés seguía diciendo «Evidencia al día — sin items pendientes» o «3 evidencias pendientes».

## Cambio

- 4 claves nuevas en el diccionario central (`lib/language-context.tsx`), en español e inglés:
  - `workerDash.evidenceUpToDate`;
  - `workerDash.evidencePendingOne` y `workerDash.evidencePendingMany` (singular y plural; el número va delante, fuera del texto);
  - `workerDash.evidencePendingHint`.
- El componente usa `useLanguage()` y `t()` con llamadas directas, para que los tests de claves las detecten.
- El componente se añade a la lista de `tests/unit/operational-panels-i18n.test.ts`, que exige que cada clave usada exista en los dos idiomas.

## Verificación

| Prueba | Resultado |
|---|---|
| `operational-panels-i18n`, `worker-evidence-summary`, `validate-critical-i18n` | 34/34 |
| `pnpm quality:i18n` | 0 errores (2 avisos previos: «Error» y «Escrow», iguales en los dos idiomas) |
| `tsc` y eslint de la web | 0 errores |
