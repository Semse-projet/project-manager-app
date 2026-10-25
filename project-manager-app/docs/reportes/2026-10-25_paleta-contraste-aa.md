# Paleta SEMSE en WCAG 2.2 AA (propuesta de diseño)

**Fecha:** 2026-10-25 · **Rama:** `claude/fix-contrast-aa` (desde `main` @ `06dfd7b`) · **Origen:** línea base de contraste del kit (`docs/semse-kit/contrast-baseline.md`, PR #1020) · **Estado:** propuesta; necesita la aprobación de diseño del responsable antes de fusionarse · **CI de GitHub:** bloqueado a nivel de cuenta; la evidencia es local.

## Hallazgo

Según la línea base de #1020, fallaban AA **5 de 20** pares en el tema oscuro y **8 de 20** en el claro:
- texto terciario (`faint`);
- bordes de campos de formulario (`border2`), casi invisibles (1.5:1);
- texto blanco de los botones `.btn-primary` y `.btn-accent`;
- en el tema claro, además, `accent`, `ok`, `warn` e `info` usados como texto.

## Criterio

El cambio mínimo que cumple AA, sin salir de la misma gama:

- **Colores de estado en el tema claro:** se oscurecen un paso de Tailwind (de 600 a 700), la misma regla que `semse-design-tokens` usa para `--brand-dark`/`--ok-dark`. `okBright` baja a 800 para que el degradado `ok → ok-dark` no se aplane.
- **`faint` y `border2`:** se toma el primer tono entre el actual y el siguiente de la gama slate que llega a 4.5:1 (texto) o 3:1 (bordes, WCAG 1.4.11) sobre `base`, `surface` y `raised`.
- **Botones:** `brand` y `accent` no cambian en el tema oscuro (son la identidad de la marca y como texto ya pasan). En su lugar, los botones rellenos usan dos tokens nuevos, `brandFill` y `accentFill`: un paso más oscuros (blue-600 y orange-700), que con texto blanco dan 5.2:1.

## Cambio

| Token | Oscuro: antes → después | Claro: antes → después |
|---|---|---|
| `faint` | `#4b6280` → `#728298` | `#64748b` → `#617087` |
| `border2` (`--border-2`) | `#273548` → `#56667c` | `#c4d0de` → `#7e8da1` |
| `accent` | sin cambio (`#ff6a00`) | `#ea580c` → `#c2410c` |
| `accentDim` | sin cambio | `rgba(234,88,12,.10)` → `rgba(194,65,12,.10)` |
| `ok` / `okBright` (`--ok-dark`) | sin cambio | `#059669`/`#047857` → `#047857`/`#065f46` |
| `warn` | sin cambio | `#d97706` → `#b45309` |
| `info` (`--signal`) | sin cambio | `#0891b2` → `#0e7490` |
| **nuevo** `brandFill` (`--brand-fill`) | `#2563eb` | `#2563eb` |
| **nuevo** `accentFill` (`--accent-fill`) | `#c2410c` | `#c2410c` |

- Archivos:
  - `packages/design-tokens/src/colors.ts`: fuente única de web y móvil;
  - los 4 bloques de `apps/web/app/globals.css`, más `--color-*` en `@theme`;
  - `.btn-primary` y `.btn-accent` usan `var(--brand-fill)` y `var(--accent-fill)` (81 usos de esas clases en la web).
- El móvil recibe los valores nuevos solo, porque `theme.ts` lee `colors.ts` directamente; no toca nada de código móvil.

## Verificación

| Prueba | Resultado |
|---|---|
| `semse-tokens.mjs` + `contrast.py` (kit #1020) sobre la paleta nueva | claro: **20/20 AA**. Oscuro: 18/20; los 2 restantes son «blanco sobre `brand`/`accent`», que ya no es el fondo de los botones |
| Mismos 20 pares midiendo los botones sobre `brandFill`/`accentFill` | **20/20 AA en los dos temas** (botones 5.17:1 y 5.18:1) |
| Test nuevo `tests/unit/design-tokens-contrast.test.ts` | AA calculado desde `colors.ts` (22 pares por tema, incluido `raised`) y sincronía `colors.ts` ↔ los 4 bloques de `globals.css` y `@theme` para los tokens tocados |
| `tsc` y `next build` | 0 errores |

## Fuera de esta propuesta

1. **Botones con estilos en línea.** Hay botones que no usan `.btn-primary`: por ejemplo, el degradado `linear-gradient(135deg, var(--brand), var(--violet))` con texto blanco del login. Siguen por debajo de 4.5:1 en el tema oscuro. Cambiarlos uno a uno es un barrido aparte.
2. **Fallbacks antiguos.** Hay unos 34 `var(--faint, #4b6280)` y similares con el valor viejo como fallback. Sólo se usan si la variable no existe, así que no se ven; se pueden actualizar en un barrido.
3. **Herramienta del kit.** Cuando se fusionen #1020 y este PR, conviene que `PAIRS` de `semse-tokens.mjs` mida los botones sobre `brandFill`/`accentFill`, y regenerar `contrast-baseline.md`.
