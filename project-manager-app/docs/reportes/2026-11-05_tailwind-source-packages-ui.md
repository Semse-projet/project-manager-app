# Tailwind no generaba las clases de `packages/ui`

**Fecha:** 2026-11-05 · **Rama:** `claude/tailwind-source-ui` (desde `main` @ `21ecf67`) · **Origen:** recorrido de fallos del 2026-11-05 (capturas de las pantallas con sesión)

## Problema

En todas las pantallas con sesión, la barra lateral y su cabecera tenían una línea casi blanca en lugar del borde sutil del diseño. `AppShell` (en `packages/ui`) usa `border-[color:var(--border)]`, pero el borde salía del color del texto (`rgb(241,245,249)`, `--ink`) porque esa clase no existía en el CSS.

Tailwind v4 sólo escanea la app que lo importa (`apps/web`). Las clases que sólo aparecen en los componentes compartidos de `packages/ui` no se generaban: 21 clases en 6 componentes, entre ellos:

- **AppShell:** borde de la barra lateral y la cabecera, color atenuado de los títulos de sección, fondo translúcido de la barra superior y espaciado de letras;
- **StatCard, EmptyState, JobCard, EscrowTimeline y AgentChatPanel:** espaciado, tamaños, fondos y colores.

Ya pasaba antes de los cambios de paleta: en las capturas del 2026-10-26 se ve la misma línea.

## Cambio

- `apps/web/app/globals.css`: `@source "../../../packages/ui/src";` justo después de `@import "tailwindcss"`.
- `tests/unit/web-tailwind-sources.test.ts`: exige ese `@source`, después del import y sin contar comentarios, y que la ruta exista. Con el CSS de `main` falla.

## Verificación

| Prueba | Resultado |
|---|---|
| Clases de `packages/ui` presentes en el CSS compilado | antes faltaban 21 de 403 usos; después, 0 |
| Borde de la barra lateral (cliente, `/client/jobs`) | antes `rgb(241,245,249)`; después `rgb(31,45,61)` (`--border`) |
| 9 pantallas de cliente, profesional y admin | sin errores de página |
| Tests de estilos web (`web-tailwind-sources`, `web-base-styles-layer`, `web-self-hosted-fonts`) | 8/8 |

Efecto visible esperado: bordes sutiles en la barra lateral, títulos de sección con su espaciado y color atenuado (algunos pasan a dos líneas, como estaba diseñado) y el fondo translúcido de la barra superior.
