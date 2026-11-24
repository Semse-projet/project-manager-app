# Corte documental de código — 2026-11-24

## Resumen

Se alinearon `docs/SEMSE_CONTEXT.md`, `docs/architecture/CURRENT_ARCHITECTURE.md`, `docs/architecture/IMPLEMENTATION_STATUS_MATRIX.md`, `ROADMAP.md` y `docs/SPEC_INDEX.md` con `main` `594279afefad1fe760b94ec84c2cee382281ceb1` (PR #1169). La producción no se consultó. El PR abierto #1142 no se fusionó ni se copió su runbook.

## Checklist final

- Código de `main` contrastado: apps (incluido `apps/mobile` Expo `~57.0.34`), módulos de los nueve dominios, flags por defecto, ancestros de F3/F4/F10 y el registro de tools (41 descriptores).
- Producción marcada como no re-verificada desde 2026-10-03 (lectura Railway de la matriz) y, para el inventario de #1142, desde 2026-11-12.
- `ui.mobile-product-consolidation` pasa a `merge_status: MERGED` con gates de dispositivo/tienda sin re-ejecutar.
- `spec:index` regenerado. `node ./scripts/spec-validate.mjs --strict`: 219 specs, 0 errores, 0 warnings, en este checkout.

## Evidencia

- `git merge-base --is-ancestor` para `afb2dccd`, `f1234291`, `a42600ec`, `8e0ad1e3`, `500bebc7`, `6040d75e`, `41eca604`, `66314be2`, `7029da63`.
- No hay commit en `main` cuyo mensaje cite #1141 o #1144.
- `node ./scripts/spec-index.mjs --check` válido (219 specs). `node ./scripts/spec-validate.mjs --strict`: Errors 0, Warnings 0.
- No se llamó a Railway, no se leyó el valor de variables de producción y no se ejecutó EAS.

## Siguientes pasos

- Releer Railway antes de afirmar SHA desplegado, canary F3/F4 o el valor de los flags.
- Decidir el merge humano de #1142 aparte de este corte: su backlog sigue siendo la lista operativa de activación.
- El strict local no sustituye el CI del PR. Si el job falla, no reetiquetar este 0/0 como el resultado de GitHub.
