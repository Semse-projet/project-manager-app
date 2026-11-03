# Línea base de contraste WCAG — paleta SEMSE

**Medido:** 2026-10-20 sobre `packages/design-tokens/src/colors.ts` en la rama `claude/replica-skill-repo-bpdobu` (paleta idéntica a `main` en `06dfd7b`). **Herramientas:** `semse-release-gate/scripts/semse-tokens.mjs` + `contrast.py`. **Umbrales WCAG 2.2 AA:** texto normal 4.5:1, texto grande 3:1, bordes y componentes de interfaz (`ui`) 3:1.

Esto es un **hallazgo**, no un cambio: este PR no toca colores. Corregirlo es un cambio de diseño que debe mover juntos `colors.ts`, los 4 bloques de `apps/web/app/globals.css` y el tema móvil (`semse-design-tokens`). Mientras tanto, `semse-release-gate` sólo bloquea pares **nuevos** por debajo de AA o ratios que **empeoren** respecto a esta tabla.

## Tema oscuro (por defecto): 5 de 20 pares fallan AA

| Par | Ratio | Necesita | Nota |
|---|---|---|---|
| `faint` (#4b6280) sobre `base` | 3.20 | 4.5 | texto de ayuda o terciario |
| `faint` sobre `surface` | 3.05 | 4.5 | |
| blanco sobre `brand` (#3b82f6) | 3.68 | 4.5 | texto de `.btn-primary`; pasa sólo como texto grande |
| blanco sobre `accent` (#ff6a00) | 2.87 | 4.5 | texto de `.btn-accent` |
| `border2` sobre `surface` | 1.53 | 3.0 (ui) | borde de inputs: casi invisible |

## Tema claro: 8 de 20 pares fallan AA

| Par | Ratio | Necesita | Nota |
|---|---|---|---|
| `faint` (#64748b) sobre `base` | 4.43 | 4.5 | por muy poco |
| `accent` (#ea580c) sobre `base` | 3.31 | 4.5 | si se usa como texto |
| `accent` sobre `surface` | 3.56 | 4.5 | |
| `ok` (#059669) sobre `surface` | 3.77 | 4.5 | si se usa como texto de estado |
| `warn` (#d97706) sobre `surface` | 3.19 | 4.5 | |
| `info` (#0891b2) sobre `surface` | 3.68 | 4.5 | |
| blanco sobre `accent` | 3.56 | 4.5 | texto de `.btn-accent` |
| `border2` sobre `surface` | 1.56 | 3.0 (ui) | borde de inputs |

## Supuestos

Los pares vienen de `PAIRS` en `semse-tokens.mjs` y aproximan el uso real. Antes de corregir un color de estado (`ok`, `warn`, `info`), hay que confirmar si se usa como **texto** sobre `surface` o sólo como fondo de chip con texto `ink`. En el segundo caso, el par correcto es otro y puede que ya pase.

## Reproducir

```bash
cd project-manager-app
node --experimental-strip-types .claude/skills/semse-release-gate/scripts/semse-tokens.mjs --theme dark --out /tmp/semse-dark.json
python3 .claude/skills/semse-release-gate/scripts/contrast.py /tmp/semse-dark.json
```
