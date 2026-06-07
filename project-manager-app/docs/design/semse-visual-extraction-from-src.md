# SEMSE Visual System — Extracción desde src/

**Fecha:** 2026-04-27

## El viejo dialecto visual (src/)

`src/index.css` definía un dark theme con CSS custom properties:

```css
--background: 0 0% 100% (light) / 222.2 84% 4.9% (dark = #1a1d24)
--primary: 262.1 83.3% 57.8%   ← Purple premium
--ring:    262.1 83.3% 57.8%   ← Purple ring
--success: 142.1 76.2% 36.3%   ← Green
--warning: 38 92% 50%          ← Amber
```

**Paleta hard-coded en componentes:**
- Fondo card: `#1a1d24` (navy azulado suave)
- Borde: `#2a2d35` (gris cálido)
- Texto primario: `#f7f8fa`
- Texto muted: `#94979e`
- Acento naranja: `#ff6a00 → #ff8c00` (gradient)

**Temperatura visual:** Cálida, premium, "acogedora".

---

## El dialecto actual (project-manager-app)

`apps/web/app/globals.css` usa Tailwind v4 `@theme`:

```css
--color-brand:   #3b82f6   ← Azul (reemplazó al púrpura)
--color-accent:  #ff6a00   ← Naranja (CONSERVADO ✓)
--color-base:    #050810   ← Negro profundo frío
--color-surface: #0c1017
--color-raised:  #111827
--color-overlay: #1a2333
--color-border:  #1f2d3d   ← Azul acero
--color-ink:     #f1f5f9
--color-muted:   #94a3b8
```

**Temperatura visual:** Fría, técnica, "seria".

---

## Lo que se conservó del viejo sistema

| Token | Valor | Estado |
|---|---|---|
| Naranja de acción `#ff6a00` | Idéntico en ambos sistemas | ✅ **ADN visual de SEMSE** |
| Gradient naranja `from-[#ff6a00] to-[#ff8c00]` | Usado en botones CTAs del nuevo sistema | ✅ Conservado |
| Green `#10b981` para éxito | Equivalente a `--color-ok: #10b981` | ✅ Conservado |
| Amber warning | Equivalente a `--color-warn: #f59e0b` | ✅ Conservado |
| Red error | Equivalente a `--color-error: #ef4444` | ✅ Conservado |

## Lo que cambió conscientemente

| Aspecto | Viejo | Nuevo | Razón |
|---|---|---|---|
| Color brand | Púrpura `262.1 83.3%` | Azul `#3b82f6` | Más neutral/profesional para B2B |
| Fondo base | `#1a1d24` (navy cálido) | `#050810` (negro frío) | Mayor contraste, jerarquía de 4 capas |
| Sistema de tokens | CSS vars via HSL | `@theme` Tailwind v4 + tokens semánticos | Más potente y consistente |
| Bordes | `#2a2d35` (gris cálido) | `#1f2d3d` (azul acero) | Coherente con brand azul nuevo |

## Colores por agente (canónicos en packages/agents)

Los 16 agentes tienen colores definidos en `NAMED_AGENTS`:

| Agente | Color |
|---|---|
| assistant (SEMSE) | `#3b82f6` |
| marta (Proyectos) | `#10b981` |
| planner | `#8b5cf6` |
| felix (Campo) | `#f59e0b` |
| escrow (Pagos) | `#ff6a00` |
| justus (Contratos) | `#06b6d4` |
| vesper (Riesgo) | `#ec4899` |
| security | `#ef4444` |
| pulse (Analytics) | `#22d3ee` |
| binary (API) | `#a3e635` |
| evidence_coach | `#fbbf24` |

## Problemas a evitar

1. **Overlays transparentes sobre texto muted** — en el viejo sistema `#94979e` sobre `#1a1d24` tiene ~3.5:1 ratio (borderline AA). En el nuevo `#94a3b8` sobre `#050810` está en ~4.8:1. No degradar.

2. **Glassmorphism excesivo** — el viejo app usaba `bg-white/5` + `border-white/10` en algunos badges que eran casi invisibles sobre fondos muy oscuros. Usar siempre `text-ink` o colores semánticos claros.

3. **Double chat launcher** — el AgentBubble y el panel no deben abrirse simultáneamente en rutas que ya tienen un panel de copiloto fijo. Controlar con estado compartido.

## Recomendación de síntesis

El sistema actual es superior. No mezclar dialectos.
El naranja `#ff6a00` es el ADN visual de SEMSE — conservar siempre.
