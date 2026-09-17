---
name: semse-design-tokens
description: How to safely add, read, or modify a SEMSE design token (colors, and the pattern for a second gradient stop like --brand-dark/--ok-dark) without breaking theme reactivity. Use when touching packages/design-tokens/src/colors.ts, apps/web/app/globals.css color blocks, apps/mobile/src/theme, or investigating a "wrong color in dark/light theme" bug.
---

# SEMSE design tokens — colors.ts ↔ globals.css ↔ mobile theme.ts

## The three files that must move together

1. **`packages/design-tokens/src/colors.ts`** — the canonical `ColorPalette` type plus `darkColors`/`lightColors` objects. This is the single source of truth for **both** web and mobile (there is no CSS in React Native).
2. **`apps/web/app/globals.css`** — the same values duplicated as CSS custom properties, by hand, in **4 separate blocks**:
   - the default `@theme` block (dark — this is the app's default theme)
   - `:root[data-theme="light"]`
   - `.public-theme` (light, for marketing/onboarding pages regardless of app theme)
   - `html[data-theme="dark"] .public-theme` (dark override of `.public-theme`)
3. **`apps/mobile/src/theme/theme.ts`** — consumes `darkColors`/`lightColors` from `colors.ts` directly (`buildTheme(darkColors)`/`buildTheme(lightColors)`). It does **not** reconstruct the palette object, so adding a field to `ColorPalette` never requires a mobile-side edit — but *removing or renaming* one does.

There is no build step or lint rule that keeps `colors.ts` and `globals.css` in sync — a change to one without the other is a silent bug, and this has already happened (see `--brand-dark` below, which existed in `globals.css` for months before anyone used it correctly).

## Adding a new "bright" second-stop token (the `--brand-dark`/`--ok-dark` pattern)

Some two-color gradients (`linear-gradient(135deg, var(--x), <second-stop>)`) need a second stop that isn't the same as `--x` itself, or the gradient collapses to a flat color in whichever theme has `var(--x) == <second-stop>`. The existing, working pattern for this (discovered by reverse-engineering `--brand-dark` in a prior session) is:

- `--brand-dark` in `globals.css` is **exactly** the `brandBright` field of `colors.ts` — dark theme `#60a5fa` is one Tailwind step *lighter* than `--brand`'s `#3b82f6` (blue-500→blue-400); light theme `#1d4ed8` is one step *darker* than `--brand`'s `#2563eb` (blue-600→blue-700).
- Applying the identical rule to `--ok` (`#10b981` dark = emerald-500, `#059669` light = emerald-600) produced `okBright`/`--ok-dark`: `#34d399` dark (emerald-400), `#047857` light (emerald-700).

**When you need a new `--x-dark` token**, don't invent a color: find `--x`'s hex in the Tailwind palette (500/600 is the usual dark/light pair here), take one step lighter for the dark-theme value and one step darker for the light-theme value, add `xBright` to `ColorPalette` in `colors.ts` (both `darkColors` and `lightColors`), then add `--x-dark:` to all 4 blocks in `globals.css` right after the existing `--x:` line.

## Diagnosing "wrong color in dark/light theme" bugs

This is almost always one of two directions, and they are **not symmetric in severity**:

- **Dark hex hardcoded as a literal** (e.g. `"#2563eb"` instead of `var(--brand)`): wrong only in light theme, since it happens to equal the dark value.
- **Light hex hardcoded as a literal**: wrong in dark theme — worse, because dark is this app's *default* theme, so most users see the bug.

To check which token a bare hex duplicates, grep `packages/design-tokens/src/colors.ts` for the exact hex (case-insensitive) in both `darkColors` and `lightColors` — a match tells you the real token and which theme is "wrong."

## The safe-fix heuristic for `#hex` → `var(--token)` sweeps

Built up over several remediation passes on this exact codebase (see `docs/AUDIT_REMEDIATION_PLAN.md` item 1.16 for the full history). A bare literal is a **genuine duplicate worth fixing** only if ALL of:

1. It matches a token's hex **exactly** (not close, not a different shade).
2. It is **not** mixed with other non-token hex values in the same object/array/ternary — a categorical/status/severity/tier map with several arbitrary decorative hues (even if one happens to coincide with a token) is a deliberate palette, not a slipped-in duplicate. The tell: if 2+ *other* entries in the same map are non-token custom hexes, treat the whole map as decorative and leave it.
3. It is **not** inside a `<canvas>` 2D context (`ctx.strokeStyle`/`ctx.fillStyle`) — these never resolve CSS `var()`.
4. It is **not** already the `var(--token, #hexFallback)` pattern — that's the *correct* form (a CSS fallback), not a bug.
5. It is **not** in a self-contained "immersive"/experimental console page with its own deliberately fixed palette (seen so far: `admin/semse-x`, `admin/vision`, `admin/developer-runtime`'s terminal-log renderer, parts of `admin/consciousness`/`admin/agents`/`admin/autonomy`).
6. It is **not** in a public/marketing/legal/onboarding page (`login`, `register`, `forgot`/`reset-password`, `(public)/*`, `components/landing/*`, `components/project-intake/*`) or a printable document view (invoice PDFs) — these are intentionally fixed-light regardless of app theme.
7. **Positive signal, not just absence of the above**: the literal sits beside an already-tokenized `var(--x)` sibling doing the equivalent job in the same object/array/ternary/component (e.g. a status map where 6 of 7 entries already use `var(--warn)`/`var(--ok)`/etc. and only one is a bare hex that matches a token exactly), or the same file already uses `var(--muted)`/`var(--faint)`/etc. everywhere else and only one line was missed.

**One more failure mode found the hard way**: even a confirmed genuine duplicate can be unsafe to tokenize if the same value is reused elsewhere in the file concatenated with a hex alpha suffix to build a translucent background/border — e.g. `` `${meta.color}30` `` or `` `${tierMeta.color}22` ``. `var(--token)30` is not valid CSS. **Before editing any status-map color, grep the file for the object/variable name followed by `.color` (or the field name) and check for a template-literal concatenation** — if found, leave that map's literal alone regardless of how clean a match it is. `CLIENT_TIER.nuevo` in `client/dashboard/page.tsx` was tried and reverted for exactly this reason.

## Notas para futuros agentes / hallazgos abiertos

- **No hay lint/CI check que detecte el desfase `colors.ts` ↔ `globals.css`.** Sería el ROI más alto de todos: un script que parsee ambos y falle si un valor difiere sería mucho más barato que otra ronda de auditoría manual. No se construyó en esta sesión — quedó fuera de alcance, pero es la sugerencia #1 si alguien tiene tiempo para una herramienta nueva.
- **Volumen real medido pero no agotado**: al cierre de la última pasada (2026-09-17), `--muted`/`--faint` tenían ~150+61 apariciones bare revisadas casi por completo (19 fixes reales encontrados, el resto categórico/decorativo/inseguro-por-concat). `--ink` está cerrado. No se hizo una pasada final exhaustiva de `--warn`/`--error`/`--info`/`--violet` con este mismo nivel de detalle — probablemente tengan menos residuo (fueron el sweep original), pero no está confirmado al 100%.
- **Gradiente `--ok-dark` ya resuelto** (PR #638) — si aparece un nuevo caso `linear-gradient(135deg, var(--x), <hex-claro-de-x>)` para un token sin su "bright" pareja, replicar el mismo método (un paso Tailwind, no inventar).
- Si se agrega un token nuevo a `ColorPalette` que el mobile SÍ necesita usar activamente (no solo heredar), revisar `apps/mobile/src/theme/theme.ts` — hoy es un passthrough simple, pero no hay garantía de que siga siéndolo.
