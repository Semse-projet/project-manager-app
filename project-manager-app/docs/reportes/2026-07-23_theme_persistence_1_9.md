# Reporte — Remediación 1.9: Persistencia del tema claro/oscuro

**Fecha:** 2026-07-23  
**Repositorio:** Semse-projet/project-manager-app  
**Ítem:** `docs/AUDIT_REMEDIATION_PLAN.md` — Sección 1, ítem 1.9 (MEDIO)  
**Autor:** Devin

## Problema

El selector de tema claro/oscuro del `Topbar` solo persistía dentro de una sesión de navegación SPA. Al refrescar la página o acceder directamente a una URL (por ejemplo, desde un bookmark), la selección se perdía y el sitio volvía al tema oscuro por defecto.

Causa técnica en `apps/web/app/(app)/layout.tsx`:

- `useState<ThemePreference>("dark")` inicializaba siempre en `"dark"`.
- Existía un `useState(() => { ... })` mal formado (sin asignación) que intentaba leer `localStorage` y llamar `setTheme`, pero no impactaba el estado inicial y no aplicaba `data-theme` al `documentElement` en el primer render.
- `handleThemeChange` escribía `localStorage` y `data-theme`, pero ningún efecto restauraba esos valores al montar el layout.

## Solución

- Se reemplazó el `useState` mal formado por dos `useEffect` claros:
  1. Al montar, lee `semse-theme` de `localStorage`; si es `"dark"` o `"light"`, actualiza el estado.
  2. Cada vez que `theme` cambia, aplica `document.documentElement.dataset.theme = theme` y persiste el valor en `localStorage`.
- `handleThemeChange` ahora solo actualiza el estado; la persistencia y la aplicación del atributo `data-theme` quedan centralizadas en el efecto dedicado.

## Archivos modificados

- `apps/web/app/(app)/layout.tsx`
  - Agregado `useEffect` al import de React.
  - Reemplazado el `useState` sin asignación por lógica de montaje y sincronización.
  - Simplificado `handleThemeChange`.
- `docs/AUDIT_REMEDIATION_PLAN.md`
  - Marcado 1.9 como `[x] Corregido` con nota de verificación pendiente en vivo.

## Validación

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter @semse/web lint` | 0 errores, 54 warnings preexistentes |
| `pnpm typecheck` | Pasa |
| `pnpm build:web` | Pasa (402/402 páginas estáticas generadas) |
| `pnpm test:unit` | 944 pass / 0 fail |
| `pnpm spec:validate:strict` | 0 errores |

## Notas y riesgos

- La corrección evita el mismatch de hidratación al no leer `localStorage` durante el render inicial; el tema se aplica en el cliente tras el montaje. Esto puede producir un breve flash del tema oscuro por defecto si el usuario tenía guardado el tema claro, hasta que el efecto se ejecute. Para eliminar completamente ese flash sería necesario inyectar un script sincrónico en `<head>` antes del primer paint, lo que se deja como mejora futura.
- Queda **pendiente verificación en vivo** para confirmar que el selector del `Topbar` refleja el tema guardado y que navegar/refresh no lo resetea.
