---
name: semse-release-gate
description: Validar un PR de SEMSE antes de pedir revisión humana, comprobando contratos, traducciones ES/EN, seguridad, contraste WCAG de la paleta real, migraciones y regresiones con evidencia reproducible, y emitir un veredicto BLOCKED, UNVERIFIED o READY_FOR_HUMAN_REVIEW. Nunca fusiona, aprueba, despliega ni activa flags o pagos; el despliegue se delega en semse-railway-release-verification.
routing:
  version: 1
  category: support
  scope:
    - pr_quality_gate
    - change_validation
    - accessibility_contrast
  triggers:
    - release gate
    - validar cambios
    - validar el pr
    - gate de calidad
    - checklist antes de merge
    - contraste wcag
    - contrast check
    - no rompe nada
  excludes:
    - railway
    - canario
    - github billing
    - actions budget
  phases:
    - verification
  precedence:
    subordinate_to: [semseproject, semse-ci-pr-workflow, semse-railway-release-verification]
  specificity: 60
  status: experimental
  notes: Parte del kit de calidad SEMSE (docs/semse-kit/). Adaptada del preflight de replica-deploy y del contraste de replica-design, sin su parte de despliegue.
---

# semse-release-gate — validar un cambio antes de pedir revisión

Cuarta pieza del **kit de calidad SEMSE** (`docs/semse-kit/README.md`). Toma la idea del *preflight* de `replica-deploy` (“cualquier fallo detiene”) y la herramienta `contrast.py` de `replica-design`, ambos del pack MIT `Jakeschincariol/replica-skill` (commit `77c9436`). De `replica-deploy` **no** se adoptó nada de despliegue, DNS, Stripe en modo live ni hosting.

## Relación con lo que ya existe (no reemplaza nada)

| Necesidad | Quién manda |
|---|---|
| Qué comprueban `quality-gates`, `unit-coverage` y `e2e`, squash y preflight | `semse-ci-pr-workflow` |
| Presupuesto de Actions, `startup_failure` y costos | `semse-github-operations-cost-guard` |
| SHA desplegado, migración, canario y rollback en Railway | `semse-railway-release-verification` |
| Hallazgos de dinero, autenticación y aislamiento | `semse-audit-remediation`, `semse-security-baseline` |
| **Este kit** | reunir las comprobaciones locales de un PR en un veredicto con evidencia |

## Autoridad y límites

- Antes de actuar, leer `project-manager-app/AGENTS.md` y `docs/semse-kit/security-rules.md`.
- **Nunca** fusiona, aprueba, despliega, cambia variables o secretos, activa feature flags, mueve dinero ni re-ejecuta CI para “ponerlo verde”. Un veredicto `READY_FOR_HUMAN_REVIEW` es una recomendación, no una autorización.
- No modifica workflows de `.github/workflows/`. Conectar este gate a GitHub Actions es la fase 4 del kit (`docs/semse-kit/README.md`) y exige autorización expresa (regla NUNCA de `AGENTS.md` sobre CI/CD).

## Comprobaciones

Ejecutar desde `project-manager-app/` las que apliquen según los archivos del diff. Si una no se puede ejecutar en el entorno, se registra como `UNVERIFIED` con el motivo.

| # | Comprobación | Aplica si el diff toca… | Comando |
|---|---|---|---|
| 1 | Lint y tipos | cualquier `.ts/.tsx` | `pnpm lint`, `pnpm typecheck` |
| 2 | Unitarios | siempre | `pnpm test:unit`, `pnpm --filter @semse/api test:unit` |
| 3 | Contratos y spec | `docs/specs/**`, `packages/schemas/**` | `pnpm spec:validate:strict` |
| 4 | Migraciones | `packages/db/prisma/schema.prisma` | existe migración nueva en `packages/db/prisma/migrations/` y `pnpm db:generate` pasa (`semse-prisma-workflow`) |
| 5 | ES/EN | `apps/web/**` con texto visible, `language-context.tsx` | `node --experimental-strip-types --test tests/unit/operational-panels-i18n.test.ts tests/unit/contributor-i18n-keys.test.ts`; cada clave nueva existe en `es` y en `en` |
| 6 | Seguridad | controladores, BFF, `rbac.ts`, pagos | checklist de `semse-security-baseline`: ownership/tenant en lecturas y escrituras, sin IDOR, estado de pago verificado en servidor, sin secretos en el diff |
| 7 | Contraste WCAG | `packages/design-tokens/**`, bloques de color de `globals.css` | ver abajo |
| 8 | Funcional | flujos con UI | specs relevantes de `tests/e2e-semse/` (`semse-functional-test`) |
| 9 | Paridad | si hay una matriz de `semse-parity-audit` para el módulo | `parity.py --fail-under <umbral acordado>`; ningún must-have pasa de `yes` a otro estado |

### Contraste de la paleta real

```bash
node --experimental-strip-types .claude/skills/semse-release-gate/scripts/semse-tokens.mjs --theme dark  --out /tmp/semse-dark.json
node --experimental-strip-types .claude/skills/semse-release-gate/scripts/semse-tokens.mjs --theme light --out /tmp/semse-light.json
python3 .claude/skills/semse-release-gate/scripts/contrast.py /tmp/semse-dark.json
python3 .claude/skills/semse-release-gate/scripts/contrast.py /tmp/semse-light.json
```

`semse-tokens.mjs` lee `packages/design-tokens/src/colors.ts` (la fuente que usan web y mobile) y añade los pares de texto y fondo que la UI usa de verdad. Antes de exportar, compara la paleta con los bloques de `apps/web/app/globals.css` de los que se transcribe (`:root` para oscuro y `:root[data-theme="light"]` para claro). Si difieren, sale con código 1 sin exportar: la web pinta esas variables CSS, no `colors.ts`, y medir el contraste de unos tokens desfasados daría un resultado falso. Los bloques `.public-theme` tienen su propia paleta y no se comprueban. La paleta actual **ya tiene fallos AA** (5 en oscuro y 8 en claro), registrados en `docs/semse-kit/contrast-baseline.md`. Mientras no se corrijan, el gate **falla sólo si aparece un par nuevo por debajo de AA o si empeora el ratio de uno de la línea base**. Corregir la línea base es un cambio de diseño en tres archivos (`semse-design-tokens`), no algo que este gate haga por su cuenta.

## Veredicto

- `BLOCKED`: alguna comprobación aplicable falla, o hay un S1/S2 abierto de `semse-functional-test`.
- `UNVERIFIED`: ninguna falla, pero alguna aplicable no se pudo ejecutar (entorno, CI bloqueado por presupuesto, falta de credenciales de prueba).
- `READY_FOR_HUMAN_REVIEW`: todas las aplicables se ejecutaron y pasaron.

Ninguno de los tres significa CI verde, merge, desplegado ni activado (`semse-ci-pr-workflow`, `semse-railway-release-verification`).

## Evidencia

Una tabla en el cuerpo del PR o en el reporte de sesión: `# | comprobación | comando | SHA | exit code | resumen (n passed / n failed) | ruta de log o trace`. Si falla, extracto del error. Sin secretos ni datos personales.

## Notas para futuros agentes

- Los pares de `semse-tokens.mjs` son una aproximación razonable del uso real (por ejemplo, `ok/warn/info` como texto sobre `surface`). Si un color de estado se usa sólo como fondo de chip con texto `ink`, ese par debe cambiar en el script, no ignorarse.
- `.btn-primary` y `.btn-accent` usan `color: #fff` fijo en `globals.css`, no un token. Por eso el exportador define `onFill`.
- El validador automático de catálogos críticos ES/EN (`scripts/quality/validate-critical-i18n.ts`) es la fase 3 del kit y aún no existe; hasta entonces la comprobación 5 se apoya en los tests de claves existentes y en revisión del diff.
