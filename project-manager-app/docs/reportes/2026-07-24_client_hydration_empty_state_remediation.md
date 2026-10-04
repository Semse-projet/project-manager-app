# Hidratación y estado vacío de Cliente — 2026-07-24

## Alcance

Se cerraron los hallazgos `1.8` y `1.9` de
`docs/AUDIT_REMEDIATION_PLAN.md`:

- React emitía el error de hidratación `#418`, observado en
  `/client/milestones`;
- la pantalla dejaba un panel alto sin contenido cuando la respuesta válida no
  contenía hitos;
- tema claro/oscuro no se restauraba de forma confiable al refrescar o abrir una
  URL directa.

## Causa raíz

El layout autenticado generaba markup dependiente del entorno durante el primer
render:

- `collapsed` consultaba `localStorage` en el initializer de `useState`; SSR
  siempre obtenía `false`, pero el navegador podía renderizar `true` antes de
  hidratar;
- otro initializer de `useState` leía `semse-theme` y llamaba `setTheme` durante
  render.

Esto permitía que el árbol del sidebar y sus labels no coincidiera entre el HTML
del servidor y el primer render del cliente. Independientemente, la rama
`groups=[]` de milestones no tenía estado vacío.

## Implementación

- Sidebar y tema parten ahora de defaults deterministas.
- `useEffect` restaura `semse-sidebar-collapsed` y `semse-theme` después de
  hidratar.
- El tema persistido actualiza el estado del selector y
  `document.documentElement.dataset.theme`.
- `/client/milestones` distingue explícitamente `loading`, `error`, `empty` y
  `ready`.
- El estado vacío explica cuándo aparecerán los hitos y ofrece el enlace
  “Ver mis proyectos”.

La guía de App Router condujo el cambio: el primer render debe ser estable entre
servidor y cliente, y los accesos a APIs del navegador se ejecutan después del
mount.

## Verificación

- `node --experimental-strip-types --test tests/unit/client-milestones-hydration.test.ts`
  — 3/3.
- `node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json`
  — typecheck limpio.
- `node scripts/spec-validate.mjs --strict`
  — 104 specs, 0 errores y 0 warnings.
- `node scripts/audit-plan-spec-coverage.mjs`
  — 157/157 items mapeados, 0 faltantes y 0 extras.
- `corepack pnpm --filter @semse/web lint`
  — 0 errores; 54 warnings preexistentes.
- `corepack pnpm --filter @semse/web build`
  — compilación y typecheck correctos; 402 páginas generadas.

## Estado operativo

No se hizo push ni deploy. Sigue pendiente una comprobación manual después del
despliegue con tema claro persistido y una cuenta CLIENT sin milestones.
